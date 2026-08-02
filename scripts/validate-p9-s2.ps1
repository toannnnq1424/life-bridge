param([switch]$SkipInstall)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$marker = Join-Path $root ".lifebridge-local\p9-s2-level-c-invoked.json"
$evidence = Join-Path $root ".lifebridge-local\p9-s2-level-c"
$ledger = Join-Path $evidence "ledger.jsonl"
$acceptedBase = "eb8a85aafafa6de83d5b0caa9c9f5cd0b434e66c"
$branchExpected = "phase/9-offline-conflict-graceful-degradation"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
if (Test-Path -LiteralPath $marker) { throw "P9-S2 Level C was already invoked; retain evidence and use targeted continuation only." }
$branch = (& git branch --show-current | Out-String).Trim()
$head = (& git rev-parse HEAD | Out-String).Trim()
if ($branch -ne $branchExpected) { throw "P9-S2 requires $branchExpected." }
& git merge-base --is-ancestor $acceptedBase $head
if ($LASTEXITCODE -ne 0) { throw "Candidate is not descended from accepted base." }
$invocationId = [Guid]::NewGuid().ToString("N")
New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidence | Out-Null
@{ invocationId=$invocationId; branch=$branch; head=$head; acceptedBase=$acceptedBase; startedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Set-Content -LiteralPath $marker -Encoding utf8
function Invoke-Stage([string]$name, [scriptblock]$command) {
  $started = [DateTimeOffset]::UtcNow
  try {
    & $command
    if ($LASTEXITCODE -ne 0) { throw "$name failed with exit code $LASTEXITCODE" }
    @{ stage=$name; result="passed"; startedAt=$started.ToString("o"); completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content $ledger
  } catch {
    @{ stage=$name; result="failed"; error=$_.Exception.Message; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content $ledger
    throw
  }
}
try {
  if (-not $SkipInstall) { Invoke-Stage "locked-install" { & $pnpm install --frozen-lockfile } }
  Invoke-Stage "format" { & $pnpm run format:p9-s2:check }
  Invoke-Stage "lint" { & $pnpm run lint }
  Invoke-Stage "typecheck" { & $pnpm run typecheck }
  Invoke-Stage "p9-s2-fitness" { & $pnpm run test:p9-s2:fitness }
  Invoke-Stage "p9-s1-regression" { & $pnpm run test:p9-s1:fitness }
  Invoke-Stage "p8-boundary" { & $pnpm run test:p8-s3:fitness }
  Invoke-Stage "p7-replay-boundary" { & $pnpm run test:p7-s2:fitness }
  Invoke-Stage "browser" { & $pnpm run test:p9-s2:browser }
  Invoke-Stage "build" { & $pnpm run build }
  Invoke-Stage "candidate-diff" { & git diff --check }
  if (git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md) { throw "Protected Stitch canary changed." }
  @{ invocationId=$invocationId; result="passed_with_hosted_postgres_mixed_runtime_required"; completedAt=[DateTimeOffset]::UtcNow.ToString("o") } | ConvertTo-Json -Compress | Add-Content $ledger
} catch {
  Write-Error "P9-S2 Level C retained evidence at $evidence. $($_.Exception.Message)"
  exit 1
}
