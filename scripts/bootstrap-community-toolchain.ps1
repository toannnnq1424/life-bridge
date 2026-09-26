param()

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $root ".lifebridge-local\toolchains"
$jdkHome = Join-Path $runtimeRoot "temurin-25.0.3+9"
$archive = Join-Path $runtimeRoot "OpenJDK25U-jdk_x64_windows_hotspot_25.0.3_9.zip"
$expectedSha256 = "709312cd0420296d9b9de917fe6e28a5b979e875ee5ab91783fb79bcd5857235"
$downloadUrl = "https://github.com/adoptium/temurin25-binaries/releases/download/jdk-25.0.3%2B9/OpenJDK25U-jdk_x64_windows_hotspot_25.0.3_9.zip"

if ($env:OS -ne "Windows_NT") {
  throw "The repository-scoped Temurin bootstrap is the supported Windows path."
}
New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

if (-not (Test-Path -LiteralPath $archive)) {
  Invoke-WebRequest -UseBasicParsing -Uri $downloadUrl -OutFile $archive
}
$actualSha256 = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant()
if ($actualSha256 -ne $expectedSha256) {
  throw "Temurin archive checksum mismatch."
}

if (-not (Test-Path -LiteralPath (Join-Path $jdkHome "bin\java.exe"))) {
  $extractRoot = Join-Path $runtimeRoot "jdk-extract-$PID"
  if (Test-Path -LiteralPath $extractRoot) {
    throw "Refusing to overwrite JDK extraction path: $extractRoot"
  }
  New-Item -ItemType Directory -Path $extractRoot | Out-Null
  try {
    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot
    $candidates = @(Get-ChildItem -LiteralPath $extractRoot -Directory)
    if ($candidates.Count -ne 1 -or -not (Test-Path -LiteralPath (Join-Path $candidates[0].FullName "bin\java.exe"))) {
      throw "Temurin archive layout is invalid."
    }
    Move-Item -LiteralPath $candidates[0].FullName -Destination $jdkHome
  } finally {
    if (Test-Path -LiteralPath $extractRoot) {
      Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
  }
}

$java = Join-Path $jdkHome "bin\java.exe"
$savedErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $versionOutput = (& $java -version 2>&1 | Out-String)
  $javaExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $savedErrorPreference
}
if ($javaExit -ne 0) {
  throw "Repository-scoped JDK failed its version check."
}
if ($versionOutput -notmatch 'Temurin' -or $versionOutput -notmatch 'version "25\.0\.3"') {
  throw "Repository-scoped JDK identity mismatch."
}

$previousJavaHome = $env:JAVA_HOME
try {
  $env:JAVA_HOME = (Resolve-Path -LiteralPath $jdkHome).Path
  & (Join-Path $root "mvnw.cmd") -B -ntp -version
  if ($LASTEXITCODE -ne 0) {
    throw "Repository Maven wrapper verification failed."
  }
} finally {
  if ($null -eq $previousJavaHome) {
    Remove-Item Env:JAVA_HOME -ErrorAction SilentlyContinue
  } else {
    $env:JAVA_HOME = $previousJavaHome
  }
}

Write-Host "Accepted repository-scoped Temurin 25.0.3+9 and Maven 3.9.16 are ready."
