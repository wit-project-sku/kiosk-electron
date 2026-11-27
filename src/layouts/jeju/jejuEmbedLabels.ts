/**
 * The two 제주 public sites' names, shared by the home (tile / card titles) and
 * the web screens (tab labels, page headers).
 *
 * Localization_Jeju carries both (Tamnao_Tab / JejuQurang_Tab, 8/8) and is the
 * source; these are the fallback, the sheet's own words, for a cell left empty
 * or a kiosk that has not synced the rows yet (the bundled copy predates them).
 */
import type { Lang } from '@renderer/lib/i18n';

export const TAMNAO_LABEL: Partial<Record<Lang, string>> = {
  ko: '탐나오',
  en: 'Tamnao',
  ja: 'タムナオ',
  zh: '塔姆瑙',
  vi: 'Tamnao',
  th: 'Tamnao',
  ru: 'Тамнао',
  id: 'Tamnao',
};

export const JEJU_QURANG_LABEL: Partial<Record<Lang, string>> = {
  ko: '제주큐랑',
  en: 'Jeju Qurang',
  ja: '済州キュラン',
  zh: '济州岛古兰',
  vi: 'Jeju Qurang',
  th: 'Jeju Qurang',
  ru: 'Чеджу Куранг',
  id: 'Jeju Qurang',
};

/**
 * Drop a leading or trailing "·". The sheet's zh cells were split out of
 * MainButton_Tamnao's "塔姆瑙·济州岛古兰" and each kept the joining dot
 * ("塔姆瑙·" / "·济州岛古兰"), which would print on a label of its own.
 */
export const trimJoinDot = (label: string): string =>
  label.replace(/^\s*[·・]\s*|\s*[·・]\s*$/g, '');
