/**
 * 추천 영양제 아이콘 주소 고르기 — 결과 화면과 결과 이미지가 같은 규칙을 쓴다.
 *
 * 분석 API 는 FillMe 서버의 절대 주소(`iconUrl`)를 준다. 키오스크는 오프라인
 * 우선이고 그 호스트는 남의 서버라, 같은 파일 이름의 번들 복사본이 있으면 그것을
 * 먼저 쓴다. 이 빌드 이후 서버에 새로 생긴 성분이라 번들에 없을 때만 원래 주소로
 * 돌아간다. (시안에서는 `FILLME_CONFIG.ingredientIconBase` + public/ 경로였다.)
 */
import { fillmeIngredientIconUrl } from '@renderer/assets/fillme';
import type { Ingredient } from './api';

export interface IngredientIconSources {
  /** 번들된 복사본. 없으면 null. */
  local: string | null;
  /** API 가 준 주소(http(s) 또는 절대 경로만 통과). 없으면 null. */
  server: string | null;
}

/**
 * 한국어 성분 이름 → 파일 — FillMe 아이콘 매칭표(2026-10-23) 3절, 19종.
 * iconUrl 이 없을 때만 쓴다. name 은 lang 으로 번역되므로 한국어 응답에서만 맞는다 —
 * 매칭표도 iconUrl 의 파일명을 먼저 쓰라고 한다. 키는 공백·쉼표·밑줄을 뺀 모양.
 */
const FILE_BY_KO_NAME: Record<string, string> = {
  기본멀티비타민: 'multivitamin-basic.png',
  비타민B강화멀티비타민: 'multivitamin-b.png',
  비타민BD강화멀티비타민: 'multivitamin-bd.png',
  비타민C강화멀티비타민: 'multivitamin-c.png',
  비타민E강화멀티비타민: 'multivitamin-e.png',
  아연강화멀티비타민: 'multivitamin-zn.png',
  고함량철분: 'iron-high.png',
  글루타치온: 'glutathione.png',
  달맞이꽃종자유: 'evening-primrose.png',
  멜라토닌: 'melatonin.png',
  밀크씨슬: 'milk-thistle.png',
  비오틴: 'biotin.png',
  셀레늄: 'selenium.png',
  오메가3: 'omega3.png',
  칼슘: 'calcium.png',
  코엔자임Q10: 'coq10.png',
  테아닌: 'theanine.png',
  트립토판: 'tryptophan.png',
  폴리페놀: 'polyphenol.png',
};

export function ingredientIconSources(ingredient: Ingredient): IngredientIconSources {
  const raw = ingredient.iconUrl;
  const server = typeof raw === 'string' && /^(https?:\/\/|\/)/i.test(raw) ? raw : null;
  // `noUncheckedIndexedAccess` — split()[0] 은 항상 있지만 타입은 모른다.
  const path = server ? (server.split(/[?#]/)[0] ?? '') : '';
  const file = path.split('/').pop() || FILE_BY_KO_NAME[ingredient.name.replace(/[\s,_]/g, '')] || '';
  return { local: (file && fillmeIngredientIconUrl(file)) || null, server };
}
