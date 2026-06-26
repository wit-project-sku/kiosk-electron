# Kiosk App — Current State, Architecture, Design & UI/UX

> Single source of truth for the project as of June 2026.  
> Stack: Electron 34 · React 19 · TypeScript · CSS Modules · Zustand · SQLite · electron-store

---

## 1. What This App Is

A **production offline-first touchscreen kiosk platform** for Insadong (Seoul) deployments, with a hidden operator back-office and an optional second-monitor customer display.

| Role | Who uses it | Window |
|------|-------------|--------|
| **Public kiosk** | Visitors at the touchscreen | Monitor 1 — fullscreen touch UI |
| **Operator** | Staff (hidden access) | Monitor 1 — sidebar dashboard |
| **Customer display** | Audience on second screen | Monitor 2 — borderless fullscreen |

The app is designed to feel **instant and native**: no startup spinners, no network dependency at launch, stable for long-running sessions.

---

## 2. Kiosk Deployments

Three physical kiosks share one codebase. Layout and content differ; structure stays the same.

| ID | Location | Layout | Theme file |
|----|----------|--------|------------|
| **W001** | 북인사마당 | `INSADONG` | `themes/insadong.json` |
| **W002** | 인사동센터 | `INSADONG` | `themes/insadong.json` |
| **W003** | 남인사마당 | `NAM_INSADONG` | `themes/nam-insadong.json` |

Config is stored per machine in electron-store (`kiosk-config.json`):

```json
{ "kioskId": "W001", "layout": "INSADONG" }
```

Provision at deploy time:

```bash
npm run provision:kiosk -- W001
npm run provision:kiosk -- W002
npm run provision:kiosk -- W003
```

---

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        ELECTRON MAIN                             │
│  KioskConfig · ThemeLoader · SQLite · Repositories · Services     │
│  Night Sync (02:00) · Google Sheets (optional) · WindowManager   │
└───────────────────────────┬─────────────────────────────────────┘
                            │ typed IPC (contextBridge)
┌───────────────────────────▼─────────────────────────────────────┐
│                     RENDERER (React)                             │
│  App → Kiosk Layout OR OperatorApp · Zustand (UI only)            │
│  Display window → CustomerDisplay (slideshow / idle)               │
└─────────────────────────────────────────────────────────────────┘
```

### Layer rules

| Layer | Responsibility | Rule |
|-------|----------------|------|
| **Layouts** (`src/layouts/`) | Public kiosk UI in React code | Not in SQLite, not JSON-driven |
| **Themes** (`themes/*.json`) | Brand colors, typography | Loaded locally at startup |
| **local_cache** (SQLite) | CMS content from Sheets | Read by layouts, never fetched live in UI |
| **Zustand** | Screen, mode, session, UI flags | Not a database — no large datasets |
| **SQLite** | Analytics, sessions, sync queue, cache | All access via repositories |

### Startup sequence (no blank screens)

```
Electron start
  → Load kiosk-config (electron-store)
  → SQLite init + migrations
  → Seed local_cache if empty
  → Build bootstrap payload (config, theme, content, settings)
  → Inject into window via preload (__INITIAL_STATE__)
  → Synchronous hydrate before first React paint
  → Render correct layout immediately
```

Network is **never** involved in startup.

---

## 4. Application Modes

### 4.1 Kiosk mode (default)

What visitors see. Full-screen touch interface driven by layout components.

```
App.tsx
  └── resolveLayout(config.layout)
        ├── InsadongLayout   (W001, W002)
        └── NamInsadongLayout (W003)
              └── KioskShell (shared shell)
```

### 4.2 Operator mode (hidden)

Full back-office preserved from the original app. Access:

- **Enter:** 5 rapid taps on kiosk ID badge (top-right, within 3 seconds)
- **Exit:** "Kiosk" button (home icon) in operator sidebar

```
OperatorApp
  └── AppShell (collapsible sidebar)
        ├── Dashboard
        ├── Customers
        ├── Photos
        ├── Camera
        ├── Display control
        ├── Data (backup / export / sync stats)
        └── Settings
```

### 4.3 Customer display (Monitor 2)

Separate HTML entry (`display.html`). Auto-opens when a second monitor is detected.

| Mode | What shows |
|------|--------------|
| `idle` | Dark stage + optional message |
| `image` | Single full-bleed image |
| `video` | Single video |
| `slideshow` | Rotating images (interval from settings) |

Controlled from operator **Display** page. State lives in main process (`DisplayService`), synced via IPC events.

---

## 5. UI/UX — Public Kiosk

### 5.1 Information architecture

Two layout variants, same interaction model:

**Layout A — Insadong (W001, W002)**

```
Home
 ├── 소개      (intro)
 ├── 관광안내  (guide)
 ├── 이벤트    (events)
 └── 편의시설  (facilities)
```

**Layout B — Nam Insadong (W003)**

```
Home
 ├── 소개      (intro)
 ├── 맛집      (food)
 ├── 쇼핑      (shopping)
 └── 문화체험  (culture)
```

### 5.2 Screen flow

```
┌──────────────────────────────────────┐
│                          [W001]      │  ← kiosk ID (admin gesture)
│                                      │
│           북인사마당                  │  ← title (from cache)
│     전통과 현대가 어우러진 인사동      │  ← subtitle
│                                      │
│   ┌──────────┐  ┌──────────┐        │
│   │   소개   │  │ 관광안내  │        │  ← 2×2 touch grid
│   └──────────┘  └──────────┘        │
│   ┌──────────┐  ┌──────────┐        │
│   │  이벤트  │  │ 편의시설  │        │
│   └──────────┘  └──────────┘        │
└──────────────────────────────────────┘
         │ tap button
         ▼
┌──────────────────────────────────────┐
│                          [W001]      │
│                                      │
│  소개                                │  ← content title
│                                      │
│  북인사마당은 인사동의 대표 문화…     │  ← body text
│                                      │
│  ┌─────────────┐                     │
│  │  ← 홈으로   │                     │  ← secondary back button
│  └─────────────┘                     │
└──────────────────────────────────────┘
```

### 5.3 Touch interaction principles

| Principle | Implementation |
|-----------|----------------|
| Large targets | Buttons min-height 5rem, 2-column grid |
| No text selection | `user-select: none` on kiosk shell |
| Press feedback | `scale(0.97)` on `:active` |
| No loading states | Content pre-hydrated from local cache |
| Analytics on tap | `button_clicked` event → SQLite first |
| No admin UI visible | Operator behind gesture only |

### 5.4 Content source

All on-screen text comes from **local_cache** (SQLite), validated with Zod (`screenContentSchema`):

```ts
{ title: string; subtitle?: string; body: string }
```

Updated by:
1. **Seed** on first launch (per kiosk ID)
2. **Night sync** from Google Sheets `Content` tab (optional)
3. **Live refresh** via `ContentChanged` IPC event (no restart needed)

Sheet CMS format:

| kiosk_id | screen_key | title | subtitle | body |
|----------|------------|-------|----------|------|

Template: `scripts/sheets-content-template.csv`

---

## 6. UI/UX — Operator Back-Office

### 6.1 Layout

Classic **sidebar + content** dashboard (1280×800 default window).

```
┌────────────┬────────────────────────────────────┐
│ [Brand]    │  Page header + actions              │
│            │                                    │
│ Dashboard  │                                    │
│ Customers  │         Main content area          │
│ Photos     │                                    │
│ Camera     │                                    │
│ Display    │                                    │
│ Data       │                                    │
│ Settings   │                                    │
│            │                                    │
│ [Sync ●]   │                                    │
│ [Kiosk]    │  ← return to public UI             │
│ [Collapse] │                                    │
└────────────┴────────────────────────────────────┘
```

- Sidebar: 240px expanded / 72px collapsed
- Navigation: Zustand route state (no React Router)
- Feature pages: lazy-loaded (code-split, no spinner fallback)
- Theme: light / dark / system via `tokens.css`

### 6.2 Operator pages

| Route | Purpose | Key UX |
|-------|---------|--------|
| Dashboard | Overview stats | Entry landing |
| Customers | CRUD table + form | React Hook Form + Zod |
| Photos | Grid gallery | Import, delete |
| Camera | Webcam capture | Save to customer |
| Display | Control Monitor 2 | Mode picker, asset selection |
| Data | Backup, export, sync queue | Excel/CSV export |
| Settings | Theme, slideshow interval, display ID | Form-based |

### 6.3 Operator design tokens

Defined in `src/renderer/src/styles/tokens.css`:

| Token group | Examples |
|-------------|----------|
| Spacing | `--space-1` … `--space-8` (4px base) |
| Radius | `--radius-sm/md/lg/full` |
| Typography | `--font-sans`, `--font-size-xs` … `--font-size-2xl` |
| Semantic colors | `--color-bg`, `--color-surface`, `--color-text`, `--color-accent` |
| Elevation | `--shadow-sm/md/lg` |
| Motion | `--transition-fast` (120ms), `--transition-base` (200ms) |

Light theme default; dark via `[data-theme='dark']`.

---

## 7. Design System — Kiosk Themes

Themes are **per-layout JSON files**, mapped to CSS custom properties at runtime.

### 7.1 Insadong (warm heritage)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `#8B4513` | Buttons, accents |
| Background | `#FDF8F3` | Page background |
| Text | `#2C1810` | Headings |
| Text muted | `#7A6355` | Subtitles, body |
| Accent | `#C17817` | Highlights |
| Font | Noto Sans KR + system stack | All kiosk text |

### 7.2 Nam Insadong (green / nature)

| Token | Value |
|-------|-------|
| Primary | `#2D5A3D` |
| Background | `#F4F9F5` |
| Text | `#1A2E1F` |
| Accent | `#E8A838` |

### 7.3 CSS variable mapping

Applied by `useKioskTheme()` on `:root`:

```
--kiosk-primary, --kiosk-bg, --kiosk-text, --kiosk-font,
--kiosk-heading-size (2.5rem), --kiosk-button-size (1.25rem),
--kiosk-screen-padding (2rem), --kiosk-button-gap (1rem)
```

### 7.4 Kiosk components

| Component | File | Style |
|-----------|------|-------|
| `KioskShell` | `src/layouts/components/KioskShell.tsx` | Full-viewport flex column |
| `KioskButton` | `src/layouts/components/KioskButton.tsx` | Primary (filled) / secondary (outlined) |
| Layout wrappers | `InsadongLayout.tsx`, `NamInsadongLayout.tsx` | Nav item config only |

Button specs:
- Border-radius: 12px
- Primary: filled brand color, white text
- Secondary: white surface, brand border
- Active state: slight scale-down + darker fill

---

## 8. State Management

| Store | File | Holds | Does NOT hold |
|-------|------|-------|---------------|
| `kioskStore` | `store/kioskStore.ts` | config, theme, screen, content map | — |
| `uiStore` | `store/uiStore.ts` | `appMode`, route, sidebar | domain data |
| `settingsStore` | `store/settingsStore.ts` | AppSettings mirror | — |
| `syncStore` | `store/syncStore.ts` | Sync queue stats | — |
| `sessionStore` | `store/sessionStore.ts` | Session, camera flags | — |
| `toastStore` | `store/toastStore.ts` | Notifications | — |
| `templatesStore` | `store/templatesStore.ts` | Template cache | — |

SQLite remains source of truth for all operational data.

---

## 9. Data & Sync (Current State)

### 9.1 SQLite tables

| Table | Purpose |
|-------|---------|
| `customers`, `images` | Operator photo/customer management |
| `sessions` | Visit sessions |
| `analytics_events` | Append-only events (`sync_state: pending/synced`) |
| `reports` | Generated report snapshots |
| `templates` | Rarely-changing config seeds |
| `sync_queue` | Durable remote job queue |
| `local_cache` | CMS content keyed by screen |
| `failed_requests` | Failed API/analytics/sync recovery |

### 9.2 Analytics flow

```
User action → trackEvent() → IPC → AnalyticsService
  → INSERT analytics_events (pending) → return immediately
  → Night sync → Google Sheets Analytics tab (if configured)
```

Every event includes `kioskId` in payload automatically.

### 9.3 Night sync (02:00 AM, invisible)

| Task | Target |
|------|--------|
| Download Content sheet | `local_cache` |
| Upload pending analytics | Sheets `Analytics` tab |
| Process sync queue | Remote jobs |
| Retry failed_requests | Durable recovery |

Requires env vars: `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`  
Without credentials: fully offline, seeded content only.

---

## 10. Security & Electron

| Measure | Status |
|---------|--------|
| `contextIsolation: true` | ✅ |
| `nodeIntegration: false` | ✅ |
| Typed preload bridge (`window.api`) | ✅ |
| Navigation lockdown | ✅ |
| CSP in HTML | ✅ |
| Custom `media://` protocol | ✅ |
| Single-instance lock | ✅ |
| Production shortcut block | ✅ |

All network (Google Sheets) runs in **main process only**.

---

## 11. File Structure (Key Paths)

```
kiosk-app/
├── themes/
│   ├── insadong.json          # W001/W002 brand tokens
│   └── nam-insadong.json      # W003 brand tokens
├── scripts/
│   ├── provision-kiosk.mjs    # Deploy-time kiosk ID setup
│   └── sheets-content-template.csv
├── src/
│   ├── layouts/               # Public kiosk UI (code-driven)
│   │   ├── InsadongLayout.tsx
│   │   ├── NamInsadongLayout.tsx
│   │   └── components/
│   │       ├── KioskShell.tsx
│   │       └── KioskButton.tsx
│   ├── shared/
│   │   ├── types/kiosk.ts
│   │   ├── validation/content.schema.ts
│   │   └── ipc/               # Typed contracts
│   ├── main/
│   │   ├── index.ts           # Bootstrap orchestration
│   │   ├── container.ts       # DI composition root
│   │   ├── bootstrap.ts       # Aggregate startup payload
│   │   ├── core/              # Config, themes, paths, security
│   │   ├── database/          # SQLite + repositories + migrations
│   │   ├── services/          # Business logic + night sync
│   │   └── windows/           # Main + display window management
│   ├── preload/               # contextBridge → window.api
│   └── renderer/
│       ├── index.html         # Operator / kiosk entry
│       ├── display.html       # Customer display entry
│       └── src/
│           ├── App.tsx        # Mode router (kiosk vs operator)
│           ├── OperatorApp.tsx
│           ├── features/      # Operator pages
│           ├── components/    # ui/ + shared/
│           ├── hooks/         # useBootstrap, useKioskTheme, useScreenContent
│           ├── store/         # Zustand stores
│           └── styles/        # tokens.css, global.css
```

---

## 12. Component Inventory

### Shared UI (`components/ui/`)

`Button`, `Card`, `Input`, `Modal`, `Spinner`, `Badge`, `Field`, `EmptyState`, `ConfirmDialog`, `PageHeader`

### Shared layout (`components/shared/`)

`AppShell`, `ErrorBoundary`, `ToastViewport`, `SyncIndicator`, `Page`

### Kiosk (`src/layouts/`)

`KioskShell`, `KioskButton`, `InsadongLayout`, `NamInsadongLayout`

### Features (`features/`)

`dashboard`, `customer`, `photo`, `camera`, `display`, `data`, `settings`

---

## 13. What Is Complete vs Optional

| Area | Status |
|------|--------|
| Instant offline startup | ✅ Complete |
| Layout A / B routing | ✅ Complete |
| JSON themes per layout | ✅ Complete |
| Local content cache + Zod validation | ✅ Complete |
| Analytics persist-first | ✅ Complete |
| Night sync scheduler | ✅ Complete |
| Google Sheets transport | ✅ Wired (needs credentials at deploy) |
| Multi-monitor display | ✅ Complete |
| Operator back-office | ✅ Complete (hidden) |
| Deployment provision script | ✅ Complete |
| Google Sheets API (live CMS) | ⚙️ Optional — set env vars |
| electron-updater | 📦 Declared, not wired |
| AI integrations | 📋 Event types only, no service |

---

## 14. UX Summary Diagram

```
                    ┌─────────────────┐
                    │   App launch    │
                    └────────┬────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
     ┌────────▼────────┐          ┌─────────▼─────────┐
     │  Kiosk mode     │          │  2nd monitor?     │
     │  (touch UI)     │          │  → Display window │
     └────────┬────────┘          └───────────────────┘
              │
     5× tap on W00x
              │
     ┌────────▼────────┐
     │  Operator mode  │
     │  (sidebar app)  │
     └────────┬────────┘
              │
        "Kiosk" button
              │
              └──────────► back to Kiosk mode
```

---

## 15. Quick Reference — Commands

```bash
npm run dev              # Development with hot reload
npm run build            # Production build
npm run provision:kiosk -- W001   # Set kiosk identity
```

**Windows config path:** `%APPDATA%\Kiosk App\kiosk-config.json`  
**Database path:** `%APPDATA%\Kiosk App\data\kiosk.db`

---

*This document reflects the codebase after the kiosk platform architecture refactor. Update it when layouts, themes, or deployment targets change.*
