param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$MavenArguments
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$runtimeRoot = Join-Path $root ".lifebridge-local\toolchains"
$mavenVersion = "3.9.16"
$mavenSha256 = "5af3b743dd8b876b5c45da33b676251e5f1687712644abb4ee519ca56e1d89ce"
$archive = Join-Path $runtimeRoot "apache-maven-$mavenVersion-bin.zip"
$mavenHome = Join-Path $runtimeRoot "apache-maven-$mavenVersion"
$mavenCommand = Join-Path $mavenHome "bin\mvn.cmd"
$acceptedJdk = Join-Path $runtimeRoot "temurin-25.0.3+9"

New-Item -ItemType Directory -Force -Path $runtimeRoot | Out-Null

$javaHome = $acceptedJdk
$java = Join-Path $javaHome "bin\java.exe"
if (-not (Test-Path -LiteralPath $java)) {
  throw "Accepted repository-scoped JDK is unavailable. Run scripts/bootstrap-community-toolchain.ps1."
}
$savedErrorPreference = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
  $javaVersion = (& $java -version 2>&1 | Out-String)
  $javaExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $savedErrorPreference
}
if ($javaExit -ne 0) {
  throw "Accepted repository-scoped JDK failed its version check."
}
if ($javaVersion -notmatch 'version "25\.0\.3"') {
  throw "JAVA_HOME does not reference accepted Temurin 25.0.3+9."
}
$env:JAVA_HOME = (Resolve-Path -LiteralPath $javaHome).Path

if (-not (Test-Path -LiteralPath $archive)) {
  Invoke-WebRequest -UseBasicParsing `
    -Uri "https://archive.apache.org/dist/maven/maven-3/$mavenVersion/binaries/apache-maven-$mavenVersion-bin.zip" `
    -OutFile $archive
}
if ((Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToLowerInvariant() -ne $mavenSha256) {
  throw "Maven distribution checksum mismatch."
}
if (-not (Test-Path -LiteralPath $mavenCommand)) {
  $extractRoot = Join-Path $runtimeRoot "maven-extract-$PID"
  if (Test-Path -LiteralPath $extractRoot) {
    throw "Refusing to overwrite Maven extraction path: $extractRoot"
  }
  New-Item -ItemType Directory -Path $extractRoot | Out-Null
  try {
    Expand-Archive -LiteralPath $archive -DestinationPath $extractRoot
    $extracted = Join-Path $extractRoot "apache-maven-$mavenVersion"
    if (-not (Test-Path -LiteralPath (Join-Path $extracted "bin\mvn.cmd"))) {
      throw "Maven archive layout is invalid."
    }
    Move-Item -LiteralPath $extracted -Destination $mavenHome
  } finally {
    if (Test-Path -LiteralPath $extractRoot) {
      Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }
  }
}

& $mavenCommand @MavenArguments
exit $LASTEXITCODE
