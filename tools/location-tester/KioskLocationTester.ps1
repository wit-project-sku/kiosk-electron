# ============================================================================
# Kiosk Location Tester
# ============================================================================
# A one-click GUI for NON-TECHNICAL testers: pick a kiosk location (W001-W006),
# and this tool sets the machine's kiosk id, closes the running Kiosk App, and
# relaunches it as that location. No terminal, no editing config files.
#
# Completely separate from the app source — it only does what the existing
# provision-kiosk.ps1 does (writes kiosk-config.json), plus restart.
#
# How to use (testers):  double-click "Kiosk Location Tester.bat"
#
# Advanced / headless use:
#   powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SetLocation W004
#   powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SetLocation W002 -NoLaunch
#   powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SelfTest
#
# Notes:
#  - Writes ONLY {"kioskId":"W00x"} (drops any shopApiKioskId so the shop-API
#    id auto-derives from the location, e.g. W003 -> 3). Correct for test
#    machines; production machines are provisioned with provision-kiosk.ps1.
#  - Looks for the installed "Kiosk App.exe"; if not installed but this folder
#    lives inside the repo, it falls back to `npm run dev`.
# ============================================================================

param(
  [string]$SetLocation = '',
  [switch]$NoLaunch,
  [switch]$SelfTest,
  [string]$DataDir = ''
)

$ErrorActionPreference = 'Stop'

# ---------------------------------------------------------------------------
# Locations (mirror src/shared/config/kioskLocations.ts)
# ---------------------------------------------------------------------------
$Locations = @(
  @{ Id = 'W001'; Name = "$([char]0xBD81)$([char]0xC778)$([char]0xC0AC)$([char]0xB9C8)$([char]0xB2F9)" },                                                                                # 북인사마당
  @{ Id = 'W002'; Name = "$([char]0xC778)$([char]0xC0AC)$([char]0xB3D9)$([char]0xC27C)$([char]0xD130)" },                                                                                # 인사동쉼터
  @{ Id = 'W003'; Name = "$([char]0xB0A8)$([char]0xC778)$([char]0xC0AC)$([char]0xB9C8)$([char]0xB2F9) ($([char]0xCE74)$([char]0xB4DC)$([char]0xB2E8)$([char]0xB9D0)$([char]0xAE30))" }, # 남인사마당 (카드단말기)
  @{ Id = 'W004'; Name = "$([char]0xC624)$([char]0xC0B0)$([char]0xC2DC) $([char]0xC624)$([char]0xC0C9)$([char]0xC2DC)$([char]0xC7A5)" },                                                 # 오산시 오색시장
  @{ Id = 'W005'; Name = "$([char]0xD654)$([char]0xC131)$([char]0xD734)$([char]0xAC8C)$([char]0xC18C)" },                                                                                # 화성휴게소
  @{ Id = 'W006'; Name = "$([char]0xC81C)$([char]0xC8FC)$([char]0xACF5)$([char]0xD56D)" }                                                                                              # 제주공항
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# ---------------------------------------------------------------------------
# App data dir(s) — same detection as provision-kiosk.ps1. The Electron
# userData folder is "Kiosk App" (app.setName) but older builds used
# "kiosk-app"; prefer whichever holds the SQLite db, else write to both.
# ---------------------------------------------------------------------------
function Get-ConfigTargets {
  if ($DataDir -ne '') { return @($DataDir) }
  $candidates = @('Kiosk App', 'kiosk-app') | ForEach-Object { Join-Path $env:APPDATA $_ }
  $withDb = @($candidates | Where-Object { Test-Path (Join-Path $_ 'data\kiosk.db') })
  if ($withDb.Count -gt 0) { return @($withDb[0]) }
  $existing = @($candidates | Where-Object { Test-Path $_ })
  if ($existing.Count -gt 0) { return $existing }
  return $candidates  # unprovisioned machine: write both, app picks its own up
}

function Get-CurrentKioskId {
  foreach ($dir in (Get-ConfigTargets)) {
    $file = Join-Path $dir 'kiosk-config.json'
    if (Test-Path $file) {
      try {
        $cfg = Get-Content $file -Raw | ConvertFrom-Json
        if ($cfg.kioskId) { return [string]$cfg.kioskId }
      } catch {}
    }
  }
  return ''
}

function Write-KioskId([string]$id) {
  $written = @()
  foreach ($dir in (Get-ConfigTargets)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
    $file = Join-Path $dir 'kiosk-config.json'
    # UTF-8 WITHOUT BOM — a BOM breaks electron-store's JSON.parse.
    [System.IO.File]::WriteAllText($file, ('{"kioskId":"' + $id + '"}'))
    $written += $file
  }
  return $written
}

# ---------------------------------------------------------------------------
# Find / stop / start the app
# ---------------------------------------------------------------------------
function Get-RepoRoot {
  # tools\location-tester -> repo root, when this folder lives inside the repo
  $root = Split-Path -Parent (Split-Path -Parent $ScriptDir)
  $pkg = Join-Path $root 'package.json'
  if ((Test-Path $pkg) -and ((Get-Content $pkg -Raw) -match '"name"\s*:\s*"kiosk-app"')) { return $root }
  return ''
}

function Find-KioskExe {
  # 1) remembered pick from a previous "browse" (per-user)
  $saved = Join-Path $env:APPDATA 'kiosk-location-tester.json'
  if (Test-Path $saved) {
    try {
      $cfg = Get-Content $saved -Raw | ConvertFrom-Json
      if ($cfg.exePath -and (Test-Path $cfg.exePath)) { return [string]$cfg.exePath }
    } catch {}
  }
  # 2) default NSIS per-user / per-machine install locations
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Kiosk App\Kiosk App.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\kiosk-app\Kiosk App.exe'),
    (Join-Path $env:ProgramFiles 'Kiosk App\Kiosk App.exe')
  )
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  # 3) uninstall registry (covers custom install directories)
  foreach ($hive in @('HKCU:', 'HKLM:')) {
    $keys = @()
    try { $keys = Get-ChildItem "$hive\Software\Microsoft\Windows\CurrentVersion\Uninstall" -ErrorAction Stop } catch {}
    foreach ($k in $keys) {
      $p = $null
      try { $p = Get-ItemProperty $k.PSPath -ErrorAction Stop } catch { continue }
      if ($p.DisplayName -like 'Kiosk App*' -and $p.InstallLocation) {
        $exe = Join-Path $p.InstallLocation 'Kiosk App.exe'
        if (Test-Path $exe) { return $exe }
      }
    }
  }
  return ''
}

function Save-ExePath([string]$path) {
  $saved = Join-Path $env:APPDATA 'kiosk-location-tester.json'
  [System.IO.File]::WriteAllText($saved, ('{"exePath":' + ($path | ConvertTo-Json) + '}'))
}

function Stop-KioskApp {
  # Installed app processes ("Kiosk App.exe" — Electron spawns several)
  try { Get-Process -Name 'Kiosk App' -ErrorAction Stop | Stop-Process -Force -Confirm:$false } catch {}
  # Dev instance: electron.exe running from THIS repo's node_modules only
  $repo = Get-RepoRoot
  if ($repo -ne '') {
    try {
      Get-CimInstance Win32_Process -Filter "Name='electron.exe'" -ErrorAction Stop |
        Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($repo, [System.StringComparison]::OrdinalIgnoreCase) } |
        ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force -Confirm:$false } catch {} }
    } catch {}
  }
  # Wait (max ~6s) until fully gone so the single-instance lock is released
  for ($i = 0; $i -lt 30; $i++) {
    $alive = $null
    try { $alive = Get-Process -Name 'Kiosk App' -ErrorAction Stop } catch {}
    if (-not $alive) { break }
    Start-Sleep -Milliseconds 200
  }
}

function Start-KioskApp {
  $exe = Find-KioskExe
  if ($exe -ne '') {
    Start-Process -FilePath $exe -WorkingDirectory (Split-Path -Parent $exe)
    return "exe: $exe"
  }
  $repo = Get-RepoRoot
  if ($repo -ne '') {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm', 'run', 'dev' -WorkingDirectory $repo
    return "dev: npm run dev ($repo)"
  }
  return ''
}

function Switch-Location([string]$id, [bool]$launch) {
  if ($launch) { Stop-KioskApp }
  $files = Write-KioskId $id
  $how = ''
  if ($launch) { $how = Start-KioskApp }
  return @{ Files = $files; LaunchedVia = $how }
}

# ---------------------------------------------------------------------------
# Headless modes
# ---------------------------------------------------------------------------
if ($SelfTest) {
  Write-Host "Config target(s) : $((Get-ConfigTargets) -join ' | ')"
  Write-Host "Current kioskId  : $(Get-CurrentKioskId)"
  Write-Host "Installed exe    : $(Find-KioskExe)"
  Write-Host "Repo root (dev)  : $(Get-RepoRoot)"
  exit 0
}

if ($SetLocation -ne '') {
  $id = $SetLocation.ToUpper()
  if (-not ($Locations | Where-Object { $_.Id -eq $id })) {
    Write-Error "Unknown location '$SetLocation'. Use one of: $(($Locations | ForEach-Object { $_.Id }) -join ', ')"
    exit 1
  }
  $result = Switch-Location $id (-not $NoLaunch)
  Write-Host "kioskId -> $id"
  $result.Files | ForEach-Object { Write-Host "  wrote $_" }
  if (-not $NoLaunch) {
    if ($result.LaunchedVia -ne '') { Write-Host "  launched via $($result.LaunchedVia)" }
    else { Write-Host '  WARNING: app not found - install Kiosk App or run from the repo.' }
  }
  exit 0
}

# ---------------------------------------------------------------------------
# GUI
# ---------------------------------------------------------------------------
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
[System.Windows.Forms.Application]::EnableVisualStyles()

$COL_BG      = [System.Drawing.Color]::FromArgb(245, 246, 248)
$COL_CARD    = [System.Drawing.Color]::White
$COL_TEXT    = [System.Drawing.Color]::FromArgb(28, 32, 38)
$COL_MUTED   = [System.Drawing.Color]::FromArgb(110, 118, 128)
$COL_ACCENT  = [System.Drawing.Color]::FromArgb(26, 77, 126)
$COL_CURRENT = [System.Drawing.Color]::FromArgb(224, 238, 250)

$form = New-Object System.Windows.Forms.Form
$form.Text = 'Kiosk Location Tester'
$form.StartPosition = 'CenterScreen'
$form.FormBorderStyle = 'FixedSingle'
$form.MaximizeBox = $false
$form.ClientSize = New-Object System.Drawing.Size(420, 555)
$form.BackColor = $COL_BG
$form.Font = New-Object System.Drawing.Font('Malgun Gothic', 10)
$form.TopMost = $true

$title = New-Object System.Windows.Forms.Label
$title.Text = "$([char]0xD0A4)$([char]0xC624)$([char]0xC2A4)$([char]0xD06C) $([char]0xC704)$([char]0xCE58) $([char]0xD14C)$([char]0xC2A4)$([char]0xD130)"  # 키오스크 위치 테스터
$title.Font = New-Object System.Drawing.Font('Malgun Gothic', 15, [System.Drawing.FontStyle]::Bold)
$title.ForeColor = $COL_TEXT
$title.AutoSize = $false
$title.TextAlign = 'MiddleCenter'
$title.SetBounds(20, 18, 380, 34)
$form.Controls.Add($title)

$currentLabel = New-Object System.Windows.Forms.Label
$currentLabel.Font = New-Object System.Drawing.Font('Malgun Gothic', 10)
$currentLabel.ForeColor = $COL_MUTED
$currentLabel.AutoSize = $false
$currentLabel.TextAlign = 'MiddleCenter'
$currentLabel.SetBounds(20, 52, 380, 24)
$form.Controls.Add($currentLabel)

$buttons = @{}
$y = 90
foreach ($loc in $Locations) {
  $btn = New-Object System.Windows.Forms.Button
  $btn.Text = "$($loc.Id)  $([char]0x2014)  $($loc.Name)"
  $btn.Tag = $loc.Id
  $btn.SetBounds(30, $y, 360, 62)
  $btn.Font = New-Object System.Drawing.Font('Malgun Gothic', 12, [System.Drawing.FontStyle]::Bold)
  $btn.BackColor = $COL_CARD
  $btn.ForeColor = $COL_TEXT
  $btn.FlatStyle = 'Flat'
  $btn.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(210, 214, 220)
  $btn.FlatAppearance.BorderSize = 1
  $btn.Cursor = 'Hand'
  $form.Controls.Add($btn)
  $buttons[$loc.Id] = $btn
  $y += 72
}

$status = New-Object System.Windows.Forms.Label
$status.Font = New-Object System.Drawing.Font('Malgun Gothic', 9)
$status.ForeColor = $COL_MUTED
$status.AutoSize = $false
$status.TextAlign = 'MiddleCenter'
$status.SetBounds(20, $y + 2, 380, 40)
$form.Controls.Add($status)

# 위치 버튼을 누르면 앱이 자동으로 재시작됩니다
$status.Text = "$([char]0xC704)$([char]0xCE58) $([char]0xBC84)$([char]0xD2BC)$([char]0xC744) $([char]0xB204)$([char]0xB974)$([char]0xBA74) $([char]0xC571)$([char]0xC774) $([char]0xC790)$([char]0xB3D9)$([char]0xC73C)$([char]0xB85C) $([char]0xC7AC)$([char]0xC2DC)$([char]0xC791)$([char]0xB429)$([char]0xB2C8)$([char]0xB2E4)"

function Update-CurrentLabel {
  $id = Get-CurrentKioskId
  $name = ''
  foreach ($loc in $Locations) {
    $isCurrent = ($loc.Id -eq $id)
    if ($isCurrent) { $name = $loc.Name }
    $buttons[$loc.Id].BackColor = @($COL_CARD, $COL_CURRENT)[[int]$isCurrent]
    $buttons[$loc.Id].FlatAppearance.BorderColor = @([System.Drawing.Color]::FromArgb(210, 214, 220), $COL_ACCENT)[[int]$isCurrent]
  }
  if ($id -eq '') {
    $currentLabel.Text = "$([char]0xD604)$([char]0xC7AC) $([char]0xC704)$([char]0xCE58): ($([char]0xBBF8)$([char]0xC124)$([char]0xC815))"  # 현재 위치: (미설정)
  } else {
    $currentLabel.Text = "$([char]0xD604)$([char]0xC7AC) $([char]0xC704)$([char]0xCE58): $id $name"  # 현재 위치: ...
  }
}

$clickHandler = {
  param($sender, $e)
  $id = [string]$sender.Tag
  foreach ($b in $buttons.Values) { $b.Enabled = $false }
  # "전환 중... 잠시만 기다려 주세요"
  $status.Text = "$id $([char]0xC804)$([char]0xD658) $([char]0xC911)... $([char]0xC7A0)$([char]0xC2DC)$([char]0xB9CC) $([char]0xAE30)$([char]0xB2E4)$([char]0xB824) $([char]0xC8FC)$([char]0xC138)$([char]0xC694)"
  $form.Refresh()
  try {
    $result = Switch-Location $id $true
    if ($result.LaunchedVia -eq '') {
      # ID는 저장했지만 앱을 찾지 못해 직접 실행이 필요하다는 안내
      [System.Windows.Forms.MessageBox]::Show(
        "kioskId = $id saved, but 'Kiosk App.exe' was not found on this PC." + [Environment]::NewLine +
        "Install the Kiosk App (or run 'npm run dev' in the project), then start it manually.",
        'Kiosk Location Tester',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Warning) | Out-Null
      # Offer to locate the exe once; remember the choice for next time.
      $dlg = New-Object System.Windows.Forms.OpenFileDialog
      $dlg.Title = 'Locate Kiosk App.exe (optional)'
      $dlg.Filter = 'Kiosk App|Kiosk App.exe|Programs|*.exe'
      if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        Save-ExePath $dlg.FileName
        Start-Process -FilePath $dlg.FileName -WorkingDirectory (Split-Path -Parent $dlg.FileName)
      }
    }
    # "전환 완료 — 앱 실행됨"
    $status.Text = "$id $([char]0xC804)$([char]0xD658) $([char]0xC644)$([char]0xB8CC) $([char]0x2014) $([char]0xC571) $([char]0xC2E4)$([char]0xD589)$([char]0xB428)"
  } catch {
    $status.Text = "Error: $($_.Exception.Message)"
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Kiosk Location Tester',
      [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Error) | Out-Null
  } finally {
    foreach ($b in $buttons.Values) { $b.Enabled = $true }
    Update-CurrentLabel
  }
}

foreach ($b in $buttons.Values) { $b.Add_Click($clickHandler) }

Update-CurrentLabel
[void]$form.ShowDialog()
