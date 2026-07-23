# Kiosk Location Tester

One-click tool so **non-technical testers** can try every kiosk location
(W001–W005) without touching config files or a terminal.

## For testers

1. Double-click **`Kiosk Location Tester.bat`**.
2. A small window opens showing the 5 locations. The highlighted one is the
   current location.
3. Click a location button. The tool automatically:
   - closes the running Kiosk App,
   - sets this machine's kiosk id (`kiosk-config.json`),
   - restarts the app as that location.
4. Test, then click another location to switch again.

> The two files (`.bat` + `.ps1`) can also be copied together to any test PC
> that has the Kiosk App installed — nothing else is required.

## What it does under the hood

Exactly what `provision-kiosk.ps1` does, plus restart:

- Writes `{"kioskId":"W00x"}` to the app's data folder
  (`%APPDATA%\Kiosk App` / `%APPDATA%\kiosk-app`, auto-detected the same way
  as `provision-kiosk.ps1`). Any `shopApiKioskId` is dropped on purpose so the
  shop-API id auto-derives from the location (e.g. `W003` → `3`).
- Kills `Kiosk App.exe` (and a dev `electron.exe` running from this repo),
  waits for the single-instance lock to release, then relaunches.
- App discovery order: previously remembered path → default NSIS install
  locations → uninstall registry → `npm run dev` if this folder is inside the
  repo → asks you to browse once (and remembers the answer).

It never touches app source code, the SQLite cache, or synced content —
switching locations is safe and repeatable.

## Advanced (headless) use

```powershell
# switch + restart without the GUI
powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SetLocation W004

# only write the id (no kill / no launch)
powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SetLocation W002 -NoLaunch

# print detected paths (config dir, current id, exe, repo) without changing anything
powershell -ExecutionPolicy Bypass -File KioskLocationTester.ps1 -SelfTest
```

`-DataDir <path>` overrides the config folder (useful for dry-runs/tests).
