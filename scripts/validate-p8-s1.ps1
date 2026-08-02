param([switch]$SkipInstall)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$marker = Join-Path $root ".lifebridge-local\p8-s1-level-c-invoked.json"
$evidence = Join-Path $root ".lifebridge-local\p8-s1-level-c"
$ledger = Join-Path $evidence "ledger.jsonl"
$acceptedBase = "a6cd86fd891e30828d04dbbae00a5da1f6922ae6"
$hosted = $env:GITHUB_ACTIONS -eq "true"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$invocationId = [Guid]::NewGuid().ToString("N")
if (Test-Path -LiteralPath $marker) { throw "P8-S1 Level C was already invoked; continue only retained failed or unstarted stages." }
$branch = (& git branch --show-current | Out-String).Trim()
$head = (& git rev-parse HEAD | Out-String).Trim()
if (-not $hosted -and $branch -ne "phase/8-household-isolation-consent-enforcement") { throw "P8-S1 requires its canonical phase branch." }
if ($hosted -and $env:EXPECTED_SHA -and $head -ne $env:EXPECTED_SHA) { throw "Hosted checkout does not match EXPECTED_SHA." }
& git merge-base --is-ancestor $acceptedBase $head
if ($LASTEXITCODE -ne 0) { throw "P8-S1 candidate is not descended from accepted base." }
New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidence | Out-Null
@{invocationId=$invocationId;branch=$branch;head=$head;acceptedBase=$acceptedBase;startedAt=[DateTimeOffset]::UtcNow.ToString("o")} | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding utf8
function Invoke-Stage([string]$Name,[scriptblock]$Command) {
  $started=[DateTimeOffset]::UtcNow
  try {
    & $Command
    if($LASTEXITCODE -ne 0){throw "$Name failed with exit code $LASTEXITCODE"}
    @{invocationId=$invocationId;stage=$Name;result="passed";startedAt=$started.ToString("o");completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content -LiteralPath $ledger -Encoding utf8
  } catch {
    @{invocationId=$invocationId;stage=$Name;result="failed";error=$_.Exception.Message;completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content -LiteralPath $ledger -Encoding utf8
    throw
  }
}
try {
  if(-not $SkipInstall){Invoke-Stage "locked-install" { & $pnpm install --frozen-lockfile }}
  Invoke-Stage "authorization-policy-static" { & $pnpm run format:p8-s1:check; & $pnpm run lint; & $pnpm run typecheck; & $pnpm run test:p8-s1:fitness }
  Invoke-Stage "cumulative-security-contracts" { & $pnpm run test:p6-s2:fitness; & $pnpm run test:p6-s3:contracts; & $pnpm run test:p7-s1:fitness; & $pnpm run test:p7-s2:fitness; & $pnpm run test:p7-s3:fitness }
  Invoke-Stage "governance-build" { & $pnpm run validate:docs; & $pnpm run validate:config; & $pnpm run validate:secrets; & $pnpm run build }
  Invoke-Stage "candidate-integrity" { git diff --check; if(git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md){throw "Protected Stitch canary changed."} }
  @{invocationId=$invocationId;result="passed_with_hosted_postgres_required";completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content -LiteralPath $ledger -Encoding utf8
} catch { Write-Error "P8-S1 Level C retained evidence at $evidence. $($_.Exception.Message)"; exit 1 }
