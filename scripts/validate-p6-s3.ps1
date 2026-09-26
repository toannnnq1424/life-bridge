param([switch]$SkipInstall)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$marker = Join-Path $root ".lifebridge-local\p6-s3-level-c-invoked.json"
$evidence = Join-Path $root ".lifebridge-local\p6-s3-level-c"
$ledger = Join-Path $evidence "ledger.jsonl"
$acceptedBase = "6d7204d6272d70672a1c1f1429cdc742fd172bc0"
$hosted = $env:GITHUB_ACTIONS -eq "true"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$maven = if ($env:OS -eq "Windows_NT") { ".\mvnw.cmd" } else { "./mvnw" }
$invocationId = [Guid]::NewGuid().ToString("N")

if (Test-Path -LiteralPath $marker) { throw "P6-S3 Level C was already invoked; use only classified targeted recovery." }
$branch = (& git branch --show-current | Out-String).Trim()
$head = (& git rev-parse HEAD | Out-String).Trim()
if (-not $hosted -and $branch -ne "phase/6-authenticated-service-communication-dependency-isolation") { throw "P6-S3 requires its canonical phase branch." }
if ($hosted -and $env:EXPECTED_SHA -and $head -ne $env:EXPECTED_SHA) { throw "Hosted checkout does not match EXPECTED_SHA." }
& git merge-base --is-ancestor $acceptedBase $head
if ($LASTEXITCODE -ne 0) { throw "P6-S3 candidate is not descended from its accepted base." }
New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidence | Out-Null
@{ invocationId=$invocationId; branch=$branch; head=$head; acceptedBase=$acceptedBase; startedAt=[DateTimeOffset]::UtcNow.ToString("o") } |
  ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding utf8

function Invoke-Stage([string]$Name, [scriptblock]$Command) {
  $started = [DateTimeOffset]::UtcNow
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$Name failed with exit code $LASTEXITCODE" }
    @{ invocationId=$invocationId; stage=$Name; result="passed"; startedAt=$started.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
  } catch {
    @{ invocationId=$invocationId; stage=$Name; result="failed"; error=$_.Exception.Message; startedAt=$started.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
    throw
  }
}

try {
  if (-not $SkipInstall) { Invoke-Stage "locked-install" { & $pnpm install --frozen-lockfile } }
  Invoke-Stage "static-auth-failure-contracts" {
    & $pnpm run format:p6-s3:check
    & $pnpm run lint
    & $pnpm run typecheck
    & $pnpm run test:p6-s3:contracts
  }
  Invoke-Stage "spring-auth-provider" { & $maven -B -ntp -f services/community/pom.xml "-Dtest=InternalTokenFilterTest,ContractVersionFilterTest" test }
  Invoke-Stage "cumulative-p6-fitness" {
    & $pnpm run test:p6-s1:contracts
    & $pnpm run test:p6-s2:fitness
    & $pnpm run validate:docs
    & $pnpm run validate:config
    & $pnpm run validate:secrets
    & $pnpm run security:deps
    & $pnpm run sbom:p6-s2
  }
  Invoke-Stage "production-build" { & $pnpm run build; & $maven -B -ntp -f services/community/pom.xml clean verify -DskipTests }
  if (-not $hosted) {
    $priorPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & docker version --format '{{.Server.Version}}' 2>$null | Out-Null } catch { }
    $containerResult = if ($LASTEXITCODE -eq 0) { "available_hosted_still_required" } else { "environment_unavailable_hosted_required" }
    $ErrorActionPreference = $priorPreference
    @{ invocationId=$invocationId; stage="local-container-classification"; result=$containerResult; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
  }
  Invoke-Stage "candidate-integrity" {
    git diff --check
    if (git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md) { throw "Protected Stitch canary changed." }
  }
  @{ invocationId=$invocationId; result="passed"; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding utf8
} catch {
  Write-Error "P6-S3 Level C retained evidence at $evidence. Classify and continue only the failed/unstarted stage. $($_.Exception.Message)"
  exit 1
}
