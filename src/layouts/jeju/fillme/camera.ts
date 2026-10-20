/**
 * 손톱 촬영 카메라 — 샘플 앱 camera.js 를 옮기고 데모 영상 소스를 더했다.
 *  - real: USB(UVC) 카메라를 getUserMedia 로 연다. 장치 이름에 labelKeyword(Arducam)가 들어간 카메라만 연다.
 *    제주 기기에는 카메라가 셋(Elgato 사진 · ZED 키 측정 · Arducam 손)이라, 못 찾았을 때 기본 카메라로
 *    넘어가면 Elgato 나 ZED 영상으로 손 분석을 하게 된다. 그래서 못 찾으면 열지 않고 오류 화면을 띄운다.
 *  - demo: 카메라 없이 화면을 확인하도록 캔버스로 만든 가짜 영상. 촬영·압축 경로는 real 과 같다.
 * 설치 방향(rotation)은 전송 이미지에 실제 픽셀로 반영해 AI 서버가 똑바른 사진을 받게 한다.
 */
import { FILLME_CONFIG } from './config';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import type { Hand } from './api';

export type CameraMode = 'real' | 'demo';

const cfg = FILLME_CONFIG.camera;

export function cameraRotation(): number {
  return ((cfg.rotation % 360) + 360) % 360;
}

/** 캔버스로 그리는 데모 영상. 손 이미지를 천천히 움직여 실제 미리보기처럼 보이게 한다. */
class DemoFeed {
  private canvas = document.createElement('canvas');
  private hand: Hand = 'left';
  private raf = 0;
  private img = new Image();
  readonly stream: MediaStream;

  constructor() {
    this.canvas.width = 1600;
    this.canvas.height = 1200;
    this.img.src = fillmeArtUrl('hand') ?? '';
    this.stream = this.canvas.captureStream(30);
    const draw = (t: number): void => {
      this.paint(t);
      this.raf = requestAnimationFrame(draw);
    };
    this.raf = requestAnimationFrame(draw);
  }

  setHand(hand: Hand): void {
    this.hand = hand;
  }

  private paint(t: number): void {
    const ctx = this.canvas.getContext('2d');
    if (!ctx) return;
    const { width: w, height: h } = this.canvas;
    const bg = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.7);
    bg.addColorStop(0, '#5b4a40');
    bg.addColorStop(1, '#241c18');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    if (this.img.complete && this.img.naturalWidth) {
      const size = 880 + Math.sin(t / 900) * 14;
      ctx.save();
      ctx.translate(w / 2 + Math.sin(t / 1300) * 18, h / 2 + 30 + Math.cos(t / 1100) * 12);
      ctx.rotate(((this.hand === 'left' ? -8 : 8) * Math.PI) / 180);
      if (this.hand === 'right') ctx.scale(-1, 1);
      ctx.drawImage(this.img, -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '600 40px sans-serif';
    ctx.fillText(`DEMO CAMERA · ${this.hand === 'left' ? 'LEFT' : 'RIGHT'}`, 48, 72);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.stream.getTracks().forEach((track) => track.stop());
  }
}

/** 손 카메라의 deviceId. 없으면 'hand-camera-missing' 을 던진다 — 다른 카메라로 대신하지 않는다. */
async function pickDeviceId(keyword: string): Promise<string> {
  if (!navigator.mediaDevices?.enumerateDevices) throw new Error('camera-unsupported');
  const list = async (): Promise<MediaDeviceInfo[]> =>
    (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  let cams = await list();
  if (cams.length && cams.every((d) => !d.label)) {
    // 권한을 받기 전에는 장치 이름이 비어 있다 — 한 번 열어 권한을 받은 뒤 다시 조회한다.
    const probe = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    probe.getTracks().forEach((track) => track.stop());
    cams = await list();
  }
  const found = cams.find((d) => d.label.toLowerCase().includes(keyword));
  if (!found) {
    console.warn('[fillme] hand camera not found', { keyword, cameras: cams.map((d) => d.label) });
    throw new Error('hand-camera-missing');
  }
  return found.deviceId;
}

function waitForFrames(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2 && video.videoWidth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('camera-timeout')), 10000);
    video.addEventListener(
      'loadeddata',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode-failed'))), 'image/jpeg', quality);
  });
}

function downscale(canvas: HTMLCanvasElement, ratio: number): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = Math.round(canvas.width * ratio);
  out.height = Math.round(canvas.height * ratio);
  out.getContext('2d')?.drawImage(canvas, 0, 0, out.width, out.height);
  return out;
}

/** 서버 파일 제한 이하가 될 때까지 품질 → 해상도 순으로 낮춘다. */
async function encodeJpeg(canvas: HTMLCanvasElement, maxBytes: number): Promise<Blob> {
  let current = canvas;
  for (let round = 0; round < 4; round++) {
    for (const quality of [0.92, 0.82]) {
      const blob = await toBlob(current, quality);
      if (blob.size <= maxBytes) return blob;
    }
    current = downscale(current, 0.8);
  }
  return toBlob(current, 0.75);
}

export class NailCamera {
  private stream: MediaStream | null = null;
  private demo: DemoFeed | null = null;
  private video: HTMLVideoElement | null = null;
  private starting: Promise<void> | null = null;

  constructor(private mode: CameraMode) {}

  setMode(mode: CameraMode): void {
    if (mode === this.mode) return;
    this.stop();
    this.mode = mode;
  }

  setDemoHand(hand: Hand): void {
    this.demo?.setHand(hand);
  }

  isActive(): boolean {
    return !!this.stream?.active && !!this.video && this.video.videoWidth > 0;
  }

  /** 미리보기 시작. 이미 열려 있으면 재사용한다. */
  start(video: HTMLVideoElement): Promise<void> {
    this.video = video;
    if (this.stream?.active) {
      if (video.srcObject !== this.stream) video.srcObject = this.stream;
      return video
        .play()
        .catch(() => undefined)
        .then(() => waitForFrames(video));
    }
    if (this.starting) return this.starting;

    this.starting = (async () => {
      if (this.mode === 'demo') {
        this.demo = new DemoFeed();
        this.stream = this.demo.stream;
      } else {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('camera-unsupported');
        const keyword = cfg.labelKeyword.toLowerCase();
        const deviceId = await pickDeviceId(keyword);
        this.stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: { exact: deviceId }, width: { ideal: cfg.width }, height: { ideal: cfg.height } },
          audio: false,
        });
        const track = this.stream.getVideoTracks()[0];
        // 열린 트랙의 이름으로 한 번 더 확인한다 — 장치 목록이 그사이 바뀌었으면 여기서 걸러진다.
        if (!track?.label.toLowerCase().includes(keyword)) {
          this.stream.getTracks().forEach((t) => t.stop());
          this.stream = null;
          throw new Error('hand-camera-missing');
        }
        const caps = (track?.getCapabilities?.() ?? {}) as { focusMode?: string[] };
        if (track && caps.focusMode?.includes('continuous')) {
          track
            .applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] })
            .catch(() => undefined);
        }
      }
      video.srcObject = this.stream;
      await video.play().catch(() => undefined);
      await waitForFrames(video);
    })();

    return this.starting.finally(() => {
      this.starting = null;
    });
  }

  stop(): void {
    this.demo?.stop();
    this.demo = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    if (this.video) this.video.srcObject = null;
  }

  async capture(maxBytes: number): Promise<Blob> {
    const video = this.video;
    if (!video || !this.isActive()) throw new Error('camera-not-ready');
    const rot = cameraRotation();
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const swap = rot % 180 !== 0;
    const canvas = document.createElement('canvas');
    canvas.width = swap ? vh : vw;
    canvas.height = swap ? vw : vh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas-unavailable');
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);
    return encodeJpeg(canvas, maxBytes);
  }
}
