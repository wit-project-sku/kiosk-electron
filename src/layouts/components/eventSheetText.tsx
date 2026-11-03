/**
 * The 이벤트 page's MBTI copy from the venue's Localization tab (화성
 * Localization_Hwaseong, 오산 Localization_Osaek), with lib/uiText as the
 * per-language fallback for an empty cell.
 *
 *   Event_MBTI_types    the eight axis labels in ONE cell, "[외향적, 경험적, …]",
 *                       in the grid's own order E S T J / I N F P
 *   Event_MBTI_results  the 추천 결과 보기 button
 *   Event_MBTI_guide1   the intro sentence, venue name included, `<br/>` breaks
 *   Event_MBTI_guide2   the "you need not pick all four" hint
 */
import { Fragment, type ReactNode } from 'react';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText, tExact } from '@renderer/lib/loc';
import { ui, type UiTextKey } from '@renderer/lib/uiText';

export type MbtiAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

/** The order Event_MBTI_types lists its labels in (the Figma grid's). */
const SHEET_ORDER: readonly MbtiAxis[] = ['E', 'S', 'T', 'J', 'I', 'N', 'F', 'P'];

/** Axis label: the sheet list's entry, or the authored label when the cell is
 *  empty or does not split into exactly eight (ja/zh separate with 、). */
export function mbtiLabel(letter: MbtiAxis, lang: Lang, fallback: UiTextKey): string {
  const labels = tExact('Event_MBTI_types', lang)
    .replace(/^\s*\[|\]\s*$/g, '')
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return labels.length === SHEET_ORDER.length ? labels[SHEET_ORDER.indexOf(letter)]! : ui(fallback, lang);
}

export function mbtiSubmitText(lang: Lang): string {
  return sheetText('Event_MBTI_results', lang, { [lang]: ui('mbtiSubmit', lang) });
}

export function mbtiHintText(lang: Lang): string {
  return sheetText('Event_MBTI_guide2', lang, { [lang]: ui('mbtiHint', lang) });
}

/** The intro sentence, or '' when the sheet has no cell (the caller then draws
 *  its authored sentence). */
export function mbtiGuideText(lang: Lang): string {
  return tExact('Event_MBTI_guide1', lang);
}

/**
 * Sheet copy with `<br/>` / `\n` as line breaks. The first `accents` entry the
 * text contains (the venue's "화성시 이벤트") is drawn in `accentClass`, the way
 * the authored sentence marks it; a translation without it is drawn plain.
 */
export function renderSheetLines(text: string, accents: readonly string[] = [], accentClass?: string): ReactNode {
  const accent = accents.find((a) => a && text.includes(a));
  return text.split(/<\s*br\s*\/?\s*>|\n/i).map((line, i, all) => {
    const trimmed = line.trim();
    const at = accent ? trimmed.indexOf(accent) : -1;
    return (
      <Fragment key={i}>
        {at < 0 ? (
          trimmed
        ) : (
          <>
            {trimmed.slice(0, at)}
            <span className={accentClass}>{accent}</span>
            {trimmed.slice(at + accent!.length)}
          </>
        )}
        {i < all.length - 1 && <br />}
      </Fragment>
    );
  });
}
