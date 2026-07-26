param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repositoryRoot "infra\p1\docker-compose.yml"
$runtimeDirectory = Join-Path $repositoryRoot ".lifebridge-local"
$composeProject = "lifebridge-p2-s2-level-c-$PID"
$pnpmCommand = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$runtimeFiles = [System.Collections.Generic.List[string]]::new()
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
  param([string]$Name, [string]$WorkingDirectory, [string[]]$Arguments)
  $stdout = Join-Path $runtimeDirectory "$composeProject-$Name.out.log"
  $stderr = Join-Path $runtimeDirectory "$composeProject-$Name.err.log"
  $runtimeFiles.Add($stdout)
  $runtimeFiles.Add($stderr)
  $startArguments = @{
    FilePath = "node"
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $stdout
    RedirectStandardError = $stderr
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $startArguments.WindowStyle = "Hidden" }
  $startedProcesses.Add((Start-Process @startArguments))
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    try {
      if ((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }
  throw "Runtime did not become ready: $Url"
}

function New-UrlSafeKey {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

Push-Location $repositoryRoot
try {
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path "scripts/validate-p2-s2.ps1"),
    [ref]$null,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) {
    throw "PowerShell syntax validation failed: scripts/validate-p2-s2.ps1"
  }

  if (-not $UseExistingDatabase) {
    $env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P2_IDENTITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_POSTGRES_PORT = "55432"
    $env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/postgres"
    $env:P2_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
    $env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_care"
    $env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_notification"
    docker compose -f $composeFile -p $composeProject config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose configuration is invalid." }
    docker compose -f $composeFile -p $composeProject up -d --wait
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL did not start." }
  } else {
    foreach ($name in @(
      "P1_ADMIN_DATABASE_URL",
      "P1_CARE_DATABASE_PASSWORD",
      "P1_NOTIFICATION_DATABASE_PASSWORD",
      "P2_ADMIN_DATABASE_URL",
      "P2_IDENTITY_DATABASE_PASSWORD",
      "CARE_DATABASE_URL",
      "NOTIFICATION_DATABASE_URL"
    )) {
      if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
        throw "$name is required with -UseExistingDatabase."
      }
    }
  }

  if (-not $SkipInstall) { Invoke-Pnpm install --frozen-lockfile }

  Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
  $postgresPort = if ($UseExistingDatabase) { "5432" } else { $env:P1_POSTGRES_PORT }
  $identityDatabaseUrl = "postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_identity"
  $env:IDENTITY_DATABASE_URL = $identityDatabaseUrl
  $env:IDENTITY_DATA_KEY = New-UrlSafeKey
  $env:IDENTITY_RATE_LIMIT_KEY = New-UrlSafeKey
  $env:IDENTITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_CURSOR_KEY = [guid]::NewGuid().ToString("N")
  $env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:IDENTITY_PORT = "3100"
  $env:GATEWAY_PORT = "3001"
  $env:IDENTITY_URL = "http://127.0.0.1:3100"
  $env:CARE_URL = "http://127.0.0.1:3101"
  $env:NOTIFICATION_URL = "http://127.0.0.1:3102"
  $env:GATEWAY_URL = "http://127.0.0.1:3001"
  $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
  $env:APP_ORIGIN = $env:PLAYWRIGHT_BASE_URL
  $env:GATEWAY_HOST = "127.0.0.1"
  $env:RUNTIME_MODE = "test"
  $env:FIXTURE_IDENTITY = "true"
  $env:NODE_ENV = "production"

  # Cumulative regression: the existing stable P1 campaign runs inside this one command.
  Remove-Item Env:IDENTITY_DATABASE_URL
  ./scripts/validate-p1-s1.ps1 -UseExistingDatabase -SkipInstall
  $env:IDENTITY_DATABASE_URL = $identityDatabaseUrl

  Invoke-Pnpm run format:p2:backend:check
  Invoke-Pnpm run lint
  Invoke-Pnpm run typecheck
  Invoke-Pnpm run test:unit
  Invoke-Pnpm run test:contracts
  Invoke-Pnpm run test:p2:identity-integration
  Invoke-Pnpm run validate:docs
  Invoke-Pnpm run validate:config
  Invoke-Pnpm run validate:secrets
  Invoke-Pnpm run security:deps
  Invoke-Pnpm run build

  Start-SliceProcess "identity" $repositoryRoot @("services/identity-consent/dist/main.mjs")
  Wait-Ready "$($env:IDENTITY_URL)/health/ready"
  Start-SliceProcess "gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/live"
  Start-SliceProcess "web" (Join-Path $repositoryRoot "apps\web") @(
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"
  )
  Wait-Ready $env:PLAYWRIGHT_BASE_URL

  $env:P2_REAL_RUNTIME = "1"
  Invoke-Pnpm run test:p2-s2:browser
  Remove-Item Env:P2_REAL_RUNTIME
  Invoke-Pnpm run test:p2:browser

  git diff --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }
  Write-Host "P2-S2 Level C validation passed."
} finally {
  foreach ($process in $startedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  foreach ($runtimeFile in $runtimeFiles) {
    $resolvedParent = (Resolve-Path (Split-Path -Parent $runtimeFile)).Path
    if ($resolvedParent -ne $runtimeDirectory) {
      throw "Refusing to remove a runtime file outside the task runtime directory."
    }
    Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  }
  if ($ownsDockerResources) {
    docker compose -f $composeFile -p $composeProject down --volumes --remove-orphans
  }
  Pop-Location
}
