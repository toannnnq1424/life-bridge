param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$evidenceRoot = Join-Path $root ".lifebridge-local\p5-s3-level-c"
$marker = Join-Path $root ".lifebridge-local\p5-s3-level-c-invoked.json"
$ledger = Join-Path $evidenceRoot "ledger.jsonl"
$acceptedBase = "ed328f6806f1ed082708e7c84367eda6bb1bb2da"
$invocationId = [Guid]::NewGuid().ToString("N")
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$maven = if ($env:OS -eq "Windows_NT") { ".\mvnw.cmd" } else { "./mvnw" }

if (Test-Path -LiteralPath $marker) {
  throw "P5-S3 Level C was already invoked locally; retain evidence and use targeted recovery only."
}

$branch = (& git branch --show-current | Out-String).Trim()
$head = (& git rev-parse HEAD | Out-String).Trim()
$hosted = $env:GITHUB_ACTIONS -eq "true"
if (-not $hosted -and $branch -ne "phase/5-moderation-resolution") { throw "P5-S3 Level C requires the canonical phase branch." }
if ($hosted -and $env:EXPECTED_SHA -and $head -ne $env:EXPECTED_SHA) { throw "Hosted checkout does not match EXPECTED_SHA." }
if (-not $hosted) {
  & git merge-base --is-ancestor $acceptedBase HEAD
  if ($LASTEXITCODE -ne 0) { throw "P5-S3 candidate is not descended from the accepted base." }
}

New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidenceRoot | Out-Null
$diff = (& git diff -- . ":(exclude)docs/orchestration/reports/STITCH_MCP_CANARY.md" | Out-String)
$diffBytes = [Text.Encoding]::UTF8.GetBytes($diff)
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
  $diffHash = ([BitConverter]::ToString($sha256.ComputeHash($diffBytes))).Replace("-", "").ToLowerInvariant()
} finally {
  $sha256.Dispose()
}
$identity = [ordered]@{ invocationId=$invocationId; branch=$branch; head=$head; acceptedBase=$acceptedBase; diffSha256=$diffHash; startedAt=[DateTimeOffset]::UtcNow.ToString("o") }
$identity | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding utf8

function Invoke-Stage([string]$name, [scriptblock]$command) {
  $start = [DateTimeOffset]::UtcNow
  try {
    & $command
    if ($LASTEXITCODE -ne 0) { throw "$name failed with exit code $LASTEXITCODE" }
    @{ invocationId=$invocationId; stage=$name; result="passed"; startedAt=$start.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
  } catch {
    @{ invocationId=$invocationId; stage=$name; result="failed"; error=$_.Exception.Message; startedAt=$start.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
    throw
  }
}

try {
  if (-not $hosted) { Invoke-Stage "toolchain" { powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-community-toolchain.ps1 } }
  Invoke-Stage "static-contracts" { & $pnpm run format:p5-s3:check; & $pnpm run lint; & $pnpm run typecheck; & $pnpm run test:p5-s3:contracts; node --experimental-strip-types tools/quality/src/p5-s3-contract-integrity.ts }
  Invoke-Stage "spring-provider" {
    & $maven -B -ntp -f services/community/pom.xml -Dtest=CommunityModerationProviderContractTest test
    if ($UseExistingDatabase) {
      $env:P5_S3_COMMUNITY_INTEGRATION = "1"
      if ($hosted) {
        $env:COMMUNITY_DATABASE_URL = "jdbc:postgresql://127.0.0.1:5432/postgres"
        $env:COMMUNITY_DATABASE_USERNAME = "postgres"
        $env:COMMUNITY_DATABASE_PASSWORD = ""
      }
      & $maven -B -ntp -f services/community/pom.xml -Dtest=CommunityModerationServiceIntegrationTest test
    }
  }
  Invoke-Stage "governance-security" { & $pnpm run validate:docs; & $pnpm run validate:config; & $pnpm run validate:secrets; & $pnpm run security:deps }
  Invoke-Stage "production-build" { & $pnpm run build; & $maven -B -ntp -f services/community/pom.xml clean verify -DskipTests }
  Invoke-Stage "browser" { & $pnpm run test:p5-s3:browser }
  Invoke-Stage "candidate-integrity" { git diff --check; if ((git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md)) { throw "Protected Stitch canary changed." } }
  @{ invocationId=$invocationId; result="passed"; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
} catch {
  Write-Error "P5-S3 Level C retained failed evidence at $evidenceRoot. Classify and recover only the failed/unstarted stage. $($_.Exception.Message)"
  exit 1
}
