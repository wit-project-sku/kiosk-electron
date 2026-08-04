# Kiosk "Update Now" — Backend API Spec

Handoff spec for the **witteria API** team. Lets an operator click one button in
the admin site and have every kiosk desktop app pull its update immediately,
instead of waiting for the scheduled Friday 17:00 window.

The kiosk (Electron) side is implemented separately in `kiosk-app`. This document
is the contract between them. **The entire contract is one timestamp.**

---

## 1. Concept

The backend stores a single value: *when an update was last requested*.

- The **admin button** sets it to "now" (`POST`).
- Each **kiosk** polls it every ~5 minutes (`GET`).
- A kiosk that sees a timestamp **newer than the last one it already handled**
  triggers its update check, then records that timestamp locally.

No job queue, no push channel, no per-kiosk bookkeeping on the server. The
kiosks converge on their own.

---

## 2. Endpoints

### 2.1 `GET /api/kiosks/{kioskNum}/update-command`

Called by the kiosk app. **Unauthenticated**, matching the existing kiosk
endpoints (`/api/kiosks/{kioskNum}/banners`, `/buttons`, etc. send no auth
headers today).

`{kioskNum}` is an **integer** — the same value already used by the banners and
buttons endpoints.

**200 response:**

```json
{
  "success": true,
  "data": {
    "requestedAt": "2026-08-03T14:22:31.000Z"
  }
}
```

**When no update has ever been requested:**

```json
{
  "success": true,
  "data": { "requestedAt": null }
}
```

`requestedAt` must be **ISO-8601 UTC**. `null` (or a missing field) means "nothing
requested" and the kiosk does nothing.

This endpoint is polled by every kiosk every ~5 minutes, so keep it cheap — a
single indexed row read. No side effects; `GET` must stay idempotent.

### 2.2 `POST /api/kiosks/update-command`

Called by the admin site when the operator clicks **Update all kiosks**.
**Must require admin authentication** (reuse whatever the admin site already
uses — this is the only privileged part of the feature).

**Request body:** empty, or optionally:

```json
{ "kioskNums": [3, 4, 5], "note": "hotfix for banner swap" }
```

- `kioskNums` omitted / empty → applies to **all** kiosks (the common case).
- `note` is optional free text for the audit log.

**Response:**

```json
{
  "success": true,
  "data": { "requestedAt": "2026-08-03T14:22:31.000Z" }
}
```

The server generates `requestedAt` itself — **do not accept it from the client.**

---

## 3. Data model

Minimum viable — a single row:

| column        | type        | notes                                  |
| ------------- | ----------- | -------------------------------------- |
| `requested_at`| timestamptz | last time an update was requested      |
| `requested_by`| text        | admin user, for the audit trail        |
| `note`        | text, null  | optional                               |

If you want per-kiosk targeting, key it by kiosk instead:

| column        | type        | notes                                  |
| ------------- | ----------- | -------------------------------------- |
| `kiosk_num`   | int, PK     | matches the URL segment                |
| `requested_at`| timestamptz |                                        |
| `requested_by`| text        |                                        |
| `note`        | text, null  |                                        |

Then `GET /{kioskNum}/update-command` returns that kiosk's row, and a fleet-wide
`POST` writes/updates every row in one statement. Starting with the single-row
version is fine — the URL shape already allows moving to per-kiosk later without
a kiosk-side change.

---

## 4. Rules that matter

1. **`requestedAt` must never move backwards.** The kiosks use "is this newer than
   what I already handled?" as their only trigger. A value that goes back in time
   means some kiosks silently skip an update.

2. **The server generates the timestamp.** Never trust a client-supplied one.

3. **No clock-skew concern.** The kiosk compares the value it just fetched against
   the last *server-provided* value it stored — never against its own clock. Kiosk
   clocks may be wrong; it doesn't affect correctness.

4. **Pressing the button twice is harmless.** The second press just moves the
   timestamp forward; kiosks that already updated find nothing new to install.

5. **Offline kiosks catch up automatically.** A kiosk that was powered off still
   sees a newer timestamp on its next poll after boot, and updates then.

6. **Keep `GET` unauthenticated** unless you also plan to give kiosks credentials.
   The value is a non-secret timestamp; the privileged action is the `POST`.

---

## 5. What the kiosk does with it

For context — no backend work implied by this section:

1. Polls `GET .../update-command` every ~5 min.
2. If `requestedAt > lastHandled` (stored locally in electron-store):
   - calls `UpdateService.checkNow()` — an immediate GitHub Releases check
   - on success, records `requestedAt` as handled
   - on failure (offline), records **nothing**, so it retries on the next poll
3. If a newer release exists it downloads in the background (~400 MB) and installs
   **once the kiosk is idle** — never mid photo or payment.
4. The Friday 17:00 weekly window is untouched and keeps running independently.

Practical effect: clicking the button means kiosks restart within roughly
10–20 minutes, as each finishes its current customer. Best pressed outside busy
hours.

---

## 6. Suggested admin UI

- A single **Update all kiosks** button, with a confirm dialog — it causes real
  kiosk restarts.
- Show the current `requestedAt` ("last requested: 3 Aug 14:22 by isroil").
- Optional but useful later: a per-kiosk list with each kiosk's currently
  installed version, so you can see the rollout land. That needs a separate
  kiosk→server version report and is **not** part of this contract.

---

## 7. Summary for the backend dev

Two routes, one timestamp:

```
GET  /api/kiosks/{kioskNum}/update-command   → { success, data: { requestedAt } }   (public)
POST /api/kiosks/update-command              → { success, data: { requestedAt } }   (admin auth)
```

Server sets `requestedAt = now()` on POST. Never let it go backwards. That's the
whole feature.
