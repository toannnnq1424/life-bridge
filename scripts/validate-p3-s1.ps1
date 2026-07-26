param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$repositoryRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$composeFile = Join-Path $repositoryRoot "infra\p1\docker-compose.yml"
$runtimeDirectory = Join-Path $repositoryRoot ".lifebridge-local"
$composeProject = "lifebridge-p3-s1-level-c-$PID"
$pnpmCommand = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$startedProcesses = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$runtimeFiles = [System.Collections.Generic.List[string]]::new()
$playwrightOutputDirectory = Join-Path $runtimeDirectory "$composeProject-playwright"
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

function Stop-SliceProcesses {
  foreach ($process in $startedProcesses) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  $startedProcesses.Clear()
}

function New-UrlSafeKey {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Assert-PrivacySafeRuntimeLogs {
  $prohibited = @(
    "Synthetic morning task",
    "Synthetic recipient",
    "Synthetic relationship",
    "P3-S1 subject synthetic passphrase",
    "P3-S1 member synthetic passphrase",
    "coverage_update",
    "schedule_conflict"
  )
  foreach ($runtimeFile in $runtimeFiles) {
    if (-not (Test-Path -LiteralPath $runtimeFile)) { continue }
    $content = Get-Content -LiteralPath $runtimeFile -Raw
    if ($null -eq $content) { $content = "" }
    foreach ($value in $prohibited) {
      if ($content.Contains($value)) {
        throw "Privacy-sensitive synthetic value found in runtime logs: $value"
      }
    }
  }
}

Push-Location $repositoryRoot
try {
  $parseErrors = $null
  [System.Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path "scripts/validate-p3-s1.ps1"),
    [ref]$null,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) {
    throw "PowerShell syntax validation failed: scripts/validate-p3-s1.ps1"
  }
  foreach ($artifactDirectory in @("test-results", "playwright-report", $playwrightOutputDirectory)) {
    if (Test-Path -LiteralPath $artifactDirectory) {
      throw "Refusing to overwrite pre-existing browser artifact path: $artifactDirectory"
    }
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

  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
  Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
  $postgresPort = if ($UseExistingDatabase) { "5432" } else { $env:P1_POSTGRES_PORT }
  $identityDatabaseUrl = "postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_identity"
  $env:IDENTITY_DATABASE_URL = $identityDatabaseUrl
  $env:IDENTITY_DATA_KEY = New-UrlSafeKey
  $env:IDENTITY_RATE_LIMIT_KEY = New-UrlSafeKey
  $env:IDENTITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_CURSOR_KEY = New-UrlSafeKey
  $env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:IDENTITY_PORT = "3100"
  $env:CARE_PORT = "3101"
  $env:NOTIFICATION_PORT = "3102"
  $env:GATEWAY_PORT = "3001"
  $env:IDENTITY_URL = "http://127.0.0.1:3100"
  $env:CARE_URL = "http://127.0.0.1:3101"
  $env:NOTIFICATION_URL = "http://127.0.0.1:3102"
  $env:GATEWAY_URL = "http://127.0.0.1:3001"
  $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
  $env:P3_PLAYWRIGHT_OUTPUT_DIR = $playwrightOutputDirectory
  $env:APP_ORIGIN = $env:PLAYWRIGHT_BASE_URL
  $env:GATEWAY_HOST = "127.0.0.1"
  $env:RUNTIME_MODE = "test"
  $env:FIXTURE_IDENTITY = "false"
  $env:NODE_ENV = "production"

  Invoke-Pnpm run format:p3:check
  Invoke-Pnpm run lint
  Invoke-Pnpm run typecheck
  Invoke-Pnpm run test:unit
  Invoke-Pnpm run test:contracts
  Invoke-Pnpm run test:p1:integration
  Invoke-Pnpm run test:p3-s1:integration
  Invoke-Pnpm run test:p3-s1:migration
  Invoke-Pnpm run validate:docs
  Invoke-Pnpm run validate:config
  Invoke-Pnpm run validate:secrets
  Invoke-Pnpm run security:deps
  Invoke-Pnpm run build

  # Cumulative P1 real-browser regression uses its existing fixture identity boundary.
  Invoke-Pnpm exec tsx tools/quality/src/p1-reset.ts
  $env:FIXTURE_IDENTITY = "true"
  Start-SliceProcess "p1-notification" $repositoryRoot @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-SliceProcess "p1-care" $repositoryRoot @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-SliceProcess "p1-gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-SliceProcess "p1-web" (Join-Path $repositoryRoot "apps\web") @(
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"
  )
  Wait-Ready $env:PLAYWRIGHT_BASE_URL
  Invoke-Pnpm run test:p1:browser
  Stop-SliceProcesses

  # P3 runtime requires the live P2 authority service and never accepts fixture actors.
  $env:FIXTURE_IDENTITY = "false"
  Start-SliceProcess "p3-notification" $repositoryRoot @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-SliceProcess "p3-care" $repositoryRoot @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-SliceProcess "p3-identity" $repositoryRoot @("services/identity-consent/dist/main.mjs")
  Wait-Ready "$($env:IDENTITY_URL)/health/ready"
  Start-SliceProcess "p3-gateway" $repositoryRoot @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-SliceProcess "p3-web" (Join-Path $repositoryRoot "apps\web") @(
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"
  )
  Wait-Ready $env:PLAYWRIGHT_BASE_URL

  $env:P3_S1_REAL_RUNTIME = "1"
  Invoke-Pnpm run test:p3-s1:browser
  Remove-Item Env:P3_S1_REAL_RUNTIME
  Assert-PrivacySafeRuntimeLogs

  # Relevant P2 governed-access UI regressions run mocked; real P2 integration already ran above.
  Invoke-Pnpm run test:p2-s3:browser
  Invoke-Pnpm run test:p2-s2:browser
  Invoke-Pnpm run test:p2:browser

  git diff --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed." }
  Write-Host "P3-S1 Level C validation passed."
} finally {
  Stop-SliceProcesses
  foreach ($runtimeFile in $runtimeFiles) {
    $resolvedParent = (Resolve-Path (Split-Path -Parent $runtimeFile)).Path
    if ($resolvedParent -ne $runtimeDirectory) {
      throw "Refusing to remove a runtime file outside the task runtime directory."
    }
    Remove-Item -LiteralPath $runtimeFile -Force -ErrorAction SilentlyContinue
  }
  foreach ($artifactDirectory in @(
    (Join-Path $repositoryRoot "test-results"),
    (Join-Path $repositoryRoot "playwright-report"),
    $playwrightOutputDirectory
  )) {
    if (-not (Test-Path -LiteralPath $artifactDirectory)) { continue }
    $resolvedArtifact = (Resolve-Path -LiteralPath $artifactDirectory).Path
    $allowedParent = if ($resolvedArtifact -eq $playwrightOutputDirectory) {
      $runtimeDirectory
    } else {
      $repositoryRoot
    }
    if ((Split-Path -Parent $resolvedArtifact) -ne $allowedParent) {
      throw "Refusing to remove a browser artifact outside its validated parent."
    }
    Remove-Item -LiteralPath $resolvedArtifact -Recurse -Force
  }
  if ($ownsDockerResources) {
    docker compose -f $composeFile -p $composeProject down --volumes --remove-orphans
  }
  Pop-Location
}
