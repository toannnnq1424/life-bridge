param(
  [switch]$UseExistingDatabase,
  [switch]$SkipInstall,
  [switch]$SkipCumulativeBrowser,
  [switch]$TargetedRecoveryAfterStaticFailure
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$scriptPath = Join-Path $root "scripts\validate-p5-s1.ps1"
$runtime = Join-Path $root ".lifebridge-local"
$compose = Join-Path $root "infra\p1\docker-compose.yml"
$expectedBranch = "phase/5-consented-help-request-directory"
$acceptedBaseHead = "486a5276ef43d143af8692501064e952a59a4829"
$invocationId = [guid]::NewGuid().ToString("N")
$project = "lifebridge-p5-s1-level-c-$PID-$($invocationId.Substring(0, 8))"
$marker = Join-Path $runtime "p5-s1-level-c-invoked.json"
$ledger = Join-Path $runtime "p5-s1-level-c-$invocationId.ledger.jsonl"
$transcript = Join-Path $runtime "p5-s1-level-c-$invocationId.transcript.log"
$artifactCopy = Join-Path $runtime "p5-s1-level-c-$invocationId-community.jar"
$pnpm = if ($env:OS -eq "Windows_NT") { "pnpm.cmd" } else { "pnpm" }
$maven = if ($env:OS -eq "Windows_NT") { Join-Path $root "mvnw.cmd" } else { Join-Path $root "mvnw" }
$node = (Get-Command node -ErrorAction Stop).Source
$java = $null
$processes = [System.Collections.Generic.List[System.Diagnostics.Process]]::new()
$logs = [System.Collections.Generic.List[string]]::new()
$browserOutputs = [System.Collections.Generic.List[string]]::new()
$ports = @(3000, 3001, 3100, 3101, 3102, 3103)
$ownsDocker = -not $UseExistingDatabase
if ($ownsDocker) { $ports += 55432 }
$composeStarted = $false
$campaignCorePassed = $false
$cleanupError = $null
$savedJavaHome = $env:JAVA_HOME
$evidenceStarted = $false
$targetedRecoveryStarted = $false
$commandRecord = $null

foreach ($name in @(
  "p5-s1", "p4-s3", "p4-s2", "p4-s1", "p3-s3", "p3-s2", "p3-s1",
  "p2-s3", "p2-s2", "p2"
)) {
  $browserOutputs.Add((Join-Path $runtime "$project-$name-playwright"))
}

function Get-Sha256Text {
  param([string]$Value)
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    return ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace("-", "").ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Write-Ledger {
  param(
    [string]$Stage,
    [ValidateSet("start", "pass", "fail")][string]$State,
    [string]$Command,
    [int]$ExitCode
  )
  $entry = [ordered]@{
    utc = [DateTime]::UtcNow.ToString("o")
    invocationId = $invocationId
    stage = $Stage
    state = $State
    command = $Command
    exitCode = $ExitCode
  }
  $entry | ConvertTo-Json -Compress | Add-Content -LiteralPath $ledger -Encoding UTF8
  if (Test-Path -LiteralPath $transcript) {
    "$($entry.utc) [$($entry.state)] $($entry.stage): $($entry.command) (exit $($entry.exitCode))" |
      Add-Content -LiteralPath $transcript -Encoding UTF8
  }
}

function Invoke-Stage {
  param(
    [string]$Name,
    [string]$Command,
    [scriptblock]$Action
  )
  Write-Ledger -Stage $Name -State start -Command $Command -ExitCode 0
  try {
    & $Action
    Write-Ledger -Stage $Name -State pass -Command $Command -ExitCode 0
  } catch {
    Write-Ledger -Stage $Name -State fail -Command $Command -ExitCode 1
    throw
  }
}

function Invoke-Pnpm {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $command = "$pnpm $($Arguments -join ' ')"
  Write-Ledger -Stage "command:pnpm" -State start -Command $command -ExitCode 0
  & $pnpm @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Ledger -Stage "command:pnpm" -State fail -Command $command -ExitCode $exitCode
    throw "pnpm failed: $($Arguments -join ' ')"
  }
  Write-Ledger -Stage "command:pnpm" -State pass -Command $command -ExitCode 0
}

function Invoke-Maven {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $command = "$maven $($Arguments -join ' ')"
  Write-Ledger -Stage "command:maven-wrapper" -State start -Command $command -ExitCode 0
  & $maven @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Ledger -Stage "command:maven-wrapper" -State fail -Command $command -ExitCode $exitCode
    throw "Repository Maven wrapper failed: $($Arguments -join ' ')"
  }
  Write-Ledger -Stage "command:maven-wrapper" -State pass -Command $command -ExitCode 0
}

function Invoke-Node {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
  $command = "$node $($Arguments -join ' ')"
  Write-Ledger -Stage "command:node" -State start -Command $command -ExitCode 0
  & $node @Arguments
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    Write-Ledger -Stage "command:node" -State fail -Command $command -ExitCode $exitCode
    throw "Node command failed: $($Arguments -join ' ')"
  }
  Write-Ledger -Stage "command:node" -State pass -Command $command -ExitCode 0
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
  } catch {
    return $false
  } finally {
    $client.Dispose()
  }
}

function Assert-PortsAvailable {
  param([int[]]$PortList)
  foreach ($port in $PortList) {
    if (Test-PortListening $port) { throw "Required task-owned port is already listening: $port" }
  }
}

function Start-NodeApp {
  param([string]$Name, [string]$WorkingDirectory, [string[]]$Arguments)
  $out = Join-Path $runtime "$project-$Name.out.log"
  $err = Join-Path $runtime "$project-$Name.err.log"
  if ((Test-Path -LiteralPath $out) -or (Test-Path -LiteralPath $err)) {
    throw "Refusing to overwrite runtime log for $Name"
  }
  $logs.Add($out)
  $logs.Add($err)
  $options = @{
    FilePath = $node
    ArgumentList = $Arguments
    WorkingDirectory = $WorkingDirectory
    RedirectStandardOutput = $out
    RedirectStandardError = $err
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $options.WindowStyle = "Hidden" }
  $process = Start-Process @options
  $processes.Add($process)
  Write-Ledger -Stage "child-process" -State pass -Command (
    "name=$Name;pid=$($process.Id);executable=node;arguments=$($Arguments -join ' ');logs=$([IO.Path]::GetFileName($out)),$([IO.Path]::GetFileName($err))"
  ) -ExitCode 0
}

function Start-JavaApp {
  param([string]$Jar)
  $out = Join-Path $runtime "$project-community.out.log"
  $err = Join-Path $runtime "$project-community.err.log"
  if ((Test-Path -LiteralPath $out) -or (Test-Path -LiteralPath $err)) {
    throw "Refusing to overwrite Community runtime log"
  }
  $logs.Add($out)
  $logs.Add($err)
  $options = @{
    FilePath = $java
    ArgumentList = @("-jar", $Jar)
    WorkingDirectory = $root
    RedirectStandardOutput = $out
    RedirectStandardError = $err
    PassThru = $true
  }
  if ($env:OS -eq "Windows_NT") { $options.WindowStyle = "Hidden" }
  $process = Start-Process @options
  $processes.Add($process)
  Write-Ledger -Stage "child-process" -State pass -Command (
    "name=community;pid=$($process.Id);executable=accepted-java;arguments=-jar services/community/target/lifebridge-community.jar;logs=$([IO.Path]::GetFileName($out)),$([IO.Path]::GetFileName($err))"
  ) -ExitCode 0
}

function Wait-Ready {
  param([string]$Url)
  for ($attempt = 0; $attempt -lt 120; $attempt++) {
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
  $forbidden = [System.Collections.Generic.List[string]]::new()
  foreach ($value in @(
    "P5-S1 subject synthetic passphrase",
    "P5-S1 synthetic household",
    "Synthetic P5-S1 recipient",
    "Synthetic P5-S1 relationship",
    "SYN-PC-001",
    "submission_integration_",
    "household_integration_",
    "recipient_integration_",
    "account_integration_",
    "password="
  )) { $forbidden.Add($value) }
  foreach ($secretName in @(
    "P1_POSTGRES_ADMIN_PASSWORD", "P1_CARE_DATABASE_PASSWORD",
    "P1_NOTIFICATION_DATABASE_PASSWORD", "P2_IDENTITY_DATABASE_PASSWORD",
    "P5_COMMUNITY_DATABASE_PASSWORD",
    "IDENTITY_DATA_KEY", "IDENTITY_RATE_LIMIT_KEY", "IDENTITY_INTERNAL_TOKEN",
    "CARE_INTERNAL_TOKEN", "CARE_CURSOR_KEY", "NOTIFICATION_INTERNAL_TOKEN",
    "COMMUNITY_INTERNAL_TOKEN", "COMMUNITY_DATABASE_PASSWORD"
  )) {
    $secretItem = Get-Item "env:$secretName" -ErrorAction SilentlyContinue
    if ($secretItem -and $secretItem.Value) { $forbidden.Add($secretItem.Value) }
  }
  foreach ($file in $logs) {
    if (-not (Test-Path -LiteralPath $file)) { continue }
    $content = Get-Content -LiteralPath $file -Raw
    if ($null -eq $content) { $content = "" }
    foreach ($value in $forbidden) {
      if ($content.Contains($value)) {
        throw "Privacy-sensitive P5-S1 sentinel found in a task-owned runtime log"
      }
    }
  }
}

function Assert-Command {
  param([string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command unavailable: $Name"
  }
}

Push-Location $root
try {
  $tokens = $null
  $parseErrors = $null
  [Management.Automation.Language.Parser]::ParseFile(
    $scriptPath,
    [ref]$tokens,
    [ref]$parseErrors
  ) | Out-Null
  if ($parseErrors.Count -gt 0) { throw "PowerShell syntax validation failed" }

  New-Item -ItemType Directory -Force -Path $runtime | Out-Null
  $head = (& git rev-parse HEAD).Trim()
  if ($LASTEXITCODE -ne 0 -or $head -notmatch '^[0-9a-f]{40}$') { throw "Candidate HEAD unavailable" }
  # Hosted Actions intentionally checks out the exact candidate in detached
  # HEAD state, where git emits no branch text. Casting null to string keeps the
  # local branch guard intact while allowing the hosted exact-SHA guard below.
  $branchOutput = @(& git branch --show-current)
  $branch = ($branchOutput -join "").Trim()
  $hosted = $env:GITHUB_ACTIONS -eq "true"

  if ($TargetedRecoveryAfterStaticFailure) {
    if ($hosted) { throw "Targeted local recovery is forbidden on hosted CI" }
    if ($UseExistingDatabase -or $SkipInstall -or $SkipCumulativeBrowser) {
      throw "Targeted local recovery cannot be combined with bypass flags"
    }
    if (-not (Test-Path -LiteralPath $marker)) {
      throw "Targeted recovery requires the immutable one-shot marker"
    }
    $markerRecord = Get-Content -LiteralPath $marker -Raw | ConvertFrom-Json
    if (
      $markerRecord.invocationId -notmatch '^[0-9a-f]{32}$' -or
      $markerRecord.composeProject -notmatch '^lifebridge-p5-s1-level-c-[0-9]+-[0-9a-f]{8}$' -or
      $markerRecord.baseHead -ne $acceptedBaseHead -or
      $markerRecord.head -ne $acceptedBaseHead -or
      $markerRecord.branch -ne $expectedBranch -or
      $markerRecord.command -ne "pnpm.cmd run validate:p5-s1"
    ) {
      throw "One-shot marker is not the accepted local P5-S1 campaign marker"
    }
    if ($branch -ne $expectedBranch -or $head -ne $acceptedBaseHead) {
      throw "Targeted recovery requires the original accepted branch and base HEAD"
    }

    $invocationId = [string]$markerRecord.invocationId
    $project = [string]$markerRecord.composeProject
    $ledger = Join-Path $runtime "p5-s1-level-c-$invocationId.ledger.jsonl"
    $transcript = Join-Path $runtime "p5-s1-level-c-$invocationId.transcript.log"
    $artifactCopy = Join-Path $runtime "p5-s1-level-c-$invocationId-community.jar"
    $browserOutputs.Clear()
    foreach ($name in @(
      "p5-s1", "p4-s3", "p4-s2", "p4-s1", "p3-s3", "p3-s2", "p3-s1",
      "p2-s3", "p2-s2", "p2"
    )) {
      $browserOutputs.Add((Join-Path $runtime "$project-$name-playwright"))
    }
    if (-not (Test-Path -LiteralPath $ledger) -or -not (Test-Path -LiteralPath $transcript)) {
      throw "Targeted recovery requires the original ledger and transcript"
    }
    foreach ($path in (@($artifactCopy, "test-results", "playwright-report") + $browserOutputs)) {
      if (Test-Path -LiteralPath $path) { throw "Refusing to overwrite task evidence path: $path" }
    }

    $recoveryEntries = @(
      Get-Content -LiteralPath $ledger |
        Where-Object { $_.Trim().Length -gt 0 } |
        ForEach-Object { $_ | ConvertFrom-Json }
    )
    if ($recoveryEntries | Where-Object { $_.invocationId -ne $invocationId }) {
      throw "Original ledger invocation identity does not match the one-shot marker"
    }
    $requiredPriorEntries = @(
      @("toolchain-integrity", "pass"),
      @("locked-install", "pass"),
      @("static-schema-integrity", "fail"),
      @("campaign", "fail"),
      @("cleanup", "pass")
    )
    foreach ($required in $requiredPriorEntries) {
      if (-not ($recoveryEntries | Where-Object { $_.stage -eq $required[0] -and $_.state -eq $required[1] })) {
        throw "Original campaign evidence does not match the classified static failure"
      }
    }
    if (-not ($recoveryEntries | Where-Object {
      $_.stage -eq "command:pnpm" -and
      $_.state -eq "fail" -and
      $_.command -eq "pnpm.cmd run format:p1:check"
    })) {
      throw "Targeted recovery is allowed only for the recorded generated-artifact format failure"
    }
    if ($recoveryEntries | Where-Object { $_.stage -eq "targeted-continuation" }) {
      throw "The classified targeted continuation was already invoked"
    }
    foreach ($unstartedStage in @(
      "node-java-contracts", "governance-security-dependencies",
      "production-build-reproducibility", "database-provisioning",
      "cumulative-postgresql", "community-postgresql", "mixed-runtime-browser", "cumulative-browser",
      "privacy-diff-cleanliness"
    )) {
      if ($recoveryEntries | Where-Object { $_.stage -eq $unstartedStage }) {
        throw "Original campaign advanced beyond the classified static failure"
      }
    }
    $branchRecord = $branch
  } else {
    if (Test-Path -LiteralPath $marker) {
      throw "P5-S1 Level C was already invoked; use only classified targeted recovery."
    }
    foreach ($path in (@($ledger, $transcript, $artifactCopy, "test-results", "playwright-report") + $browserOutputs)) {
      if (Test-Path -LiteralPath $path) { throw "Refusing to overwrite task evidence path: $path" }
    }
    if ($hosted) {
      $expectedSha = if ($env:EXPECTED_SHA) { $env:EXPECTED_SHA } else { $env:GITHUB_SHA }
      if ($head -ne $expectedSha) { throw "Hosted checkout does not match EXPECTED_SHA" }
      $branchRecord = "detached:$($env:GITHUB_REF)"
    } else {
      if ($UseExistingDatabase -or $SkipInstall) {
        throw "Database/install bypass flags are hosted-CI-only"
      }
      if ($branch -ne $expectedBranch) { throw "P5-S1 Level C requires branch $expectedBranch" }
      if ($head -ne $acceptedBaseHead) {
        throw "Local P5-S1 candidate must remain based at the accepted canonical dev HEAD before its one-shot campaign"
      }
      $branchRecord = $branch
    }
    if ($SkipCumulativeBrowser) { throw "The accepted P5-S1 campaign cannot skip cumulative browsers" }
  }

  $trackedDiff = (& git diff HEAD --binary -- . ':(exclude)docs/orchestration/reports/STITCH_MCP_CANARY.md') -join "`n"
  if ($LASTEXITCODE -ne 0) { throw "Candidate diff unavailable" }
  $untrackedEvidence = [System.Collections.Generic.List[string]]::new()
  $untracked = @(& git ls-files --others --exclude-standard | Sort-Object)
  if ($LASTEXITCODE -ne 0) { throw "Candidate untracked-file list unavailable" }
  foreach ($portablePath in $untracked) {
    if ($portablePath -eq "docs/orchestration/reports/STITCH_MCP_CANARY.md") { continue }
    $resolvedUntracked = Join-Path $root $portablePath
    $untrackedHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $resolvedUntracked).Hash.ToLowerInvariant()
    $untrackedEvidence.Add("$portablePath`t$untrackedHash")
  }
  $candidateMaterial = $trackedDiff + "`n--untracked--`n" + ($untrackedEvidence -join "`n")
  $diffDigest = Get-Sha256Text $candidateMaterial
  if ($TargetedRecoveryAfterStaticFailure) {
    $commandRecord = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/validate-p5-s1.ps1 -TargetedRecoveryAfterStaticFailure"
    $env:JAVA_HOME = Join-Path $runtime "toolchains\temurin-25.0.3+9"
    $script:java = Join-Path $env:JAVA_HOME "bin\java.exe"
    if (-not (Test-Path -LiteralPath $script:java)) {
      throw "Accepted repository Java runtime is unavailable for targeted recovery"
    }
    $evidenceStarted = $true
    Write-Ledger -Stage "targeted-candidate" -State pass -Command (
      "classification=generated Maven target excluded from source formatting;originalDigest=$($markerRecord.diffDigest);correctedDigest=$diffDigest"
    ) -ExitCode 0
    $targetedRecoveryStarted = $true
    Write-Ledger -Stage "targeted-continuation" -State start -Command $commandRecord -ExitCode 0
  } else {
    $commandRecord = if ($hosted) { "./scripts/validate-p5-s1.ps1 -UseExistingDatabase -SkipInstall" } else { "pnpm.cmd run validate:p5-s1" }
    $markerTemp = "$marker.$invocationId.tmp"
    [ordered]@{
      invokedUtc = [DateTime]::UtcNow.ToString("o")
      processId = $PID
      invocationId = $invocationId
      baseHead = $acceptedBaseHead
      head = $head
      diffDigest = $diffDigest
      branch = $branchRecord
      command = $commandRecord
      composeProject = $project
    } | ConvertTo-Json | Set-Content -LiteralPath $markerTemp -Encoding UTF8
    [IO.File]::Move($markerTemp, $marker)
    New-Item -ItemType File -Path $ledger -ErrorAction Stop | Out-Null
    New-Item -ItemType File -Path $transcript -ErrorAction Stop | Out-Null
    $evidenceStarted = $true

    Invoke-Stage "toolchain-integrity" "accepted JDK 25.0.3+9 and Maven 3.9.16 wrapper verification" {
      $wrapperProperties = Get-Content -LiteralPath (Join-Path $root ".mvn\wrapper\maven-wrapper.properties") -Raw
      foreach ($expected in @(
        "wrapperVersion=3.3.4",
        "wrapperType=only-script",
        "distributionUrl=https://archive.apache.org/dist/maven/maven-3/3.9.16/binaries/apache-maven-3.9.16-bin.zip",
        "distributionSha256Sum=5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce"
      )) {
        if (-not $wrapperProperties.Contains($expected)) { throw "Maven wrapper metadata mismatch" }
      }
      if ($env:OS -eq "Windows_NT") {
        & (Join-Path $root "scripts\bootstrap-community-toolchain.ps1")
        if ($LASTEXITCODE -ne 0) { throw "Repository toolchain bootstrap failed" }
        $env:JAVA_HOME = Join-Path $runtime "toolchains\temurin-25.0.3+9"
        $script:java = Join-Path $env:JAVA_HOME "bin\java.exe"
      } else {
        if (-not $env:JAVA_HOME) { throw "JAVA_HOME is required on the hosted Linux runner" }
        $script:java = Join-Path $env:JAVA_HOME "bin/java"
      }
      $savedVersionErrorPreference = $ErrorActionPreference
      $ErrorActionPreference = "Continue"
      try {
        $version = (& $script:java -version 2>&1 | Out-String)
        $javaVersionExit = $LASTEXITCODE
      } finally {
        $ErrorActionPreference = $savedVersionErrorPreference
      }
      if ($javaVersionExit -ne 0 -or $version -notmatch 'version "25\.0\.3"' -or $version -notmatch 'Temurin') {
        throw "Accepted Java runtime identity mismatch"
      }
      $mavenVersion = (& $maven -B -ntp -version 2>&1 | Out-String)
      if ($LASTEXITCODE -ne 0 -or $mavenVersion -notmatch 'Apache Maven 3\.9\.16' -or $mavenVersion -notmatch 'Java version: 25\.0\.3') {
        throw "Accepted Maven or Maven Java runtime identity mismatch"
      }
      Write-Host $mavenVersion.Trim()
    }

    Invoke-Stage "locked-install" "$pnpm install --frozen-lockfile" {
      if (-not $SkipInstall) { Invoke-Pnpm install --frozen-lockfile }
    }
  }

  Invoke-Stage "static-schema-integrity" "P5-S1 formats, lint, typecheck, and frozen schema integrity" {
    foreach ($format in @(
      "format:p1:check", "format:p2:backend:check", "format:p3:check",
      "format:p3-s2:check", "format:p3-s3:check", "format:p4-s1:check",
      "format:p4-s2:check", "format:p4-s3:check", "format:p5-s1:check"
    )) { Invoke-Pnpm run $format }
    Invoke-Pnpm run lint
    Invoke-Pnpm run typecheck
    Invoke-Node --experimental-strip-types tools/quality/src/p5-s1-contract-integrity.ts
  }

  Invoke-Stage "node-java-contracts" "Node unit/consumer plus Java unit/provider contracts" {
    Invoke-Pnpm run test:unit
    Invoke-Pnpm run test:contracts
    Invoke-Pnpm run test:p5-s1:contracts
    Invoke-Maven -B -ntp -f services/community/pom.xml clean test
  }

  Invoke-Stage "governance-security-dependencies" "docs, config, secrets, Node advisory, and Java SBOM gates" {
    Invoke-Pnpm run validate:docs
    Invoke-Pnpm run validate:config
    Invoke-Pnpm run validate:secrets
    Invoke-Pnpm run security:deps
  }

  Invoke-Stage "production-build-reproducibility" "Node build and two identical clean Maven verify artifacts" {
    Invoke-Pnpm run build
    Invoke-Maven -B -ntp -f services/community/pom.xml clean verify
    $jar = Join-Path $root "services\community\target\lifebridge-community.jar"
    if (-not (Test-Path -LiteralPath $jar)) { throw "Packaged Community artifact unavailable" }
    $sbom = Join-Path $root "services\community\target\classes\META-INF\sbom\community-sbom.json"
    if (-not (Test-Path -LiteralPath $sbom)) {
      throw "Community CycloneDX provenance output unavailable"
    }
    $sbomDocument = Get-Content -LiteralPath $sbom -Raw | ConvertFrom-Json
    if ($sbomDocument.bomFormat -ne "CycloneDX" -or -not $sbomDocument.specVersion) {
      throw "Community CycloneDX provenance output is invalid"
    }
    $firstHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $jar).Hash.ToLowerInvariant()
    Copy-Item -LiteralPath $jar -Destination $artifactCopy
    Invoke-Maven -B -ntp -f services/community/pom.xml clean verify
    $secondHash = (Get-FileHash -Algorithm SHA256 -LiteralPath $jar).Hash.ToLowerInvariant()
    if ($firstHash -ne $secondHash) { throw "Community artifact reproducibility mismatch" }
    Write-Host "Community reproducible artifact SHA-256: $secondHash"
  }

  Invoke-Stage "database-provisioning" "scoped PostgreSQL and service-owner provisioning" {
    Assert-Command docker
    Assert-PortsAvailable $ports
    if ($ownsDocker) {
      $env:P1_POSTGRES_ADMIN_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_CARE_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_NOTIFICATION_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P2_IDENTITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P5_COMMUNITY_DATABASE_PASSWORD = [guid]::NewGuid().ToString("N")
      $env:P1_POSTGRES_PORT = "55432"
      $env:P1_ADMIN_DATABASE_URL = "postgresql://postgres:$($env:P1_POSTGRES_ADMIN_PASSWORD)@127.0.0.1:55432/postgres"
      $env:P2_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
      $env:P5_ADMIN_DATABASE_URL = $env:P1_ADMIN_DATABASE_URL
      $env:CARE_DATABASE_URL = "postgresql://lifebridge_care:$($env:P1_CARE_DATABASE_PASSWORD)@127.0.0.1:55432/lifebridge_care"
      $env:NOTIFICATION_DATABASE_URL = "postgresql://lifebridge_notification:$($env:P1_NOTIFICATION_DATABASE_PASSWORD)@127.0.0.1:55432/lifebridge_notification"
      docker compose -f $compose -p $project config --quiet
      if ($LASTEXITCODE -ne 0) { throw "Compose configuration invalid" }
      docker compose -f $compose -p $project up -d --wait
      $script:composeStarted = $true
      if ($LASTEXITCODE -ne 0) { throw "PostgreSQL startup failed" }
      $env:P5_S1_POSTGRES_CONTAINER = (docker compose -f $compose -p $project ps -q postgres).Trim()
      if ($LASTEXITCODE -ne 0 -or -not $env:P5_S1_POSTGRES_CONTAINER) {
        throw "PostgreSQL container identity unavailable"
      }
    } else {
      foreach ($name in @(
        "P1_ADMIN_DATABASE_URL", "P1_CARE_DATABASE_PASSWORD",
        "P1_NOTIFICATION_DATABASE_PASSWORD", "P2_ADMIN_DATABASE_URL",
        "P2_IDENTITY_DATABASE_PASSWORD", "P5_ADMIN_DATABASE_URL",
        "P5_COMMUNITY_DATABASE_PASSWORD", "P5_S1_POSTGRES_CONTAINER"
      )) {
        if (-not (Get-Item "env:$name" -ErrorAction SilentlyContinue)) {
          throw "$name is required with -UseExistingDatabase"
        }
      }
    }
    $env:P4_S3_POSTGRES_CONTAINER = $env:P5_S1_POSTGRES_CONTAINER
    Invoke-Pnpm exec tsx tools/quality/src/p1-database.ts
    Invoke-Pnpm exec tsx tools/quality/src/p2-database.ts
    Invoke-Pnpm exec tsx tools/quality/src/p5-s1-database.ts
    $postgresPort = if ($UseExistingDatabase) { "5432" } else { "55432" }
    $env:IDENTITY_DATABASE_URL = "postgresql://lifebridge_identity:$($env:P2_IDENTITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_identity"
    $env:P5_S1_COMMUNITY_TEST_DATABASE_URL = "postgresql://lifebridge_community:$($env:P5_COMMUNITY_DATABASE_PASSWORD)@127.0.0.1:$postgresPort/lifebridge_community"
    $env:COMMUNITY_DATABASE_URL = "jdbc:postgresql://127.0.0.1:$postgresPort/lifebridge_community"
    $env:COMMUNITY_DATABASE_USERNAME = "lifebridge_community"
    $env:COMMUNITY_DATABASE_PASSWORD = $env:P5_COMMUNITY_DATABASE_PASSWORD
  }

  Invoke-Stage "cumulative-postgresql" "P1 through P4-S3 integration, migration, and restore regression" {
    foreach ($check in @(
      "test:p1:integration", "test:p3-s1:integration", "test:p3-s2:integration",
      "test:p3-s3:integration", "test:p4-s1:integration", "test:p4-s2:integration",
      "test:p4-s3:integration", "test:p3-s1:migration", "test:p3-s2:migration",
      "test:p2-s3:migration", "test:p3-s3:migration", "test:p4-s1:migration", "test:p4-s2:migration",
      "test:p4-s3:migration", "test:p4-s3:backup-restore"
    )) { Invoke-Pnpm run $check }
  }

  Invoke-Stage "community-postgresql" "Community rollback/reapply/no-backfill/owner isolation and Spring integration" {
    Invoke-Pnpm run test:p5-s1:migration
    $env:P5_S1_COMMUNITY_INTEGRATION = "1"
    try {
      Invoke-Maven -B -ntp -f services/community/pom.xml test
    } finally {
      Remove-Item Env:P5_S1_COMMUNITY_INTEGRATION -ErrorAction SilentlyContinue
    }
  }

  $env:IDENTITY_DATA_KEY = New-Key
  $env:IDENTITY_RATE_LIMIT_KEY = New-Key
  $env:IDENTITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:CARE_CURSOR_KEY = New-Key
  $env:NOTIFICATION_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:COMMUNITY_INTERNAL_TOKEN = [guid]::NewGuid().ToString("N")
  $env:IDENTITY_PORT = "3100"
  $env:CARE_PORT = "3101"
  $env:NOTIFICATION_PORT = "3102"
  $env:COMMUNITY_PORT = "3103"
  $env:GATEWAY_PORT = "3001"
  $env:IDENTITY_URL = "http://127.0.0.1:3100"
  $env:CARE_URL = "http://127.0.0.1:3101"
  $env:NOTIFICATION_URL = "http://127.0.0.1:3102"
  $env:COMMUNITY_URL = "http://127.0.0.1:3103"
  $env:GATEWAY_URL = "http://127.0.0.1:3001"
  $env:PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
  $env:APP_ORIGIN = $env:PLAYWRIGHT_BASE_URL
  $env:GATEWAY_HOST = "127.0.0.1"
  $env:COMMUNITY_HOST = "127.0.0.1"
  $env:COMMUNITY_ALLOWED_PROVINCE_CITY_CODES = "SYN-PC-001,SYN-PC-002"
  $env:COMMUNITY_FIXTURES_ENABLED = "true"
  $env:RUNTIME_MODE = "test"
  $env:FIXTURE_IDENTITY = "false"
  $env:NODE_ENV = "production"
  $env:P5_S1_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[0]
  $env:P4_S3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[1]
  $env:P4_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[2]
  $env:P4_S1_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[3]
  $env:P3_S3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[4]
  $env:P3_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[5]
  $env:P3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[6]
  $env:P2_S3_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[7]
  $env:P2_S2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[8]
  $env:P2_PLAYWRIGHT_OUTPUT_DIR = $browserOutputs[9]

  Invoke-Stage "mixed-runtime-browser" "built Web/Gateway/Identity/Community PostgreSQL LB-022/LB-024 browser proof" {
    Start-NodeApp "notification" $root @("services/notification/dist/main.mjs")
    Wait-Ready "$($env:NOTIFICATION_URL)/health/ready"
    Start-NodeApp "care" $root @("services/care-coordination/dist/main.mjs")
    Wait-Ready "$($env:CARE_URL)/health/ready"
    Start-NodeApp "identity" $root @("services/identity-consent/dist/main.mjs")
    Wait-Ready "$($env:IDENTITY_URL)/health/ready"
    Start-JavaApp (Join-Path $root "services\community\target\lifebridge-community.jar")
    Wait-Ready "$($env:COMMUNITY_URL)/health/ready"
    Start-NodeApp "gateway" $root @("apps/gateway/dist/main.mjs")
    Wait-Ready "$($env:GATEWAY_URL)/health/ready"
    Start-NodeApp "web" (Join-Path $root "apps\web") @(
      "node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3000"
    )
    Wait-Ready $env:PLAYWRIGHT_BASE_URL
    $env:P5_S1_REAL_RUNTIME = "1"
    try { Invoke-Pnpm run test:p5-s1:browser } finally {
      Remove-Item Env:P5_S1_REAL_RUNTIME -ErrorAction SilentlyContinue
    }
  }

  Invoke-Stage "cumulative-browser" "P2 through P4-S3 artifact-disabled Chromium regressions" {
    if (-not $SkipCumulativeBrowser) {
      foreach ($browser in @(
        "test:p4-s3:browser", "test:p4-s2:browser", "test:p4-s1:browser",
        "test:p3-s3:browser", "test:p3-s2:browser", "test:p3-s1:browser",
        "test:p2-s3:browser", "test:p2-s2:browser", "test:p2:browser"
      )) { Invoke-Pnpm run $browser }
    }
  }

  Invoke-Stage "privacy-diff-cleanliness" "runtime sentinel scan, protected canary, and git diff checks" {
    Scan-Logs
    git diff HEAD --check
    if ($LASTEXITCODE -ne 0) { throw "git diff HEAD --check failed" }
    $canaryDiff = (& git diff HEAD -- docs/orchestration/reports/STITCH_MCP_CANARY.md) -join "`n"
    if ($LASTEXITCODE -ne 0 -or $canaryDiff.Length -ne 0) {
      throw "Protected Stitch canary changed"
    }
  }

  $campaignCorePassed = $true
} catch {
  if ($evidenceStarted) {
    if ($TargetedRecoveryAfterStaticFailure -and $targetedRecoveryStarted) {
      Write-Ledger -Stage "targeted-continuation" -State fail -Command "classified targeted recovery failed" -ExitCode 1
    } else {
      Write-Ledger -Stage "campaign" -State fail -Command "classified targeted recovery required" -ExitCode 1
    }
  }
  throw
} finally {
  if ($evidenceStarted) {
    Write-Ledger -Stage "cleanup" -State start -Command "recorded PIDs, logs, browser outputs, artifact copy, Compose project, and ports" -ExitCode 0
  }
  foreach ($process in $processes) {
    if (-not $process.HasExited) {
      Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
      try { $process.WaitForExit(5000) | Out-Null } catch {}
      if (-not $process.HasExited -and $null -eq $cleanupError) {
        $cleanupError = [InvalidOperationException]::new("Recorded task-owned process did not exit: $($process.Id)")
      }
    }
  }
  try { Scan-Logs } catch { $cleanupError = $_ }
  if ($campaignCorePassed -and $null -eq $cleanupError) {
    foreach ($file in $logs) {
      if (Test-Path -LiteralPath $file) {
        $resolvedFile = (Resolve-Path -LiteralPath $file).Path
        if ((Split-Path -Parent $resolvedFile) -ne (Resolve-Path $runtime).Path) {
          $cleanupError = [InvalidOperationException]::new("Unsafe runtime log path")
          break
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
          $cleanupError = [InvalidOperationException]::new("Unsafe browser artifact path")
          break
        }
        Remove-Item -LiteralPath $resolved -Recurse -Force
      }
    }
  }
  if (Test-Path -LiteralPath $artifactCopy) {
    $resolvedArtifact = (Resolve-Path -LiteralPath $artifactCopy).Path
    if ((Split-Path -Parent $resolvedArtifact) -ne (Resolve-Path $runtime).Path) {
      $cleanupError = [InvalidOperationException]::new("Unsafe Community artifact evidence path")
    } else {
      Remove-Item -LiteralPath $resolvedArtifact -Force
    }
  }
  if ($ownsDocker -and $composeStarted) {
    docker compose -f $compose -p $project down --volumes --remove-orphans
    if ($LASTEXITCODE -ne 0 -and $null -eq $cleanupError) {
      $cleanupError = [InvalidOperationException]::new("Docker cleanup failed")
    }
  }
  foreach ($port in $ports) {
    if (Test-PortListening $port -and $null -eq $cleanupError) {
      $cleanupError = [InvalidOperationException]::new("Task-owned port remains listening: $port")
    }
  }
  if ($null -eq $savedJavaHome) {
    Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue
  } else {
    $env:JAVA_HOME = $savedJavaHome
  }
  if ($evidenceStarted) {
    if ($null -ne $cleanupError) {
      Write-Ledger -Stage "cleanup" -State fail -Command "classified exact-target cleanup recovery required" -ExitCode 1
      if ($campaignCorePassed) {
        if ($TargetedRecoveryAfterStaticFailure) {
          Write-Ledger -Stage "targeted-continuation" -State fail -Command "core gates passed; cleanup failed" -ExitCode 1
        } else {
          Write-Ledger -Stage "campaign" -State fail -Command "core gates passed; cleanup failed" -ExitCode 1
        }
      }
    } else {
      Write-Ledger -Stage "cleanup" -State pass -Command "recorded task-owned resources released" -ExitCode 0
      if ($campaignCorePassed) {
        if ($TargetedRecoveryAfterStaticFailure) {
          Write-Ledger -Stage "targeted-continuation" -State pass -Command $commandRecord -ExitCode 0
          Write-Host "P5-S1 targeted continuation passed; the original one-shot campaign remains failed evidence."
        } else {
          Write-Ledger -Stage "campaign" -State pass -Command $commandRecord -ExitCode 0
          Write-Host "P5-S1 Level C validation passed."
        }
      }
    }
  }
  Pop-Location
  if ($null -ne $cleanupError) { throw $cleanupError }
}
