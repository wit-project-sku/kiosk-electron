# Sets this machine's kiosk identity for the installed Kiosk App.
# No Node / project needed — copy this file to the kiosk and run it.
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File provision-kiosk.ps1 W002
#   powershell -ExecutionPolicy Bypass -File provision-kiosk.ps1 W003 -ShopId 3
#
#   W001 = 북인사마당   W002 = 인사동센터   W003 = 남인사마당
#   W004 = 오산 오색시장  W005 = 화성휴게소   W006 = 제주국제공항
#   W007 = 제주국제여객터미널   W008 = 세계자연유산본부
#
#   -ShopId is the witteria shop-API id for this kiosk. LEAVE IT OFF unless the
#   API tells you otherwise: without it the app uses the id authored for the
#   location in src/shared/config/kioskLocations.ts (제주 W006 -> 7, a historic
#   filing that still resolves), falling back to the digits of the kiosk id
#   (W003 -> 3, W007 -> 7). Passing it overrides both, so a wrong value silently
#   empties every shop list.
#
# Tip: launch the app once first so its data folder exists, then run this,
# then restart the app.

#
# -Beta provisions the SIDE-BY-SIDE beta install (%APPDATA%\kiosk-app-beta)
# instead of production (%APPDATA%\kiosk-app). The two builds keep completely
# separate state, so each needs provisioning once — see
# src/main/core/appIdentity.ts and electron-builder.beta.yml.

param(
  [Parameter(Mandatory = $true)][string]$KioskId,
  [int]$ShopId = 0,
  [switch]$Beta
)

$id = $KioskId.ToUpper()
if ($id -notmatch '^W\d{3}$') {
  Write-Error "Kiosk id must look like W001 / W002 / W003 (got '$KioskId')."
  exit 1
}

# Production's userData dir is Electron's default, derived from the package name
# ("kiosk-app"); an older Electron briefly used "Kiosk App", so that fossil is
# still probed. The beta build sets its own path explicitly (kiosk-app-beta).
$names = if ($Beta) { @('kiosk-app-beta') } else { @('kiosk-app', 'Kiosk App') }
$candidates = $names | ForEach-Object { Join-Path $env:APPDATA $_ }
$dir = $candidates | Where-Object { Test-Path (Join-Path $_ 'data\kiosk.db') } | Select-Object -First 1
if (-not $dir) { $dir = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1 }
if (-not $dir) {
  $dir = $candidates[0]
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
}

$file = Join-Path $dir 'kiosk-config.json'
if ($ShopId -gt 0) {
  $json = '{"kioskId":"' + $id + '","shopApiKioskId":' + $ShopId + '}'
} else {
  $json = '{"kioskId":"' + $id + '"}'
}

# WriteAllText = UTF-8 without BOM (a BOM breaks JSON.parse / electron-store).
[System.IO.File]::WriteAllText($file, $json)

Write-Host "OK -> $file"
Write-Host $json
Write-Host ("Now restart " + $(if ($Beta) { 'Kiosk App Beta' } else { 'the Kiosk App' }) + ".")
