# Fix this kiosk's display videos for instant switching — run ON THE KIOSK.
#
# Ships inside the installed app (electron-builder extraResources), next to
# reencode-videos.mjs, so a kiosk needs NO Node.js install: the app's own .exe
# runs the script as Node (ELECTRON_RUN_AS_NODE). Only ffmpeg is required.
#
#   powershell -ExecutionPolicy Bypass -File "<install dir>\resources\optimize-videos.ps1"
#
# Default install dir: %LOCALAPPDATA%\Programs\witworldwide (per-user NSIS).
# Optional argument: the videos folder (default C:\KioskVideos).
#
# CLOSE THE KIOSK APP FIRST — a clip the app is playing is locked by Windows
# and gets skipped as FAILED (harmless: originals stay in place; re-run later,
# already-fixed files are skipped automatically).
param([string]$VideosDir = 'C:\KioskVideos')

$ErrorActionPreference = 'Stop'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host 'ffmpeg is required (one-time install):  winget install Gyan.FFmpeg'
  Write-Host 'Then open a NEW terminal and run this script again.'
  exit 1
}

# The app exe sits one level above resources\ (skip the NSIS uninstaller).
$appDir = Split-Path $PSScriptRoot -Parent
$exe = Get-ChildItem $appDir -Filter '*.exe' -File |
  Where-Object { $_.Name -notlike 'Uninstall*' } |
  Select-Object -First 1
if (-not $exe) {
  Write-Error "No app executable found in $appDir — run this from the installed app's resources folder."
  exit 1
}

$env:ELECTRON_RUN_AS_NODE = '1'
& $exe.FullName (Join-Path $PSScriptRoot 'reencode-videos.mjs') $VideosDir
exit $LASTEXITCODE
