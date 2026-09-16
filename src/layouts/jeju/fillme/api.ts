/**
 * FillMe 비회원 손톱분석 API — 샘플 앱 api.js 를 TypeScript 로 옮겼다.
 *  - POST /api/analysis/guest   분석(multipart) → 성공 시 결과, 손가락 부족 시 results.recapture
 *
 * 서버는 FillMe(주식회사 링커버스) 소유(`admin-v2.fillme.co.kr`)이고 우리 백엔드를
 * 거치지 않는다. 렌더러가 직접 부르는 몇 안 되는 경로라, 프로덕션 CSP 의
 * connect-src 에 이 오리진이 들어 있어야 한다 — main/core/security.ts 참고.
 *
 * ★ 샘플에 있던 `GET /api/analysis/guest/result`(reviewKey 로 결과 재조회)는
 *   옮기지 않았다. 그 API 는 샘플의 휴대폰 결과 페이지(result.html)가 쓰던 것이고,
 *   우리는 결과를 이미지로 그려 admin-be 에 올리는 방식(share.ts·shareImage.ts)으로
 *   대신한다. 키오스크에는 reviewKey 로 결과를 다시 부를 화면이 없다.
 */
import { FILLME_CONFIG } from './config';

export type Sex = 'male' | 'female';
export type Hand = 'left' | 'right';

export interface Ingredient {
  name: string;
  iconUrl?: string | null;
}

export interface AnalysisResult {
  reviewKey?: string;
  content?: string;
  checkDate?: string;
  recommendedSupplement?: {
    title?: string;
    description?: string;
    ingredients?: Ingredient[];
  };
  /** 손가락이 부족하면 다시 찍어야 할 손 — 예: ['left_hand'] */
  recapture?: string[];
  detectedFingers?: Partial<Record<'left_hand' | 'right_hand', number>>;
}

export interface GuestInfo {
  age: number;
  sex: Sex;
  bmi: number;
  /** 남성은 보내지 않는다(앱과 동일). */
  pregnant: boolean | null;
}

export type ApiErrorKind = 'network' | 'timeout' | 'notFound' | 'server';

export class ApiError extends Error {
  constructor(
    public readonly kind: ApiErrorKind,
    message: string,
    public readonly status?: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiBase(): string {
  return FILLME_CONFIG.apiBaseUrl.trim().replace(/\/+$/, '');
}

async function request(path: string, init: RequestInit, timeoutMs: number): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiBase() + path, {
      ...init,
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    const body = (await res.json().catch(() => null)) as
      | { results?: AnalysisResult; code?: string; message?: string; error?: string }
      | null;
    if (res.ok && body?.results) return body.results;
    const code = body?.code;
    const message = body?.message || body?.error || `HTTP ${res.status}`;
    // 서버 EException.HEALTH_ANALYSIS_NOT_FOUND
    throw new ApiError(code === 'APP29' ? 'notFound' : 'server', message, res.status, code);
  } catch (e) {
    if (e instanceof ApiError) throw e;
    if (e instanceof DOMException && e.name === 'AbortError') {
      throw new ApiError('timeout', '요청 시간이 초과되었습니다.');
    }
    throw new ApiError('network', e instanceof Error ? e.message : '네트워크 오류');
  } finally {
    clearTimeout(timer);
  }
}

export function analyzeGuest(info: GuestInfo, left: Blob, right: Blob): Promise<AnalysisResult> {
  const form = new FormData();
  form.append('age', String(info.age));
  form.append('sex', info.sex);
  form.append('bmi', String(info.bmi));
  // 키오스크 개인정보처리방침 수집 항목에 '현재 질환'이 없어 보내지 않는다(선택 파라미터).
  if (info.pregnant != null) form.append('pregnant', String(info.pregnant));
  form.append('leftHandImage', left, 'left.jpg');
  form.append('rightHandImage', right, 'right.jpg');
  return request('/api/analysis/guest', { method: 'POST', body: form }, FILLME_CONFIG.requestTimeoutMs);
}

export function needsRecapture(r: AnalysisResult | null): r is AnalysisResult & { recapture: string[] } {
  return !!r && Array.isArray(r.recapture) && r.recapture.length > 0;
}

/** 서버는 UTC 'yyyy-MM-ddTHH:mm:ssZ' → 기기 로컬 시간으로 표시. */
export function formatDate(value?: string): string {
  const d = value ? new Date(value) : new Date();
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
