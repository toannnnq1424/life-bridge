param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall,
  [switch]$ContinueAfterDockerStart,
  [switch]$ContinueAfterUnitConcurrency,
  [switch]$ContinueAtP3S3Integration,
  [switch]$ContinueAtP3S3Browser,
  [switch]$ContinueAtDetachedBrowserEvidence,
  [switch]$SkipP3Migrations,
  [switch]$SkipCumulativeBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$compose = Join-Path $root "infra\p1\docker-compose.yml"
$runtime = Join-Path $root ".lifebridge-local"
$project = "lifebridge-p3-s3-level-c-$PID"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$logs = [System.Collections.Generic.List[string]]::new()
$ownsDocker = -not $UseExistingDatabase
$composeStarted = $false
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

function Invoke-Pnpm { param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Args) & $pnpm @Args; if ($LASTEXITCODE -ne 0) { throw "pnpm failed: $($Args -join ' ')" } }
function New-Key { $bytes=New-Object byte[] 32; $rng=[Security.Cryptography.RandomNumberGenerator]::Create(); try{$rng.GetBytes($bytes)}finally{$rng.Dispose()}; [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+","-").Replace("/","_") }
function Start-App {
  param([string]$Name,[string]$WorkingDirectory,[string[]]$Arguments)
  $out=Join-Path $runtime "$project-$Name.out.log"; $err=Join-Path $runtime "$project-$Name.err.log"; $logs.Add($out); $logs.Add($err)
  $options=@{FilePath="node";ArgumentList=$Arguments;WorkingDirectory=$WorkingDirectory;RedirectStandardOutput=$out;RedirectStandardError=$err;PassThru=$true}
  if($env:OS -eq "Windows_NT"){$options.WindowStyle="Hidden"}
  $processes.Add((Start-Process @options))
}
function Wait-Ready { param([string]$Url) for($i=0;$i -lt 90;$i++){try{if((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200){return}}catch{};Start-Sleep -Milliseconds 500};throw "Runtime not ready: $Url" }
function Scan-Logs {
  $forbidden=@("P3-S3 subject synthetic passphrase","P3-S3 member synthetic passphrase","P3-S3 synthetic household","Synthetic recipient","Weekly coordination check-in","actor_ref","America/New_York","recipient_context.basic_label")
  foreach($file in $logs){if(Test-Path -LiteralPath $file){$content=Get-Content -LiteralPath $file -Raw;if($null -eq $content){$content=""};foreach($value in $forbidden){if($content.Contains($value)){throw "Sensitive synthetic value in runtime log: $value"}}}}
}

Push-Location $root
try {
  if($ContinueAfterDockerStart){
    $previousErrorPreference=$ErrorActionPreference
    $ErrorActionPreference="Continue"
    docker info *> $null
    $dockerInfoExitCode=$LASTEXITCODE
    $ErrorActionPreference=$previousErrorPreference
    if($dockerInfoExitCode -ne 0){throw "Docker continuation requires a ready engine"}
    Write-Host "Continuing retained P3-S3 Level C after classified Docker startup recovery."
  }
  $parseErrors=$null; [Management.Automation.Language.Parser]::ParseFile((Resolve-Path "scripts/validate-p3-s3.ps1"),[ref]$null,[ref]$parseErrors)|Out-Null
  if($parseErrors.Count -gt 0){throw "PowerShell syntax validation failed"}
  foreach($path in @("test-results","playwright-report",(Join-Path $runtime "$project-playwright"))){if(Test-Path -LiteralPath $path){throw "Refusing to overwrite browser artifact path: $path"}}
  if($ownsDocker){
    $env:P1_POSTGRES_ADMIN_PASSWORD=[guid]::NewGuid().ToString("N"); $env:P1_CARE_DATABASE_PASSWORD=[guid]::NewGuid().ToString("N"); $env:P1_NOTIFICATION_DATABASE_PASSWORD=[guid]::NewGuid().ToString("N"); $env:P2_IDENTITY_DATABASE_PASSWORD=[guid]::NewGuid().ToString("N"); $env:P1_POSTGRES_PORT="55432"
    $env:P1_ADMIN_DATABASE_URL="postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/postgres"; $env:P2_ADMIN_DATABASE_URL=$env:P1_ADMIN_DATABASE_URL
    $env:CARE_DATABASE_URL="postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_care"; $env:NOTIFICATION_DATABASE_URL="postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_notification"
    docker compose -f $compose -p $project config --quiet; if($LASTEXITCODE -ne 0){throw "Compose config invalid"}; docker compose -f $compose -p $project up -d --wait; if($LASTEXITCODE -ne 0){throw "PostgreSQL startup failed"}; $composeStarted=$true
  }
  if(-not $SkipInstall){Invoke-Pnpm install --frozen-lockfile}
  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts; Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
  $port=if($UseExistingDatabase){"5432"}else{$env:P1_POSTGRES_PORT}; $env:IDENTITY_DATABASE_URL="postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$port/lifebridge_identity"
  $env:IDENTITY_DATA_KEY=New-Key; $env:IDENTITY_RATE_LIMIT_KEY=New-Key; $env:IDENTITY_INTERNAL_TOKEN=[guid]::NewGuid().ToString("N"); $env:CARE_INTERNAL_TOKEN=[guid]::NewGuid().ToString("N"); $env:CARE_CURSOR_KEY=New-Key; $env:NOTIFICATION_INTERNAL_TOKEN=[guid]::NewGuid().ToString("N")
  $env:IDENTITY_PORT="3100";$env:CARE_PORT="3101";$env:NOTIFICATION_PORT="3102";$env:GATEWAY_PORT="3001";$env:IDENTITY_URL="http://127.0.0.1:3100";$env:CARE_URL="http://127.0.0.1:3101";$env:NOTIFICATION_URL="http://127.0.0.1:3102";$env:GATEWAY_URL="http://127.0.0.1:3001";$env:PLAYWRIGHT_BASE_URL="http://127.0.0.1:3000";$env:P3_S3_PLAYWRIGHT_OUTPUT_DIR=Join-Path $runtime "$project-playwright";$env:APP_ORIGIN=$env:PLAYWRIGHT_BASE_URL;$env:GATEWAY_HOST="127.0.0.1";$env:RUNTIME_MODE="test";$env:FIXTURE_IDENTITY="false";$env:NODE_ENV="production"

  if(-not $ContinueAfterUnitConcurrency -and -not $ContinueAtP3S3Integration -and -not $ContinueAtP3S3Browser -and -not $ContinueAtDetachedBrowserEvidence){
    Invoke-Pnpm run format:p1:check; Invoke-Pnpm run format:p2:backend:check; Invoke-Pnpm run format:p3:check; Invoke-Pnpm run format:p3-s2:check; Invoke-Pnpm run format:p3-s3:check
    Invoke-Pnpm run lint; Invoke-Pnpm run typecheck
  } else {
    Write-Host "Retaining green cumulative format, lint and typecheck evidence; continuing at corrected unit discovery."
  }
  if(-not $ContinueAtP3S3Integration -and -not $ContinueAtP3S3Browser -and -not $ContinueAtDetachedBrowserEvidence){
    Invoke-Pnpm run test:unit; Invoke-Pnpm run test:contracts; Invoke-Pnpm run validate:docs; Invoke-Pnpm run validate:config; Invoke-Pnpm run validate:secrets; Invoke-Pnpm run security:deps; Invoke-Pnpm run build
    Invoke-Pnpm run test:p1:integration; Invoke-Pnpm run test:p3-s1:integration; Invoke-Pnpm run test:p3-s2:integration
  } elseif($ContinueAtP3S3Integration) {
    Write-Host "Retaining green unit/contracts/docs/config/secrets/audit/build and P1/P3-S1/P3-S2 integration evidence."
    Invoke-Pnpm run typecheck
    Invoke-Pnpm --filter @lifebridge/care-coordination run build
    Invoke-Pnpm --filter @lifebridge/web run build
  } elseif($ContinueAtP3S3Browser) {
    Write-Host "Retaining green P3-S3 integration and cumulative migration evidence; rebuilding the affected web path."
    Invoke-Pnpm run typecheck
    Invoke-Pnpm --filter @lifebridge/web run build
  } else {
    Write-Host "Retaining green typecheck, build, integration and migration evidence; recovering detached browser evidence only."
  }
  if(-not $ContinueAtP3S3Browser -and -not $ContinueAtDetachedBrowserEvidence){
    Invoke-Pnpm run test:p3-s3:integration
    if(-not $SkipP3Migrations){
      Invoke-Pnpm run test:p3-s1:migration; Invoke-Pnpm run test:p3-s2:migration; Invoke-Pnpm run test:p3-s3:migration
    }
  }

  Start-App "notification" $root @("services/notification/dist/main.mjs"); Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-App "care" $root @("services/care-coordination/dist/main.mjs"); Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-App "identity" $root @("services/identity-consent/dist/main.mjs"); Wait-Ready "$($env:IDENTITY_URL)/health/ready"
  Start-App "gateway" $root @("apps/gateway/dist/main.mjs"); Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-App "web" (Join-Path $root "apps\web") @("node_modules/next/dist/bin/next","start","--hostname","127.0.0.1","--port","3000"); Wait-Ready $env:PLAYWRIGHT_BASE_URL
  $env:P3_S3_REAL_RUNTIME="1"
  if($ContinueAtP3S3Browser -or $ContinueAtDetachedBrowserEvidence){
    Invoke-Pnpm exec playwright test --config playwright.p3-s3.config.ts --grep "real P3-S3"
  } else {
    Invoke-Pnpm run test:p3-s3:browser
  }
  Remove-Item Env:P3_S3_REAL_RUNTIME
  if(-not $SkipCumulativeBrowser){
    Invoke-Pnpm run test:p3-s2:browser; Invoke-Pnpm run test:p3-s1:browser; Invoke-Pnpm run test:p2-s3:browser; Invoke-Pnpm run test:p2-s2:browser; Invoke-Pnpm run test:p2:browser
  }
  git diff --check; if($LASTEXITCODE -ne 0){throw "git diff --check failed"}
  Write-Host "P3-S3 Level C validation passed."
} finally {
  foreach($process in $processes){if(-not $process.HasExited){Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue}}
  $scanError=$null;try{Scan-Logs}catch{$scanError=$_}
  foreach($file in $logs){if(Test-Path -LiteralPath $file){$parent=(Resolve-Path (Split-Path -Parent $file)).Path;if($parent -ne $runtime){throw "Unsafe runtime log path"};Remove-Item -LiteralPath $file -Force}}
  foreach($path in @((Join-Path $root "test-results"),(Join-Path $root "playwright-report"),(Join-Path $runtime "$project-playwright"))){if(Test-Path -LiteralPath $path){$resolved=(Resolve-Path -LiteralPath $path).Path;$allowed=if($resolved.StartsWith($runtime)){$runtime}else{$root};if((Split-Path -Parent $resolved) -ne $allowed){throw "Unsafe browser artifact path"};Remove-Item -LiteralPath $resolved -Recurse -Force}}
  if($ownsDocker -and $composeStarted){docker compose -f $compose -p $project down --volumes --remove-orphans;if($LASTEXITCODE -ne 0){throw "Docker cleanup failed"}}
  Pop-Location
  if($null -ne $scanError){throw $scanError}
}
