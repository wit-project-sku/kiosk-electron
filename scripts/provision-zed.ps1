# Verifies (and finishes) the ZED 2i height-measurement setup on a 제주 kiosk.
#
# Usage (PowerShell, on the kiosk):
#   powershell -ExecutionPolicy Bypass -File provision-zed.ps1
#   powershell -ExecutionPolicy Bypass -File provision-zed.ps1 -Calibrate
#
# 제주 ONLY (W006 / W007 / W008). The app starts the height sidecar nowhere else,
# so running this on an Insadong / 오산 / 화성 machine achieves nothing.
#
# What this does NOT do: install the ZED SDK. That is a ~1.2 GB interactive
# download from stereolabs.com, matched to the machine's CUDA, and it needs a
# human. This checks every prerequisite, says exactly which one is missing, and
# does the parts that CAN be automated (numpy, and the floor calibration).
#
# The kiosk's RTX 5050 is Blackwell and needs CUDA 12.8 or newer. An older SDK
# build will install happily and then fail at runtime with no CUDA device, which
# is why the driver is checked here rather than discovered later.
#
# Nothing here is required for the kiosk to work. If it is never run, the photo
# flow is completely unaffected and heights are simply never recorded.

param(
  # Run the floor calibration at the end. Stand clear of the camera first.
  [switch]$Calibrate,
  # Where the sidecar lives. Defaults to the installed app's resources folder.
  [string]$SidecarPath = '',
  # The interpreter pyzed was installed into. Must match the one the ZED SDK's
  # get_python_api.py was run against; on a machine with several Pythons the
  # bare `python` on PATH is frequently not that one.
  [string]$Python = 'python'
)

$ErrorActionPreference = 'Continue'
$problems = @()

function Test-Step {
  param([string]$Name, [scriptblock]$Check)
  Write-Host -NoNewline "  $Name ... "
  try {
    $result = & $Check
    if ($result) {
      Write-Host "OK  $result" -ForegroundColor Green
      return $true
    }
  } catch {
    # fall through to the failure path
  }
  Write-Host 'MISSING' -ForegroundColor Red
  return $false
}

Write-Host ''
Write-Host 'ZED height measurement - prerequisite check' -ForegroundColor Cyan
Write-Host ''

# ---- 1. GPU driver -----------------------------------------------------------
$driverOk = Test-Step 'NVIDIA driver' {
  $out = & nvidia-smi --query-gpu=name,driver_version --format=csv,noheader 2>$null
  if ($LASTEXITCODE -eq 0) { return ($out | Select-Object -First 1) }
  return $null
}
if (-not $driverOk) {
  $problems += 'No NVIDIA driver found (nvidia-smi did not run). The ZED SDK needs one.'
}

# ---- 2. ZED SDK --------------------------------------------------------------
$sdkRoots = @(
  'C:\Program Files (x86)\ZED SDK',
  'C:\Program Files\ZED SDK'
)
$sdkRoot = $sdkRoots | Where-Object { Test-Path $_ } | Select-Object -First 1
$sdkOk = Test-Step 'ZED SDK' { if ($sdkRoot) { return $sdkRoot } else { return $null } }
if (-not $sdkOk) {
  $problems += 'ZED SDK not installed. Download it from stereolabs.com/developers - pick the build for CUDA 12.8+ (the RTX 5050 is Blackwell).'
}

# ---- 3. Python ---------------------------------------------------------------
$pythonOk = Test-Step "Python ($Python)" {
  $out = & $Python --version 2>&1
  if ($LASTEXITCODE -eq 0) { return $out }
  return $null
}
if (-not $pythonOk) {
  $problems += "No interpreter at '$Python'. Install Python 3.11, or pass -Python with a full path."
}

# ---- 4. pyzed ----------------------------------------------------------------
$pyzedOk = $false
if ($pythonOk) {
  $pyzedOk = Test-Step 'pyzed bindings' {
    $out = & $Python -c "import pyzed.sl as sl; print(sl.Camera.get_sdk_version())" 2>$null
    if ($LASTEXITCODE -eq 0) { return $out }
    return $null
  }
}
if ($pythonOk -and -not $pyzedOk) {
  $script = if ($sdkRoot) { Join-Path $sdkRoot 'get_python_api.py' } else { '<ZED SDK>\get_python_api.py' }
  $problems += "pyzed not installed for this interpreter. Run:  $Python `"$script`""
}

# ---- 5. numpy (we can just fix this one) -------------------------------------
if ($pythonOk) {
  $numpyOk = Test-Step 'numpy' {
    $out = & $Python -c "import numpy; print(numpy.__version__)" 2>$null
    if ($LASTEXITCODE -eq 0) { return $out }
    return $null
  }
  if (-not $numpyOk) {
    Write-Host '    installing numpy...' -ForegroundColor Yellow
    & $Python -m pip install --quiet numpy
    if ($LASTEXITCODE -ne 0) { $problems += 'numpy install failed.' }
  }
}

# ---- 6. The camera itself ----------------------------------------------------
# PnP status 'OK' means present and started; a remembered-but-unplugged device
# reports 'Unknown', which is exactly the case worth catching at install time.
$cameraOk = Test-Step 'ZED 2i connected' {
  $dev = Get-PnpDevice -ErrorAction SilentlyContinue |
    Where-Object { $_.InstanceId -like '*VID_2B03*' -and $_.Status -eq 'OK' } |
    Select-Object -First 1
  if ($dev) { return $dev.FriendlyName }
  return $null
}
if (-not $cameraOk) {
  $problems += 'No ZED camera is connected and started. Check the USB 3 cable - the ZED and the Elgato are both USB 3 and should ideally sit on different host controllers.'
}

# ---- 7. The sidecar ----------------------------------------------------------
if (-not $SidecarPath) {
  $guesses = @(
    (Join-Path ${env:ProgramFiles} 'witworldwide\resources\zed-height'),
    (Join-Path ${env:LOCALAPPDATA} 'Programs\witworldwide\resources\zed-height'),
    (Join-Path $PSScriptRoot '..\zed-height')
  )
  $SidecarPath = $guesses | Where-Object { Test-Path (Join-Path $_ 'main.py') } | Select-Object -First 1
}
$sidecarOk = Test-Step 'height sidecar' {
  if ($SidecarPath -and (Test-Path (Join-Path $SidecarPath 'main.py'))) { return $SidecarPath }
  return $null
}
if (-not $sidecarOk) {
  $problems += 'Could not find zed-height\main.py. Pass -SidecarPath with the installed app resources folder.'
}

Write-Host ''

if ($problems.Count -gt 0) {
  Write-Host 'Not ready yet:' -ForegroundColor Yellow
  foreach ($p in $problems) { Write-Host "  - $p" }
  Write-Host ''
  Write-Host 'The kiosk still works normally; heights just will not be recorded.' -ForegroundColor DarkGray
  exit 1
}

Write-Host 'All prerequisites present.' -ForegroundColor Green
Write-Host ''

if (-not $Calibrate) {
  Write-Host 'Next: aim the camera, clear the area, and run this again with -Calibrate.'
  Write-Host 'Then check it against a tape measure:'
  Write-Host "  cd `"$SidecarPath`"; $Python main.py --selftest"
  exit 0
}

# ---- Calibration -------------------------------------------------------------
# Writes to the app's userData so it survives an auto-update, which replaces the
# install directory wholesale. Must match ZedSidecarManager's HEIGHT_CALIBRATION.
$calibration = Join-Path $env:APPDATA 'kiosk-app\zed-height\calibration.json'
New-Item -ItemType Directory -Force -Path (Split-Path $calibration) | Out-Null
$env:HEIGHT_CALIBRATION = $calibration

Write-Host 'Calibrating the floor plane.' -ForegroundColor Cyan
Write-Host 'Make sure NOBODY is standing in front of the camera.' -ForegroundColor Yellow
Write-Host 'Press Enter when the area is clear, or Ctrl+C to abort.'
$null = Read-Host

Push-Location $SidecarPath
& $Python main.py --calibrate
$code = $LASTEXITCODE
Pop-Location

if ($code -ne 0) {
  Write-Host ''
  Write-Host 'Calibration failed. The floor must be visible to the camera.' -ForegroundColor Red
  exit 1
}

Write-Host ''
Write-Host "Calibrated. Saved to $calibration" -ForegroundColor Green
Write-Host 'Now verify against a tape measure before leaving:'
Write-Host "  cd `"$SidecarPath`"; $Python main.py --selftest"
