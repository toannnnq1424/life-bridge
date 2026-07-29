param([switch]$SkipInstall)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$evidenceRoot = Join-Path $root ".lifebridge-local\p6-s1-level-c"
$marker = Join-Path $root ".lifebridge-local\p6-s1-level-c-invoked.json"
$ledger = Join-Path $evidenceRoot "ledger.jsonl"
$acceptedBase = "f7a4052f8181f2a0933a5e61884d91ae200b4da9"
$invocationId = [Guid]::NewGuid().ToString("N")
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$maven = if ($env:OS -eq "Windows_NT") { ".\mvnw.cmd" } else { "./mvnw" }
$hosted = $env:GITHUB_ACTIONS -eq "true"

if (Test-Path -LiteralPath $marker) {
  throw "P6-S1 Level C was already invoked locally; retain evidence and use targeted recovery only."
}

$branch = (& git branch --show-current | Out-String).Trim()
$head = (& git rev-parse HEAD | Out-String).Trim()
if (-not $hosted -and $branch -ne "phase/6-versioned-contracts-rolling-compatibility") {
  throw "P6-S1 Level C requires the canonical phase branch."
}
if ($hosted -and $env:EXPECTED_SHA -and $head -ne $env:EXPECTED_SHA) {
  throw "Hosted checkout does not match EXPECTED_SHA."
}
& git merge-base --is-ancestor $acceptedBase $head
if ($LASTEXITCODE -ne 0) { throw "P6-S1 candidate is not descended from the accepted base." }

New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidenceRoot | Out-Null
$status = (& git status --porcelain=v1 --untracked-files=all | Out-String)
$diff = (& git diff --binary -- . ":(exclude)docs/orchestration/reports/STITCH_MCP_CANARY.md" | Out-String)
$identityBytes = [Text.Encoding]::UTF8.GetBytes($status + "`n" + $diff)
$sha256 = [Security.Cryptography.SHA256]::Create()
try {
  $diffHash = ([BitConverter]::ToString($sha256.ComputeHash($identityBytes))).Replace("-", "").ToLowerInvariant()
} finally {
  $sha256.Dispose()
}
$identity = [ordered]@{
  invocationId = $invocationId
  branch = $branch
  head = $head
  acceptedBase = $acceptedBase
  candidateSha256 = $diffHash
  startedAt = [DateTimeOffset]::UtcNow.ToString("o")
}
$identity | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding utf8

function Invoke-Stage([string]$name, [scriptblock]$command) {
  $start = [DateTimeOffset]::UtcNow
  try {
    & $command
    if ($LASTEXITCODE -ne 0) { throw "$name failed with exit code $LASTEXITCODE" }
    @{ invocationId=$invocationId; stage=$name; result="passed"; startedAt=$start.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } |
      ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
  } catch {
    @{ invocationId=$invocationId; stage=$name; result="failed"; error=$_.Exception.Message; startedAt=$start.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } |
      ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
    throw
  }
}

try {
  if (-not $hosted) {
    Invoke-Stage "toolchain" {
      powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/bootstrap-community-toolchain.ps1
    }
  }
  if (-not $SkipInstall) { Invoke-Stage "locked-install" { & $pnpm install --frozen-lockfile } }
  Invoke-Stage "static-and-language-neutral-contracts" {
    & $pnpm run format:p6-s1:check
    & $pnpm run lint
    & $pnpm run typecheck
    & $pnpm run test:p6-s1:contracts
  }
  Invoke-Stage "spring-current-previous-provider" {
    & $maven -B -ntp -f services/community/pom.xml "-Dtest=ContractVersionFilterTest,CommunityProviderContractTest,CommunityModerationProviderContractTest" test
  }
  Invoke-Stage "governance-security" {
    & $pnpm run validate:docs
    & $pnpm run validate:config
    & $pnpm run validate:secrets
    & $pnpm run security:deps
  }
  Invoke-Stage "production-build" {
    & $pnpm run build
    & $maven -B -ntp -f services/community/pom.xml clean verify -DskipTests
  }
  Invoke-Stage "mixed-runtime-primary-journey" {
    & $pnpm run test:p5-s1:browser
  }
  Invoke-Stage "candidate-integrity" {
    git diff --check
    if ((git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md)) {
      throw "Protected Stitch canary changed."
    }
    if (Test-Path test-results) { throw "Generated test-results remain." }
    if (Test-Path playwright-report) { throw "Generated playwright-report remains." }
  }
  @{ invocationId=$invocationId; result="passed"; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } |
    ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
} catch {
  Write-Error "P6-S1 Level C retained failed evidence at $evidenceRoot. Classify and recover only the failed or unstarted stage. $($_.Exception.Message)"
  exit 1
}
