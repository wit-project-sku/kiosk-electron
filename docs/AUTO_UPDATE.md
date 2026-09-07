# Auto-Update System

Production auto-update for the Windows kiosk fleet, built on **electron-updater**
+ **GitHub Releases**. Modeled on how VS Code / Discord update: check in the
background, download silently, install on restart. No custom update server.

---

## 1. How updates work (runtime)

All update logic lives in the main process, isolated under `src/main/updater/`:

- **`UpdateService.ts`** — wraps `electron-updater`'s `autoUpdater`. It:
  - checks on a **channel-specific schedule** (see §3.1);
  - **downloads in the background** as soon as an update is found (`autoDownload`),
    so the kiosk keeps operating normally while checking and downloading;
  - **installs on the next idle moment** (never mid photo/payment) and restarts —
    **silently, zero user interaction** — with the **nightly reboot as a
    guaranteed fallback** (`autoInstallOnAppQuit`);
  - **never blocks the kiosk** — on any failure it logs, keeps the current
    version running, and retries with **exponential backoff** (15 min → 6 h) so
    it never spams GitHub; **duplicate checks are skipped**;
  - is **disabled in dev / unpackaged** builds (nothing to self-replace).
- **`updateChannel.ts`** — resolves the channel from `UPDATE_CHANNEL`.
- **`updateSchedule.ts`** — resolves the schedule from env (weekly window vs
  interval) and computes the next/previous maintenance windows.
- **`UpdateStateStore.ts`** — persists the last handled window (electron-store,
  `update-state.json`) so the schedule **survives restarts** and detects a window
  **missed** while the kiosk was powered off.

The renderer never touches Electron. It reads status over IPC only:

- Preload bridge: `window.api.updates.getStatus() | checkNow() | installNow()`
  and `window.api.events.onUpdateStatusChanged(cb)`.
- `useUpdateStatus()` hook + `UpdateStatusIndicator` — a small, non-blocking
  corner indicator (Checking / Downloading % / Installing / hidden when idle).

**Security:** `contextIsolation` on, `nodeIntegration` off, all IPC validated
through the typed contract/registry (`ok`/`err` envelopes). The renderer gets a
frozen `window.api` surface — no `ipcRenderer`, no Node.

**Logging** (electron-log, `%APPDATA%\kiosk-app\logs\main.log`, scope
`updater`): current version, latest version, download size, progress, errors,
and restart are all logged.

---

## 2. How GitHub Releases work here

- **Provider:** `github` (`electron-builder.yml` → `publish`), repo
  `wit-project-sku/kiosk-electron`. This is baked into each installed app as
  `app-update.yml`, so every kiosk knows where to look.
- Each release publishes, per channel:
  - the **NSIS installer** `*.exe`,
  - its **`.blockmap`** (enables tiny differential downloads),
  - the channel **metadata**: `latest.yml` (production) or `beta.yml` (beta),
  - auto-generated **release notes**.
- **Windows only** — no dmg / AppImage / zip / deb / rpm.

electron-updater on a kiosk fetches the channel `*.yml` from the newest matching
release, compares versions, and downloads the `.exe` (using the `.blockmap` to
transfer only changed blocks).

---

## 3. Channels (production vs beta)

| | Production | Beta |
|---|---|---|
| Branch | `main` | `develop_1` |
| Version | `X.Y.Z` | `X.(Y+1).0-beta.<run#>` — one **minor ahead** of the newest stable |
| GitHub release | normal | **pre-release** |
| Metadata file | `latest.yml` | `beta.yml` |
| Kiosk setting | `UPDATE_CHANNEL=latest` | `UPDATE_CHANNEL=beta` |

- A **production** kiosk sets `allowPrerelease=false` → it never even considers
  pre-releases, so a beta build **cannot** land on it.
- A **beta** kiosk reads `beta.yml`, which only pre-releases contain → it only
  gets beta builds.
- **Switching channels needs no rebuild** — set `UPDATE_CHANNEL` in the app's
  `.env` (or a real OS env var) and restart.

### 3.1 Beta installs SIDE BY SIDE with production

A beta build is a **separate application**, not a second copy of the same one.
That is what lets one office machine run and test both channels; before this
(2026-08-27) installing beta simply upgraded production over the top, because
NSIS keys its uninstall entry off `appId`.

| | production | beta |
|---|---|---|
| `appId` | `com.kioskapp.desktop` | `com.kioskapp.desktop.beta` |
| `productName` / install dir | `witworldwide` | `witworldwide-beta` |
| icon | `build/icon.ico` (navy) | `build/icon-beta.ico` (orange, "BETA") |
| `%APPDATA%` tree | `kiosk-app` | `kiosk-app-beta` |
| config | `electron-builder.yml` | `electron-builder.beta.yml` |

Because the `%APPDATA%` trees are separate, so are the database, the logs and
the **provisioned kioskId** — each install needs `provision-kiosk.ps1` run once:

```powershell
.\provision-kiosk.ps1 -KioskId W006            # production
.\provision-kiosk.ps1 -KioskId W006 -Beta      # the beta install
```

They can run at the same time: the singleton lock is a file inside `userData`,
so each build locks only itself.

★ **Production's directory was deliberately NOT renamed.** `userData` is
Electron's default there (`kiosk-app`, from package.json's `name`), and the
existing `app.setName()` call runs after `whenReady()`, too late to move it on
Electron 34. Making that call early would have relocated every deployed kiosk to
a fresh empty database with no kioskId on the next auto-update. Only the beta
build is redirected, and it uses an explicit `app.setPath('userData', …)` rather
than a rename — see `src/main/core/appIdentity.ts`.

Build a beta locally with `npm run build:win:beta`; CI passes
`--config electron-builder.beta.yml` whenever `prerelease` is true. Regenerate
the icon with `npm run icon:beta` if `build/icon.png` ever changes.

**Identity comes from the BUILD, not from `.env`.** `electron-builder.beta.yml`
stamps `buildChannel: beta` into the packaged `package.json` (`extraMetadata`),
and that is what `appIdentity.ts` reads. `UPDATE_CHANNEL` is only the fallback.
This matters for LOCAL builds: CI force-writes `UPDATE_CHANNEL=beta` from the
same `prerelease` input that selects the beta config, so the two can never
disagree there — but `npm run build:win:beta` on a developer machine ships that
developer's `.env`. If identity keyed off `UPDATE_CHANNEL` alone, such a build
would install under the beta name and icon while still pointing at production's
`kiosk-app` database and singleton lock.

The update FEED still follows `UPDATE_CHANNEL`, so a local beta build whose
`.env` says `latest` would replace itself with production on its first update
check. `build:win:beta` prints a warning when it spots that mismatch.

> **A beta version must never trail the stable one.** The obvious
> `X.Y.Z-beta.N` scheme is semver-LOWER than `X.Y.Z`, and that broke the beta
> channel completely (fixed 2026-08-10): GitHub orders its release feed by
> version, so the stable release sat above every beta; electron-updater's GitHub
> provider takes the **first** feed entry whose tag is not another channel's
> prerelease — a stable tag passes that test — then 404s on `beta.yml` at that
> tag and **silently falls back to `latest.yml`**. Every beta kiosk therefore
> "upgraded" itself onto the production build within a minute of being installed,
> and stayed there (that build's `.env` says `UPDATE_CHANNEL=latest`). CI now
> derives the beta version from the newest **stable release**, one minor ahead, so
> the beta always sorts first in the feed and outranks production in semver. A
> whole minor rather than a patch, because production cuts releases by bumping the
> patch and would collide on the very next one.
>
> Related: `UpdateService` sets `allowDowngrade = false` **after**
> `autoUpdater.channel`, because electron-updater's `channel` setter forces
> `allowDowngrade = true`. Assigning them in the other order leaves every kiosk
> willing to install an older build than the one it is running.

### 3.1 Update schedules (per channel)

Configured in `.env`, **no hardcoding** — change and restart, no rebuild:

**Production (`latest`) — weekly maintenance window**
```
UPDATE_DAY=Friday     # day name, or 0-6 (0=Sun); default Friday
UPDATE_TIME=17:00     # HH:MM, LOCAL kiosk time; default 17:00
```
- Checks once per week at the window (not continuously during business hours).
- On the window: downloads in the background, then installs + restarts while idle
  (nightly-reboot fallback guarantees it applies).
- **Missed-window catch-up:** the window's "handled" timestamp is persisted
  (`update-state.json`). On startup, if the most recent window is newer than the
  last handled one (kiosk was powered off Friday 17:00), it checks **immediately**,
  installs if an update exists, records the window, and resumes the weekly cadence.
  Between windows it makes **no** update requests.
- Offline at the window → exponential backoff (15 min → 6 h) until it succeeds,
  then the window is recorded and weekly resumes.

**Beta (`beta`) — fast polling**
```
UPDATE_BETA_INTERVAL_MIN=15   # minutes between checks (5-240); default 15
```
- Checks immediately on startup, then every interval; downloads + installs +
  restarts automatically. Offline just retries on the next tick.

---

## 4. Versioning

- **Semantic versioning**, single source of truth = `package.json` `version`.
- **Production:** you cut a release by **bumping `package.json` version** in a PR
  to `main` (`npm version patch|minor|major --no-git-tag-version`). CI publishes
  that exact version. If the version is unchanged, the run is a **no-op** (it
  won't re-release an existing version).
- **Beta:** CI computes the version automatically — the newest **stable** release
  (or `package.json`, whichever is higher) with the **minor bumped** and
  `-beta.<github.run_number>` appended, e.g. stable `5.0.18` → `5.1.0-beta.11`.
  Every push to `develop_1` yields a unique pre-release that outranks production;
  you don't bump anything for beta. See the callout in §3 for why this matters.

---

## 5. How GitHub Actions publishes

Three workflow files in `.github/workflows/`:

- **`release.yml`** — reusable (`workflow_call`) pipeline: checkout → setup Node
  20 → `npm ci` (rebuilds native modules for Electron) → resolve version →
  `npm run build` (typecheck + electron-vite) → `electron-builder --win
  --publish always`. Shared by both channels.
- **`release-production.yml`** — `on: push: branches: [main]` → calls `release.yml`
  with `prerelease:false`, `release_type:release`. (A merged PR **is** a push to
  `main`, so merges publish too.)
- **`release-beta.yml`** — `on: push: branches: [develop_1, develop_v1]` → calls
  `release.yml` with `prerelease:true`, `release_type:prerelease`.

Publishing uses the built-in `GITHUB_TOKEN` (`permissions: contents: write`) —
no PAT needed. There is **no manual upload step**.

---

## 6. Windows code signing (add later)

The pipeline is signing-ready. Add two repo **secrets** and it starts signing
with **no workflow edits**:

- `WINDOWS_CSC_LINK` — base64 of the `.pfx` (or a URL to it),
- `WINDOWS_CSC_KEY_PASSWORD` — the certificate password.

`release.yml` already passes these as `CSC_LINK` / `CSC_KEY_PASSWORD`; empty =
unsigned (today). electron-builder signs the installer automatically once set.
Signed builds also let electron-updater verify the publisher on update.

---

## 7. Rollback

Rollback is just "publish a newer good version" — kiosks always move to the
**newest valid release on their channel**:

- Prod `1.3.0` is bad → ship a fix as **`1.3.1`** (or revert the code and release
  `1.3.1`). Push to `main`; production kiosks auto-update to `1.3.1`.
- `allowDowngrade` is **off**, so bumping forward is the mechanism — don't try to
  "re-release" a lower number. Take the known-good code, set a **higher** version,
  release it.
- If a release is entirely broken, you can also **delete/mark-as-draft** the bad
  GitHub release so kiosks fall back to the previous published one on the next
  check.
- **Beta and production are independent**: beta pre-releases never affect a
  production rollback (production ignores pre-releases entirely).

---

## 8. Cutting releases — quick reference

**Production**
```bash
npm version patch --no-git-tag-version   # or minor / major
git commit -am "release: vX.Y.Z"
git push origin main                     # CI builds + publishes latest.yml
```

**Beta** — just push to the dev branch; CI versions and pre-releases it:
```bash
git push origin develop_1                # CI publishes X.Y.Z-beta.<run#> (beta.yml)
```

**Local packaging (no publish):**
```bash
npm run build:win                        # bumps patch + builds NSIS locally
npx electron-builder --win --publish never   # build artifacts without uploading
```

---

## 9. CI runtime config (.env + secrets/)

`electron-builder` ships `.env` (API keys) and `secrets/` (Google
service-account JSON) as `extraResources`. Both are **gitignored**, so CI creates
safe **placeholders** (`Prepare runtime config placeholders` step) and the build
stays green — producing a valid **auto-updating** installer even with no secrets.

That placeholder build has no API keys, so the *kiosk features* (weather, sheets
sync, payment central URL, etc.) won't work. To publish a **fully-functional**
installer, inject the real files in that step from your own GitHub secrets, e.g.
add before the "Build and publish" step:

```yaml
- name: Inject runtime config
  if: steps.ver.outputs.skip == 'false'
  shell: bash
  env:
    KIOSK_ENV: ${{ secrets.KIOSK_ENV }}                        # full .env contents
    GOOGLE_SA: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON }}       # service-account.json
    GOOGLE_SA_OSAEK: ${{ secrets.GOOGLE_SERVICE_ACCOUNT_JSON_OSAEK }}
  run: |
    [ -n "$KIOSK_ENV" ] && printf '%s\n' "$KIOSK_ENV" > .env
    mkdir -p secrets
    [ -n "$GOOGLE_SA" ] && printf '%s' "$GOOGLE_SA" > secrets/service-account.json
    [ -n "$GOOGLE_SA_OSAEK" ] && printf '%s' "$GOOGLE_SA_OSAEK" > secrets/service-account-osaek.json
    # keep the channel correct regardless of what's in KIOSK_ENV:
    CH=$([ "${{ inputs.prerelease }}" = "true" ] && echo beta || echo latest)
    grep -v '^UPDATE_CHANNEL=' .env > .env.tmp 2>/dev/null || true; mv -f .env.tmp .env 2>/dev/null || true
    echo "UPDATE_CHANNEL=$CH" >> .env
```

Alternatively, run these workflows on a **self-hosted runner** that already has
`.env` and `secrets/` on disk — the placeholder step no-ops when the files exist.

---

## 10. Videos & large media (must survive updates)

Display/attract videos are large and pre-downloaded per kiosk, so they are **NOT
bundled** in the installer. They live in a fixed **external** folder outside the
app install directory, which is the whole point: an auto-update replaces the app
dir, so anything inside it (the old `resources/videos`) would be **wiped on every
update**. External storage survives.

- **Where:** `C:\KioskVideos` by default (packaged Windows), overridable with
  `KIOSK_VIDEOS_DIR`. Layout: `<dir>/<set>/*.mp4` where `<set>` is
  `insadong` | `osaek` | `hwaseong`. Resolved in `src/main/core/paths.ts` (`videos`).
- **Setup (once per kiosk):** drop the pre-downloaded `.mp4`s into
  `C:\KioskVideos\<set>\`. The app lists them fresh at runtime (no manifest, no
  rebuild) and streams them via `media://video/...`. Auto-updates never touch them.
- **Build:** you no longer delete `resources/videos` before building — it's simply
  not referenced by `extraResources` anymore, so every installer is light.
- **Migrating an existing kiosk:** its videos are currently inside
  `…\resources\videos`. After installing a new build, **move them once** to
  `C:\KioskVideos\<set>\` (or set `KIOSK_VIDEOS_DIR` to their location). From then
  on updates leave them alone.

Captured/AI photos already follow this pattern (`C:\KioskPhotos`, `PHOTO_SAVE_DIR`).

---

## 11. Prerequisites / gotchas

- **Must be installed via the NSIS installer** for auto-update to work.
  electron-updater replaces an *installed* app; a raw `win-unpacked` folder copy
  cannot self-update.
- **`build/icon.ico` must be committed** (it is) — CI needs it to build the NSIS
  installer.
- The installer is **per-user** (`perMachine: false`), so updates apply **without
  an admin prompt** — important for unattended kiosks.
- The **first** auto-update requires kiosks to already be running a build whose
  `app-update.yml` points at GitHub (i.e. built after this change). Deploy that
  build once via the installer; every update after is automatic.
