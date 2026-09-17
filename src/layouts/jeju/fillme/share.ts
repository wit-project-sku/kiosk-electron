/**
 * 결과 이미지를 우리 서버(admin-be)에 올리고 휴대폰 페이지 주소를 받는다.
 *   POST {apiBase}/api/fillme/shares
 *   multipart `image` → BaseResponse { success, code: 201, message, data: { shareUrl, expiresAt } }
 * 담당은 admin-be `FillmeShareController` (`domain/fillme`).
 *
 * 호스트는 앱이 이미 아는 witteria API base 다 — 메인이 `WITTERIA_API_BASE` 로
 * 정해서 KioskConfig.apiBase 로 넘겨 주고, 여기서 읽는다. 이 기능만의 주소
 * 환경변수는 두지 않는다: 키오스크 하나를 스테이지로 돌릴 때 한 군데만 바꾸면
 * 되고, 런타임 값이라 재빌드도 필요 없다.
 *
 * React 훅이 아니라 `getState()` 로 읽는 이유는, 이 함수가 결과가 나온 뒤
 * 이벤트 흐름에서 한 번 불리기 때문이다 — 렌더 중에 구독할 값이 아니다.
 */
import { useKioskStore } from '@renderer/store/kioskStore';
import { FILLME_CONFIG } from './config';

export interface ShareLink {
  /** QR 에 넣는 휴대폰 페이지 주소 */
  shareUrl: string;
  /** 서버가 이미지를 지우는 시각(ISO) */
  expiresAt: string;
}

/** `{apiBase}/api/fillme/shares`, with any trailing slash on the base ignored. */
export function shareUploadUrl(): string {
  const base = useKioskStore.getState().config.apiBase.replace(/\/+$/, '');
  return `${base}${FILLME_CONFIG.share.uploadPath}`;
}

export async function createShare(image: Blob): Promise<ShareLink> {
  const form = new FormData();
  form.append('image', image, 'fillme-result.jpg');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILLME_CONFIG.share.timeoutMs);
  try {
    const res = await fetch(shareUploadUrl(), { method: 'POST', body: form, signal: controller.signal });
    const body = (await res.json().catch(() => null)) as { success?: boolean; data?: Partial<ShareLink> } | null;
    const data = body?.data;
    if (!res.ok || !body?.success || !data?.shareUrl || !data.expiresAt) {
      throw new Error(`share upload failed: HTTP ${res.status}`);
    }
    return { shareUrl: data.shareUrl, expiresAt: data.expiresAt };
  } finally {
    clearTimeout(timer);
  }
}

export type ShareState =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'ready'; link: ShareLink }
  | { status: 'error' };
