/**
 * 결과 화면(FillmeResult)과 휴대폰 결과 이미지(shareImage)가 함께 쓰는 문구.
 * 두 곳이 같은 말을 쓰도록 한 군데에 둔다.
 */
import type { Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';

/* 시트에 아직 줄이 없는 문구 — sheetText 가 키가 생기는 순간 시트를 따른다. */
export const COPY = {
  tabHealth: ['Fillme_result_tab1', '건강 분석'],
  tabSummary: ['Fillme_result_tab2', '종합분석 결과'],
  score: ['Fillme_result_score', '건강 점수'],
  scoreUnit: ['Fillme_result_scoreUnit', '점'],
  toSummary: ['Fillme_result_toSummary', '종합분석 결과보기'],
  nail: ['Fillme_result_nail', '손톱 분석'],
  /* 시안 문구는 '최근 10회의 기기사용' 이지만 API 의 fingerScores 는 손가락별 점수다 —
     손가락 수는 응답마다 달라(실제 8개) 문구에 숫자를 넣지 않는다. */
  chartNote: ['Fillme_result_chartNote', '그래프: 손가락별 손톱 분석 점수를 표시합니다.'],
  solutions: ['Fillme_result_solutions', '맞춤 솔루션'],
  solutionHint: ['Fillme_result_solutionHint', '원하는 솔루션을 2개이상을 선택해주세요.\nⓘ 눌러 솔루션 상세정보를 확인해보세요.'],
  aiResult: ['Fillme_result_ai', 'AI 분석 결과'],
  status: ['Fillme_result_status', '건강 상태'],
  aiNutrients: ['Fillme_result_aiNutrients', 'AI 추천영양제'],
  /** {list} 자리에 영양소 이름들이 들어간다 — 낱말 순서는 언어마다 시트가 정한다. */
  deficient: ['Fillme_result_deficient', '{list} 부족'],
  close: ['Fillme_result_close', '닫기'],
  care: ['Fillme_result_care', '관리'],
  watch: ['Fillme_result_watch', '관심'],
  good: ['Fillme_result_good', '권장'],
  overall: ['Fillme_result_overall', '종합'],
  color: ['Fillme_result_color', '색깔'],
  pattern: ['Fillme_result_pattern', '패턴'],
  damage: ['Fillme_result_damage', '손상'],
  tool: ['Fillme_result_tool', '툴'],
  skin: ['Fillme_result_skin', '주변 피부'],
} as const;

export function copy(id: keyof typeof COPY, lang: Lang): string {
  const [key, ko] = COPY[id];
  return sheetText(key, lang, { ko });
}
