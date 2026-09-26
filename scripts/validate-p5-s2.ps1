param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall,
  [switch]$TargetedRecoveryAfterPortConflict
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtime = Join-Path $root ".lifebridge-local"
$compose = Join-Path $root "infra\p1\docker-compose.yml"
$expectedBranch = "phase/5-volunteer-match-organization-coordination"
$acceptedBase = "e56df0f7d36a37f00e3c9750d112464e32cf09a1"
$invocationId = [guid]::NewGuid().ToString("N")
$marker = Join-Path $runtime "p5-s2-level-c-invoked.json"
$ledger = Join-Path $runtime "p5-s2-level-c-$invocationId.ledger.jsonl"
$transcript = Join-Path $runtime "p5-s2-level-c-$invocationId.transcript.log"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$maven = if ($env:OS -eq "Windows_NT") { Join-Path $root "mvnw.cmd" } else { Join-Path $root "mvnw" }
$hosted = $env:GITHUB_ACTIONS -eq "true"
$evidenceStarted = $false
$project = "lifebridge-p5-s2-level-c-$PID-$($invocationId.Substring(0, 8))"
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$logs = [System.Collections.Generic.List[string]]::new()
$composeStarted = $false
$ownsDocker = -not $UseExistingDatabase
$cleanupError = $null
$java = $null
$campaignPassed = $false
$targetedRecoveryStarted = $false

function Write-Ledger {
  param(
    [string]$Stage,
    [ValidateSet("start", "pass", "fail")][string]$State,
    [string]$Command,
    [int]$ExitCode
  )
  $record = [ordered]@{
    utc = [DateTime]::UtcNow.ToString("o")
    invocationId = $invocationId
    stage = $Stage
    state = $State
    command = $Command
    exitCode = $ExitCode
  }
  $record | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding UTF8
  "$($record.utc) [$State] ${Stage}: $Command (exit $ExitCode)" |
    Add-Content -LiteralPath $transcript -Encoding UTF8
}

function Invoke-Stage {
  param([string]$Name, [string]$Command, [scriptblock]$Action)
  Write-Ledger $Name start $Command 0
  try {
    & $Action
    Write-Ledger $Name pass $Command 0
  } catch {
    Write-Ledger $Name fail $Command 1
    throw
  }
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $pnpm @Arguments
  if ($LASTEXITCODE -ne 0) { throw "pnpm failed: $($Arguments -join ' ')" }
}

function Invoke-Maven {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  & $maven @Arguments
  if ($LASTEXITCODE -ne 0) { throw "Maven failed: $($Arguments -join ' ')" }
}

function New-Key {
  $bytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($bytes) } finally { $random.Dispose() }
  return [Convert]::ToBase64String($bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function Test-PortListening {
  param([int]$Port)
  $client = [Net.Sockets.TcpClient]::new()
  try {
    $task = $client.ConnectAsync("127.0.0.1", $Port)
    return $task.Wait(250) -and $client.Connected
  } catch { return $false } finally { $client.Dispose() }
}

function Assert-PortsFree {
  param([int[]]$Ports)
  foreach ($port in $Ports) {
    $free = $false
    for ($attempt = 0; $attempt -lt 10; $attempt++) {
      if (-not (Test-PortListening $port)) { $free = $true; break }
      Start-Sleep -Milliseconds 250
    }
    if (-not $free) { throw "Required task-owned port is already listening: $port" }
  }
}

function Start-NodeApp {
  param([string]$Name, [string]$WorkingDirectory, [string[]]$Arguments)
  $out = Join-Path $runtime "$project-$Name.out.log"
  $err = Join-Path $runtime "$project-$Name.err.log"
  $logs.Add($out); $logs.Add($err)
  $options = @{
    FilePath = (Get-Command node -ErrorAction Stop).Source
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $out
    RedirectStandardError = $err
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $options.WindowStyle = "Hidden" }
  $processes.Add((Start-Process @options))
}

function Start-JavaApp {
  $out = Join-Path $runtime "$project-community.out.log"
  $err = Join-Path $runtime "$project-community.err.log"
  $logs.Add($out); $logs.Add($err)
  $options = @{
    FilePath = $script:java
    ArgumentList = @("-jar", (Join-Path $root "services\community\target\lifebridge-community.jar"))
    WorkingDirectory = $root
    RedirectStandardOutput = $out
    RedirectStandardError = $err
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $options.WindowStyle = "Hidden" }
  $processes.Add((Start-Process @options))
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
    try {
      if ((Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 2).StatusCode -eq 200) { return }
    } catch {}
    Start-Sleep -Milliseconds 500
  }
  throw "Runtime not ready: $Url"
}

function Get-DiffDigest {
  $tracked = (& git diff HEAD --binary -- . ':(exclude)docs/orchestration/reports/STITCH_MCP_CANARY.md') -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "Candidate diff unavailable" }
  $untracked = @(& git ls-files --others --exclude-standard |
      Where-Object { $_ -ne "docs/orchestration/reports/STITCH_MCP_CANARY.md" } |
      Sort-Object)
  $material = $tracked + "`n--untracked--`n"
  foreach ($path in $untracked) {
    $material += "$path`t$((Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $root $path)).Hash)`n"
  }
  $bytes = [Text.Encoding]::UTF8.GetBytes($material)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant() }
  finally { $sha.Dispose() }
}

Push-Location $root
try {
  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  $head = (& git rev-parse HEAD).Trim()
  $branch = ((@(& git branch --show-current)) -join "").Trim()
  if ($TargetedRecoveryAfterPortConflict) {
    if ($hosted -or $UseExistingDatabase -or $SkipInstall) {
      throw "Port-conflict recovery is local-only and cannot use bypass flags"
    }
    if (-not (Test-Path -LiteralPath $marker)) { throw "Recovery requires the one-shot marker" }
    $markerRecord = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if (
      $markerRecord.invocationId -ne "fbbdf1f7e40a4046aeb8dfe4297ae553" -or
      $markerRecord.acceptedBase -ne $acceptedBase -or
      $markerRecord.head -ne $acceptedBase -or
      $markerRecord.branch -ne $expectedBranch -or
      $markerRecord.command -ne "pnpm.cmd run validate:p5-s2" -or
      $head -ne $markerRecord.head -or $branch -ne $expectedBranch
    ) { throw "Marker/candidate does not match the classified P5-S2 invocation" }
    $invocationId = [string]$markerRecord.invocationId
    $ledger = Join-Path $runtime "p5-s2-level-c-$invocationId.ledger.jsonl"
    $transcript = Join-Path $runtime "p5-s2-level-c-$invocationId.transcript.log"
    if (-not (Test-Path $ledger) -or -not (Test-Path $transcript)) {
      throw "Recovery requires the original ledger and transcript"
    }
    $entries = @(Get-Content $ledger | Where-Object { $_.Trim() } | ForEach-Object { $_ | ConvertFrom-Json })
    if ($entries | Where-Object { $_.invocationId -ne $invocationId }) {
      throw "Recovery ledger invocation identity mismatch"
    }
    foreach ($required in @(
      @("toolchain-candidate", "pass"), @("locked-install", "pass"),
      @("static-contracts", "pass"), @("governance-security", "pass"),
      @("production-build", "pass"), @("database-provisioning", "fail"),
      @("campaign", "fail"), @("cleanup", "fail")
    )) {
      if (-not ($entries | Where-Object { $_.stage -eq $required[0] -and $_.state -eq $required[1] })) {
        throw "Recovery ledger lacks required $($required[0]):$($required[1]) evidence"
      }
    }
    if ($entries | Where-Object { $_.stage -eq "targeted-port-continuation" }) {
      throw "Port-conflict recovery was already invoked"
    }
    foreach ($forbidden in @("postgresql-v2", "mixed-runtime-browser", "candidate-cleanliness")) {
      if ($entries | Where-Object { $_.stage -eq $forbidden }) {
        throw "Original campaign advanced beyond classified port conflict"
      }
    }
    Assert-PortsFree @(3200, 3201, 3210, 3211, 3212, 3213, 56432)
    $diffDigest = Get-DiffDigest
    $project = "lifebridge-p5-s2-recovery-$PID-$($invocationId.Substring(0, 8))"
    $evidenceStarted = $true
    $targetedRecoveryStarted = $true
    Write-Ledger "targeted-candidate" pass `
      "classification=transient-port-3000;originalDigest=$($markerRecord.diffDigest);correctedDigest=$diffDigest" 0
    Write-Ledger "targeted-port-continuation" start `
      "scripts/validate-p5-s2.ps1 -TargetedRecoveryAfterPortConflict" 0
  } else {
    if (Test-Path -LiteralPath $marker) {
      throw "P5-S2 Level C was already invoked; retain evidence and use classified targeted recovery only."
    }
  if ($hosted) {
    if (-not $UseExistingDatabase -or -not $SkipInstall) {
      throw "Hosted P5-S2 requires the isolated database and locked-install bypass flags."
    }
    $expectedSha = if ($env:EXPECTED_SHA) { $env:EXPECTED_SHA } else { $env:GITHUB_SHA }
    if ($head -ne $expectedSha) { throw "Hosted checkout does not match EXPECTED_SHA" }
  } else {
    if ($UseExistingDatabase -or $SkipInstall) { throw "Bypass flags are hosted-CI-only" }
    if ($branch -ne $expectedBranch) { throw "P5-S2 Level C requires branch $expectedBranch" }
    & git merge-base --is-ancestor $acceptedBase $head
    if ($LASTEXITCODE -ne 0) { throw "Candidate is not based on accepted canonical dev" }
  }
  $diffDigest = Get-DiffDigest
  [ordered]@{
    invokedUtc = [DateTime]::UtcNow.ToString("o")
    invocationId = $invocationId
    acceptedBase = $acceptedBase
    head = $head
    branch = if ($hosted) { "detached:$($env:GITHUB_REF)" } else { $branch }
    diffDigest = $diffDigest
    command = if ($hosted) {
      "./scripts/validate-p5-s2.ps1 -UseExistingDatabase -SkipInstall"
    } else {
      "pnpm.cmd run validate:p5-s2"
    }
  } | ConvertTo-Json | Set-Content -LiteralPath $marker -Encoding UTF8
  New-Item -ItemType File -Path $ledger -ErrorAction Stop | Out-Null
  New-Item -ItemType File -Path $transcript -ErrorAction Stop | Out-Null
  $evidenceStarted = $true
  }

  if (-not $TargetedRecoveryAfterPortConflict) {
  Invoke-Stage "toolchain-candidate" "exact candidate and pinned Node/Java/Maven" {
    $nodeVersion = node --version
    if ($hosted -and $nodeVersion -notmatch '^v22\.22\.3$') {
      throw "Hosted P5-S2 requires Node 22.22.3"
    }
    if (-not $hosted -and $nodeVersion -notmatch '^v22\.') {
      Write-Ledger "known-local-node-deviation" pass `
        "observed=$nodeVersion;hosted Node 22.22.3 remains decisive" 0
    }
    if (-not $hosted) { & (Join-Path $root "scripts\bootstrap-community-toolchain.ps1") }
    $script:java = if ($hosted) {
      Join-Path $env:JAVA_HOME "bin/java"
    } else {
      Join-Path $runtime "toolchains\temurin-25.0.3+9\bin\java.exe"
    }
    if (-not (Test-Path -LiteralPath $script:java)) { throw "Accepted Java runtime unavailable" }
    Invoke-Maven -B -ntp -version
  }
  if (-not $SkipInstall) {
    Invoke-Stage "locked-install" "pnpm install --frozen-lockfile" {
      Invoke-Pnpm install --frozen-lockfile
    }
  }
  Invoke-Stage "static-contracts" "P5-S2 format/lint/type/unit/contracts/integrity" {
    Invoke-Pnpm run format:p5-s2:check
    Invoke-Pnpm run lint
    Invoke-Pnpm run typecheck
    Invoke-Pnpm run test:unit
    Invoke-Pnpm run test:p5-s2:contracts
    & node --experimental-strip-types tools/quality/src/p5-s2-contract-integrity.ts
    if ($LASTEXITCODE -ne 0) { throw "P5-S2 contract integrity failed" }
    Invoke-Maven -B -ntp -f services/community/pom.xml clean test
  }
  Invoke-Stage "governance-security" "docs/config/secrets/dependency validation" {
    Invoke-Pnpm run validate:docs
    Invoke-Pnpm run validate:config
    Invoke-Pnpm run validate:secrets
    Invoke-Pnpm run security:deps
  }
  Invoke-Stage "production-build" "Node builds and Community verify" {
    Invoke-Pnpm run build
    Invoke-Maven -B -ntp -f services/community/pom.xml clean verify
    $first = (Get-FileHash -Algorithm SHA256 services/community/target/lifebridge-community.jar).Hash
    Invoke-Maven -B -ntp -f services/community/pom.xml clean verify
    $second = (Get-FileHash -Algorithm SHA256 services/community/target/lifebridge-community.jar).Hash
    if ($first -ne $second) { throw "Community package is not reproducible" }
  }
  } else {
    $script:java = Join-Path $runtime "toolchains\temurin-25.0.3+9\bin\java.exe"
    if (-not (Test-Path -LiteralPath $script:java)) { throw "Accepted Java runtime unavailable" }
  }
  Invoke-Stage "database-provisioning" "isolated PostgreSQL and service owners" {
    Assert-PortsFree @(3200, 3201, 3210, 3211, 3212, 3213)
    if ($ownsDocker) {
      Assert-PortsFree @(56432)
      $env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P2_IDENTITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P5_COMMUNITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_POSTGRES_PORT = "56432"
      $env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:56432/postgres"
      $env:P2_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
      $env:P5_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
      docker compose -f $compose -p $project config --quiet
      if ($LASTEXITCODE -ne 0) { throw "Compose configuration invalid" }
      docker compose -f $compose -p $project up -d --wait
      if ($LASTEXITCODE -ne 0) { throw "PostgreSQL startup failed" }
      $script:composeStarted = $true
    } else {
      foreach ($name in @(
        "P1_ADMIN_DATABASE_URL", "P1_CARE_DATABASE_PASSWORD", "P1_NOTIFICATION_DATABASE_PASSWORD",
        "P2_ADMIN_DATABASE_URL", "P2_IDENTITY_DATABASE_PASSWORD", "P5_ADMIN_DATABASE_URL",
        "P5_COMMUNITY_DATABASE_PASSWORD"
      )) {
        if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) { throw "$name is required" }
      }
    }
    $postgresPort = if ($UseExistingDatabase) { "5432" } else { "56432" }
    $env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_care"
    $env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_notification"
    Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
    Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
    Invoke-Pnpm exec tsx tools/quality/src/p5-s1-database.ts
    $env:IDENTITY_DATABASE_URL = "postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_identity"
    $env:P5_S2_COMMUNITY_TEST_DATABASE_URL = "postgresql://lifebridge_community:$($env:P5_COMMUNITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_community"
    $env:COMMUNITY_DATABASE_URL = "jdbc:postgresql://127.0.0.1:$postgresPort/lifebridge_community"
    $env:COMMUNITY_DATABASE_USERNAME = "lifebridge_community"
    $env:COMMUNITY_DATABASE_PASSWORD = $env:P5_COMMUNITY_DATABASE_PASSWORD
  }
  Invoke-Stage "postgresql-v2" "P5-S2 rollback/reapply/no-backfill/owner isolation" {
    Invoke-Pnpm run test:p5-s2:migration
    $env:P5_S2_COMMUNITY_INTEGRATION = "1"
    try {
      Invoke-Maven -B -ntp -f services/community/pom.xml test
    } finally {
      Remove-Item Env:P5_S2_COMMUNITY_INTEGRATION -ErrorAction SilentlyContinue
    }
  }
  Invoke-Stage "mixed-runtime-browser" "P5-S2 runtime and mocked Chromium" {
    $env:IDENTITY_DATA_KEY = New-Key
    $env:IDENTITY_RATE_LIMIT_KEY = New-Key
    $env:IDENTITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
    $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
    $env:CARE_CURSOR_KEY = New-Key
    $env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
    $env:COMMUNITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
    $env:IDENTITY_PORT = "3210"; $env:CARE_PORT = "3211"; $env:NOTIFICATION_PORT = "3212"
    $env:COMMUNITY_PORT = "3213"; $env:GATEWAY_PORT = "3201"
    $env:IDENTITY_URL = "http://127.0.0.1:3210"; $env:CARE_URL = "http://127.0.0.1:3211"
    $env:NOTIFICATION_URL = "http://127.0.0.1:3212"; $env:COMMUNITY_URL = "http://127.0.0.1:3213"
    $env:GATEWAY_URL = "http://127.0.0.1:3201"; $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3200"
    $env:APP_ORIGIN = $env:PLAYWRIGHT_BASE_URL; $env:GATEWAY_HOST = "127.0.0.1"
    $env:COMMUNITY_HOST = "127.0.0.1"; $env:COMMUNITY_FIXTURES_ENABLED = "true"
    $env:COMMUNITY_ALLOWED_PROVINCE_CITY_CODES = "SYN-PC-001,SYN-PC-002"
    $env:RUNTIME_MODE = "test"; $env:FIXTURE_IDENTITY = "false"; $env:NODE_ENV = "production"
    $env:P5_S2_PLAYWRIGHT_OUTPUT_DIR = Join-Path $runtime "$project-playwright"
    Start-NodeApp "notification" $root @("services/notification/dist/main.mjs")
    Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
    Start-NodeApp "care" $root @("services/care-coordination/dist/main.mjs")
    Wait-Ready "$($env:CARE_URL)/health/ready"
    Start-NodeApp "identity" $root @("services/identity-consent/dist/main.mjs")
    Wait-Ready "$($env:IDENTITY_URL)/health/ready"
    Start-JavaApp
    Wait-Ready "$($env:COMMUNITY_URL)/health/ready"
    Start-NodeApp "gateway" $root @("apps/gateway/dist/main.mjs")
    Wait-Ready "$($env:GATEWAY_URL)/health/ready"
    Start-NodeApp "web" (Join-Path $root "apps\web") @(
      "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3200"
    )
    Wait-Ready $env:PLAYWRIGHT_BASE_URL
    $env:P5_S2_REAL_RUNTIME = "1"
    try { Invoke-Pnpm run test:p5-s2:browser }
    finally { Remove-Item Env:P5_S2_REAL_RUNTIME -ErrorAction SilentlyContinue }
  }
  Invoke-Stage "candidate-cleanliness" "privacy sentinel and immutable diff" {
    if ((Get-DiffDigest) -ne $diffDigest) { throw "Candidate changed during P5-S2 Level C" }
    $canary = & git status --short -- docs/orchestration/reports/STITCH_MCP_CANARY.md
    if ($canary) { throw "Protected Stitch canary has a worktree/index change" }
  }
  if ($targetedRecoveryStarted) {
    Write-Ledger "targeted-port-continuation" pass `
      "database, migration, integration, runtime browser, cleanliness passed" 0
    Write-Host "P5-S2 targeted continuation passed; the original one-shot campaign remains failed evidence."
  } else {
    Write-Ledger "campaign" pass "pnpm.cmd run validate:p5-s2" 0
    Write-Host "P5-S2 Level C validation passed."
  }
  $campaignPassed = $true
} catch {
  if ($evidenceStarted) {
    if ($targetedRecoveryStarted) {
      Write-Ledger "targeted-port-continuation" fail "classified continuation failed" 1
    } else {
      Write-Ledger "campaign" fail "pnpm.cmd run validate:p5-s2" 1
    }
  }
  throw
} finally {
  foreach ($process in $processes) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      try { $process.WaitForExit(5000) | Out-Null } catch {}
    }
    $process.Dispose()
  }
  if ($ownsDocker -and $composeStarted) {
    docker compose -f $compose -p $project down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0) { $cleanupError = "Docker cleanup failed" }
  }
  if ($campaignPassed) {
    $runtimeRoot = (Resolve-Path -LiteralPath $runtime).Path
    foreach ($path in @($logs) + @((Join-Path $runtime "$project-playwright"))) {
      if (-not (Test-Path -LiteralPath $path)) { continue }
      $resolved = (Resolve-Path -LiteralPath $path).Path
      if (-not $resolved.StartsWith("$runtimeRoot$([IO.Path]::DirectorySeparatorChar)")) {
        $cleanupError = "Unsafe task-owned cleanup path"
        continue
      }
      Remove-Item -LiteralPath $resolved -Recurse -Force
    }
  }
  foreach ($port in @(3200, 3201, 3210, 3211, 3212, 3213)) {
    if (Test-PortListening $port -and $null -eq $cleanupError) {
      $cleanupError = "Task-owned port remains listening: $port"
    }
  }
  if ($evidenceStarted) {
    Write-Ledger "cleanup" $(if ($null -eq $cleanupError) { "pass" } else { "fail" }) `
      "exact PID and compose-project cleanup" $(if ($null -eq $cleanupError) { 0 } else { 1 })
  }
  Pop-Location
  if ($null -ne $cleanupError) { throw $cleanupError }
}
