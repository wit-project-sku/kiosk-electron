/**
 * 제주도 이벤트 — Figma nodes 6212:54808 (MBTI tab at rest), 6212:54858 (mid
 * request), 6308:78956 (results) and 6212:54917 (list tab), the 2026-08-24
 * redesign of 6052:45789 / 6052:46385. The event detail behind a card is
 * 6212:55057 — the shared EventDetailScreen, unchanged by this pass.
 *
 * Two tabs share the header and the banner:
 *  - the region tab lists real events from the witteria API (category chips →
 *    a 3-across scrolling card grid → the shared event detail page), and
 *  - the MBTI tab picks up to one letter per axis, then 추천 결과 보기 calls the
 *    recommendation endpoint.
 *
 * Both data paths are the shared ones HwaseongEvents uses (useEvents /
 * eventsApi.recommend / EventDetailScreen); only the presentation is Jeju's.
 */
import { Fragment, useMemo, useState } from 'react';
import { isOk } from '@shared/types/result';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useEvents } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { sheetText, t } from '@renderer/lib/loc';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuEvents.module.css';

interface Props {
  controller: KioskController;
}

/** API region for every recommendation call on this kiosk. */
const REGION: EventRegion = 'JEJU';

/**
 * Two tabs — 제주도 (API region JEJU) and MBTI. The previous frames drew three
 * (종로구 / 인사동 / MBTI, Insadong districts left over from the source file) and
 * this file cut them down to two; the redesign agrees, and 6212:54808 now draws
 * exactly these two. `.tab` is flex:1, so a third would re-space the row.
 */
const TABS: Array<{ id: string; key?: string; label: string }> = [
  // The sheet spells it 제주시 (Event_Tab_Jeju, 8/8 languages); the frame drew
  // 제주도. The sheet wins — it is the operator's word for their own region —
  // and the authored label stays as the fallback. MBTI is a loan word with no
  // row of its own and needs none.
  { id: 'REGION', key: 'Event_Tab_Jeju', label: '제주도' },
  { id: 'MBTI', label: 'MBTI' },
];

/**
 * Category chips under the region tabs (Figma 6052:46478). Labels come from the
 * localization table by key. Localization_Jeju now carries all four itself, so
 * `t()` answers from the 제주 rows rather than falling through to Insadong's.
 */
const CATEGORY_TABS: { key: string; value: EventCategory }[] = [
  { key: 'Event_Category_All', value: 'ALL' },
  { key: 'Event_Category_performance', value: 'SHOW' },
  { key: 'Event_Category_exibition', value: 'EXHIBITION' },
  { key: 'Event_Category_etc', value: 'ETC' },
];

/**
 * The design draws a SCROLLBAR beside the grid and no page buttons — unlike
 * Hwaseong, which paginates six at a time. So one generous page is fetched and
 * the grid scrolls; six cards (3×2) are visible at rest, exactly as drawn.
 */
const PAGE_SIZE = 30;

type MbtiAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';

const MBTI_PAIRS: [MbtiAxis, MbtiAxis][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];

/** Figma row-major order (6052:45935): E S T J / I N F P. */
const MBTI_GRID: MbtiAxis[] = ['E', 'S', 'T', 'J', 'I', 'N', 'F', 'P'];

/** Authored Korean, the fallback behind `Event_MBTI_types`. */
const MBTI_LABELS: Record<MbtiAxis, string> = {
  E: '외향적', I: '내향적',
  S: '경험적', N: '상상적',
  T: '이성적', F: '감성적',
  J: '계획적', P: '즉흥적',
};

/**
 * The eight axis words, from Localization_Jeju `Event_MBTI_types`.
 *
 * The sheet stores them as ONE bracketed list — "[외향적, 경험적, …]" — in
 * MBTI_GRID's own row-major order (E S T J / I N F P), which is why this maps
 * positionally onto that array rather than onto MBTI_PAIRS.
 *
 * ★ Split on the IDEOGRAPHIC comma too: ja and zh separate with 、 rather than
 * ",", so a plain `split(',')` returns the whole list as one item and every
 * Japanese tile would read the entire sentence. Anything that does not yield
 * exactly eight parts is discarded and the authored Korean stands.
 */
const mbtiLabels = (lang: Lang): Record<MbtiAxis, string> => {
  const raw = sheetText('Event_MBTI_types', lang);
  const parts = raw
    .replace(/^\s*\[|\]\s*$/g, '')
    .split(/[,、，]/)
    .map((v) => v.trim())
    .filter(Boolean);
  if (parts.length !== MBTI_GRID.length) return MBTI_LABELS;
  return Object.fromEntries(MBTI_GRID.map((a, i) => [a, parts[i]!])) as Record<MbtiAxis, string>;
};

/**
 * A sheet line that stores its own break as a literal `<br/>`. Rendered as real
 * line breaks rather than injected as HTML — the cell is operator text.
 */
const brLines = (text: string): string[] => text.split(/<br\s*\/?>/i).map((l) => l.trim());

/*
 * ★ NO QR on this page (removed 2026-08-24 at the user's request). It used to
 * draw the shared `event-qr.png` — the bottom-right "QR 클릭! ← 모바일에서
 * 확인하기" row and the full-screen zoom it opened — over every state of both
 * tabs. Both are gone, along with the `qrZoom` state and the ~15 `.qr*` rules
 * that only they used.
 *
 * The ASSET stays: Insadong, 오산 and 화성 all import the same file and still
 * draw their own QR rows. This removal is 제주-only.
 */

/** Result slots the modal draws (Figma 6173:100721 has exactly two columns). */
const RESULT_SLOTS = 2;

export function JejuEvents({ controller }: Props): JSX.Element {
  const lang = useLang();
  const [tab, setTab] = useState('REGION');
  const [category, setCategory] = useState<EventCategory>('ALL');
  const [detailId, setDetailId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<MbtiAxis>>(new Set());
  const axisLabels = useMemo(() => mbtiLabels(lang), [lang]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'results'>('idle');
  const [results, setResults] = useState<EventRecommendation[]>([]);
  /* ♿ re-lays this page out rather than shifting it — the tab row moves to the
     foot of the artboard and the MBTI content follows it down — so almost every
     positioned element takes a second class. See the low-reach block at the end
     of JejuEvents.module.css for the y map. */
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /* Params are optional because CSS Module lookups are typed `string | undefined`. */
  const low = (base?: string, alt?: string): string => `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;

  const isMbti = tab === 'MBTI';
  // Passing a null region on the MBTI tab skips the fetch entirely.
  const { items, loading, error } = useEvents(isMbti ? null : REGION, category, 1, PAGE_SIZE);

  const selectTab = (id: string): void => {
    setTab(id);
    setDetailId(null);
  };

  const selectCategory = (value: EventCategory): void => {
    setCategory(value);
    setDetailId(null);
  };

  // Back closes an open event detail first; from the list it leaves the screen.
  const goBack = (): void => {
    if (detailId !== null) setDetailId(null);
    else controller.navigate('home', '뒤로');
  };

  const toggle = (letter: MbtiAxis): void => {
    if (status === 'loading') return;
    setSelected((prev) => {
      const next = new Set(prev);
      // One pick per axis: choosing E clears I, and tapping again deselects.
      const pair = MBTI_PAIRS.find((p) => p.includes(letter))!;
      next.delete(pair[0] === letter ? pair[1] : pair[0]);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const getResults = async (): Promise<void> => {
    setStatus('loading');
    // Letters in canonical axis order, e.g. "ENFP" — may be partial, which the
    // copy explicitly tells the visitor is fine.
    const mbti = MBTI_PAIRS.map(([a, b]) => (selected.has(a) ? a : selected.has(b) ? b : '')).join('');
    const res = await window.api.eventsApi.recommend({ region: REGION, mbti });
    setResults(isOk(res) ? res.value : []);
    setStatus('results');
  };

  return (
    <JejuPageFrame
      controller={controller}
      title="제주도 이벤트"
      bannerFallback="banner-detail"
      onBack={goBack}
      /* ♿ 6532:39157: the mode-bar shape with the promo KEPT under the bar, so
         the header lands at 113 + 573 = 686. The body shift stays 0 — this page
         positions its own low-reach body (see the CSS). */
      lowReachModeBar
      lowReachBarBanner
      lowReachShift={686}
    >
      <div className={low(styles.tabs, styles.tabsLow)}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`${styles.tab} ${tab === tb.id ? styles.tabActive : ''}`}
            onClick={() => selectTab(tb.id)}
          >
            {tb.key ? sheetText(tb.key, lang, { ko: tb.label }) : tb.label}
          </button>
        ))}
      </div>

      {!isMbti ? (
        <>
          {/* One centred line, "전체 ㅣ 공연 ㅣ 전시 ㅣ 기타" — the ㅣ separators
              are real glyphs in the design, drawn between the labels rather
              than as a border, so they are rendered as inert spans. */}
          <div className={low(styles.chips, styles.chipsLow)}>
            {CATEGORY_TABS.map((c, i) => (
              <Fragment key={c.value}>
                {i > 0 && <span className={styles.chipSep}>ㅣ</span>}
                <button
                  type="button"
                  className={`${styles.chip} ${c.value === category ? styles.chipActive : ''}`}
                  onClick={() => selectCategory(c.value)}
                >
                  {t(c.key, lang)}
                </button>
              </Fragment>
            ))}
          </div>

          {detailId !== null ? (
            // The 제주 event detail has no frame of its own in Figma; the shared
            // page is identical on every kiosk and takes the brand colour, so
            // this is the same detail Hwaseong opens, in 제주 orange.
            //
            // It must be wrapped: its root is a full-artboard pointer-events:none
            // layer (only the map re-enables), but JejuPageFrame's `.body > *`
            // rule would force it back to `auto` at equal specificity and let it
            // swallow every tap on the header underneath.
            <div className={low(styles.detailHost, styles.detailHostLow)}>
              <EventDetailScreen eventId={detailId} accent="#ff7f0f" />
            </div>
          ) : (
            <div className={low(styles.listScroll, styles.listScrollLow)}>
              <div className={styles.list}>
                {items.map((event) => (
                  <button
                    key={event.eventId}
                    type="button"
                    className={styles.card}
                    onClick={() => setDetailId(event.eventId)}
                  >
                    {/* The plate is always drawn: it is the design's empty-image
                        state and also what shows while a photo loads. */}
                    <span className={styles.cardThumb}>
                      {event.mainImage && (
                        <img src={event.mainImage} alt="" draggable={false} loading="lazy" />
                      )}
                    </span>
                    <span className={styles.cardTitle}>{event.title}</span>
                    <span className={styles.cardVenue}>{event.location}</span>
                  </button>
                ))}
              </div>

              {!loading && items.length === 0 && (
                <p className={styles.listEmpty}>
                  {error ? '이벤트를 불러오지 못했습니다.' : '등록된 이벤트가 없습니다.'}
                </p>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          <div className={low(styles.grid, styles.gridLow)}>
            {MBTI_GRID.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`${styles.cell} ${selected.has(letter) ? styles.cellSelected : ''}`}
                onClick={() => toggle(letter)}
              >
                <span className={styles.letter}>{letter}</span>
                <span className={styles.axisLabel}>{axisLabels[letter]}</span>
              </button>
            ))}
          </div>

          {status === 'loading' ? (
            <div className={`${low(styles.cta, styles.ctaLow)} ${styles.ctaLoading}`}>
              <span className={styles.spinner} />
              결과 로딩중..
            </div>
          ) : (
            <button
              type="button"
              className={low(styles.cta, styles.ctaLow)}
              onClick={() => void getResults()}
            >
              {sheetText('Event_MBTI_results', lang, { ko: '추천 결과 보기' })}
            </button>
          )}

          {/* Both paragraphs come from Localization_Jeju (Event_MBTI_guide1 /
              _guide2), which stores its own break as a literal `<br/>`.
              The orange accent the frame puts on "제주도 이벤트" is NOT
              reconstructed: the phrase moves inside the sentence in every other
              language, so locating it would be a guess. Korean-only copy in all
              eight languages was the worse trade. */}
          <p className={low(styles.desc, styles.descLow)}>
            {[
              sheetText('Event_MBTI_guide1', lang, {
                ko: 'MBTI 성향과 취향을 반영해<br/>제주도 이벤트를 맞춤 추천해드립니다!',
              }),
              sheetText('Event_MBTI_guide2', lang, {
                ko: 'MBTI 4가지 유형을 전부 선택하지 않아도<br/>나만의 추천 결과를 받아볼 수 있어요!',
              }),
            ].map((para, p) => (
              <span key={p}>
                {p > 0 && (
                  <>
                    <br />
                    <br />
                  </>
                )}
                {brLines(para).map((line, i) => (
                  <span key={i}>
                    {i > 0 && <br />}
                    {line}
                  </span>
                ))}
              </span>
            ))}
          </p>

          {status === 'results' && (
            // Figma node 6173:100721 — two columns and no close button, so
            // tapping the dim is the only dismiss, as designed.
            <div
              className={low(styles.overlay, styles.overlayLow)}
              role="presentation"
              onClick={() => setStatus('idle')}
            >
              <div
                className={`${styles.modal} ${lowReach ? styles.modalLow : ''}`}
                onClick={(e) => e.stopPropagation()}
              >
                {results.length > 0 ? (
                  <>
                    {/* The design lays out exactly two slots; extra results the
                        API returns are not shown. */}
                    {results.slice(0, RESULT_SLOTS).map((r, i) => (
                      <div
                        key={r.eventId}
                        className={`${styles.result} ${i === 0 ? styles.resultLeft : styles.resultRight}`}
                      >
                        {r.mainImage ? (
                          <img src={r.mainImage} alt="" className={styles.resultImg} draggable={false} />
                        ) : (
                          <span className={styles.resultImg} />
                        )}
                        <p className={styles.resultName}>{r.title}</p>
                        {/* Figma also shows a venue line ("서울역사박물관 1층
                            로비전시실"), but EventRecommendation carries only
                            eventId/title/mainImage — no location — so there is
                            nothing to render. It needs an API field. */}
                      </div>
                    ))}
                    {/* No QR here: 6308:78956 draws the card with the two event
                        columns and nothing else. */}
                  </>
                ) : (
                  // "없습니다", not "불러오지 못했습니다": `results` is empty both
                  // when the call fails AND when the API legitimately matches
                  // nothing, and the second is the common case. Same wording the
                  // other three locations use.
                  <p className={styles.modalEmpty}>추천 결과가 없습니다.</p>
                )}
              </div>
            </div>
          )}
        </>
      )}

    </JejuPageFrame>
  );
}
