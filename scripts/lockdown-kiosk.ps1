# Locks down a Windows touch kiosk so users cannot escape the Kiosk App.
#
# WHY THIS EXISTS:
#   Electron's `kiosk` mode makes our window fullscreen and frameless, but it
#   CANNOT block Windows' own touch gestures (swipe up / from an edge to show
#   Task View / all open apps) or system keys (Win, Ctrl+Alt+Del). Those are
#   handled by the Windows shell BEFORE the app sees them. This script applies
#   the OS-level policies that actually disable them.
#
# RUN AS ADMINISTRATOR:
#   powershell -ExecutionPolicy Bypass -File scripts\lockdown-kiosk.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\lockdown-kiosk.ps1 -Revert
#
# A SIGN-OUT (or reboot) is required for all settings to take effect.

param(
  [switch]$Revert
)

# --- must be elevated (writes HKLM policy keys) ---
$admin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()
         ).IsInRole([Security.Principal.WindowsBuiltinRole]::Administrator)
if (-not $admin) {
  Write-Error "Run this in an ELEVATED PowerShell (Run as administrator)."
  exit 1
}

function Set-RegDword($path, $name, $value) {
  if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
  New-ItemProperty -Path $path -Name $name -Value $value -PropertyType DWord -Force | Out-Null
  Write-Host ("  {0}\{1} = {2}" -f $path, $name, $value)
}

$EdgeUI    = 'HKLM:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI'
$Explorer  = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\Explorer'
$System    = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Policies\System'

if ($Revert) {
  Write-Host "Reverting kiosk lockdown..."
  Set-RegDword $EdgeUI   'AllowEdgeSwipe'        1   # re-enable edge swipe
  Set-RegDword $Explorer 'NoTaskGrouping'        0
  Remove-ItemProperty -Path $Explorer -Name 'NoWinKeys'    -ErrorAction SilentlyContinue
  Remove-ItemProperty -Path $System   -Name 'DisableTaskMgr' -ErrorAction SilentlyContinue
  Write-Host "Reverted. Sign out / reboot to apply."
  exit 0
}

Write-Host "Applying kiosk lockdown..."

# 1) THE key fix for your symptom: disable ALL touch edge swipes (the bottom/
#    side swipe that opens Task View / shows every open app).
Set-RegDword $EdgeUI 'AllowEdgeSwipe' 0

# 2) Disable the Windows logo (Win) key combos (Win+Tab task view, Win+D, etc.).
Set-RegDword $Explorer 'NoWinKeys' 1

# 3) Disable Task Manager (Ctrl+Shift+Esc) so the app can't be killed from touch.
Set-RegDword $System 'DisableTaskMgr' 1

Write-Host ""
Write-Host "Done. SIGN OUT or REBOOT for the edge-swipe policy to take effect."
Write-Host ""
Write-Host "STRONGEST option (recommended for unattended kiosks):"
Write-Host "  Configure Windows 'Assigned Access' / Shell Launcher so the Kiosk"
Write-Host "  App runs as the shell instead of explorer.exe. That removes the"
Write-Host "  taskbar entirely and blocks every gesture/shortcut, including"
Write-Host "  Ctrl+Alt+Del menu items. See: Settings > Accounts > Other users >"
Write-Host "  'Set up a kiosk', or Shell Launcher (Win 11 Enterprise/Education)."
