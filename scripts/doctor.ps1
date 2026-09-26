[CmdletBinding()]
param(
    [switch]$FailOnOptional
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

$results = New-Object "System.Collections.Generic.List[object]"

function Add-Result {
    param(
        [Parameter(Mandatory = $true)]
        [ValidateSet("mandatory", "optional")]
        [string]$Requirement,
        [Parameter(Mandatory = $true)]
        [ValidateSet("PASS", "WARN", "FAIL")]
        [string]$Status,
        [Parameter(Mandatory = $true)]
        [string]$Check,
        [Parameter(Mandatory = $true)]
        [string]$Classification,
        [Parameter(Mandatory = $true)]
        [string]$Detail
    )

    $results.Add([PSCustomObject]@{
            Requirement    = $Requirement
            Status         = $Status
            Check          = $Check
            Classification = $Classification
            Detail         = $Detail
        })
}

function Resolve-Application {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    return Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
}

if (
    $env:OS -eq "Windows_NT" -and
    [Environment]::OSVersion.Version.Major -ge 10
) {
    Add-Result "mandatory" "PASS" "Operating system" "environment" (
        "Windows {0} detected; Windows 10/11 is the supported workstation baseline." -f
        [Environment]::OSVersion.Version
    )
}
else {
    Add-Result "mandatory" "FAIL" "Operating system" "environment" (
        "Windows 10/11 is required; detected OS version {0}." -f
        [Environment]::OSVersion.Version
    )
}

if (
    $PSVersionTable.PSVersion.Major -gt 5 -or
    (
        $PSVersionTable.PSVersion.Major -eq 5 -and
        $PSVersionTable.PSVersion.Minor -ge 1
    )
) {
    Add-Result "mandatory" "PASS" "Windows PowerShell" "environment" (
        "Version {0}; scripts require 5.1 or newer." -f $PSVersionTable.PSVersion
    )
}
else {
    Add-Result "mandatory" "FAIL" "Windows PowerShell" "environment" (
        "Version {0} is unsupported." -f $PSVersionTable.PSVersion
    )
}

$git = Resolve-Application "git.exe"
if ($null -eq $git) {
    Add-Result "mandatory" "FAIL" "Git" "dependency" "git.exe was not found."
}
else {
    $gitVersion = (& $git.Source --version).Trim()
    Add-Result "mandatory" "PASS" "Git" "dependency" $gitVersion
}

$node = Resolve-Application "node.exe"
if ($null -eq $node) {
    Add-Result "mandatory" "FAIL" "Node.js" "dependency" "node.exe was not found."
}
else {
    $nodeVersion = (& $node.Source --version).Trim()
    if ($nodeVersion -match "^v22\.") {
        Add-Result "mandatory" "PASS" "Node.js" "dependency" $nodeVersion
    }
    else {
        Add-Result "mandatory" "FAIL" "Node.js" "dependency" (
            "Expected 22.x; detected $nodeVersion."
        )
    }
}

$pnpm = Resolve-Application "pnpm.cmd"
if ($null -eq $pnpm) {
    Add-Result "mandatory" "FAIL" "pnpm" "dependency" (
        "pnpm.cmd was not found. Do not use pnpm.ps1 or change ExecutionPolicy."
    )
}
else {
    $pnpmVersion = (& $pnpm.Source --version).Trim()
    if ($pnpmVersion -eq "11.9.0") {
        Add-Result "mandatory" "PASS" "pnpm" "dependency" $pnpmVersion
    }
    else {
        Add-Result "mandatory" "FAIL" "pnpm" "dependency" (
            "Expected 11.9.0; detected $pnpmVersion."
        )
    }
}

foreach ($requiredFile in @(
        "package.json",
        "pnpm-lock.yaml",
        "pnpm-workspace.yaml",
        "tsconfig.json",
        "eslint.config.mjs",
        ".env.example"
    )) {
    if (Test-Path -LiteralPath $requiredFile -PathType Leaf) {
        Add-Result "mandatory" "PASS" $requiredFile "configuration" "File is present."
    }
    else {
        Add-Result "mandatory" "FAIL" $requiredFile "configuration" "File is missing."
    }
}

$npm = Resolve-Application "npm.cmd"
if ($null -eq $npm) {
    Add-Result "optional" "WARN" "npm.cmd" "dependency" "Not found; pnpm remains canonical."
}
else {
    $npmVersion = (& $npm.Source --version).Trim()
    Add-Result "optional" "PASS" "npm.cmd" "dependency" $npmVersion
}

$corepack = Resolve-Application "corepack.cmd"
if ($null -eq $corepack) {
    Add-Result "optional" "WARN" "Corepack" "dependency" "corepack.cmd was not found."
}
else {
    $corepackVersion = (& $corepack.Source --version).Trim()
    Add-Result "optional" "PASS" "Corepack" "dependency" $corepackVersion
}

$docker = Resolve-Application "docker.exe"
if ($null -eq $docker) {
    Add-Result "optional" "WARN" "Docker CLI" "dependency" (
        "Docker is optional until a slice requires containers."
    )
}
else {
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $dockerClientOutput = @(& $docker.Source --version 2>&1)
    $dockerClientExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    $dockerVersionLine = $dockerClientOutput |
        ForEach-Object { $_.ToString() } |
        Where-Object { $_ -match "^Docker version " } |
        Select-Object -First 1
    if ($dockerClientExitCode -eq 0 -and $null -ne $dockerVersionLine) {
        Add-Result "optional" "PASS" "Docker CLI" "dependency" (
            $dockerVersionLine
        )
    }
    else {
        Add-Result "optional" "WARN" "Docker CLI" "permission" (
            "CLI exists but version inspection failed. No configuration was changed."
        )
    }

    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    $dockerServerOutput = @(& $docker.Source version --format "{{.Server.Version}}" 2>&1)
    $dockerServerExitCode = $LASTEXITCODE
    $ErrorActionPreference = $previousErrorActionPreference
    if ($dockerServerExitCode -eq 0 -and $dockerServerOutput.Count -gt 0) {
        Add-Result "optional" "PASS" "Docker daemon" "environment" (
            "Server version {0}." -f $dockerServerOutput[0]
        )
    }
    else {
        Add-Result "optional" "WARN" "Docker daemon" "environment" (
            "Unavailable or access denied. Diagnose first; do not edit services, registry, " +
            "firewall, or Docker user config automatically."
        )
    }
}

foreach ($optionalCommand in @(
        @{ Name = "gh.exe"; Label = "GitHub CLI" },
        @{ Name = "pwsh.exe"; Label = "PowerShell 7" },
        @{ Name = "python.exe"; Label = "Python" }
    )) {
    $command = Resolve-Application $optionalCommand.Name
    if ($null -eq $command) {
        Add-Result "optional" "WARN" $optionalCommand.Label "dependency" "Not installed; optional."
    }
    else {
        Add-Result "optional" "PASS" $optionalCommand.Label "dependency" (
            "Found at {0}." -f $command.Source
        )
    }
}

Write-Host ""
Write-Host "LifeBridge Windows doctor"
Write-Host "========================="
foreach ($result in $results) {
    Write-Host (
        "[{0}] [{1}] {2} ({3}) - {4}" -f `
            $result.Requirement.ToUpperInvariant(), `
            $result.Status, `
            $result.Check, `
            $result.Classification, `
            $result.Detail
    )
}

$mandatoryFailures = @($results | Where-Object {
        $_.Requirement -eq "mandatory" -and $_.Status -eq "FAIL"
    })
$optionalWarnings = @($results | Where-Object {
        $_.Requirement -eq "optional" -and $_.Status -ne "PASS"
    })

Write-Host ""
Write-Host (
    "Summary: {0} mandatory failure(s), {1} optional warning(s)." -f `
        $mandatoryFailures.Count, `
        $optionalWarnings.Count
)

if ($mandatoryFailures.Count -gt 0) {
    exit 1
}

if ($FailOnOptional -and $optionalWarnings.Count -gt 0) {
    exit 2
}

exit 0
