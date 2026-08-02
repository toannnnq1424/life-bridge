param([switch]$SkipInstall)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $root
$marker = Join-Path $root ".lifebridge-local\p9-s1-level-c-invoked.json"
$evidence = Join-Path $root ".lifebridge-local\p9-s1-level-c"
$ledger = Join-Path $evidence "ledger.jsonl"
$acceptedBase = "c93be641fd1a828e16aef060c70f5f9feb4c4f36"
$hosted = $env:GITHUB_ACTIONS -eq "true"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
if (Test-Path -LiteralPath $marker) { throw "P9-S1 Level C was already invoked; use retained targeted continuation only." }
$branch = (& git branch --show-current | Out-String).Trim(); if ($LASTEXITCODE -ne 0) { throw "Cannot resolve branch." }
$head = (& git rev-parse HEAD | Out-String).Trim(); if ($LASTEXITCODE -ne 0) { throw "Cannot resolve head." }
if (-not $hosted -and $branch -ne "phase/9-redacted-observability-slo-baseline") { throw "P9-S1 requires its canonical phase branch." }
& git merge-base --is-ancestor $acceptedBase $head; if ($LASTEXITCODE -ne 0) { throw "Candidate is not descended from accepted base." }
$invocationId = [Guid]::NewGuid().ToString("N")
New-Item -ItemType Directory -Force -Path (Split-Path $marker), $evidence | Out-Null
@{invocationId=$invocationId;branch=$branch;head=$head;acceptedBase=$acceptedBase;startedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Set-Content -LiteralPath $marker -Encoding utf8
function Invoke-Native([string]$Stage,[scriptblock]$Command){$started=[DateTimeOffset]::UtcNow;try{& $Command;if($LASTEXITCODE -ne 0){throw "$Stage failed with exit code $LASTEXITCODE"};@{stage=$Stage;result="passed";startedAt=$started.ToString("o");completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content $ledger}catch{@{stage=$Stage;result="failed";error=$_.Exception.Message;completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content $ledger;throw}}
try {
  if(-not $SkipInstall){Invoke-Native "locked-install" { & $pnpm install --frozen-lockfile }}
  Invoke-Native "format" { & $pnpm run format:p9-s1:check }
  Invoke-Native "lint" { & $pnpm run lint }
  Invoke-Native "typecheck" { & $pnpm run typecheck }
  Invoke-Native "p9-fitness" { & $pnpm run test:p9-s1:fitness }
  Invoke-Native "spring-parity" { ./mvnw.cmd -B -ntp -f services/community/pom.xml -Dtest=SafeTelemetryTest test }
  Invoke-Native "cumulative-build" { & $pnpm run test:p8-s3:fitness }
  Invoke-Native "build" { & $pnpm run build }
  Invoke-Native "candidate-diff" { & git diff --check }
  if (git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md) { throw "Protected Stitch canary changed." }
  @{invocationId=$invocationId;result="passed_with_hosted_postgres_mixed_runtime_required";completedAt=[DateTimeOffset]::UtcNow.ToString("o")}|ConvertTo-Json -Compress|Add-Content $ledger
} catch { Write-Error "P9-S1 Level C retained evidence at $evidence. $($_.Exception.Message)"; exit 1 }
