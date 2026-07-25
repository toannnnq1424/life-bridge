[CmdletBinding()]
param(
    [switch]$Offline,
    [switch]$SkipValidation
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Resolve-RequiredApplication {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $command = Get-Command $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $command) {
        throw "Missing required command '$Name'. Run scripts/doctor.ps1 for classification."
    }

    return $command.Source
}

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory = $true)]
        [string]$FilePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments,
        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    Write-Host "==> $Label"
    & $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "$Label failed with exit code $LASTEXITCODE."
    }
}

$nodePath = Resolve-RequiredApplication -Name "node.exe"
$pnpmPath = Resolve-RequiredApplication -Name "pnpm.cmd"

$nodeVersion = (& $nodePath --version).Trim()
if ($nodeVersion -notmatch "^v22\.") {
    throw "Node.js 22.x is required; detected $nodeVersion."
}

$pnpmVersion = (& $pnpmPath --version).Trim()
if ($pnpmVersion -ne "11.9.0") {
    throw "pnpm 11.9.0 is required; detected $pnpmVersion."
}

if (-not (Test-Path -LiteralPath "pnpm-lock.yaml" -PathType Leaf)) {
    throw "pnpm-lock.yaml is missing. Bootstrap never creates an unreviewed lockfile."
}

$installArguments = @("install", "--frozen-lockfile")
if ($Offline) {
    $installArguments += "--offline"
}

Invoke-CheckedCommand `
    -FilePath $pnpmPath `
    -Arguments $installArguments `
    -Label "Install pinned workspace dependencies"

if (-not $SkipValidation) {
    Write-Host "==> Run Phase 0 validation"
    & (Join-Path $PSScriptRoot "validate-phase0.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Phase 0 validation failed with exit code $LASTEXITCODE."
    }
}

Write-Host "Bootstrap completed. No system configuration or secret file was changed."
