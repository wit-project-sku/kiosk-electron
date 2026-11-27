# Checks, on a Jeju kiosk, whether ZED 2i body measurements are being taken and
# sent to the server with each photo (POST /api/stats/shots/v2).
#
# Read-only: it reads the installed app, its logs and its SQLite database. It
# sends nothing to the server and changes nothing on the kiosk.
#
#   powershell -ExecutionPolicy Bypass -File check-zed-upload.ps1
#   powershell -ExecutionPolicy Bypass -File check-zed-upload.ps1 -Days 3
#   powershell -ExecutionPolicy Bypass -File check-zed-upload.ps1 -Beta
#
# The database is read through the kiosk's own Electron + better-sqlite3 (run as
# Node), so nothing has to be installed. -ElectronExe / -SqliteModule exist only
# to run this on a developer machine against a dev build.
#
# Kept ASCII-only on purpose: Windows PowerShell 5.1 reads a BOM-less script as
# the ANSI codepage and mangles anything else.

param(
  [int]$Days = 7,
  [switch]$Beta,
  [string]$UserData,
  [string]$ElectronExe,
  [string]$SqliteModule
)

$ErrorActionPreference = 'Continue'
$MinVersion = [version]'5.0.31'      # first release with shots/v2 (commit 73db79c)
$MinBetaVersion = [version]'5.1.0'   # 5.1.0-beta.132 and later
$MinBetaBuild = 132

if (-not $UserData) {
  $UserData = Join-Path $env:APPDATA ($(if ($Beta) { 'kiosk-app-beta' } else { 'kiosk-app' }))
}
$since = (Get-Date).AddDays(-$Days).ToString('yyyy-MM-dd')
$verdict = New-Object System.Collections.Generic.List[string]

function Section($title) { Write-Host ''; Write-Host "==== $title ====" -ForegroundColor Cyan }
function Ok($msg)   { Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Bad($msg)  { Write-Host "  [FAIL] $msg" -ForegroundColor Red; $verdict.Add($msg) }
function Warn($msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Info($msg) { Write-Host "         $msg" }

Write-Host "ZED -> shots/v2 upload check   (last $Days days, since $since)" -ForegroundColor Cyan
Info "userData: $UserData"

# ---- 1. Installed app and version ---------------------------------------------
Section '1. Installed app version'
$productName = if ($Beta) { 'witworldwide-beta' } else { 'witworldwide' }
$installDirs = @(
  (Join-Path $env:LOCALAPPDATA "Programs\$productName"),
  (Join-Path ${env:ProgramFiles} $productName),
  (Join-Path $env:LOCALAPPDATA 'Programs\witworldwide'),
  (Join-Path ${env:ProgramFiles} 'witworldwide')
)
$installDir = $installDirs | Where-Object { Test-Path (Join-Path $_ 'resources\app.asar') } | Select-Object -First 1
$appExe = $null
if ($installDir) {
  $appExe = Get-ChildItem $installDir -Filter *.exe |
    Where-Object { $_.Name -notmatch '^(Uninstall|elevate)' } | Select-Object -First 1
}
if ($appExe) {
  $ver = $appExe.VersionInfo.ProductVersion
  Info "exe:     $($appExe.FullName)"
  Info "version: $ver"
  $m = [regex]::Match([string]$ver, '^(\d+\.\d+\.\d+)(?:-beta\.(\d+))?')
  if ($m.Success) {
    $core = [version]$m.Groups[1].Value
    $isBetaVer = $m.Groups[2].Success
    $hasV2 = if ($isBetaVer) { $core -gt $MinBetaVersion -or ($core -eq $MinBetaVersion -and [int]$m.Groups[2].Value -ge $MinBetaBuild) }
             else { $core -ge $MinVersion }
    if ($hasV2) { Ok "version includes the shots/v2 ZED upload" }
    else { Bad "version $ver is OLDER than the shots/v2 upload (needs >= 5.0.31 or 5.1.0-beta.132). This build never sends ZED sizes." }
  } else { Warn "could not parse version '$ver'" }
} else {
  Warn 'installed app not found under Programs\witworldwide (dev machine?)'
}

$configPath = Join-Path $UserData 'kiosk-config.json'
if (Test-Path $configPath) {
  try {
    $cfg = Get-Content $configPath -Raw | ConvertFrom-Json
    Info "kioskId: $($cfg.kioskId)   layout: $($cfg.layout)"
    if ($cfg.layout -and $cfg.layout -notmatch '^JEJU_') {
      Bad "layout '$($cfg.layout)' is not a Jeju layout: ZED measurement and shots/v2 are off on this kiosk"
    }
  } catch { Warn "could not read $configPath" }
} else { Warn "no kiosk-config.json at $configPath" }

# ---- 2. ZED prerequisites -----------------------------------------------------
Section '2. ZED sidecar prerequisites'
foreach ($name in 'HEIGHT_ENABLED', 'HEIGHT_PYTHON', 'STATS_SHOTS_V2_URL') {
  $v = [Environment]::GetEnvironmentVariable($name, 'User')
  if (-not $v) { $v = [Environment]::GetEnvironmentVariable($name, 'Machine') }
  if ($v) { Info "$name = $v" }
}
if ([Environment]::GetEnvironmentVariable('HEIGHT_ENABLED', 'User') -eq 'false' -or
    [Environment]::GetEnvironmentVariable('HEIGHT_ENABLED', 'Machine') -eq 'false') {
  Bad 'HEIGHT_ENABLED=false: height measurement is switched off'
}

$calib = Join-Path $UserData 'zed-height\calibration.json'
if (Test-Path $calib) {
  Ok "floor calibration present ($calib)"
  Info ((Get-Content $calib -Raw) -replace '\s+', ' ')
} else {
  Bad "no floor calibration at $calib - every height will be null. Run provision-zed.ps1 -Calibrate with nobody in front of the camera."
}

$python = [Environment]::GetEnvironmentVariable('HEIGHT_PYTHON', 'User')
if (-not $python) { $python = [Environment]::GetEnvironmentVariable('HEIGHT_PYTHON', 'Machine') }
if (-not $python) { $python = 'python' }
$pyOut = & $python -c "import pyzed.sl as sl; print(sl.Camera.get_sdk_version())" 2>&1
if ($LASTEXITCODE -eq 0) { Ok "pyzed importable with '$python' (SDK $pyOut)" }
else { Bad "pyzed NOT importable with '$python': $(($pyOut | Out-String).Trim() -split "`n" | Select-Object -Last 1)" }

# ---- 3. Logs ------------------------------------------------------------------
Section '3. Logs'
$logDir = Join-Path $UserData 'logs'
$logFiles = @('main.old.log', 'main.log') | ForEach-Object { Join-Path $logDir $_ } | Where-Object { Test-Path $_ }
# A List, not `+=`: the rotated log is 10 MB and array appends copy every time.
$lines = New-Object System.Collections.Generic.List[string]
foreach ($f in $logFiles) {
  # Keep only dated lines inside the window; continuation lines ride along.
  $keep = $false
  foreach ($l in [IO.File]::ReadLines($f)) {
    if ($l -match '^\[(\d{4}-\d{2}-\d{2}) ') { $keep = $matches[1] -ge $since }
    if ($keep) { $lines.Add($l) }
  }
}
Info "$($lines.Count) log lines in window from: $($logFiles -join ', ')"

$patterns = [ordered]@{
  'sidecar started'          = 'Height sidecar starting'
  'sidecar ready'            = 'Height sidecar ready'
  'pose measurement on'      = 'pose measurement on'
  'pose measurement off'     = 'pose measurement off'
  'sidecar gave up'          = 'failed to stay up; giving up'
  'sidecar not found'        = 'Height sidecar not found'
  'sidecar exited'           = 'Height sidecar exited'
  'sidecar errors'           = 'Height sidecar error'
  'no calibration'           = 'ZED has no floor calibration'
  'camera not detected'      = 'CAMERA NOT DETECTED'
  'camera stream failed'     = 'CAMERA STREAM FAILED'
  'HEIGHT measured'          = '===== HEIGHT: \d'
  'HEIGHT none'              = '===== HEIGHT: none'
  'shot had no ZED result'   = 'No ZED measurement for this shot'
  'shots/v2 failed (queued)' = 'shots/v2 POST failed'
  'shots/v2 rejected (lost)' = 'shots/v2 rejected'
  'shots/v2 409 (dup = ok)'  = 'shots/v2 already stored'
  'shots/v2 nightly resend'  = 'shots/v2 nightly re-send'
}
$counts = @{}
foreach ($k in $patterns.Keys) {
  $c = @($lines | Where-Object { $_ -match $patterns[$k] }).Count
  $counts[$k] = $c
  $color = 'Gray'
  if ($c -gt 0 -and $k -match 'gave up|not found|no calibration|not detected|stream failed|rejected|failed') { $color = 'Red' }
  elseif ($c -gt 0 -and $k -match 'measured|ready') { $color = 'Green' }
  Write-Host ('  {0,-26} {1,5}' -f $k, $c) -ForegroundColor $color
}
if ($counts['sidecar gave up'] -gt 0)     { Bad 'the ZED sidecar gave up starting (SDK / pyzed / wrong Python). See its last lines below.' }
if ($counts['sidecar not found'] -gt 0)   { Bad 'zed-height\main.py is missing from the install' }
if ($counts['pose measurement off'] -gt 0 -and $counts['pose measurement on'] -eq 0) { Warn 'pose measurement is OFF (point cloud only, less accurate). Run provision-zed.ps1 -InstallPose' }
if ($counts['camera not detected'] -gt 0) { Bad 'ZED reported CAMERA NOT DETECTED - usually a Windows display rotation, not a cable fault' }
if ($counts['camera stream failed'] -gt 0) { Bad 'ZED reported CAMERA STREAM FAILED TO START - USB 3 bandwidth/port, or another process holds the ZED (ZED Explorer, a second app instance)' }
if ($counts['shots/v2 rejected (lost)'] -gt 0) { Bad 'the server REJECTED shots/v2 requests; those shots went to the v1 batch without sizes. Send the error lines below to the backend.' }
if ($counts['sidecar started'] -eq 0 -and $lines.Count -gt 0) { Warn 'the sidecar never started in this window (non-Jeju layout, HEIGHT_ENABLED=false, or an old build)' }
if ($counts['HEIGHT measured'] -eq 0 -and $counts['HEIGHT none'] -gt 0) { Warn 'the ZED ran but never produced a height; see the "none - reason" lines below' }

Write-Host ''
Write-Host '  Last relevant lines:' -ForegroundColor Cyan
$relevant = '\((height|zed-sidecar|stats)\)|shots/v2|HEIGHT:'
$lines | Where-Object { $_ -match $relevant } | Select-Object -Last 40 | ForEach-Object {
  Write-Host "    $($_.Substring(0, [Math]::Min(300, $_.Length)))"
}

# ---- 4. Database --------------------------------------------------------------
Section '4. Local database'
$dbPath = Join-Path $UserData 'data\kiosk.db'
if (-not (Test-Path $dbPath)) {
  Bad "no database at $dbPath"
} else {
  if (-not $ElectronExe -and $appExe) { $ElectronExe = $appExe.FullName }
  if (-not $SqliteModule -and $installDir) {
    $SqliteModule = Join-Path $installDir 'resources\app.asar.unpacked\node_modules\better-sqlite3'
  }
  if (-not $ElectronExe -or -not (Test-Path $ElectronExe) -or -not (Test-Path $SqliteModule)) {
    Warn 'cannot read the database: app exe or better-sqlite3 not found (pass -ElectronExe and -SqliteModule)'
  } else {
    $js = @'
const [, , mod, dbPath, since] = process.argv;
const Database = require(mod);
const db = new Database(dbPath, { readonly: true, fileMustExist: true });
const has = (t) => !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(t);
const out = {};
if (has('height_measurements')) {
  const cols = db.prepare('PRAGMA table_info(height_measurements)').all().map((c) => c.name);
  const w = cols.includes('shoulder_width_cm');
  out.height = db.prepare(`SELECT COUNT(*) AS total,
      SUM(height_cm IS NOT NULL) AS withHeight,
      ${w ? 'SUM(shoulder_width_cm IS NOT NULL)' : '0'} AS withWidths,
      MIN(measured_at) AS first, MAX(measured_at) AS last
    FROM height_measurements WHERE local_date >= ?`).get(since);
  out.reasons = db.prepare(`SELECT COALESCE(reason, '(measured)') AS reason, COUNT(*) AS n
    FROM height_measurements WHERE local_date >= ? GROUP BY 1 ORDER BY n DESC LIMIT 8`).all(since);
  out.recent = db.prepare(`SELECT measured_at, height_cm, ${w ? 'shoulder_width_cm, chest_width_cm, waist_width_cm, hip_width_cm,' : ''}
      confidence, samples, subjects, reason ${cols.includes('version') ? ', version' : ''}
    FROM height_measurements ORDER BY measured_at DESC LIMIT 10`).all();
} else {
  out.height = null;
}
if (has('failed_requests')) {
  out.queued = db.prepare(`SELECT type, COUNT(*) AS n, MAX(retry_count) AS maxRetry,
      MAX(updated_at) AS last, (SELECT error FROM failed_requests f2 WHERE f2.type = f.type
        ORDER BY updated_at DESC LIMIT 1) AS lastError
    FROM failed_requests f WHERE type LIKE 'photo_shot%' GROUP BY type`).all();
}
console.log(JSON.stringify(out));
'@
    $jsPath = Join-Path $env:TEMP 'check-zed-upload.js'
    Set-Content -Path $jsPath -Value $js -Encoding ASCII
    $env:ELECTRON_RUN_AS_NODE = '1'
    $raw = & $ElectronExe $jsPath $SqliteModule $dbPath $since 2>&1
    Remove-Item Env:\ELECTRON_RUN_AS_NODE
    Remove-Item $jsPath -ErrorAction SilentlyContinue
    try {
      $res = ($raw | Where-Object { $_ -is [string] -and $_.StartsWith('{') } | Select-Object -Last 1) | ConvertFrom-Json
    } catch { $res = $null }
    if (-not $res) {
      Warn "database query failed: $(($raw | Out-String).Trim())"
    } elseif (-not $res.height) {
      Bad 'no height_measurements table - this build predates the ZED feature'
    } else {
      $h = $res.height
      Info "captures measured since ${since}: $($h.total)   with height: $($h.withHeight)   with widths: $($h.withWidths)"
      Info "first: $($h.first)   last: $($h.last)"
      if ([int]$h.total -eq 0) { Bad 'no ZED rows at all in this window - the sidecar is not running during photos' }
      elseif ([int]$h.withHeight -eq 0) { Bad 'ZED rows exist but every height is null - see the reasons below' }
      else { Ok 'the ZED is measuring visitors' }
      Write-Host '  Reasons:' -ForegroundColor Cyan
      $res.reasons | ForEach-Object { Info ('{0,5}  {1}' -f $_.n, $_.reason) }
      Write-Host '  Last 10 rows:' -ForegroundColor Cyan
      $res.recent | Format-Table -AutoSize | Out-String -Width 220 | ForEach-Object { Write-Host $_ }
    }
    if ($res -and $res.queued) {
      Write-Host '  Shots waiting in the retry queue:' -ForegroundColor Cyan
      $res.queued | Format-Table type, n, maxRetry, last, lastError -AutoSize | Out-String -Width 220 | ForEach-Object { Write-Host $_ }
      $v2 = $res.queued | Where-Object { $_.type -eq 'photo_shot_v2' }
      if ($v2 -and [int]$v2.n -gt 0) { Warn "$($v2.n) shots/v2 uploads are queued (5xx/network) for the nightly re-send" }
    } elseif ($res) {
      Ok 'no photo shots stuck in the retry queue'
    }
  }
}

# ---- Verdict ------------------------------------------------------------------
Section 'Verdict'
if ($verdict.Count -eq 0) {
  Ok 'nothing wrong found on the kiosk side.'
  Info 'A successful shots/v2 send is not logged, so if the server still has no rows,'
  Info 'check on the backend that /api/stats/shots/v2 stores them for this kioskId.'
} else {
  $verdict | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
}
Write-Host ''
