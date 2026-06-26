# Sets this machine's kiosk identity for the installed Kiosk App.
# No Node / project needed — copy this file to the kiosk and run it.
#
# Usage (PowerShell):
#   powershell -ExecutionPolicy Bypass -File provision-kiosk.ps1 W002
#   powershell -ExecutionPolicy Bypass -File provision-kiosk.ps1 W003 -ShopId 3
#
#   W001 = 북인사마당   W002 = 인사동센터   W003 = 남인사마당
#   -ShopId is the witteria shop-API id for this kiosk (optional; defaults to
#   the digits of the kiosk id, e.g. W003 -> 3).
#
# Tip: launch the app once first so its data folder exists, then run this,
# then restart the app.

param(
  [Parameter(Mandatory = $true)][string]$KioskId,
  [int]$ShopId = 0
)

$id = $KioskId.ToUpper()
if ($id -notmatch '^W\d{3}$') {
  Write-Error "Kiosk id must look like W001 / W002 / W003 (got '$KioskId')."
  exit 1
}

# Electron's userData dir derives from the package name ("kiosk-app"), but older
# notes used "Kiosk App" — detect whichever the app actually created.
$candidates = @('kiosk-app', 'Kiosk App') | ForEach-Object { Join-Path $env:APPDATA $_ }
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
Write-Host "Now restart the Kiosk App."
