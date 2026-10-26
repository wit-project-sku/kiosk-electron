/**
 * 게스트 분석 결과(api.ts) → 결과 화면(FillmeResult)이 그리는 모양.
 *
 * API 는 healthStatus · fingerScores 를 JSON 문자열로 준다.
 * 깨진 문자열 하나가 결과 화면 전체를 막으면 안 되므로 푸는 일은 전부 여기서,
 * 실패하면 그 칸만 비운다.
 */
import type { AnalysisResult, Ingredient } from './api';

/** 손톱 분석 그래프의 탭 — Figma 8240:45360 순서. */
export type NailCategory = 'overall' | 'color' | 'pattern' | 'damage' | 'tool' | 'skin';

/** 맞춤 솔루션 등급 — 관리(빨강) · 관심(주황) · 권장(초록). */
export type SolutionLevel = 'care' | 'watch' | 'good';

/** 솔루션의 추천 영양소 — 팝업(8248:139377)의 카드 한 장. */
export interface Nutrient {
  name: string;
  /** 효능 한 줄 (drugs[].effect). */
  benefit?: string;
}

export interface Solution {
  id: number;
  /** 항목 이름 (healthStatusDetails[].issue). */
  name: string;
  /** 한 줄 안내 (…title). */
  description?: string;
  /** 긴 설명 (…details). */
  detail?: string;
  level: SolutionLevel;
  iconUrl?: string;
  /** AI 추천영양제 (…drugs). */
  nutrients: Nutrient[];
}

export interface ResultView {
  healthScore?: number;
  /**
   * 그래프 탭마다 손가락 10칸의 점수(0–100). x 축 1…10 은 손가락이다.
   * 점수가 없는 손가락은 null — 뒤 손가락이 앞으로 당겨지지 않게 자리를 지킨다.
   */
  fingerScores: Partial<Record<NailCategory, (number | null)[]>>;
  /** 전체 진단 문장 (content). */
  comment?: string;
  solutions: Solution[];
  supplement: {
    name?: string;
    solution?: string;
    title?: string;
    description?: string;
    ingredients: Ingredient[];
  };
}

/** fingerScores 의 키 → 그래프 탭. 툴 = line, 손상 = crack, 주변 피부 = around. */
const SCORE_KEY: Record<NailCategory, string> = {
  overall: 'Average',
  color: 'color',
  pattern: 'pattern',
  damage: 'crack',
  tool: 'line',
  skin: 'around',
};

function parseJson(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch (e) {
    console.warn('[fillme] bad JSON field in result', e);
    return null;
  }
}

export const FINGER_COUNT = 10;

/**
 * 손가락 1…10 막대 색 — 종합분석 결과 시안(8240:44779…44797)의 파스텔, 순서대로.
 * 진단 아이콘 바탕색과는 다른 묶음이다. 결과 화면과 휴대폰 이미지가 같이 쓴다.
 */
export const FINGER_BAR_COLORS = ['#dcf6f7', '#dcf6f7', '#e6e4f9', '#fbe6d9', '#eeeef0', '#e6e4f9', '#dcf6f7', '#f3e2ed', '#dcf3f7', '#f1fad9'];

/**
 * {"0": …, "1": …} → 손가락 10칸. 칸은 키의 번호로 정한다 — 손가락 하나를 못
 * 찾아 키가 빠져도 나머지가 제자리에 남는다(배열 순서로 채우면 뒤가 당겨져 9 · 10
 * 칸이 빈다). 키는 0…9 가 문서 모양이고, 10 이 있고 0 이 없으면 1…10 으로 본다.
 */
function byFinger(obj: Record<string, unknown>): (Record<string, unknown> | null)[] {
  const keys = Object.keys(obj).filter((k) => /^\d+$/.test(k));
  const base = keys.includes(String(FINGER_COUNT)) && !keys.includes('0') ? 1 : 0;
  const slots: (Record<string, unknown> | null)[] = Array.from({ length: FINGER_COUNT }, () => null);
  for (const k of keys) {
    const i = Number(k) - base;
    const f = obj[k];
    if (i >= 0 && i < FINGER_COUNT && f && typeof f === 'object') slots[i] = f as Record<string, unknown>;
  }
  return slots;
}

/**
 * 손가락 한 개의 점수 — 키의 대소문자(Average / average)와 숫자 문자열("85.3")을
 * 너그럽게 받는다. 문서의 예시와 실제 응답이 어긋나도 탭이 비지 않게.
 */
function scoreOf(finger: Record<string, unknown>, key: string): number | null {
  const k = key in finger ? key : Object.keys(finger).find((x) => x.toLowerCase() === key.toLowerCase());
  const raw = k == null ? undefined : finger[k];
  const n = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(n) ? n : null;
}

/**
 * 항목 id → 등급.
 *
 * ★ API 문서에는 등급이 없다. 시안의 네 항목(피로감 402 · 간 기능 103 = 관리,
 *   건조감 201 = 관심, 매끈함 400 = 권장)이 id 끝 두 자리와 맞아떨어져 그 규칙을
 *   쓴다: 00 권장 · 01 관심 · 02 이상 관리. FillMe 가 준 진단 아이콘 파일 이름이
 *   00 쪽을 뒷받침한다 — 100 선명함 · 200 단정함 · 300 단단함 · 400 매끈함 ·
 *   500 깔끔함, 모두 좋은 상태다. 01 과 02+ 의 경계는 시안 하나뿐이라 FillMe 에
 *   확인이 필요하다 — 틀리면 이 함수 하나만 고친다.
 */
export function levelOf(id: number): SolutionLevel {
  const rank = id % 100;
  return rank === 0 ? 'good' : rank === 1 ? 'watch' : 'care';
}

const LEVEL_ORDER: Record<SolutionLevel, number> = { care: 0, watch: 1, good: 2 };

export function toResultView(result: AnalysisResult): ResultView {
  const scores = parseJson(result.fingerScores);
  const fingerScores: ResultView['fingerScores'] = {};
  if (scores) {
    const fingers = byFinger(scores);
    for (const [cat, key] of Object.entries(SCORE_KEY) as [NailCategory, string][]) {
      const values = fingers.map((f) => (f ? scoreOf(f, key) : null));
      if (values.some((v) => v != null)) fingerScores[cat] = values;
    }
    // 탭은 여섯 개가 늘 보인다 — 빈 탭 · 빈 칸이 생기면 API 가 실제로 준 모양을 남겨 둔다.
    const missing = (Object.keys(SCORE_KEY) as NailCategory[]).filter((c) => !fingerScores[c]);
    const absent = fingers.flatMap((f, i) => (f ? [] : [i + 1]));
    if (missing.length || absent.length) {
      console.warn('[fillme] fingerScores: empty tabs', missing, '· fingers without scores', absent, '· raw keys', Object.keys(scores), '· finger keys', Object.keys(fingers.find(Boolean) ?? {}));
    }
  }

  const solutions: Solution[] = (result.healthStatusDetails ?? [])
    .filter((d) => d && typeof d.id === 'number' && d.issue)
    .map((d) => ({
      id: d.id,
      name: d.issue,
      description: d.title || undefined,
      detail: d.details || undefined,
      level: levelOf(d.id),
      iconUrl: d.iconUrl || undefined,
      nutrients: (d.drugs ?? []).filter((x) => x?.name).map((x) => ({ name: x.name, benefit: x.effect || undefined })),
    }))
    // 관리 → 관심 → 권장. 같은 등급 안에서는 API 순서를 지킨다(sort 는 안정 정렬).
    .sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);

  const rs = result.recommendedSupplement ?? {};
  const score = result.healthScore;
  return {
    healthScore: typeof score === 'number' && Number.isFinite(score) ? score : undefined,
    fingerScores,
    comment: result.content || undefined,
    solutions,
    supplement: {
      name: rs.name,
      solution: rs.solution,
      title: rs.title,
      description: rs.description,
      ingredients: (rs.ingredients ?? []).filter((x) => x?.name),
    },
  };
}
