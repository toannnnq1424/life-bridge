param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repositoryRoot "infra\p1\docker-compose.yml"
$runtimeDirectory = Join-Path $repositoryRoot ".lifebridge-local"
$composeProject = "lifebridge-p1-level-c-$PID"
$pnpmCommand = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$ownsDockerResources = -not $UseExistingDatabase

New-Item -ItemType Directory -Force -Path $runtimeDirectory | Out-Null

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $pnpmCommand @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "pnpm command failed: $($Arguments -join ' ')"
  }
}

function Start-SliceProcess {
  param(
    [string]$Name,
    [string]$WorkingDirectory,
    [string[]]$Arguments
  )
  $stdout = Join-Path $runtimeDirectory "$composeProject-$Name.out.log"
  $stderr = Join-Path $runtimeDirectory "$composeProject-$Name.err.log"
  $startArguments = @{
    FilePath = "node"
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $stdout
    RedirectStandardError = $stderr
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") {
    $startArguments.WindowStyle = "Hidden"
  }
  $process = Start-Process @startArguments
  $startedProcesses.Add($process)
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Runtime did not become ready: $Url"
}

Push-Location $repositoryRoot
try {
  foreach ($scriptPath in @(
    "scripts/start-p1.ps1",
    "scripts/test-p1-browser.ps1",
    "scripts/validate-p1-s1.ps1"
  )) {
    $parseErrors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
      (Resolve-Path $scriptPath),
      [ref]$null,
      [ref]$parseErrors
    ) | Out-Null
    if ($parseErrors.Count -gt 0) {
      throw "PowerShell syntax validation failed: $scriptPath"
    }
  }

  if (-not $UseExistingDatabase) {
    $env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_POSTGRES_PORT = "55432"
    $env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/postgres"
    $env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_care"
    $env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_notification"
    docker compose -f $composeFile -p $composeProject config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid." }
    docker compose -f $composeFile -p $composeProject up -d --wait
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start." }
  } else {
    foreach ($name in @("P1_ADMIN_DATABASE_URL", "P1_CARE_DATABASE_PASSWORD", "P1_NOTIFICATION_DATABASE_PASSWORD", "CARE_DATABASE_URL", "NOTIFICATION_DATABASE_URL")) {
      if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
        throw "$name is required with -UseExistingDatabase."
      }
    }
  }

  $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_URL = "http://127.0.0.1:3101"
  $env:NOTIFICATION_URL = "http://127.0.0.1:3102"
  $env:GATEWAY_URL = "http://127.0.0.1:3001"
  $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
  $env:RUNTIME_MODE = "test"
  $env:FIXTURE_IDENTITY = "true"
  $env:NODE_ENV = "production"

  if (-not $SkipInstall) {
    Invoke-Pnpm install --frozen-lockfile
  }
  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
  Invoke-Pnpm run format:p1:check
  Invoke-Pnpm run lint
  Invoke-Pnpm run typecheck
  Invoke-Pnpm run test:unit
  Invoke-Pnpm run test:contracts
  Invoke-Pnpm run validate:docs
  Invoke-Pnpm run validate:config
  Invoke-Pnpm run validate:secrets
  Invoke-Pnpm run security:deps

  $ignoredBuilds = (& $pnpmCommand ignored-builds | Out-String)
  if ($LASTEXITCODE -ne 0 -or $ignoredBuilds -notmatch "(?m)^\s+sharp\s*$") {
    throw "Sharp must remain explicitly denied by the workspace allowBuilds policy."
  }
  $imagePipelineUsage = rg -n "next/image|sharp" apps/web/app apps/web/src apps/web/next.config.ts
  if ($LASTEXITCODE -eq 0 -or $imagePipelineUsage) {
    throw "P1-S1 must not introduce a Sharp or next/image pipeline."
  }

  Invoke-Pnpm run test:p1:integration
  Invoke-Pnpm run build
  Invoke-Pnpm exec tsx tools/quality/src/p1-reset.ts

  Start-SliceProcess "notification" $repositoryRoot @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-SliceProcess "care" $repositoryRoot @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-SliceProcess "gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-SliceProcess "web" (Join-Path $repositoryRoot "apps\web") @("node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000")
  Wait-Ready $env:PLAYWRIGHT_BASE_URL

  Invoke-Pnpm exec playwright test
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }
  Write-Host "P1-S1 Level C validation passed."
} finally {
  foreach ($process in $startedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  if ($ownsDockerResources) {
    docker compose -f $composeFile -p $composeProject down --volumes --remove-orphans
  }
  Pop-Location
}
