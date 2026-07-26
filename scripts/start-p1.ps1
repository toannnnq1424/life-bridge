$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDirectory = Join-Path $repositoryRoot ".lifebridge-local"
$runtimeFile = Join-Path $runtimeDirectory "p1-demo.json"
$composeFile = Join-Path $repositoryRoot "infra\p1\docker-compose.yml"
$composeProject = "lifebridge-p1-demo"
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
if (Test-Path -LiteralPath $runtimeFile) {
  $runtime = Get-Content -LiteralPath $runtimeFile -Raw | ConvertFrom-Json
} else {
  $runtime = [ordered]@{
    postgresAdminPassword = [guid]::NewGuid().ToString("N")
    careDatabasePassword = [guid]::NewGuid().ToString("N")
    notificationDatabasePassword = [guid]::NewGuid().ToString("N")
    careToken = [guid]::NewGuid().ToString("N")
    notificationToken = [guid]::NewGuid().ToString("N")
  }
  $runtime | ConvertTo-Json | Set-Content -LiteralPath $runtimeFile -Encoding UTF8
}

$env:P1_POSTGRES_ADMIN_PASSWORD = $runtime.postgresAdminPassword
$env:P1_CARE_DATABASE_PASSWORD = $runtime.careDatabasePassword
$env:P1_NOTIFICATION_DATABASE_PASSWORD = $runtime.notificationDatabasePassword
$env:P1_POSTGRES_PORT = "55432"
$env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:55432/postgres"
$env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:55432/lifebridge_care"
$env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:55432/lifebridge_notification"
$env:CARE_INTERNAL_TOKEN = $runtime.careToken
$env:NOTIFICATION_INTERNAL_TOKEN = $runtime.notificationToken
$env:CARE_URL = "http://127.0.0.1:3101"
$env:NOTIFICATION_URL = "http://127.0.0.1:3102"
$env:GATEWAY_URL = "http://127.0.0.1:3001"
$env:RUNTIME_MODE = "local"
$env:FIXTURE_IDENTITY = "true"
$env:NODE_ENV = "production"

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & pnpm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm command failed: $($Arguments -join ' ')"
  }
}

function Start-SliceProcess {
  param([string]$Name, [string]$WorkingDirectory, [string[]]$Arguments)
  $process = Start-Process -FilePath "node" -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -RedirectStandardOutput (Join-Path $runtimeDirectory "$Name.out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$Name.err.log") -WindowStyle Hidden -PassThru
  $startedProcesses.Add($process)
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -eq 200) { return }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Runtime did not become ready: $Url"
}

Push-Location $repositoryRoot
try {
  docker compose -f $composeFile -p $composeProject up -d --wait
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start." }
  Invoke-Pnpm install --frozen-lockfile
  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
  Invoke-Pnpm run build

  Start-SliceProcess "notification" $repositoryRoot @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-SliceProcess "care" $repositoryRoot @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-SliceProcess "gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-SliceProcess "web" (Join-Path $repositoryRoot "apps\web") @("node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000")
  Wait-Ready "http://127.0.0.1:3000"

  Write-Host "LifeBridge P1-S1 is ready at http://127.0.0.1:3000"
  Write-Host "Press Ctrl+C to stop the app. The local PostgreSQL volume is retained."
  while ($true) {
    Start-Sleep -Seconds 1
    foreach ($process in $startedProcesses) {
      if ($process.HasExited) {
        throw "A P1-S1 runtime process exited. Review .lifebridge-local logs."
      }
    }
  }
} finally {
  foreach ($process in $startedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  docker compose -f $composeFile -p $composeProject stop
  Pop-Location
}
