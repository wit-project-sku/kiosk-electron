/**
 * FillMe 화면 문구를 시트에서 읽는다 — Localization_Jeju_v2 의 `Fillme_*` 줄.
 *
 * 이 화면들은 원래 한국어만 박혀 있었다(copy.ts 머리말이 말하는 "제주 앱 통합 시
 * 8개 언어 처리 방식을 따로 정해야 한다"가 이것이다). 이제 시트가 61줄을 여덟 개
 * 언어로 모두 채워 주므로 `sheetText` 가 아니라 `t` 를 쓴다 — 빈 칸을 메울 authored
 * 사본이 필요 없다. 시트에 없는 키는 `t` 가 키 이름을 그대로 돌려주니 화면에서
 * 바로 눈에 띈다.
 *
 * 줄바꿈은 개행이 아니다
 * 구글 시트에서 셀 안 줄바꿈(Alt+Enter)은 CSV 로 나올 때 U+2028 LINE SEPARATOR 로
 * 실린다 — 지금 제주 시트에도 11 군데 들어 있다. 자바스크립트의 split 은 이 문자를
 * 개행으로 보지 않으므로 예전처럼 개행으로 잘라서는 한 줄도 나뉘지 않는다. 그래서
 * 줄을 나눠 그리는 자리는 전부 `tLines` 를 거친다.
 */
import type { Lang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';

/** 시트가 쓰는 줄바꿈 — 개행, U+2028(줄 구분), U+2029(문단 구분). */
const BREAKS = /[\n\u2028\u2029]+/;

/** 시트 한 줄 그대로. 줄바꿈이 없는 짧은 문구용. */
export function tx(key: string, lang: Lang): string {
  return t(key, lang);
}

/**
 * 시트 값을 줄 단위로 나눈 것 — 예전에 <br/> 로 그리던 자리에 쓴다.
 * 빈 줄은 버리고 앞뒤 공백도 턴다. 시트가 한 줄로 적어 두면 길이 1 이다.
 */
export function tLines(key: string, lang: Lang): string[] {
  return t(key, lang)
    .split(BREAKS)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 개인정보처리방침 한 편 — 제목과 조(條)들. */
export interface PolicyDoc {
  title: string;
  sections: { heading?: string; paragraphs: string[] }[];
}

const POLICY_KEY = 'Fillme_PrivacyPolicyContent';
/** 줄 하나씩 — 위의 BREAKS 와 달리 빈 줄을 살려 둔다(빈 줄이 조 경계다). */
const LINE = /[\n\u2028\u2029]/;

/**
 * 시트의 방침 전문을 화면이 그리던 모양으로 되돌린다.
 *
 * 시트는 한 칸에 통째로 들어 있지만 짜임새는 여덟 언어가 똑같다(확인함: 한국어와
 * 영어 모두 빈 줄로 나뉜 덩어리 14개). 빈 줄이 조 경계이고, 첫 덩어리가 제목,
 * 둘째 덩어리는 머리말이라 제목이 없으며, 셋째부터는 첫 줄이 조 제목이다. 조
 * 번호를 글자로 알아보려 들지 않는 이유가 이것이다 — '제1조' 와 'Article 1' 과
 * 'Статья 1' 을 모두 맞히는 규칙은 없지만, 빈 줄은 어느 언어에서나 빈 줄이다.
 *
 * 시트에 줄이 없으면 null 을 돌려준다 — 부르는 쪽이 authored 전문으로 돌아간다.
 */
export function tPolicy(lang: Lang): PolicyDoc | null {
  const raw = t(POLICY_KEY, lang);
  if (!raw || raw === POLICY_KEY) return null;

  const blocks: string[][] = [];
  let cur: string[] = [];
  for (const line of raw.split(LINE)) {
    const v = line.trim();
    if (v) cur.push(v);
    else if (cur.length) {
      blocks.push(cur);
      cur = [];
    }
  }
  if (cur.length) blocks.push(cur);
  if (blocks.length < 2) return null;

  const title = (blocks[0] as string[]).join(' ');
  const sections = blocks.slice(1).map((lines, i) =>
    // 머리말(첫 덩어리)만 조 제목이 없다.
    i === 0 ? { paragraphs: lines } : { heading: lines[0], paragraphs: lines.slice(1) },
  );
  return { title, sections };
}
