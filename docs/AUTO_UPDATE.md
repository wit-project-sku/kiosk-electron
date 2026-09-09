# Auto-Update System

Production auto-update for the Windows kiosk fleet, built on **electron-updater**
+ **GitHub Releases**. Modeled on how VS Code / Discord update: check in the
background, download silently, install on restart. No custom update server.

---

## 1. How updates work (runtime)

All update logic lives in the main process, isolated under `src/main/updater/`:

- **`UpdateService.ts`** — wraps `electron-updater`'s `autoUpdater`. It:
  - checks on a **channel-specific schedule** (see §3.3);
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

## 3. Channels (production / beta / lab)

| | Production | Beta | Lab |
|---|---|---|---|
| Branch | `main` | `develop_1` | `advanced-ui` |
| Purpose | the live fleet | testing before production | experimental work, not yet fit for the beta kiosks |
| Version | `X.Y.Z` | `X.(Y+1).0-beta.<run#>` | `X.(Y+2).0-lab.<run#>` |
| GitHub release | normal | **pre-release** | **pre-release** |
| Metadata file | `latest.yml` | `beta.yml` | `lab.yml` |
| Kiosk setting | `UPDATE_CHANNEL=latest` | `UPDATE_CHANNEL=beta` | `UPDATE_CHANNEL=lab` |
| GH Environment | `production` | `beta` | `beta` (shared) |
| Workflow | `release-production.yml` | `release-beta.yml` | `release-lab.yml` |

- A **production** kiosk sets `allowPrerelease=false` → it resolves through
  `/releases/latest`, which excludes pre-releases, so no beta or lab build can
  land on it.
- A **beta** kiosk reads `beta.yml`, which only beta pre-releases contain.
- A **lab** kiosk reads `lab.yml`. See §3.2 — `lab` is a *custom* channel to
  electron-updater and is structurally the safest of the three.
- **Switching channels needs no rebuild** — set `UPDATE_CHANNEL` in the app's
  `.env` (or a real OS env var) and restart. Anything unrecognised (a typo,
  `production`, `labs`) falls back to `latest`, so a bad value can never put a
  production kiosk on a test feed.

Lab deliberately **shares the `beta` GitHub Environment** — same staging URLs and
test keys, no second copy of those secrets to keep in sync. ★ That environment's
"deployment branches" rule must therefore allow **both** `develop_1` and
`advanced-ui`. If `advanced-ui` is missing from it, a lab run still SUCCEEDS but
every secret resolves empty and the installer ships `.env.example` defaults with
no API keys — a green pipeline and an inert kiosk. The `Inject runtime config`
step emits a CI **warning** when it sees this.

### 3.1 Every channel installs SIDE BY SIDE

A beta or lab build is a **separate application**, not a second copy of the same
one. That is what lets one office machine run and test all three channels at
once; before this (2026-08-27) installing beta simply upgraded production over
the top, because NSIS keys its uninstall entry off `appId`.

| | production | beta | lab |
|---|---|---|---|
| `appId` | `com.kioskapp.desktop` | `com.kioskapp.desktop.beta` | `com.kioskapp.desktop.lab` |
| `productName` / install dir | `witworldwide` | `witworldwide-beta` | `witworldwide-lab` |
| icon | `build/icon.ico` (navy) | `build/icon-beta.ico` (orange, "BETA") | `build/icon-lab.ico` (green, "LAB") |
| `%APPDATA%` tree | `kiosk-app` | `kiosk-app-beta` | `kiosk-app-lab` |
| config | `electron-builder.yml` | `electron-builder.beta.yml` | `electron-builder.lab.yml` |
| display name | `Kiosk App` | `Kiosk App Beta` | `Kiosk App Lab` |

The colours are the load-bearing part: at 16px in the taskbar a name is truncated
but a hue is not, so navy / orange / green is what tells the three apart.
Regenerate with `npm run icon:beta` / `npm run icon:lab` (one script,
`scripts/make-channel-icon.mjs <channel>`) if `build/icon.png` ever changes.

Because the `%APPDATA%` trees are separate, so are the database, the logs and
the **provisioned kioskId** — each install needs `provision-kiosk.ps1` run once:

```powershell
.\provision-kiosk.ps1 -KioskId W006            # production
.\provision-kiosk.ps1 -KioskId W006 -Beta      # the beta install
.\provision-kiosk.ps1 -KioskId W006 -Lab       # the lab install
```

Same for the DB inspector: `node scripts/db-inspect.mjs --beta` / `--lab`.

They can run at the same time: the singleton lock is a file inside `userData`,
so each build locks only itself. ⚠ One caveat on a card-terminal kiosk (W003):
`PAYMENT_HTTP_PORT` is a fixed value in `.env`, and beta and lab inherit the
*same* value from the *same* `beta` environment secret — so only one of them can
run the payment agent at a time. Not an issue on the office machine, which has no
terminal.

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

**Identity comes from the BUILD, not from `.env`.** `electron-builder.<channel>.yml`
stamps `buildChannel: <channel>` into the packaged `package.json`
(`extraMetadata`), and that is what `appIdentity.ts` reads. `UPDATE_CHANNEL` is
only the fallback. This matters for LOCAL builds: CI force-writes
`UPDATE_CHANNEL` from the same `update_channel` input that selects the config, so
the two can never disagree there — but `npm run build:win:beta` / `:lab` on a
developer machine ships that developer's `.env`. If identity keyed off
`UPDATE_CHANNEL` alone, such a build would install under the test name and icon
while still pointing at production's `kiosk-app` database and singleton lock.

Adding a channel is therefore three things: a row in `CHANNEL_IDENTITY`
(`appIdentity.ts`), an `electron-builder.<channel>.yml`, and a row in the `case`
in `release.yml`'s **Resolve channel** step.

The update FEED still follows `UPDATE_CHANNEL`, so a local test build whose
`.env` says `latest` would replace itself with production on its first update
check. `build:win:beta` / `build:win:lab` print a warning when they spot that
mismatch.

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

### 3.2 Why `lab` is immune to that failure

`lab` is a **custom** channel name as far as electron-updater is concerned — its
GitHub provider only special-cases `"alpha"` and `"beta"`. From the feed walk in
`GitHubProvider.getLatestVersion` (6.8.x):

```js
const shouldFetchVersion = !currentChannel || ["alpha", "beta"].includes(currentChannel);
const isCustomChannel    = hrefChannel !== null && !["alpha", "beta"].includes(hrefChannel);
if (shouldFetchVersion && !isCustomChannel && !channelMismatch) { tag = hrefTag; break }
const isNextPreRelease = hrefChannel && hrefChannel === currentChannel;
if (isNextPreRelease) { tag = hrefTag; break }
```

With `channel = 'lab'`, `shouldFetchVersion` is **false**, so the first branch —
the one that lets a beta kiosk resolve a *stable* tag — can never fire. A lab
kiosk matches only tags whose prerelease id is exactly `lab`. And in the other
direction, a lab release sitting at the top of the feed is `isCustomChannel` to a
beta kiosk, which skips it and keeps walking.

So: **lab cannot be captured by a stable or beta release, and cannot disturb
either existing channel.** The two-minors-ahead version scheme is belt-and-braces
here, not load-bearing — it just keeps `X.(Y+1).0-beta.N` and `X.(Y+2).0-lab.N`
from ever sharing a base version.

### 3.3 Update schedules (per channel)

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

**Test channels (`beta`, `lab`) — fast polling**
```
UPDATE_BETA_INTERVAL_MIN=15   # minutes between checks (5-240); default 15
```
- Checks immediately on startup, then every interval; downloads + installs +
  restarts automatically. Offline just retries on the next tick.
- Beta and lab share this one knob deliberately: lab mirrors beta, and a second
  interval var would be one more thing to keep in step across the two installs
  sitting on the same office kiosk.

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
- **Lab:** the same rule with the minor bumped **twice** —
  `-lab.<github.run_number>`, e.g. stable `5.0.20` → `5.2.0-lab.7`. Every push to
  `advanced-ui` yields a unique pre-release; you don't bump anything for lab
  either. The extra minor is only to keep the beta and lab lanes from ever
  sharing a base version (§3.2).

The run number is monotonic across the whole repo, so a channel's versions always
increase even as the stable base moves — which matters because
`allowDowngrade = false`.

---

## 5. How GitHub Actions publishes

Four workflow files in `.github/workflows/` — one reusable pipeline and one thin
caller per channel:

- **`release.yml`** — reusable (`workflow_call`) pipeline: checkout → setup Node
  20 → **resolve channel** → `npm ci` (rebuilds native modules for Electron) →
  resolve version → inject runtime config → `npm run build` (typecheck +
  electron-vite) → `electron-builder --win --publish always`. Shared by all
  channels.
- **`release-production.yml`** — `on: push: branches: [main]` → `update_channel:
  latest`, `environment: production`. (A merged PR **is** a push to `main`, so
  merges publish too.)
- **`release-beta.yml`** — `on: push: branches: [develop_1, develop_v1]` →
  `update_channel: beta`, `environment: beta`.
- **`release-lab.yml`** — `on: push: branches: [advanced-ui]` →
  `update_channel: lab`, `environment: beta`.

★ The callers pass exactly **two** inputs, `update_channel` and `environment`.
Everything else — GitHub release type, `electron-builder` config, filename label,
version bump, the `UPDATE_CHANNEL` baked into the shipped `.env` — is derived
once in the **Resolve channel** step. The earlier shape passed `prerelease`,
`channel_label` and `release_type` separately, which let a caller state a
combination that cannot be true (`prerelease` + `releaseType: release`) and had
to be re-derived correctly in three different steps. An unknown channel fails the
job immediately rather than silently building something.

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
- **The three channels are independent**: beta and lab pre-releases never affect
  a production rollback (production ignores pre-releases entirely), and beta and
  lab ignore each other's tags as foreign channels (§3.2).

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

**Lab** — same, from the experimental branch:
```bash
git push origin advanced-ui              # CI publishes X.Y.Z-lab.<run#> (lab.yml)
```

**Local packaging (no publish):**
```bash
npm run build:win                        # bumps patch + builds NSIS locally
npm run build:win:beta                   # beta identity (witworldwide-beta)
npm run build:win:lab                    # lab identity  (witworldwide-lab)
npx electron-builder --win --publish never   # build artifacts without uploading
```

**Putting lab on a kiosk that already runs production and beta:**
```powershell
# 1. install the lab .exe from the newest -lab pre-release (own dir + Start-menu entry)
# 2. provision its identity — separate %APPDATA% tree, so separate kioskId
.\provision-kiosk.ps1 -KioskId W006 -Lab
# 3. restart "Kiosk App Lab". It polls lab.yml every 15 min from then on.
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
    grep -v '^UPDATE_CHANNEL=' .env > .env.tmp 2>/dev/null || true; mv -f .env.tmp .env 2>/dev/null || true
    echo "UPDATE_CHANNEL=${{ inputs.update_channel }}" >> .env
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
