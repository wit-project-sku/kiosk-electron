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

Verify with `python main.py --selftest`.

## Calibrate

**Once per installation, and again only if the camera is moved.** Stand clear of
the camera, then:

```
python main.py --calibrate
```

This fits the floor plane and writes `calibration.json`. Deliberately a manual
step: a kiosk boots with people in front of it, and a floor silently refitted
onto someone's shoulders would shift every height that day with nothing to show
for it.

The camera's mount rotation is **not** configured anywhere. 제주 mounts both
cameras rotated 90° (`kioskLocations.cameraRotation`), and nothing here is told
that — "up" is derived from the fitted floor, so the mount can be rotated,
tilted or replaced without a constant anywhere needing to agree with it. The
IMU's gravity vector is used only to reject a fit that landed on a wall.

## Check it against real people

```
python main.py --selftest
```

Prints a live per-frame estimate, a running median, and the subject count. Stand
at the kiosk's marked spot and compare against a tape measure. Expect **±2–5 cm**
— shoes, hair and posture all eat into it. Worth testing specifically:

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
| `HEIGHT_CALIBRATION` | `./calibration.json` | the app points this at userData |

## Layout

| | |
|---|---|
| `geometry.py` | floor fitting, the up axis, shared constants |
| `estimator.py` | point cloud → height. **The part that can be wrong.** |
| `zed.py` | the only module that needs a camera |
| `main.py` | protocol loop and CLI modes |

`geometry.py` and `estimator.py` take plain numpy arrays and know nothing about
the SDK, so the measurement itself is tested against synthetic bodies on a
machine with no camera and no CUDA:

```
python -m pytest tests -q
```

`tests/synthetic.py` builds bodies of known height at constant surface density,
which is what makes them a fair test: the estimator's premise is that a slab
through a head holds proportionally more points than a slab through a raised
arm, and constant-density sampling reproduces exactly that relationship.
