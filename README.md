# Kiosk App

A production-grade, **offline-first** Electron desktop application for operating a
customer-facing kiosk across **two monitors**:

- **Monitor 1 — Operator dashboard:** customer management, media library, camera
  capture, display controls, and settings.
- **Monitor 2 — Customer display:** a borderless, fullscreen/kiosk window that
  shows images, video, and slideshows pushed live from the operator.

Built with Electron, React, TypeScript (strict), Zustand, React Hook Form + Zod,
SQLite (better-sqlite3), CSS Modules, Lucide icons, electron-log, and
electron-builder.

---

## Table of contents

1. [Quick start](#quick-start)
2. [Tech stack](#tech-stack)
3. [Architecture overview](#architecture-overview)
4. [Folder structure](#folder-structure)
5. [State management strategy](#state-management-strategy)
6. [Database strategy](#database-strategy)
7. [IPC architecture](#ipc-architecture)
8. [Security architecture](#security-architecture)
9. [Multi-monitor architecture](#multi-monitor-architecture)
10. [Offline-first architecture](#offline-first-architecture)
11. [CSS architecture](#css-architecture)
12. [Error-handling strategy](#error-handling-strategy)
13. [Logging strategy](#logging-strategy)
14. [Performance practices](#performance-practices)
15. [Future scalability plan](#future-scalability-plan)
16. [Extending the app](#extending-the-app)

---

## Quick start

```bash
# Install dependencies (also rebuilds better-sqlite3 for Electron)
npm install

# Run in development with HMR
npm run dev

# Type-check the whole project (strict)
npm run typecheck

# Lint & format
npm run lint
npm run format

# Production build (compiles main/preload/renderer into ./out)
npm run build

# Package installers for the current platform
npm run build:win     # NSIS installer
npm run build:mac     # DMG
npm run build:linux   # AppImage
```

> **Requirements:** Node.js ≥ 20. The `postinstall` hook runs
> `electron-builder install-app-deps` to compile the native `better-sqlite3`
> module against the bundled Electron version.

---

## Tech stack

| Concern        | Choice                          | Why                                                        |
| -------------- | ------------------------------- | ---------------------------------------------------------- |
| Shell          | Electron 34                     | Cross-platform desktop, multi-window, native integration   |
| UI             | React 19 + TypeScript (strict)  | Component model, type safety end-to-end                    |
| Bundler        | electron-vite + Vite 6          | Fast HMR, separate main/preload/renderer pipelines, ESM    |
| State          | Zustand                         | Minimal, no boilerplate, no context re-render storms       |
| Forms          | React Hook Form + Zod           | Performant forms + schema validation shared with backend   |
| Database       | better-sqlite3                  | Synchronous, fast, zero-config embedded SQL                |
| Styling        | CSS Modules + design tokens     | Scoped styles, no runtime CSS-in-JS cost, theme via vars   |
| Icons          | lucide-react                    | Tree-shakeable SVG icon set                                |
| Logging        | electron-log                    | File + console transports, rotation, crash capture         |
| Packaging      | electron-builder                | Installers for Win/Mac/Linux, native dep rebuild           |

---

## Architecture overview

The app is split into **three Electron processes** plus a **shared contract
layer**, following a strict layered, feature-based architecture.

```
┌──────────────────────────────────────────────────────────────────┐
│                          RENDERER (React)                          │
│  features/* → hooks → window.api (typed bridge)                    │
│  Zustand stores (ui, settings, toast) · CSS Modules · ErrorBoundary│
└───────────────▲───────────────────────────────┬───────────────────┘
                │  contextBridge (window.api)    │  events (broadcast)
┌───────────────┴───────────────────────────────▼───────────────────┐
│                     PRELOAD (isolated bridge)                       │
│  Exposes a single typed `KioskBridge`; no Node leaks to renderer    │
└───────────────▲───────────────────────────────┬───────────────────┘
                │  ipcRenderer.invoke            │  webContents.send
┌───────────────┴───────────────────────────────▼───────────────────┐
│                          MAIN (Node)                                │
│  IPC registry → Services → Repositories → SQLite                    │
│  WindowManager · DisplayService · Security · Logger · media://      │
└────────────────────────────────────────────────────────────────────┘
                ▲
                │  imports types & contracts only (no runtime coupling)
┌───────────────┴────────────────────────────────────────────────────┐
│                            SHARED                                    │
│  domain types · IPC channels · IPC contracts · Zod schemas · const  │
└─────────────────────────────────────────────────────────────────────┘
```

**Dependency rule:** dependencies point inward/downward only.
`renderer → shared`, `main → shared`, `preload → shared`. The renderer never
imports from `main`, and `main` never imports from `renderer`. This prevents
circular dependencies and keeps each process independently buildable.

**Layering inside `main`:** `IPC handler → Service → Repository → Database`.
Each layer has one responsibility:

- **Handlers** are thin adapters that translate IPC calls into service calls.
- **Services** hold business logic and validation; no SQL, no Electron APIs.
- **Repositories** are the only place raw SQL lives; they map rows ↔ domain
  entities.
- **Database** owns the single connection, PRAGMAs, and migrations.

Wiring happens in one **composition root** (`src/main/container.ts`) using
explicit constructor injection — no decorators, no magic, trivially testable.

---

## Folder structure

```
src/
├─ shared/                     # Cross-process contract (no Node/DOM deps)
│  ├─ types/                   # domain.ts (entities), result.ts (Result<T>)
│  ├─ ipc/                     # channels.ts, contracts.ts, bridge.ts
│  ├─ validation/              # Zod schemas (used by UI + services)
│  └─ constants.ts
│
├─ main/                       # Electron main process
│  ├─ index.ts                 # Lifecycle orchestration / entry point
│  ├─ container.ts             # Composition root (DI)
│  ├─ core/                    # logger, paths, AppError, security, media://
│  ├─ database/                # Database.ts, migrations/, repositories/
│  ├─ services/                # Customer/Image/Settings/Display services
│  ├─ ipc/                     # registry.ts, registerIpc.ts, handlers/
│  └─ windows/                 # WindowManager, MainWindow, DisplayWindow
│
├─ preload/                    # Secure bridge
│  ├─ index.ts                 # contextBridge.exposeInMainWorld('api', …)
│  └─ index.d.ts               # Window type augmentation
│
└─ renderer/                   # React UI (two HTML entry points)
   ├─ index.html / display.html
   └─ src/
      ├─ main.tsx / display.tsx   # Operator + display roots
      ├─ App.tsx / DisplayApp.tsx
      ├─ features/                # Self-contained feature modules
      │  ├─ dashboard/  customer/  photo/  camera/  display/  settings/
      ├─ components/
      │  ├─ ui/                   # Design-system primitives
      │  └─ shared/               # AppShell, ErrorBoundary, Toast, …
      ├─ hooks/  store/  lib/  styles/
```

Each **feature** is self-contained (`FeaturePage.tsx`, `components/`, `hooks/`)
and only reaches outward through `window.api`, shared UI components, and stores.
Folders are intentionally shallow to keep navigation fast.

---

## State management strategy

State is deliberately split by **ownership and lifetime**:

| State                       | Owner                | Mechanism                                  |
| --------------------------- | -------------------- | ------------------------------------------ |
| Persistent domain data      | Main process (SQLite)| Source of truth; fetched via `window.api`  |
| Server cache (lists, items) | Feature hooks        | `useAsyncResult` with stale-response guard |
| App settings                | `settingsStore`      | Mirrors main; synced via `SettingsChanged` |
| UI navigation/sidebar       | `uiStore` (Zustand)  | Local, ephemeral                           |
| Notifications               | `toastStore`         | Global, ephemeral                          |
| Local form state            | React Hook Form      | Component-local, validated by Zod          |

Principles:

- **Keep local state local.** Only genuinely shared state goes into Zustand.
- **No prop drilling.** Cross-cutting concerns (toasts, theme) are reached via
  stores/hooks, not threaded through props.
- **The main process is the single source of truth** for anything persistent;
  the renderer holds caches that re-sync on broadcasts.
- **Selectors** (`useStore(s => s.field)`) ensure components re-render only when
  the slice they read changes.

---

## Database strategy

- **Engine:** `better-sqlite3` (synchronous). In the main process this is ideal —
  queries run on the native thread, are extremely fast, and avoid promise
  overhead. The renderer never touches the DB directly.
- **Tuning PRAGMAs:** `journal_mode=WAL`, `synchronous=NORMAL`,
  `foreign_keys=ON`, `busy_timeout=5000` — chosen for a single-writer,
  crash-resilient desktop workload.
- **Repository pattern:** all SQL is confined to `database/repositories/*`. They
  translate snake_case rows ↔ camelCase domain entities, so services and the UI
  speak only domain types.
- **Migration system:** ordered, versioned migrations
  (`database/migrations/*`) run inside transactions, tracked in a
  `schema_migrations` table so each runs exactly once. Append new migrations;
  never edit shipped ones.
- **Settings** use a typed key/value table with JSON-encoded values and
  `DEFAULT_SETTINGS` fallbacks, making new settings forward-compatible.

---

## IPC architecture

A **single typed contract** drives all inter-process communication:

1. `shared/ipc/channels.ts` — canonical channel names (`domain:action`).
2. `shared/ipc/contracts.ts` — maps each channel to its `request` and `response`
   types. Responses are always wrapped in `Result<T>`.
3. `shared/ipc/bridge.ts` — the `KioskBridge` API shape exposed on `window.api`.

Because the preload bridge and the main-process handler registry are both built
from this contract, **a change in one place produces compile errors everywhere**
the channel is used — the contract cannot silently drift between processes.

- **Invoke (request/response):** `ipcRenderer.invoke` → `ipcMain.handle`. The
  `handle()` helper in `ipc/registry.ts` is the single place that wraps results
  in `ok()`, converts thrown `AppError`s into serializable `err()` envelopes, and
  logs failures.
- **Events (one-way broadcast):** the main process pushes `DisplayStateChanged`,
  `SettingsChanged`, and `MonitorsChanged` to windows via `webContents.send`;
  the preload exposes subscription helpers that return an unsubscribe function
  (so listeners are always cleaned up).

---

## Security architecture

Implements the Electron security checklist:

- **`contextIsolation: true`, `nodeIntegration: false`, `sandbox: false`** (the
  last is required for an ESM preload). The renderer has **no Node access**.
- **Minimal preload surface:** only the typed `KioskBridge` is exposed — no
  `ipcRenderer`, no `require`, no `fs`.
- **Navigation lockdown:** `will-navigate` is blocked for untrusted origins;
  `setWindowOpenHandler` denies in-app windows and routes external links to the
  OS browser.
- **Permissions denied by default;** only `media` (camera) is granted.
- **Custom `media://` protocol** streams local files **only** from the app's
  media/thumbnail directories, with path-traversal protection — so `webSecurity`
  stays enabled (no `file://` loading).
- **Strict CSP** in both HTML entry points.
- **Single-instance lock** — a kiosk must be a singleton.
- **Production shortcut guards** — DevTools, reload, print, and zoom shortcuts
  are blocked in packaged builds.

---

## Multi-monitor architecture

- `WindowManager` owns both windows and all main→renderer broadcasting.
- On startup, if a second display is detected, the **customer display window auto-
  opens** on it (`DisplayWindow.pickDisplay` chooses the preferred monitor, else
  the first non-primary, else primary).
- The display window is **borderless + fullscreen**, with optional **kiosk mode**
  (configurable in settings) that locks it down and hides it from the taskbar.
- **Display content state lives in the main process** (`DisplayService`), not in
  either renderer. This means it survives the display window closing/reopening
  and is pushed to the window the instant it loads.
- The operator pushes content via `display:setState`; `DisplayService` notifies
  subscribers, and `WindowManager` broadcasts `DisplayStateChanged` to the
  customer window. Hot-plugging monitors emits `MonitorsChanged`.

---

## Offline-first architecture

The app works **100% offline**; there is no network dependency anywhere.

- All data is stored locally in SQLite under Electron's `userData` directory.
- All media (images/videos, camera captures) is stored on the local filesystem;
  only lightweight metadata rows live in the database.
- **Sync-ready by design:** the repository + service layering means a future
  cloud sync can be added as a new service that reads/writes the same
  repositories and reconciles changes — without touching the UI or IPC contract.
  (Schema already carries `created_at`/`updated_at` timestamps to support it.)

---

## CSS architecture

- **CSS Modules only** — every component imports a scoped `*.module.css`. No
  Tailwind, no CSS-in-JS, no component libraries.
- **Design tokens** (`styles/tokens.css`) are the single source of truth for
  color, spacing, radius, typography, motion, and elevation. Components reference
  only CSS variables, never raw hex values.
- **Theming** is a one-line switch: `:root[data-theme='dark']` overrides the
  semantic color layer. `useTheme` applies `light`/`dark`/`system` and tracks the
  OS preference live.
- Global resets and kiosk hygiene (no text selection, themed scrollbars,
  reduced-motion support) live in `styles/global.css`.

---

## Error-handling strategy

- **`Result<T>` envelope:** every IPC response is `{ ok: true, value } | { ok:
  false, error }`. The renderer branches with full type safety and never deals
  with thrown values across the bridge.
- **`AppError`** carries a stable `code` (`VALIDATION`, `NOT_FOUND`, `DATABASE`,
  …) and optional field-level messages. The IPC registry converts it into a
  serializable error.
- **Validation** runs on both sides of the boundary using the **same Zod
  schemas** — instant UI feedback, and the data layer can never be corrupted.
- **React `ErrorBoundary`** catches render crashes and shows a recoverable
  fallback instead of a blank window.
- **Main-process safety nets:** `uncaughtException`/`unhandledRejection` handlers
  plus electron-log's crash capture; fatal DB init failure quits cleanly.

---

## Logging strategy

- **electron-log** with file + console transports, 10 MB rotation, and a
  structured line format including subsystem scope and timestamp.
- **Scoped loggers** (`createLogger('database')`) tag each line by subsystem so
  production logs are easy to triage.
- Renderer console output and uncaught errors are routed through electron-log.
- Expected control-flow failures (`VALIDATION`, `NOT_FOUND`) are logged at
  `warn`; unexpected/`DATABASE`/`UNKNOWN` at `error`.

---

## Performance practices

- **Fast startup:** feature pages are **code-split** via `React.lazy` so the
  initial bundle stays small; each screen loads on demand.
- **Smooth large lists/galleries:** memoized rows/tiles (`React.memo`), lazy-
  loaded thumbnails, paginated customer queries.
- **No wasted re-renders:** Zustand selectors, `useMemo`/`useCallback` for
  expensive derivations, state split by lifetime.
- **No leaked resources:** every IPC subscription returns an unsubscribe;
  intervals/streams (slideshow timer, camera `MediaStream`) are torn down on
  unmount; the DB connection is checkpointed and closed on quit.
- **Minimal IPC traffic:** server caches + targeted broadcasts instead of
  polling.

---

## Data, analytics & sync architecture

The data layer is built around one rule: **SQLite is the source of truth; memory
holds only frequently-read, rarely-changing data; nothing depends on the
network.**

### Storage responsibilities

| Data                                   | Where it lives                  |
| -------------------------------------- | ------------------------------- |
| Customers, analytics, sessions,        | **SQLite** (better-sqlite3)     |
| reports, templates, sync queue         |                                 |
| Application settings/preferences       | **electron-store** (atomic JSON)|
| Images / videos / captures             | **Local filesystem**            |
| UI / session / device runtime state    | **Zustand** (never datasets)    |
| Cloud sync                             | **Background worker** (main)    |

> **Note on settings:** the spec lists "Settings" under both SQLite and
> electron-store. We resolved this by storing `AppSettings` (theme, kiosk mode,
> etc.) in **electron-store** per the explicit Architecture Rule, and keeping all
> domain/business data in SQLite. Rarely-changing business config lives in the
> `templates` table.

### Repository pattern

Every entity has a dedicated repository (`CustomerRepository`,
`AnalyticsRepository`, `SessionRepository`, `ReportRepository`,
`TemplateRepository`, `SyncQueueRepository`). Repositories are the **only** place
SQL is written. React components never touch SQL or `window.api` for data —
they go through feature hooks → repositories/services.

### Memory cache & instant navigation

At launch the renderer makes a **single** `app.bootstrap()` IPC call that returns
settings + templates + sync stats together. These warm dedicated Zustand stores
(`settingsStore`, `templatesStore`, `syncStore`). Pages then read this
rarely-changing config straight from memory — no per-navigation queries, no
loading spinners. Large/volatile data (customers, photos) is fetched on demand
and never cached wholesale in Zustand.

```
App start → app.bootstrap() → hydrate settings/templates/sync stores → render from memory
```

### Analytics (never lose an event)

Analytics are immutable, append-only records. Tracking is **persist-first**:

```
User action → trackEvent() → AnalyticsService → INSERT (sync_state='pending') → returns
                                                          ↓ (background, later)
                              SyncService tick → upload batch → mark 'synced'
```

The event is durably in SQLite **before** the call returns, so events survive
network failures, AI/API failures, crashes, restarts, and power loss. Reports are
generated from this event history (not counters), so they are reproducible.

### Durable sync queue

Every remote operation becomes a row in `sync_queue` first (`upload_image`,
`sync_customer`, …). A background worker (`SyncService`, runs on a timer in the
main process):

- claims due jobs atomically (`pending → processing`),
- on success marks `completed`; on failure records the error and re-queues with
  **exponential backoff + jitter** (`pending` again) until `max_attempts`, then
  parks the job as `failed` (never silently discarded — retryable from the UI),
- recovers jobs stuck in `processing` (from a crash) back to `pending` at startup.

The transport is **pluggable and unconfigured by default** (`NoopSyncTransport`):
offline-first means the queue simply accumulates and flushes if/when a real
backend is wired in — zero changes to services or UI. Live queue stats are
broadcast to the UI (`SyncStatsChanged`) and shown in the sidebar indicator.

### Backup / restore / export

- **Backup** → a single `backup.zip` (consistent SQLite snapshot via the online
  backup API + media + thumbnails + settings).
- **Restore** → closes the DB, swaps files atomically, clears stale WAL/SHM,
  re-opens.
- **Export** → Customers / Analytics / Reports to **CSV**, **Excel** (exceljs),
  or **JSON**.

All available from the **Data** screen in the operator UI.

### Reliability for long-running kiosks

- WAL journaling + transactions for crash safety.
- Analytics/sync writes are atomic and recoverable.
- Validation on both IPC boundaries; corrupt JSON values fall back to defaults
  rather than crashing.
- Timers are `unref`'d and listeners are always cleaned up, so the app can run
  for weeks without restarts or leaks.

## Future scalability plan

- **Cloud sync:** add a `SyncService` over the existing repositories; the
  timestamped schema and offline-first design already accommodate it.
- **Thumbnail/transcoding pipeline:** the import path already records a thumbnail
  slot; plug in `sharp` (or an FFmpeg worker) behind `ImageService` without
  schema or caller changes.
- **More entities/features:** drop a new folder under `features/`, a repository +
  service in `main`, and a few channels in the shared contract — the pattern
  scales linearly.
- **Background work:** move heavy jobs to a `utilityProcess` to keep the main
  process responsive.
- **Auto-update:** `electron-updater` is already a dependency; wire it to a
  release feed in `electron-builder.yml`.
- **Testing:** services/repositories are pure and injectable — add Vitest unit
  tests against in-memory SQLite, and Playwright for the renderer.

---

## Extending the app

**Add a new IPC channel** (e.g. `report:generate`):

1. Add the name to `shared/ipc/channels.ts`.
2. Add its request/response to `shared/ipc/contracts.ts`.
3. Add the method to `KioskBridge` in `shared/ipc/bridge.ts` and the preload.
4. Implement a handler in `main/ipc/handlers/*` and register it.
5. Call `window.api.<domain>.<method>()` from a feature hook.

TypeScript enforces every step — if any piece is missing, the build fails.

**Add a new feature page:** create `renderer/src/features/<name>/`, add a route
to `uiStore` + `AppShell` nav + `App.tsx`, and consume `window.api` via a hook.
```
