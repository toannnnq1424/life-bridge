[CmdletBinding()]
param(
    [switch]$SkipDoctor
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoRoot

function Resolve-Pnpm {
    $command = Get-Command "pnpm.cmd" -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1

    if ($null -eq $command) {
        throw "pnpm.cmd was not found. Do not use pnpm.ps1 or change ExecutionPolicy."
    }

    return $command.Source
}

function Invoke-Validation {
    param(
        [Parameter(Mandatory = $true)]
        [string]$PnpmPath,
        [Parameter(Mandatory = $true)]
        [string]$ScriptName
    )

    Write-Host ""
    Write-Host "==> pnpm run $ScriptName"
    & $PnpmPath run $ScriptName
    if ($LASTEXITCODE -ne 0) {
        throw "Validation '$ScriptName' failed with exit code $LASTEXITCODE."
    }
}

if (-not $SkipDoctor) {
    Write-Host "==> Windows doctor"
    & (Join-Path $PSScriptRoot "doctor.ps1")
    if ($LASTEXITCODE -ne 0) {
        throw "Doctor reported a mandatory environment or dependency failure."
    }
}

$pnpmPath = Resolve-Pnpm

foreach ($scriptName in @(
        "format:check",
        "lint",
        "typecheck",
        "test:unit",
        "test:integration",
        "build"
    )) {
    Invoke-Validation -PnpmPath $pnpmPath -ScriptName $scriptName
}

Write-Host ""
Write-Host "Phase 0 validation passed."
