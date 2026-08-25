import type { ObjectDetector } from '@mediapipe/tasks-vision';
import type { FootfallTuning } from '@shared/types/footfall';
import type { Detection } from './types';

/**
 * Person detection for 유동인구 counting.
 *
 * ── Where the model comes from ─────────────────────────────────────────
 * The same place the 손동작 게이트's does: `resources/mediapipe/`, vendored into
 * the installer and served over `appres://`. Nothing is fetched at runtime — the
 * kiosks sit on networks we do not control, and a counter that silently stops
 * working when a CDN is unreachable is worse than no counter, because the
 * missing hours look like empty ones.
 *
 * ── Why EfficientDet-Lite0 and not YOLO ────────────────────────────────
 * The prototype this is ported from ran YOLOv8n through onnxruntime-web, which
 * meant a second WASM runtime, a second execution-provider story, and hand-
 * written NMS over 8400 anchors in JavaScript on every frame. This app already
 * ships the MediaPipe vision runtime for the gesture gate, so the detector here
 * is 4.6 MB of model on top of bytes that are already in the installer, with NMS
 * and letterboxing done inside the graph. Same COCO 'person' class, a fraction
 * of the surface area.
 */

/** Base path served by the appres:// protocol handler. */
const RUNTIME_BASE = 'appres://mediapipe';
const MODEL_FILE = 'efficientdet_lite0.tflite';

/**
 * One detector for the whole renderer, kept alive across suspends.
 *
 * Loading costs 9.5 MB of WASM plus the model — about a second on this hardware.
 * The counter suspends and resumes many times a day (every photo session), and
 * paying that on each resume would mean missing the first second of every
 * resumption. The promise, not the instance, is cached so two callers racing
 * share one load.
 */
let detectorPromise: Promise<ObjectDetector> | null = null;

function loadDetector(tuning: FootfallTuning): Promise<ObjectDetector> {
  detectorPromise ??= (async () => {
    // Dynamic import: the MediaPipe glue is only needed by the two features that
    // use a camera, and keeping it out of the initial chunk keeps boot instant.
    const { FilesetResolver, ObjectDetector: Detector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(RUNTIME_BASE);
    return Detector.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: `${RUNTIME_BASE}/${MODEL_FILE}`,
        // GPU keeps a 320×320 pass near 5 ms. CPU is several times that and
        // competes with the attract video's decode for the same cores — but see
        // the fallback below: an unavailable GPU must not disable counting.
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      // The model knows 80 COCO classes and we care about exactly one. Filtering
      // inside the graph means the other 79 never cross into JavaScript.
      categoryAllowlist: ['person'],
      // Deliberately below the tracking threshold: weak boxes are what keep a
      // partially-occluded track alive (see ObjectTracker's double association).
      scoreThreshold: tuning.scoreThreshold,
      // A kiosk walkway wide enough to hold more than this at 4 fps is a kiosk
      // whose counting line is in the wrong place.
      maxResults: 10,
    });
  })().catch((error) => {
    // Clear the cache so a later resume retries instead of inheriting a rejected
    // promise for the rest of the day.
    detectorPromise = null;
    throw error;
  });
  return detectorPromise;
}

/** Retry once on CPU when the GPU delegate is unavailable on this machine. */
async function loadWithCpuFallback(tuning: FootfallTuning): Promise<ObjectDetector> {
  try {
    return await loadDetector(tuning);
  } catch {
    const { FilesetResolver, ObjectDetector: Detector } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(RUNTIME_BASE);
    detectorPromise = Detector.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${RUNTIME_BASE}/${MODEL_FILE}`, delegate: 'CPU' },
      runningMode: 'VIDEO',
      categoryAllowlist: ['person'],
      scoreThreshold: tuning.scoreThreshold,
      maxResults: 10,
    }).catch((error) => {
      detectorPromise = null;
      throw error;
    });
    return detectorPromise;
  }
}

export class PersonDetector {
  private detector: ObjectDetector | null = null;
  /**
   * MediaPipe's VIDEO mode rejects a timestamp that is not strictly greater than
   * the last one, and `video.currentTime` repeats while a frame is held. The
   * loop therefore carries its own monotonic clock.
   */
  private lastTimestamp = 0;

  async load(tuning: FootfallTuning): Promise<void> {
    this.detector = await loadWithCpuFallback(tuning);
  }

  isLoaded(): boolean {
    return this.detector !== null;
  }

  /**
   * Detect people in the current video frame.
   *
   * The video element is handed to MediaPipe directly rather than drawn to a
   * canvas first: the graph does its own letterbox-and-resize to the model's
   * 320×320, so an intermediate canvas would cost a copy and a readback to
   * produce the same pixels. Boxes come back in the video's own pixel space,
   * which is the space the tracker and the counting line both work in.
   */
  detect(video: HTMLVideoElement, tuning: FootfallTuning): Detection[] {
    if (!this.detector) return [];

    const timestamp = Math.max(performance.now(), this.lastTimestamp + 1);
    this.lastTimestamp = timestamp;

    const result = this.detector.detectForVideo(video, timestamp);
    const frameArea = video.videoWidth * video.videoHeight;
    if (frameArea === 0) return [];

    const detections: Detection[] = [];
    for (const detection of result.detections) {
      const box = detection.boundingBox;
      if (!box) continue;
      // Far-away people visible down a concourse are real, but they are not
      // passing THIS kiosk. Counting them adds a constant to every hour that
      // nobody downstream can subtract back out.
      if ((box.width * box.height) / frameArea < tuning.minBoxAreaRatio) continue;
      detections.push({
        bbox: [box.originX, box.originY, box.width, box.height],
        confidence: detection.categories[0]?.score ?? 0,
      });
    }
    return detections;
  }

  /**
   * Reset the frame clock. Called when the stream restarts — the next timestamp
   * still has to be monotonic, but the gap should not be attributed to motion.
   */
  resetClock(): void {
    this.lastTimestamp = performance.now();
  }
}
