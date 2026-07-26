param(
  [string]$Grep = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeDirectory = Join-Path $repositoryRoot ".lifebridge-local"
$composeFile = Join-Path $repositoryRoot "infra\p1\docker-compose.yml"
$composeProject = "lifebridge-p1-browser-$PID"
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null
$env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
$env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
$env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
$env:P1_POSTGRES_PORT = "55434"
$env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:55434/postgres"
$env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:55434/lifebridge_care"
$env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:55434/lifebridge_notification"
$env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
$env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
$env:CARE_URL = "http://127.0.0.1:3101"
$env:NOTIFICATION_URL = "http://127.0.0.1:3102"
$env:GATEWAY_URL = "http://127.0.0.1:3001"
$env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
$env:RUNTIME_MODE = "test"
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
  $process = Start-Process -FilePath "node" -ArgumentList $Arguments -WorkingDirectory $WorkingDirectory -RedirectStandardOutput (Join-Path $runtimeDirectory "$composeProject-$Name.out.log") -RedirectStandardError (Join-Path $runtimeDirectory "$composeProject-$Name.err.log") -WindowStyle Hidden -PassThru
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
  if (-not $SkipBuild) {
    Invoke-Pnpm run build
  }
  docker compose -f $composeFile -p $composeProject up -d --wait
  if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start." }
  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
  Invoke-Pnpm --filter @lifebridge/care-coordination migrate
  Invoke-Pnpm --filter @lifebridge/notification migrate
  Invoke-Pnpm exec tsx tools/quality/src/p1-reset.ts

  Start-SliceProcess "notification" $repositoryRoot @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-SliceProcess "care" $repositoryRoot @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-SliceProcess "gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-SliceProcess "web" (Join-Path $repositoryRoot "apps\web") @("node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000")
  Wait-Ready $env:PLAYWRIGHT_BASE_URL
  if ($Grep) {
    & node node_modules/@playwright/test/cli.js test --grep $Grep
    if ($LASTEXITCODE -ne 0) {
      throw "Targeted Playwright command failed."
    }
  } else {
    Invoke-Pnpm run test:p1:browser
  }
} finally {
  foreach ($process in $startedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  docker compose -f $composeFile -p $composeProject down --volumes --remove-orphans
  Pop-Location
}
