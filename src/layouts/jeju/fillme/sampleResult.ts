/**
 * 결과 화면 시안(Figma 8240:45310 · 43467 · 44486)의 값을 게스트 분석 API 모양
 * (FillMe_Guest_Analysis_API.pdf)으로 적은 것 — 개발 빌드에서만 쓴다.
 *
 * 카메라 · API 없이 결과 화면을 볼 때, 응답이 비워 둔 칸만 이 값으로 채운다.
 * 운영 빌드에서는 `withSample` 이 결과를 그대로 돌려준다 — 지어낸 건강 점수를
 * 실제 방문객에게 보여 주지 않는다.
 */
import type { AnalysisResult, Drug } from './api';

/** 팝업(8248:139377)의 효능 문구 — 시안에 없는 성분은 이름만. */
const EFFECT: Record<string, string> = {
  비타민C: '항산화 작용, 면역 기능 강화 및 콜라겐 합성 도움',
  비타민B2: '에너지 생산, 피부/눈/신경계 건강 유지, 항산화 작용',
  비타민B3: '에너지 대사, 피부 건강, 신경계 기능 지원',
  비타민B12: '적혈구 생성 및 신경 기능에 필수적',
  칼슘: '뼈와 치아 건강에 필수적이며, 신경 및 근육 기능에도 도움',
  셀레늄: '항산화 작용 및 면역 기능에 도움',
  아연: '면역 기능, 상처 치유 및 단백질 합성에 필요',
};

function drugs(...names: string[]): Drug[] {
  return names.map((name) => ({ name, effect: EFFECT[name] }));
}

/** 손가락 10개 × 다섯 항목 — 평균은 다섯 항목의 평균. */
const FINGERS: [color: number, around: number, crack: number, line: number, pattern: number][] = [
  [88, 84, 85, 82, 83],
  [70, 62, 68, 60, 64],
  [74, 70, 72, 69, 71],
  [62, 58, 60, 55, 59],
  [80, 77, 78, 74, 76],
  [56, 50, 54, 52, 53],
  [90, 86, 88, 87, 89],
  [73, 70, 71, 68, 72],
  [66, 60, 63, 61, 64],
  [82, 78, 80, 76, 79],
];

const SAMPLE: AnalysisResult = {
  healthScore: 85,
  content:
    '손톱이 건강한 편이지만 주기적인 관리가 필요한 상태입니다. 손톱 끝이 살짝 갈라지거나 건조할 가능성이 있으며, 외부 환경에 의해 손상이 생길 수 있습니다. 몸 전체의 혈액순환을 돕기 위해 꾸준한 스트레칭과 손가락 마사지도 효과적입니다.',
  healthStatus: JSON.stringify({ 피로감: 402, '간 기능': 103, 건조감: 201, 매끈함: 400 }),
  fingerScores: JSON.stringify(
    Object.fromEntries(
      FINGERS.map(([color, around, crack, line, pattern], i) => [
        String(i),
        { color, around, crack, line, pattern, Average: (color + around + crack + line + pattern) / 5 },
      ]),
    ),
  ),
  healthStatusDetails: [
    {
      id: 402,
      issue: '피로감',
      title: '적절한 휴식으로 체력과 면역력을 회복하세요',
      details: '피로가 지나치게 축적되면 활동에 필요한 체력과 면역력이 떨어지게 돼요. 적절한 휴식 및 영양섭취를 하는 것이 중요해요.',
      drugs: drugs('비타민C', '비타민B2', '비타민B3', '비타민B12', '칼슘', '셀레늄', '아연'),
    },
    {
      id: 103,
      issue: '간 기능',
      title: '간 건강을 위한 필수 영양소 섭취를 통해 간 기능을 향상시키세요.',
      details:
        '필수 영양소 부족을 해결하고 간 기능을 개선하세요. 비타민 B 복합체, 비타민 C, 비타민 E, 오메가-3 지방산, 그리고 아미노산을 충분히 섭취하여 간 기능을 지원하세요. 신선한 과일과 채소, 견과류, 기름진 생선, 통곡물 등을 포함한 균형 잡힌 식사를 통해 영양소를 보충하고, 규칙적인 운동과 충분한 수분 섭취를 통해 전반적인 건강을 유지하세요.',
      drugs: drugs('밀크씨슬', '비타민B', '비타민C', '비타민E', '아미노산', '글루타치온'),
    },
    {
      id: 201,
      issue: '건조감',
      title: '충분한 수분과 영양섭취로 신체의 수분 균형을 유지하세요',
      details:
        '하루에 최소 8잔의 물을 마셔 체내 수분을 유지하고, 보습 효과가 있는 로션이나 크림을 사용해 피부의 수분을 지켜주세요. 또한, 비타민 C, E와 오메가-3 지방산이 풍부한 음식을 섭취해 피부 건강을 증진하고, 균형 잡힌 식단으로 영양을 보충하여 전반적인 건강을 유지하세요.',
      drugs: drugs('비타민C', '비타민E', '오메가3'),
    },
    {
      id: 400,
      issue: '매끈함',
      title: '매끈한 건강한 손톱이네요.',
      details:
        '매끈한 손톱을 유지하려면 손톱을 정기적으로 다듬어 모양을 유지하고, 손톱에 필요한 수분과 영양을 공급하기 위해 보습제를 사용하세요. 또한, 비타민과 미네랄이 풍부한 균형잡힌 식사를 통해 손톱의 건강을 지원하고, 손톱에 자극을 줄 수 있는 화학물질이나 물리적 충격을 피하세요.',
      drugs: drugs('비타민C', '비타민B'),
    },
  ],
  recommendedSupplement: {
    ingredients: [
      { name: '비타민B강화멀티비타민', iconUrl: 'https://admin-v2.fillme.co.kr/images/ingredient-icons/v1/multivitamin-b.png' },
      { name: '밀크씨슬', iconUrl: 'https://admin-v2.fillme.co.kr/images/ingredient-icons/v1/milk-thistle.png' },
      { name: '오메가3', iconUrl: 'https://admin-v2.fillme.co.kr/images/ingredient-icons/v1/omega3.png' },
    ],
    name: '퍼티그 오프',
    solution: '피로 관리',
    title: '손톱에서 피로 누적 신호가 감지됐어요',
    description:
      '손톱의 결과 윤기 패턴을 보니, 최근 몸이 평소보다 많이 지쳐 있을 가능성이 있어요. 잦은 야근, 수면 부족, 영양 불균형이 이어지면 손톱이 가장 먼저 변화를 보이는 부위 중 하나예요. → 비타민B군과 미네랄 밸런스를 채워, 다시 가벼운 컨디션으로 돌아가는 케어를 시작해 보세요.',
  },
};

/** 개발 빌드: 응답이 비워 둔 칸만 시안 값으로 채운다. 운영 빌드: 그대로. */
export function withSample(result: AnalysisResult): AnalysisResult {
  if (!import.meta.env.DEV) return result;
  const rs = result.recommendedSupplement ?? {};
  const sample = SAMPLE.recommendedSupplement ?? {};
  return {
    ...result,
    healthScore: result.healthScore ?? SAMPLE.healthScore,
    content: result.content || SAMPLE.content,
    healthStatus: result.healthStatus || SAMPLE.healthStatus,
    fingerScores: result.fingerScores || SAMPLE.fingerScores,
    healthStatusDetails: result.healthStatusDetails?.length ? result.healthStatusDetails : SAMPLE.healthStatusDetails,
    recommendedSupplement: {
      ...rs,
      name: rs.name ?? sample.name,
      solution: rs.solution ?? sample.solution,
      title: rs.title ?? sample.title,
      description: rs.description ?? sample.description,
      ingredients: rs.ingredients?.length ? rs.ingredients : sample.ingredients,
    },
  };
}
