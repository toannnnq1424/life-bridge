[CmdletBinding()]
param(
  [switch]$SkipInstall,
  [switch]$SkipContainers
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Invoke-Checked {
  param([Parameter(Mandatory = $true)][scriptblock]$Command)
  & $Command
  if ($LASTEXITCODE -ne 0) { throw "Native command failed with exit code $LASTEXITCODE." }
}

if (-not $SkipInstall) { Invoke-Checked { pnpm.cmd install --frozen-lockfile } }
Invoke-Checked { pnpm.cmd run format:p6-s2:check }
Invoke-Checked { pnpm.cmd run lint }
Invoke-Checked { pnpm.cmd run typecheck }
Invoke-Checked { pnpm.cmd run test:p6-s2:fitness }
Invoke-Checked { pnpm.cmd run sbom:p6-s2 }
Invoke-Checked { pnpm.cmd --filter @lifebridge/web build }
Invoke-Checked { pnpm.cmd --filter @lifebridge/gateway build }
Invoke-Checked { pnpm.cmd --filter @lifebridge/identity-consent build }
Invoke-Checked { pnpm.cmd --filter @lifebridge/care-coordination build }
Invoke-Checked { pnpm.cmd --filter @lifebridge/notification build }
Invoke-Checked { ./mvnw.cmd -B -ntp -f services/community/pom.xml clean verify }

if (-not $SkipContainers) {
  Invoke-Checked { docker version --format '{{.Server.Version}}' | Out-Null }
  foreach ($name in @("web", "gateway", "identity-consent", "care-coordination", "notification", "community")) {
    Invoke-Checked { docker build --file "artifacts/$name/Dockerfile" --tag "lifebridge/$name:p6-s2" . }
  }
}

Write-Output "P6-S2 slice validation passed."
