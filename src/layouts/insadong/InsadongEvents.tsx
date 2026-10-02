import { Fragment, useRef, useState } from 'react';
import qrCodeImg from '@renderer/assets/event-qr.png';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import { isOk } from '@shared/types/result';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useEvents } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { useLang } from '@renderer/lib/i18n';
import { t, tExact } from '@renderer/lib/loc';
import { ui, uiParts, type UiTextKey } from '@renderer/lib/uiText';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongEvents.module.css';

/** Region tabs → API eventRegion (MBTI has no region; it opens the quiz).
 *  Figma 7525:77241 draws exactly two pills — 인사동 and MBTI. `id` is the
 *  stable selection key; `key` is the Localization_Insa row for the label.
 *  MBTI is a brand name with no sheet row, so it falls back to its literal. */
const REGION_TABS: { id: string; key: string | null; region: EventRegion | null }[] = [
  { id: 'INSA', key: 'Event_Tab_Insadong', region: 'INSA' },
  { id: 'MBTI', key: null, region: null },
];
/** Category tabs → API eventCategory, labels from Localization_Insa. */
const CATEGORY_TABS: { key: string; value: EventCategory }[] = [
  { key: 'Event_Category_All', value: 'ALL' },
  { key: 'Event_Category_performance', value: 'SHOW' },
  { key: 'Event_Category_exibition', value: 'EXHIBITION' },
  { key: 'Event_Category_etc', value: 'ETC' },
];
/** One generous page — the list scrolls (Figma draws a scrollbar and ▲/▼,
 *  not page numbers). Six cards (3×2) are visible at rest. */
const PAGE_SIZE = 30;
/** One row of the event grid (Figma pitch 1088 → 1952). */
const SCROLL_STEP = 864;
/** Result slots the modal draws (Figma 7525:77364 has exactly two columns). */
const RESULT_SLOTS = 2;

type MbtiAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
const MBTI_PAIRS: [MbtiAxis, MbtiAxis][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];
// Figma row-major order (5494:151799): E S T J / I N F P.
const MBTI_GRID: MbtiAxis[] = ['E', 'S', 'T', 'J', 'I', 'N', 'F', 'P'];
/** Axis label keys — resolved per language at render (see lib/uiText.ts). */
const MBTI_LABEL_KEYS = {
  E: 'mbtiE', I: 'mbtiI', S: 'mbtiS', N: 'mbtiN',
  T: 'mbtiT', F: 'mbtiF', J: 'mbtiJ', P: 'mbtiP',
} as const satisfies Record<MbtiAxis, UiTextKey>;

interface MbtiSectionProps {
  /** API region for the recommendation call (fixed per kiosk). */
  region: EventRegion;
}

/**
 * MBTI 선택 워크플로우 (Figma 7525:77206 / 77253 / 77309): a 4×2 toggle grid
 * (one pick per E/I·S/N·T/F·J/P axis) → "추천 결과 보기" → "결과 로딩중.." →
 * a results card (two events + a close button). Results come from
 * GET /api/events/recommend (region + MBTI).
 */
function MbtiSection({ region }: MbtiSectionProps): JSX.Element {
  const lang = useLang();
  const [selected, setSelected] = useState<Set<MbtiAxis>>(new Set());
  const [status, setStatus] = useState<'idle' | 'loading' | 'results'>('idle');
  const [results, setResults] = useState<EventRecommendation[]>([]);

  const toggle = (letter: MbtiAxis): void => {
    if (status === 'loading') return;
    setSelected((prev) => {
      const next = new Set(prev);
      const pair = MBTI_PAIRS.find((p) => p.includes(letter))!;
      const other = pair[0] === letter ? pair[1] : pair[0];
      next.delete(other);
      if (next.has(letter)) next.delete(letter);
      else next.add(letter);
      return next;
    });
  };

  const getResults = async (): Promise<void> => {
    setStatus('loading');
    // Selected letters in canonical axis order (e.g. "ENFP"; may be partial).
    const mbti = MBTI_PAIRS.map(([a, b]) => (selected.has(a) ? a : selected.has(b) ? b : '')).join('');
    const res = await window.api.eventsApi.recommend({ region, mbti });
    setResults(isOk(res) ? res.value : []);
    setStatus('results');
  };

  return (
    <>
      <div className={styles.mbtiGrid}>
        {MBTI_GRID.map((letter) => (
          <button
            key={letter}
            type="button"
            className={`${styles.mbtiCell} ${selected.has(letter) ? styles.mbtiCellSelected : ''}`}
            onClick={() => toggle(letter)}
          >
            <span className={styles.mbtiLetter}>{letter}</span>
            <span className={styles.mbtiLabel}>{ui(MBTI_LABEL_KEYS[letter], lang)}</span>
          </button>
        ))}
      </div>

      {status === 'loading' ? (
        <div className={`${styles.mbtiCta} ${styles.mbtiCtaLoading}`}>
          <span className={styles.mbtiSpinner} />
          {ui('mbtiLoading', lang)}
        </div>
      ) : (
        <button type="button" className={styles.mbtiCta} onClick={() => void getResults()}>
          {tExact('Event_MBTI_results', lang) || ui('mbtiSubmit', lang)}
        </button>
      )}

      <p className={styles.mbtiDesc}>
        {/* "{region}" is substituted here so the accent span survives translation. */}
        {uiParts('mbtiIntro', lang)[0]}
        <span className={styles.mbtiAccent}>
          {`${t('Event_Tab_Insadong', lang)} ${t('MainButton_Event', lang)}`}
        </span>
        {uiParts('mbtiIntro', lang)[1]}
        <br />
        <br />
        {(tExact('Event_MBTI_guide2', lang).replace(/<br\s*\/?>\s*/gi, '\n') || ui('mbtiHint', lang))
          .split('\n')
          .map((line, i, all) => (
            <span key={i}>
              {line}
              {i < all.length - 1 && <br />}
            </span>
          ))}
      </p>

      {status === 'results' && (
        <div className={styles.modalOverlay} onClick={() => setStatus('idle')}>
          <div className={styles.resultsBox} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.modalClose}
              onClick={() => setStatus('idle')}
              aria-label={ui('close', lang)}
            >
              <svg className={styles.modalCloseIcon} viewBox="0 0 125 125" aria-hidden="true">
                <circle cx="62.5" cy="62.5" r="58" fill="none" stroke="currentColor" strokeWidth="4.3" />
                <path d="M44 44 L81 81 M81 44 L44 81" fill="none" stroke="currentColor" strokeWidth="4.3" strokeLinecap="round" />
              </svg>
            </button>
            {results.length > 0 ? (
              <div className={styles.resultsCards}>
                {results.slice(0, RESULT_SLOTS).map((event) => (
                  <div key={event.eventId} className={styles.resultCard}>
                    <div className={styles.resultThumb}>
                      {event.mainImage && <img src={event.mainImage} alt="" draggable={false} />}
                    </div>
                    <p className={styles.resultTitle}>{event.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.noDataText}>{ui('noRecommendations', lang)}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

interface InsadongEventsProps {
  controller: KioskController;
}

/**
 * Native replacement for the withevent.kr <webview> embed — same header/leftNav/
 * banner chrome as every other content screen, laid out at Figma px on the
 * 2160×3840 artboard (7525:77206 MBTI, 77253 loading, 77309 results,
 * 77412 list, 77551 detail). Two tabs (인사동 / MBTI), a scrolling event grid,
 * and a QR footer; the MBTI tab swaps the body for MbtiSection.
 */
export function InsadongEvents({ controller }: InsadongEventsProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const banner = useRotatingBanner();
  const lang = useLang();
  /** Tab label from the sheet; MBTI (no key) keeps its literal id. */
  const tabLabel = (tab: { id: string; key: string | null }): string =>
    tab.key ? t(tab.key, lang) : tab.id;

  const [regionId, setRegionId] = useState(REGION_TABS[0]!.id);
  const [categoryValue, setCategoryValue] = useState<EventCategory>(CATEGORY_TABS[0]!.value);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const activeRegion = REGION_TABS.find((r) => r.id === regionId) ?? REGION_TABS[0]!;
  const activeCategory = CATEGORY_TABS.find((c) => c.value === categoryValue) ?? CATEGORY_TABS[0]!;
  const isMbti = activeRegion.region === null;

  const { items, loading, error } = useEvents(
    isMbti ? null : activeRegion.region,
    activeCategory.value,
    1,
    PAGE_SIZE,
  );

  const selectRegion = (id: string): void => {
    setRegionId(id);
    setDetailId(null);
  };
  const selectCategory = (value: EventCategory): void => {
    setCategoryValue(value);
    setDetailId(null);
  };
  const scrollBy = (dy: number): void => listRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  // Back closes the detail page first; from the list it leaves the screen.
  const goBack = (): void => {
    if (detailId !== null) setDetailId(null);
    else goHome();
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="인사동 이벤트" onHome={goHome} onBack={goBack} />

      <div className={styles.regionTabs}>
        {REGION_TABS.map((r) => (
          <button
            key={r.id}
            type="button"
            className={`${styles.regionTab} ${r.id === regionId ? styles.regionTabSelected : ''}`}
            onClick={() => selectRegion(r.id)}
          >
            {tabLabel(r)}
          </button>
        ))}
      </div>

      {isMbti ? (
        <MbtiSection region="INSA" />
      ) : (
        <>
          <div className={styles.categoryTabs}>
            {CATEGORY_TABS.map((c, i) => (
              <Fragment key={c.value}>
                {i > 0 && <span className={styles.categorySep}>ㅣ</span>}
                <button
                  type="button"
                  className={`${styles.categoryTab} ${c.value === categoryValue ? styles.categoryTabSelected : ''}`}
                  onClick={() => selectCategory(c.value)}
                >
                  {t(c.key, lang)}
                </button>
              </Fragment>
            ))}
          </div>

          {detailId !== null ? (
            <EventDetailScreen eventId={detailId} accent="var(--kiosk-primary)" />
          ) : (
            <>
              <div ref={listRef} className={styles.listScroll}>
                <div className={styles.grid}>
                  {items.map((event) => (
                    <button
                      key={event.eventId}
                      type="button"
                      className={styles.card}
                      onClick={() => setDetailId(event.eventId)}
                    >
                      <div className={styles.thumb}>
                        {event.mainImage && <img src={event.mainImage} alt="" draggable={false} />}
                      </div>
                      <p className={styles.cardTitle}>{event.title}</p>
                      <p className={styles.cardVenue}>{event.location}</p>
                    </button>
                  ))}
                </div>

                {!loading && items.length === 0 && (
                  <p className={styles.emptyState}>
                    {error ? ui('eventsLoadFailed', lang) : ui('eventsEmpty', lang)}
                  </p>
                )}
              </div>

              {items.length > 0 && (
                <>
                  <button
                    type="button"
                    className={`${styles.scrollBtn} ${styles.scrollUp}`}
                    onClick={() => scrollBy(-SCROLL_STEP)}
                    aria-label="위로"
                  >
                    {iconUrl('scroll-arrow') && (
                      <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
                    )}
                  </button>
                  <button
                    type="button"
                    className={`${styles.scrollBtn} ${styles.scrollDown}`}
                    onClick={() => scrollBy(SCROLL_STEP)}
                    aria-label="아래로"
                  >
                    {iconUrl('scroll-arrow') && (
                      <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
                    )}
                  </button>
                </>
              )}
            </>
          )}

          <div className={styles.qrFooter}>
            <div className={styles.qrDivider} />
            <p className={styles.qrSource}>{tExact('Event_Source', lang) || ui('eventSource', lang)}</p>
            <button type="button" className={styles.qrFrame} onClick={() => setQrZoomOpen(true)} aria-label="QR">
              <img src={qrCodeImg} alt="" draggable={false} />
            </button>
          </div>
        </>
      )}

      <InsadongLeftNav onHome={goHome} onBack={goBack} />

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}

      {qrZoomOpen && (
        <div className={`${styles.modalOverlay} ${styles.qrOverlay}`} onClick={() => setQrZoomOpen(false)}>
          <div className={styles.qrZoomBox} onClick={(e) => e.stopPropagation()}>
            <button type="button" className={styles.qrZoomClose} onClick={() => setQrZoomOpen(false)} aria-label="닫기">
              ✕
            </button>
            <div className={styles.qrZoomFrame}>
              <img src={qrCodeImg} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
              <span className={`${styles.qrCorner} ${styles.qrCornerTL}`}>⌜</span>
              <span className={`${styles.qrCorner} ${styles.qrCornerTR}`}>⌝</span>
              <span className={`${styles.qrCorner} ${styles.qrCornerBL}`}>⌞</span>
              <span className={`${styles.qrCorner} ${styles.qrCornerBR}`}>⌟</span>
            </div>
            <p className={styles.qrZoomHint}>{ui('qrAlign', lang)}</p>
          </div>
        </div>
      )}
    </>
  );
}
