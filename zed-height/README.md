# zed-height — 제주 visitor-height sidecar

Estimates a visitor's height from a **ZED 2i** while the 제주 photo flow is
taking their picture, and reports it to the kiosk app as an anonymous number.

**제주 only** (W006 제주공항, W007 제주국제여객터미널, W008 세계자연유산본부). The app spawns
this only where `isJejuLayout()` is true.

## What it is not

- **Not the photo camera.** 제주 runs two cameras side by side: an Elgato that
  takes the picture and feeds the AR pipeline, and this ZED, which only
  measures. The ZED must never be opened as a photo camera — it is a stereo
  device and hands out both sensors in one frame, so a photo taken with it shows
  the visitor twice. `CameraService` filters it out by label for exactly that
  reason.
- **Not on screen.** Nothing here renders, streams, or reaches the renderer. It
  writes JSON on stdout and nothing else.
- **Not in the photo's way.** The app never awaits a result. If this process is
  dead, the SDK missing, or the camera unplugged, the height is simply null and
  the photo flow does not notice.
- **Not linked to the photo.** Results are stored with a timestamp and nothing
  else — no session id, no image reference. See migration `008`.
- **Not rotated in Windows.** The ZED's per-camera rotation setting must stay at
  **0**. It does not turn the camera, it restacks the two stereo eyes in the
  buffer (`2560x720` side by side becomes `720x2560` stacked) and the SDK can no
  longer split them — it refuses the device with `CAMERA NOT DETECTED`. Expect
  the preview to look sideways on a 90° mount; that is correct. (The Elgato IS
  rotated in Windows, deliberately — see `kioskLocations.cameraRotation`.)

## Install (per kiosk)

Needs the ZED SDK, which brings CUDA with it. Not bundled in the installer —
it is a provisioning step, roughly 1.2 GB.

1. Install the **ZED SDK for Windows** matching the machine's CUDA. The 제주
   kiosk is an RTX 5050 (Blackwell) and needs **CUDA 12.8+**.
2. Install Python 3.11, then the SDK's Python bindings:
   ```
   python "C:\Program Files (x86)\ZED SDK\get_python_api.py"
   ```
3. `pip install numpy`
4. Calibrate — see below.

Verify with `npm run height:measure` (or, on a kiosk with no repo checked out,
`scripts/provision-zed.ps1`, which checks every prerequisite and names whichever
one is missing).

## Calibrate

**Once per installation, and again only if the camera is moved.** Stand clear of
the camera, then:

```
npm run height:calibrate
```

This fits the floor plane and saves it. Deliberately a manual step: a kiosk boots
with people in front of it, and a floor silently refitted onto someone's
shoulders would shift every height that day with nothing to show for it.

It prints the fitted camera height and asks you to check it:

```
Camera is 1.37 m above the surface it fitted.
>> CHECK THIS WITH A TAPE MEASURE. <<
```

**Do not skip that.** Nothing in software can tell the real floor from the
largest flat surface in view — a desk, a counter and a floor are all level, all
below the camera, all gravity-aligned. A fit that landed on furniture produces
perfectly normal-looking readings that are wrong by a constant, which is the
worst way for a measurement to fail. A tape measure is the only thing that
catches it.

**Mount the camera in its final position and orientation FIRST.** A calibration
describes the floor in CAMERA coordinates, so it is only valid for the
orientation it was taken in; turning the camera afterwards invalidates it. That
much is detected — the sidecar compares the stored plane against live IMU
gravity at startup and refuses to measure rather than report nonsense — but the
fix is still to recalibrate.

The mount ANGLE, by contrast, is not configured anywhere and never needs to be.
제주 mounts this camera rotated 90°, and nothing here is told: "up" comes from
the fitted floor, so the mount can be rotated, tilted or replaced freely. This
is covered by tests at 0/45/90/180/270° and ±15° of tilt.

## Check it against real people

```
npm run height:measure
```

Prints a per-frame estimate, a running median, the distance and the subject
count. It shows **no video**: like the rest of this sidecar it only ever asks the
camera for `MEASURE.XYZ` (a grid of 3D coordinates), never for an image, so there
is nothing to display even by accident.

Stand at the kiosk's marked spot and compare against a tape measure. Expect
**±2–5 cm** — shoes, hair and posture all eat into it. Worth testing
specifically:

- a hand raised for the 손동작 게이트 (the common case, and the one the estimator
  is built around)
- a peace sign
- a hat
- two people, for a 같이찍기 capture

## Protocol

Newline-delimited JSON. stdout carries **only** protocol messages; diagnostics
go to stderr, which the app pipes into its own logger.

| in | |
|---|---|
| `{"cmd":"start"}` | begin sampling |
| `{"cmd":"stop"}` | end sampling and report |
| `{"cmd":"calibrate"}` | refit the floor, with nobody in frame |
| `{"cmd":"ping"}` | → `{"type":"pong"}` |

| out | |
|---|---|
| `{"type":"ready","calibrated":true,"cameraHeightM":1.42}` | after the camera opens |
| `{"type":"result","heightCm":171.4,"confidence":0.86,"samples":184,"subjects":1,"reason":null}` | one capture |
| `{"type":"calibrated","cameraHeightM":1.42}` | |
| `{"type":"error","message":"..."}` | |

`heightCm` is null whenever the number would not mean anything — nobody in the
zone, more than one visitor in frame, or too few usable frames. `reason` says
which.

### The measurement window

`start` is sent when the **camera screen opens**, not when the countdown starts.
제주 arms a 손동작 게이트 first, so the visitor is already standing in position and
posing before the 10 seconds begin — 15–30 s of frames rather than 10. That
length is the whole reason a median works.

## Tuning

| env | default | |
|---|---|---|
| `HEIGHT_FPS` | 12 | sampling rate (not the camera's frame rate) |
| `HEIGHT_ZONE_MIN` | 0.8 | standing zone, metres across the floor from the camera |
| `HEIGHT_ZONE_MAX` | 3.5 | |
| `HEIGHT_CALIBRATION` | `./calibration.json` | the app and `height-run.mjs` both point this at userData |

## Layout

| | |
|---|---|
| `geometry.py` | floor fitting, the up axis, shared constants |
| `estimator.py` | point cloud → height. **The part that can be wrong.** |
| `zed.py` | the only module that needs a camera |
| `main.py` | protocol loop and CLI modes |

`geometry.py` and `estimator.py` take plain numpy arrays and know nothing about
the SDK, so the measurement itself is tested against synthetic bodies on a
machine with no camera and no CUDA.

| command | needs a ZED? | |
|---|---|---|
| `npm run height:test` | no | the measurement maths, against synthetic bodies |
| `npm run height:selftest` | no | the app-side plumbing (`scripts/height-selftest.mjs`) |
| `npm run height:calibrate` | **yes** | fit and save the floor plane |
| `npm run height:measure` | **yes** | live estimates as text, to check against a tape measure |

Every one of those except `height:selftest` (which is pure Node) goes through
`scripts/height-run.mjs`, which resolves the interpreter
exactly as the app does — `HEIGHT_PYTHON`, then a `.venv` beside this folder,
then PATH — and points `HEIGHT_CALIBRATION` at the path the app actually reads.
Both are printed on every run, because getting either wrong is easy and the
symptoms are confusing (`ModuleNotFoundError: numpy` is always the wrong Python;
a calibration that seems to work but the app never sees is always the wrong
path).

For local work, make the venv it looks for:

```
cd zed-height
python -m venv .venv
.venv\Scripts\python -m pip install numpy pytest
```

On a kiosk there is no venv, so it falls through to the system Python the ZED
SDK's `get_python_api.py` installed pyzed into. `HEIGHT_PYTHON` overrides it if
that is not the one on PATH.

`tests/synthetic.py` builds bodies of known height at constant surface density,
which is what makes them a fair test: the estimator's premise is that a slab
through a head holds proportionally more points than a slab through a raised
arm, and constant-density sampling reproduces exactly that relationship.
