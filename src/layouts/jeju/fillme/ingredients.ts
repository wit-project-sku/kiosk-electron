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

export function ingredientIconSources(ingredient: Ingredient): IngredientIconSources {
  const raw = ingredient.iconUrl;
  const server = typeof raw === 'string' && /^(https?:\/\/|\/)/i.test(raw) ? raw : null;
  // `noUncheckedIndexedAccess` — split()[0] 은 항상 있지만 타입은 모른다.
  const path = server ? (server.split(/[?#]/)[0] ?? '') : '';
  const file = path.split('/').pop() ?? '';
  return { local: (file && fillmeIngredientIconUrl(file)) || null, server };
}
