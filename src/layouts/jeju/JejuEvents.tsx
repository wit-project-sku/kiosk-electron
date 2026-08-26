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
import { Fragment, useState } from 'react';
import { isOk } from '@shared/types/result';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useEvents } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
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
const TABS: Array<{ id: string; label: string }> = [
  { id: 'REGION', label: '제주도' },
  { id: 'MBTI', label: 'MBTI' },
];

/**
 * Category chips under the region tabs (Figma 6052:46478). Labels come from the
 * localization table by key — 제주 has no sheet yet, so `t()` falls through to
 * the bundled Insadong rows, which carry all eight languages for these four.
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

const MBTI_LABELS: Record<MbtiAxis, string> = {
  E: '외향적', I: '내향적',
  S: '경험적', N: '상상적',
  T: '이성적', F: '감성적',
  J: '계획적', P: '즉흥적',
};

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
  const [status, setStatus] = useState<'idle' | 'loading' | 'results'>('idle');
  const [results, setResults] = useState<EventRecommendation[]>([]);

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
    >
      <div className={styles.tabs}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            type="button"
            className={`${styles.tab} ${tab === tb.id ? styles.tabActive : ''}`}
            onClick={() => selectTab(tb.id)}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {!isMbti ? (
        <>
          {/* One centred line, "전체 ㅣ 공연 ㅣ 전시 ㅣ 기타" — the ㅣ separators
              are real glyphs in the design, drawn between the labels rather
              than as a border, so they are rendered as inert spans. */}
          <div className={styles.chips}>
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
            <div className={styles.detailHost}>
              <EventDetailScreen eventId={detailId} accent="#ff7f0f" />
            </div>
          ) : (
            <div className={styles.listScroll}>
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
          <div className={styles.grid}>
            {MBTI_GRID.map((letter) => (
              <button
                key={letter}
                type="button"
                className={`${styles.cell} ${selected.has(letter) ? styles.cellSelected : ''}`}
                onClick={() => toggle(letter)}
              >
                <span className={styles.letter}>{letter}</span>
                <span className={styles.axisLabel}>{MBTI_LABELS[letter]}</span>
              </button>
            ))}
          </div>

          {status === 'loading' ? (
            <div className={`${styles.cta} ${styles.ctaLoading}`}>
              <span className={styles.spinner} />
              결과 로딩중..
            </div>
          ) : (
            <button type="button" className={styles.cta} onClick={() => void getResults()}>
              추천 결과 보기
            </button>
          )}

          <p className={styles.desc}>
            MBTI 성향과 취향을 반영해
            <br />
            {/* The redesign agrees with this now — 6212:54808 reads "제주도
                이벤트"; the older node still said 종로구, an Insadong leftover. */}
            <span className={styles.descAccent}>제주도 이벤트</span>를 맞춤 추천해드립니다!
            <br />
            <br />
            MBTI 4가지 유형을 전부 선택하지 않아도
            <br />
            나만의 추천 결과를 받아볼 수 있어요!
          </p>

          {status === 'results' && (
            // Figma node 6173:100721 — two columns and no close button, so
            // tapping the dim is the only dismiss, as designed.
            <div className={styles.overlay} role="presentation" onClick={() => setStatus('idle')}>
              <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
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
