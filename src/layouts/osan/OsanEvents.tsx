import { Fragment, useEffect, useRef, useState } from 'react';
import qrCodeImg from '@renderer/assets/event-qr.png';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import { isOk } from '@shared/types/result';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useEvents } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { useLang } from '@renderer/lib/i18n';
import { sheetText, t } from '@renderer/lib/loc';
import { ui, uiParts, type UiTextKey } from '@renderer/lib/uiText';
import { OsanHeader } from './OsanHeader';
import { OsanLeftNav } from './OsanLeftNav';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { mbtiGuideText, mbtiHintText, mbtiLabel, mbtiSubmitText, renderSheetLines, type MbtiAxis } from '@layouts/components/eventSheetText';
import styles from './OsanEvents.module.css';

/** Region tabs → API eventRegion (MBTI has no region; it opens the quiz).
 *  `id` is the stable selection key — never the label, which is localized.
 *  `key` is the Localization_Osaek row supplying the label; MBTI is a brand
 *  name with no sheet row, so it falls back to its literal. */
const REGION_TABS: { id: string; key: string | null; region: EventRegion | null }[] = [
  { id: 'OSAN', key: 'Event_Tab_Osan', region: 'OSAN' },
  { id: 'MBTI', key: null, region: null },
];
/** Category tabs → API eventCategory, labels from Localization_Osaek. */
const CATEGORY_TABS: { key: string; value: EventCategory }[] = [
  { key: 'Event_Category_All', value: 'ALL' },
  { key: 'Event_Category_performance', value: 'SHOW' },
  { key: 'Event_Category_exibition', value: 'EXHIBITION' },
  { key: 'Event_Category_etc', value: 'ETC' },
];
/* What follows each label in Figma's one-line row (7838:115562): the gaps are
   literal spaces, 7 before the first ㅣ and 8 before the others. */
const CATEGORY_GAPS = ['       ㅣ          ', '        ㅣ          ', '        ㅣ          '];
/* The design scrolls one list (▲/▼ + an edge pill) instead of paging, so one
   request fetches what a region realistically has — same as 제주. */
const PAGE_SIZE = 30;
/** One grid row: poster 683.286 + title/venue + row gap (1088 → 1952). */
const ROW_PITCH = 864;

const MBTI_PAIRS: [MbtiAxis, MbtiAxis][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];
// Figma row-major order (5494:154635): E S T J / I N F P.
const MBTI_GRID: MbtiAxis[] = ['E', 'S', 'T', 'J', 'I', 'N', 'F', 'P'];
/** Axis label keys — resolved per language at render (see lib/uiText.ts). */
const MBTI_LABEL_KEYS = {
  E: 'mbtiE', I: 'mbtiI', S: 'mbtiS', N: 'mbtiN',
  T: 'mbtiT', F: 'mbtiF', J: 'mbtiJ', P: 'mbtiP',
} as const satisfies Record<MbtiAxis, UiTextKey>;

interface MbtiSectionProps {
  onOpenQr: () => void;
  /** API region for the recommendation call (fixed per kiosk). */
  region: EventRegion;
}

/**
 * MBTI 선택 워크플로우 — Figma 오산>오산시이벤트-02-1 / -02-2 / -02-3 (7838:115186 /
 * 115246 / 115315): a 4×2 toggle grid (one pick per E/I·S/N·T/F·J/P axis) →
 * "추천 결과 보기" → "결과 로딩중.." → the recommended events in a popup closed by
 * its ✕, with the "QR 클릭!" footer under it opening the QR-zoom modal. The
 * recommendations are `eventsApi.recommend`'s answer for this region and the
 * letters picked; an empty answer shows the no-recommendation card.
 */
function MbtiSection({ onOpenQr, region }: MbtiSectionProps): JSX.Element {
  const lang = useLang();
  const loadingIcon = osanIconUrl('mbti-loading');
  const closeIcon = osanIconUrl('mbti-close');
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
            <span className={styles.mbtiLabel}>{mbtiLabel(letter, lang, MBTI_LABEL_KEYS[letter])}</span>
          </button>
        ))}
      </div>

      {status === 'loading' ? (
        <div className={`${styles.mbtiCta} ${styles.mbtiCtaLoading}`}>
          <span className={styles.mbtiSpinner}>
            {loadingIcon && <img src={loadingIcon} alt="" draggable={false} />}
          </span>
          {ui('mbtiLoading', lang)}
        </div>
      ) : (
        <button type="button" className={styles.mbtiCta} onClick={() => void getResults()}>
          {mbtiSubmitText(lang)}
        </button>
      )}

      <p className={styles.mbtiDesc}>
        {/* Event_MBTI_guide1 / guide2 from the sheet; an empty guide1 cell keeps
            the authored sentence below. */}
        {mbtiGuideText(lang) ? (
          renderSheetLines(mbtiGuideText(lang), [t('MainButton_Event', lang)], styles.mbtiAccent)
        ) : (
          <>
            {/* "{region}" is substituted here so the accent span survives translation. */}
            {uiParts('mbtiIntro', lang)[0]}
            {/* MainButton_Event is already "오산시 이벤트" — prefixing Event_Tab_Osan
                ("오산시") read "오산시 오산시 이벤트". */}
            <span className={styles.mbtiAccent}>{t('MainButton_Event', lang)}</span>
            {uiParts('mbtiIntro', lang)[1]}
          </>
        )}
        <br />
        <br />
        {renderSheetLines(mbtiHintText(lang))}
      </p>

      {status === 'results' && (
        <>
          {/* 7838:115377 — "QR 클릭! ← 모바일에서 확인하기", under the popup's scrim. */}
          <button type="button" className={styles.mbtiQrFooter} onClick={onOpenQr}>
            <span className={styles.mbtiQrDivider} />
            <span className={styles.mbtiQrText}>
              {ui('qrTap', lang)}
              <br />
              {ui('viewOnMobile', lang)}
            </span>
            <span className={styles.mbtiQrImg}>
              <img src={qrCodeImg} alt="QR" draggable={false} />
            </span>
          </button>

          <div className={styles.mbtiScrim} onClick={() => setStatus('idle')} />
          {results.length > 0 ? (
            <div className={styles.resultsBox}>
              <div className={styles.resultsCards}>
                {results.slice(0, 2).map((event) => (
                  <div key={event.eventId} className={styles.resultCard}>
                    <div className={styles.resultThumb}>
                      {event.mainImage && <img src={event.mainImage} alt="" draggable={false} />}
                    </div>
                    <p className={styles.resultTitle}>{event.title}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={styles.noDataBox}>
              <p className={styles.noDataText}>{ui('noRecommendations', lang)}</p>
            </div>
          )}
          <button
            type="button"
            className={styles.resultsClose}
            onClick={() => setStatus('idle')}
            aria-label={ui('close', lang)}
          >
            {closeIcon && <img src={closeIcon} alt="" draggable={false} />}
          </button>
        </>
      )}
    </>
  );
}

interface OsanEventsProps {
  controller: KioskController;
}

/**
 * Native replacement for the withevent.kr <webview> embed on W004 (오산시 이벤트).
 * Same header/left-nav/banner chrome as every other Osan content screen, laid out
 * at exact Figma px on the 2160×3840 artboard (오산>오산시이벤트-01-1 / -01-2,
 * 7838:115432 / 115584). Two centered region tabs (오산시 · MBTI); the 오산시 tab
 * shows a category-filtered, scrolling event grid and its detail page, MBTI
 * swaps the body for the quiz workflow. Navy [오색시장] main01 var(--kiosk-primary).
 */
export function OsanEvents({ controller }: OsanEventsProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  /** Tab label from the sheet; MBTI (no key) keeps its literal id. */
  const tabLabel = (tab: { id: string; key: string | null }): string =>
    tab.key ? t(tab.key, lang) : tab.id;

  const [regionId, setRegionId] = useState(REGION_TABS[0]!.id);
  const [categoryValue, setCategoryValue] = useState<EventCategory>(CATEGORY_TABS[0]!.value);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const activeRegion = REGION_TABS.find((r) => r.id === regionId) ?? REGION_TABS[0]!;
  const activeCategory = CATEGORY_TABS.find((c) => c.value === categoryValue) ?? CATEGORY_TABS[0]!;
  const isMbti = activeRegion.region === null;
  /*
   * ♿ — OsanKiosk moves this page down under the mode bar; `.lowEvents` re-places
   * it onto the frames (제주>제주도이벤트-01-2 7878:48020 detail, -02-1 7878:47622
   * MBTI): promo at 146, header at 719, the body in the lower half, the region
   * tabs at 3440 and the category row at 3660. The event list has no frame; it
   * takes the detail card's slot (1342).
   */
  const low = useAccessibilityStore((s) => s.lowReach);
  /* An event's detail page has its own row, SubHeader_Detail_Event ("* QR코드로
     이벤트의 상세정보를 확인하세요"); the list keeps SubHeader_Event. */
  const eventSubtitle =
    detailId !== null
      ? sheetText('Event_Detail_SubHeader', lang) || sheetText('SubHeader_Detail_Event', lang) || undefined
      : undefined;

  const { items, loading, error } = useEvents(
    isMbti ? null : activeRegion.region,
    activeCategory.value,
    1,
    PAGE_SIZE,
  );

  /* 7838:115556 — the scroll position as a 34px pill on the artboard's right
     edge, the thumb a fraction of the two-row window; null when nothing scrolls
     (and then ▲/▼ are hidden too). */
  const listRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{ top: number; size: number } | null>(null);
  const showList = !isMbti && detailId === null;
  useEffect(() => {
    const el = listRef.current;
    if (!el) {
      setThumb(null);
      return undefined;
    }
    const sync = (): void => {
      const range = el.scrollHeight - el.clientHeight;
      if (range <= 1) return setThumb(null);
      const size = Math.min(1, el.clientHeight / el.scrollHeight);
      setThumb({ size, top: (el.scrollTop / range) * (1 - size) });
    };
    sync();
    el.addEventListener('scroll', sync, { passive: true });
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    if (el.firstElementChild) ro.observe(el.firstElementChild);
    return () => {
      el.removeEventListener('scroll', sync);
      ro.disconnect();
    };
  }, [showList, items]);
  const scrollBy = (dy: number): void => listRef.current?.scrollBy({ top: dy, behavior: 'smooth' });
  const arrow = osanIconUrl('scroll-arrow');

  const selectRegion = (id: string): void => {
    setRegionId(id);
    setDetailId(null);
  };
  const selectCategory = (value: EventCategory): void => {
    setCategoryValue(value);
    listRef.current?.scrollTo({ top: 0 });
    setDetailId(null);
  };
  // Back closes the detail page first; from the list it leaves the screen.
  const goBack = (): void => {
    if (detailId !== null) setDetailId(null);
    else goHome();
  };

  return (
    <div className={low ? styles.lowEvents : undefined} style={{ display: 'contents' }}>
      {osanIconUrl('page-bg') && <img className={styles.bg} src={osanIconUrl('page-bg')} alt="" draggable={false} />}

      {low ? (
        <div className={styles.lowHeader}>
          <OsanHeader title="오산시 이벤트" subtitle={eventSubtitle} onHome={goHome} onBack={goBack} />
        </div>
      ) : (
        <OsanHeader title="오산시 이벤트" subtitle={eventSubtitle} onHome={goHome} onBack={goBack} />
      )}

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
        <MbtiSection onOpenQr={() => setQrZoomOpen(true)} region="OSAN" />
      ) : (
        <>
          <p className={styles.categoryRow}>
            {CATEGORY_TABS.map((c, i) => (
              <Fragment key={c.value}>
                <button
                  type="button"
                  className={`${styles.categoryTab} ${c.value === categoryValue ? styles.categoryTabSelected : ''}`}
                  data-label={t(c.key, lang)}
                  onClick={() => selectCategory(c.value)}
                >
                  <span>{t(c.key, lang)}</span>
                </button>
                {CATEGORY_GAPS[i]}
              </Fragment>
            ))}
          </p>

          {detailId !== null ? (
            /* 오산>오산시이벤트-01-2 (7838:115584): the shared detail body; this
               frame's card edge is a plain 0 4 4 25% drop shadow. */
            <div className={styles.detailSlot}>
              <EventDetailScreen
                eventId={detailId}
                accent="var(--kiosk-primary)"
                cardShadow="0 4px 4px rgba(0, 0, 0, 0.25)"
              />
            </div>
          ) : (
            <>
              <div ref={listRef} className={styles.list}>
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
              </div>

              {!loading && items.length === 0 && (
                <p className={styles.emptyState}>
                  {error ? ui('eventsLoadFailed', lang) : ui('eventsEmpty', lang)}
                </p>
              )}

              {thumb && (
                <>
                  <div className={styles.track} aria-hidden>
                    <span
                      className={styles.trackThumb}
                      style={{ top: `${thumb.top * 100}%`, height: `${thumb.size * 100}%` }}
                    />
                  </div>
                  <button
                    type="button"
                    className={`${styles.scrollBtn} ${styles.scrollUp}`}
                    onClick={() => scrollBy(-ROW_PITCH)}
                    aria-label="위로"
                  >
                    {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
                  </button>
                  <button
                    type="button"
                    className={`${styles.scrollBtn} ${styles.scrollDown}`}
                    onClick={() => scrollBy(ROW_PITCH)}
                    aria-label="아래로"
                  >
                    {arrow && <img src={arrow} alt="" className={styles.scrollBtnImg} draggable={false} />}
                  </button>
                </>
              )}
            </>
          )}

          {/* 7838:115563 — rule, the framed QR and the data source. */}
          <div className={styles.qrFooter}>
            <div className={styles.qrDivider} />
            <div className={styles.qrFrame} />
            <div className={styles.qrImg}>
              <img src={qrCodeImg} alt="QR" draggable={false} />
            </div>
            <p className={styles.qrSource}>{sheetText('Event_Source', lang, { [lang]: ui('eventSource', lang) })}</p>
          </div>
        </>
      )}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      {/* 7838:115223 — the 상점 검색 promo with a main-01 strip (the same art as
          the 뭐하지 banner, whose strip is orange): it opens 검색. */}
      {osanIconUrl('banner-course') && (
        <button
          type="button"
          className={styles.searchBanner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={osanIconUrl('banner-course')} alt="" draggable={false} />
          <span className={styles.searchBannerStrip} />
        </button>
      )}

      {qrZoomOpen && (
        <div className={styles.modalOverlay} onClick={() => setQrZoomOpen(false)}>
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
    </div>
  );
}
