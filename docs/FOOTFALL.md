# 유동인구 — anonymous passer-by counting

The kiosk camera watches the walkway and counts how many people cross an
imaginary line in front of it. Counts are stored locally by the hour and pushed
to the backend once a night at **21:30 local time**. Visitors are not told and
do not need to be: nothing about a person is recorded.

---

## What is and is not stored

| | |
|---|---|
| **Stored** | An integer per kiosk per hour: how many crossed, which way, and how long the counter was actually watching. |
| **Not stored** | Frames, stills, video, faces, embeddings, identifiers, anything that could distinguish one person from another. |

A camera frame exists only inside the renderer's counting loop. It is handed to
the detector, reduced to bounding boxes, matched against the previous frame's
boxes, and discarded. The only thing that leaves that loop is `+1`.

Nothing is written to disk, nothing crosses the IPC bridge but integers, and
there is no code path that can turn an hourly total back into a person.

---

## How it works

```
 renderer (touch-screen window)                       main process
┌──────────────────────────────────────┐            ┌────────────────────────┐
│ camera 640×480                        │            │ FootfallService        │
│   ↓ MotionGate (32×24 diff)           │  crossings │  hourly buckets        │
│   ↓ EfficientDet-Lite0 ('person')     │ ─────────► │  flush → SQLite / 60s  │
│   ↓ ObjectTracker (ByteTrack assoc.)  │            │                        │
│   ↓ LineCrossingCounter               │  ◄──────── │ runtime (active?)      │
└──────────────────────────────────────┘   runtime   └───────────┬────────────┘
                                                                 │ 21:30 daily
                                                     ┌───────────▼────────────┐
                                                     │ FootfallUploader       │
                                                     │  POST FOOTFALL_API_URL │
                                                     └────────────────────────┘
```

**Detection** — MediaPipe `ObjectDetector` with EfficientDet-Lite0, filtered to
the COCO `person` class inside the graph. The model and the WASM runtime are
vendored into the installer (`npm run vendor:mediapipe`) and served over
`appres://`, the same way the 손동작 게이트's hand landmarker is. Nothing is
fetched from a CDN at runtime.

**Tracking** — ByteTrack-style double association ported from the standalone
counting prototype. Strong detections match tracks and can start new ones; weak
detections may only continue an existing track. That asymmetry is what stops a
person who briefly blurs or is occluded from being counted twice under a new id.

One thing the port had to add: association cannot be IoU alone. At 30 fps a
walking person's box always overlaps its own previous position, but at the 6 fps
this runs at the boxes can be disjoint — and two boxes that do not touch have an
IoU of exactly zero, which is indistinguishable from "different person". Every
track was one frame long and nothing was counted at all. `ObjectTracker` now
scores overlap first and falls back to size-relative proximity, which only ever
matters for the first association of a track (after that the velocity prediction
lands on the detection). `npm run footfall:selftest` is the check that caught it
and the check that keeps it fixed.

**Counting** — a track is counted when the segment between its last two
centroids crosses the counting line, and only if it has been seen at least three
times. Each track id can be counted **once**, ever: a person waiting by the line
drifts back and forth across it and must not become a dozen visitors.

---

## Edge cases it handles

| Situation | Behaviour |
|---|---|
| **A visitor is taking an AR photo** | Counting releases the camera the moment the photo workflow leaves `idle` — before the preview opens, not when it does. Chromium gives the second opener of a device whatever format the first negotiated, so a counter still holding the camera at 640×480 would produce 640×480 *photos*. |
| **The customer display opens the camera** | Same release, triggered independently off `DisplayState.mode` — so a capture path added later (operator controls, the donation web view) cannot start competing for the device without this seeing it. |
| **The photo session just ended** | A 6-second cool-down before counting resumes. The group that was just photographed walks away across the line together; without the pause they would spike the busiest hours. |
| **Tracks across a suspend** | Tracker and counted-id set are cleared on every restart. Ids only mean something within one continuous view; carrying them across a gap would let a track "cross" by teleporting. |
| **Camera unplugged / in use / missing** | Retry with backoff (2s → 60s). Recorded for diagnostics but never used to disable the feature — a blocker there would mean nothing could ever switch it back on. |
| **Model or GPU unavailable** | GPU delegate falls back to CPU; a total failure leaves counting off and the kiosk otherwise untouched. Nothing here is on the path of anything a visitor waits for. |
| **Camera warm-up** | The first 8 frames after a (re)start are discarded while auto-exposure settles — the detector hallucinates on that noise. |
| **Nothing is moving** | A 32×24 luma diff gates the detector. On an empty corridor the loop costs a thumbnail and a subtraction, not a neural network. |
| **Machine busy** | If a detector pass exceeds 60 ms the loop halves its own rate, and climbs back when the machine frees up. |
| **Only one window counts** | The counter is mounted in the touch-screen window, which always exists. The customer display opens only when a second monitor is present. |
| **Hour / midnight rollover** | Every crossing is bucketed by its own timestamp, so a batch spanning 14:59:58 → 15:00:01 splits correctly. |
| **Power loss** | Buffered counts flush to SQLite every 60 s and on shutdown; at most one minute is at risk. |
| **Backend down or not built yet** | Rows stay `pending` and accumulate. Two retries inside the nightly window, then tomorrow. A kiosk offline for a week sends the week. |
| **Upload partially succeeded** | Buckets are keyed by `(kioskId, bucketStart)` and re-sent; the server upsert makes a duplicate a no-op. |
| **An uploaded hour gains a visitor** | The row flips back to `pending` and is re-sent with the corrected total. |
| **Disk growth** | 24 rows a day, and synced rows older than 180 days are pruned at each nightly run. |

---

## Data

`footfall_buckets` (migration 007), one row per kiosk per local hour:

| column | meaning |
|---|---|
| `kiosk_id`, `bucket_start` | Identity. `bucket_start` is local ISO-8601 with offset, e.g. `2026-08-24T14:00:00+09:00`. |
| `local_date`, `hour` | Denormalized for day queries. |
| `in_count` / `out_count` | Direction across the line. For a vertical line, `in` = left→right. Which physical direction that is depends on the camera mount, so both are kept. |
| `total_count` | `in + out` — the number this feature exists to produce. |
| `active_seconds` | How long the counter was actually watching that hour. Distinguishes "nobody walked past" from "the camera was busy taking photos". |
| `sync_state`, `synced_at` | Upload state. |

Inspect a live kiosk without stopping it:

```bash
node scripts/db-inspect.mjs footfall_buckets 50
```

---

## Backend contract

`POST` to `FOOTFALL_API_URL` (optionally `Authorization: Bearer FOOTFALL_API_KEY`):

```json
{
  "kioskId": "W006",
  "kioskNum": 6,
  "sentAt": "2026-08-24T21:30:00+09:00",
  "buckets": [
    {
      "bucketStart": "2026-08-24T14:00:00+09:00",
      "localDate": "2026-08-24",
      "hour": 14,
      "in": 37,
      "out": 34,
      "total": 71,
      "activeSeconds": 3480
    }
  ]
}
```

Requirements on the server:

1. **Upsert on `(kioskId, bucketStart)`**, replacing the stored totals with the
   ones in the body. The kiosk re-sends any hour whose total changed, and
   re-sends everything after a timeout it could not confirm.
2. Any 2xx means "durably stored". The kiosk marks those buckets synced and will
   not send them again unless their totals change.
3. Batches are at most 200 buckets. A kiosk that has been offline sends several
   batches back to back.

Until `FOOTFALL_API_URL` is set the counts stay on the kiosk. Pointing it at a
real endpoint later uploads the entire backlog on the first night — nothing
collected in the meantime is lost.

---

## Tuning a site

All of it is env, no rebuild — see the 유동인구 block in `.env.example`. The two
that matter most:

- `FOOTFALL_LINE` — `vertical:0.5` counts people walking across the frame (a
  camera facing a corridor). `horizontal:0.5` counts people walking toward the
  kiosk. Move the position if the camera is not centred on the walkway.
- `FOOTFALL_MIN_BOX` — raise it where people are visible far down a concourse
  behind the walkway. They are real people, but they are not passing *this*
  kiosk, and counting them adds a constant to every hour that nobody downstream
  can subtract back out.

After changing any of them — or anything in `ObjectTracker` /
`LineCrossingCounter` — run the scenario checks:

```bash
npm run footfall:selftest
```

They simulate walks, loiterers, occlusions, and noise against the real tracker
and counter. Several of the tuning numbers only look reasonable until a walk is
simulated with them.

To check what a kiosk is doing right now, `window.api.footfall.getStats()`
returns today's totals per hour, the current runtime (including why counting is
suspended, if it is), and how many buckets are waiting to upload.
