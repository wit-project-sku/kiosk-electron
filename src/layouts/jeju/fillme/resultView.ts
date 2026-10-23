/**
 * 게스트 분석 결과(api.ts) → 결과 화면(FillmeResult)이 그리는 모양.
 *
 * API 는 healthStatus · fingerScores · fingerCroppedImages 를 JSON 문자열로 준다.
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
  /** 손가락별 잘라낸 손톱 사진, 손가락 순. */
  nailImages: string[];
  /** 그래프 탭마다 손가락 순 점수(0–100). x 축 1…10 은 손가락이다. */
  fingerScores: Partial<Record<NailCategory, number[]>>;
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

/** {"0": …, "1": …} 의 값을 손가락 번호 순으로. */
function byFinger(obj: Record<string, unknown>): unknown[] {
  return Object.keys(obj)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b))
    .map((k) => obj[k]);
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
    const fingers = byFinger(scores).filter((f): f is Record<string, unknown> => !!f && typeof f === 'object');
    for (const [cat, key] of Object.entries(SCORE_KEY) as [NailCategory, string][]) {
      const values = fingers.map((f) => f[key]).filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (values.length) fingerScores[cat] = values;
    }
  }

  const images = parseJson(result.fingerCroppedImages);
  const nailImages = images
    ? byFinger(images).filter((u): u is string => typeof u === 'string' && /^https?:\/\//i.test(u))
    : [];

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
    nailImages,
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
