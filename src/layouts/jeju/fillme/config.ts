/**
 * FillMe 손톱분석 설정 — fillme-jeju-prototype 의 src/config.ts 를 키오스크 앱으로 옮긴 것.
 * 원본은 FillMe 샘플 앱(fillme-kiosk-web) config.js 값이고, 여기서 바뀐 것은 세 가지뿐이다:
 *   ① 결과 QR 업로드 주소가 상대 경로에서 앱이 이미 아는 witteria API base 로
 *      (렌더러에는 origin 이 없다 — share.ts 가 kioskStore 에서 읽는다),
 *   ② 카메라 모드·장치 이름·설치 방향이 빌드 환경변수로 뺀 값으로,
 *   ③ 성분 아이콘은 public/ 경로 대신 번들된 자산으로 (assets/fillme/index.ts).
 *
 * 나머지(촬영 타이밍, 무입력 시간, 이미지 한도, 요청 타임아웃)는 원본 그대로다.
 *
 * ── 주소는 왜 환경변수가 아닌가 ──────────────────────────────────────────
 *  · 분석 서버(`admin-v2.fillme.co.kr`)는 FillMe 소유이고 우리가 고를 수 있는
 *    값이 아니다. 스테이지도 대안 호스트도 없으니 상수로 둔다.
 *  · 결과 QR 서버는 admin-be 이고, 그 주소는 앱에 이미 있다 — `WITTERIA_API_BASE`
 *    (메인 프로세스, 런타임). 이 기능만의 `VITE_FILLME_SHARE_ORIGIN` 을 따로 두면
 *    키오스크 하나를 스테이지로 돌릴 때 두 군데를 맞춰야 하고, VITE_ 값은 빌드
 *    때 박히므로 재빌드까지 필요해진다. 그래서 그 변수는 두지 않는다.
 *
 * ★ `import.meta.env.VITE_*` 는 반드시 정적으로 읽는다 — Vite 는 그렇게 쓴 것만
 *   빌드 때 값으로 바꿔 넣는다. detailCardSave.ts 가 같은 이유로 같은 규칙을 쓴다.
 */

/**
 * 'demo' 는 카메라 없이 캔버스로 만든 가짜 영상으로 화면만 넘겨 본다(분석은 진짜).
 * 기기에서는 'real' 이어야 한다 — 그래서 기본값이 'real' 이다. 손톱 카메라가 아직
 * 안 달린 기기에서 화면만 확인할 때만 'demo' 로 띄운다.
 */
const CAMERA_MODE_ENV = import.meta.env.VITE_FILLME_CAMERA_MODE;

/** 손톱 카메라 장치 이름의 일부. 제주 기기에 달릴 모델은 [확인 필요] — 샘플 기준 Arducam. */
const CAMERA_LABEL_ENV = import.meta.env.VITE_FILLME_CAMERA_LABEL;

/** 설치 방향 보정(시계방향 0/90/180/270). 기기에 달아 보고 정한다 — [확인 필요]. */
const CAMERA_ROTATION_ENV = import.meta.env.VITE_FILLME_CAMERA_ROTATION;

const trimmed = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const rotation = ((): 0 | 90 | 180 | 270 => {
  const n = Number(trimmed(CAMERA_ROTATION_ENV, '0'));
  return n === 90 || n === 180 || n === 270 ? n : 0;
})();

export type FillmeCameraMode = 'real' | 'demo';

export const FILLME_CAMERA_MODE: FillmeCameraMode =
  trimmed(CAMERA_MODE_ENV, 'real') === 'demo' ? 'demo' : 'real';

export const FILLME_CONFIG = {
  /** 비회원 분석 API(FillMe 소유). 서버 CORS 는 모든 오리진 허용. */
  apiBaseUrl: 'https://admin-v2.fillme.co.kr',

  /**
   * 결과 QR — 키오스크가 결과 이미지를 admin-be 에 올리고, 돌려받은 휴대폰 페이지
   * 주소를 QR 로 띄운다. 계약은 `POST /api/fillme/shares` (multipart `image`) →
   * `{ success, code: 201, message, data: { shareUrl, expiresAt } }`.
   *
   * 호스트는 여기 없다: `WITTERIA_API_BASE` 로 정해지는 값이라 share.ts 가
   * kioskStore 에서 읽어 이 경로 앞에 붙인다.
   */
  share: {
    enabled: true,
    uploadPath: '/api/fillme/shares',
    timeoutMs: 20000,
  },

  camera: {
    /** 장치 이름에 이 문자열이 들어간 카메라를 우선 쓴다(손톱 촬영용 USB 카메라). */
    labelKeyword: trimmed(CAMERA_LABEL_ENV, 'Arducam'),
    /** IMX298 16MP 4:3 최대 모드. 가장 가까운 값으로 열린다. */
    width: 4656,
    height: 3496,
    /** 설치 방향 보정(시계방향). 미리보기와 전송 이미지 모두에 적용. */
    rotation,
    /** 미리보기만 좌우반전(전송 이미지는 반전 안 함 — 왼손/오른손이 뒤바뀌지 않게). */
    mirrorPreview: false,
  },

  /** 자동 촬영 타이밍(초): 손 올릴 준비 → 카운트다운 → 촬영 완료 표시 */
  prepareSeconds: 3,
  countdownSeconds: 3,
  shotDoneSeconds: 1.2,

  /** 서버 업로드 제한(파일당 5MB)보다 작게 JPEG 로 압축한다. */
  maxImageBytes: 4.5 * 1024 * 1024,

  /**
   * 무입력 시 처음 화면으로(초). 개인정보 보호를 위해 끄지 않는다.
   *
   * 키오스크 전체의 무입력 복귀(useKioskController, 3분)와 별개로 돈다. 이쪽이
   * 짧은 이유는 이 화면만 손 사진과 신체 정보를 들고 있기 때문이다 — 전체 타이머가
   * 홈으로 돌리기 전에 이 타이머가 먼저 그것들을 버린다.
   */
  idleSeconds: 90,
  resultIdleSeconds: 180,
  idleWarningSeconds: 10,

  /** 분석 요청 타임아웃(ms). 서버 nginx proxy_read_timeout(120s)보다 짧게. */
  requestTimeoutMs: 110000,
} as const;

/** 만 14세 미만 안내 기준(개인정보처리방침 제11조). */
export const CHILD_AGE = 14;
