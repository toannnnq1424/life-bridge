param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall,
  [switch]$SkipCumulativeBrowser
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$compose = Join-Path $root "infra\p1\docker-compose.yml"
$runtime = Join-Path $root ".lifebridge-local"
$project = "lifebridge-p4-s2-level-c-$PID"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$logs = [System.Collections.Generic.List[string]]::new()
$browserOutputs = [System.Collections.Generic.List[string]]::new()
foreach ($name in @("p4-s2", "p4-s1", "p3-s3", "p3-s2", "p3-s1", "p2-s3", "p2-s2", "p2")) {
  $browserOutputs.Add((Join-Path $runtime "$project-$name-playwright"))
}
$ownsDocker = -not $UseExistingDatabase
$composeStarted = $false
New-Item -ItemType Directory -Force -Path $runtime | Out-Null

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $pnpm @Arguments
  if ($LASTEXITCODE -ne 0) { throw "pnpm failed: $($Arguments -join ' ')" }
}

function New-Key {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Start-App {
  param([string]$Name, [string]$WorkingDirectory, [string[]]$Arguments)
  $out = Join-Path $runtime "$project-$Name.out.log"
  $err = Join-Path $runtime "$project-$Name.err.log"
  $logs.Add($out)
  $logs.Add($err)
  $options = @{
    FilePath = "node"
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $out
    RedirectStandardError = $err
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $options.WindowStyle = "Hidden" }
  $processes.Add((Start-Process @options))
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    try {
      if ((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200) {
        return
      }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "Runtime not ready: $Url"
}

function Scan-Logs {
  $forbidden = @(
    "P4-S2 subject synthetic passphrase",
    "P4-S2 synthetic household",
    "Synthetic P4-S2 recipient",
    "Synthetic P4-S2 relationship",
    "Synthetic emergency contact",
    "Synthetic participant-entered step",
    "+66000000001",
    "+66000000002",
    "synthetic offline phrase",
    "displayLabel",
    "dialString",
    "stepText"
  )
  foreach ($file in $logs) {
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $content = Get-Content -LiteralPath $file -Raw
    if ($null -eq $content) { $content = "" }
    foreach ($value in $forbidden) {
      if ($content.Contains($value)) {
        throw "Privacy-sensitive P4-S2 value found in runtime log: $value"
      }
    }
  }
}

Push-Location $root
try {
  $tokens = $null
  $parseErrors = $null
  [Management.Automation.Language.Parser]::ParseFile(
    (Resolve-Path "scripts/validate-p4-s2.ps1"),
    [ref]$tokens,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) { throw "PowerShell syntax validation failed" }
  foreach ($path in (@("test-results", "playwright-report") + $browserOutputs)) {
    if (Test-Path -LiteralPath $path) {
      throw "Refusing to overwrite browser artifact path: $path"
    }
  }

  if ($ownsDocker) {
    $env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P2_IDENTITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
    $env:P1_POSTGRES_PORT = "55432"
    $env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/postgres"
    $env:P2_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
    $env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_care"
    $env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:$($env:P1_POSTGRES_PORT)/lifebridge_notification"
    docker compose -f $compose -p $project config --quiet
    if ($LASTEXITCODE -ne 0) { throw "Compose configuration invalid" }
    docker compose -f $compose -p $project up -d --wait
    $composeStarted = $true
    if ($LASTEXITCODE -ne 0) { throw "PostgreSQL startup failed" }
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
        throw "$name is required with -UseExistingDatabase"
      }
    }
  }

  if (-not $SkipInstall) { Invoke-Pnpm install --frozen-lockfile }
  Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
  Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
  $postgresPort = if ($UseExistingDatabase) { "5432" } else { $env:P1_POSTGRES_PORT }
  $env:IDENTITY_DATABASE_URL = "postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_identity"
  $env:IDENTITY_DATA_KEY = New-Key
  $env:IDENTITY_RATE_LIMIT_KEY = New-Key
  $env:IDENTITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_CURSOR_KEY = New-Key
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
  $env:P4_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[0]
  $env:P4_S1_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[1]
  $env:P3_S3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[2]
  $env:P3_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[3]
  $env:P3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[4]
  $env:P2_S3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[5]
  $env:P2_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[6]
  $env:P2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[7]
  $env:APP_ORIGIN = $env:PLAYWRIGHT_BASE_URL
  $env:GATEWAY_HOST = "127.0.0.1"
  $env:RUNTIME_MODE = "test"
  $env:FIXTURE_IDENTITY = "false"
  $env:NODE_ENV = "production"

  foreach ($format in @(
    "format:p1:check",
    "format:p2:backend:check",
    "format:p3:check",
    "format:p3-s2:check",
    "format:p3-s3:check",
    "format:p4-s1:check",
    "format:p4-s2:check"
  )) { Invoke-Pnpm run $format }
  foreach ($check in @(
    "lint", "typecheck", "test:unit", "test:contracts", "validate:docs",
    "validate:config", "validate:secrets", "security:deps", "build",
    "test:p1:integration", "test:p3-s1:integration", "test:p3-s2:integration",
    "test:p3-s3:integration", "test:p4-s1:integration", "test:p4-s2:integration",
    "test:p3-s1:migration", "test:p3-s2:migration", "test:p3-s3:migration",
    "test:p4-s1:migration", "test:p4-s2:migration"
  )) { Invoke-Pnpm run $check }

  Start-App "notification" $root @("services/notification/dist/main.mjs")
  Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
  Start-App "care" $root @("services/care-coordination/dist/main.mjs")
  Wait-Ready "$($env:CARE_URL)/health/ready"
  Start-App "identity" $root @("services/identity-consent/dist/main.mjs")
  Wait-Ready "$($env:IDENTITY_URL)/health/ready"
  Start-App "gateway" $root @("apps/gateway/dist/main.mjs")
  Wait-Ready "$($env:GATEWAY_URL)/health/ready"
  Start-App "web" (Join-Path $root "apps\web") @(
    "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"
  )
  Wait-Ready $env:PLAYWRIGHT_BASE_URL

  $env:P4_S2_REAL_RUNTIME = "1"
  Invoke-Pnpm run test:p4-s2:browser
  Remove-Item Env:P4_S2_REAL_RUNTIME
  if (-not $SkipCumulativeBrowser) {
    foreach ($browser in @(
      "test:p4-s1:browser", "test:p3-s3:browser", "test:p3-s2:browser",
      "test:p3-s1:browser", "test:p2-s3:browser", "test:p2-s2:browser", "test:p2:browser"
    )) { Invoke-Pnpm run $browser }
  }
  git diff --check
  if ($LASTEXITCODE -ne 0) { throw "git diff --check failed" }
  Write-Host "P4-S2 Level C validation passed."
} finally {
  foreach ($process in $processes) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    }
  }
  $scanError = $null
  try { Scan-Logs } catch { $scanError = $_ }
  foreach ($file in $logs) {
    if (Test-Path -LiteralPath $file) {
      $resolvedFile = (Resolve-Path -LiteralPath $file).Path
      if ((Split-Path -Parent $resolvedFile) -ne (Resolve-Path $runtime).Path) {
        throw "Unsafe runtime log path"
      }
      Remove-Item -LiteralPath $resolvedFile -Force
    }
  }
  foreach ($path in (@(
    (Join-Path $root "test-results"),
    (Join-Path $root "playwright-report")
  ) + $browserOutputs)) {
    if (Test-Path -LiteralPath $path) {
      $resolved = (Resolve-Path -LiteralPath $path).Path
      $allowedParent = if ($resolved.StartsWith($runtime)) { $runtime } else { $root }
      if ((Split-Path -Parent $resolved) -ne $allowedParent) {
        throw "Unsafe browser artifact path"
      }
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
  if ($ownsDocker -and $composeStarted) {
    docker compose -f $compose -p $project down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) { throw "Docker cleanup failed" }
  }
  Pop-Location
  if ($null -ne $scanError) { throw $scanError }
}
