import { useState } from 'react';
import qrCodeImg from '@renderer/assets/event-qr.png';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import { isOk } from '@shared/types/result';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { useEvents, pageWindow } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { ui, uiParts, type UiTextKey } from '@renderer/lib/uiText';
import { OsanHeader } from './OsanHeader';
import { OsanBanner } from './OsanBanner';
import { OsanLeftNav } from './OsanLeftNav';
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
const PAGE_SIZE = 6;

type MbtiAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
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
 * MBTI 선택 워크플로우 (Figma 5494:154504 / 156455 / 5535:6134): a 4×2 toggle grid
 * (one pick per E/I·S/N·T/F·J/P axis) → "추천 결과 보기" → "결과 로딩중.." spinner →
 * a recommended-event RESULTS MODAL (dark overlay + centered card) whose QR opens
 * the QR-zoom modal. TODO: wire the real recommendation call once an endpoint
 * exists — currently returns the first 2 mock events after a fake delay.
 */
function MbtiSection({ onOpenQr, region }: MbtiSectionProps): JSX.Element {
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
          결과 로딩중..
        </div>
      ) : (
        <button type="button" className={styles.mbtiCta} onClick={() => void getResults()}>
          추천 결과 보기
        </button>
      )}

      <p className={styles.mbtiDesc}>
        {/* "{region}" is substituted here so the accent span survives translation. */}
        {uiParts('mbtiIntro', lang)[0]}
        <span className={styles.mbtiAccent}>
          {`${t('Event_Tab_Osan', lang)} ${t('MainButton_Event', lang)}`}
        </span>
        {uiParts('mbtiIntro', lang)[1]}
        <br />
        <br />
        {ui('mbtiHint', lang)
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
          {results.length > 0 ? (
            <div className={styles.resultsBox} onClick={(e) => e.stopPropagation()}>
              <div className={styles.resultsCards}>
                {results.map((event) => (
                  <div key={event.eventId} className={styles.resultCard}>
                    <div className={styles.resultThumb}>
                      {event.mainImage && <img src={event.mainImage} alt="" draggable={false} />}
                    </div>
                    <p className={styles.resultTitle}>{event.title}</p>
                  </div>
                ))}
              </div>
              <button type="button" className={styles.resultsQr} onClick={onOpenQr}>
                <div className={styles.resultsQrImg}>
                  <img src={qrCodeImg} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
                </div>
                <span className={styles.resultsQrLabel}>{ui('viewOnMobile', lang)}</span>
              </button>
            </div>
          ) : (
            <div className={styles.noDataBox} onClick={(e) => e.stopPropagation()}>
              <p className={styles.noDataText}>{ui('noRecommendations', lang)}</p>
            </div>
          )}
        </div>
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
 * at exact Figma px on the 2160×3840 artboard (node 5494:154504). Two centered
 * region tabs (오산시 · MBTI); the 오산시 tab shows a category-filtered event grid,
 * MBTI swaps the body for the quiz workflow. Navy [오색시장] main01 var(--kiosk-primary).
 */
export function OsanEvents({ controller }: OsanEventsProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLang();
  /** Tab label from the sheet; MBTI (no key) keeps its literal id. */
  const tabLabel = (tab: { id: string; key: string | null }): string =>
    tab.key ? t(tab.key, lang) : tab.id;

  const [regionId, setRegionId] = useState(REGION_TABS[0]!.id);
  const [categoryValue, setCategoryValue] = useState<EventCategory>(CATEGORY_TABS[0]!.value);
  const [page, setPage] = useState(1);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const activeRegion = REGION_TABS.find((r) => r.id === regionId) ?? REGION_TABS[0]!;
  const activeCategory = CATEGORY_TABS.find((c) => c.value === categoryValue) ?? CATEGORY_TABS[0]!;
  const isMbti = activeRegion.region === null;

  const { items, totalPages, loading, error } = useEvents(
    isMbti ? null : activeRegion.region,
    activeCategory.value,
    page,
    PAGE_SIZE,
  );

  const selectRegion = (id: string): void => {
    setRegionId(id);
    setPage(1);
    setDetailId(null);
  };
  const selectCategory = (value: EventCategory): void => {
    setCategoryValue(value);
    setPage(1);
    setDetailId(null);
  };
  // Back closes the detail page first; from the list it leaves the screen.
  const goBack = (): void => {
    if (detailId !== null) setDetailId(null);
    else goHome();
  };

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title="오산시 이벤트" onHome={goHome} onBack={goBack} />

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
          <div className={styles.categoryTabs}>
            {CATEGORY_TABS.map((c) => (
              <button
                key={c.value}
                type="button"
                className={`${styles.categoryTab} ${c.value === categoryValue ? styles.categoryTabSelected : ''}`}
                onClick={() => selectCategory(c.value)}
              >
                {t(c.key, lang)}
              </button>
            ))}
          </div>

          {detailId !== null ? (
            <EventDetailScreen eventId={detailId} accent="var(--kiosk-primary)" />
          ) : (
            <>
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

              {totalPages > 1 && (
                <div className={styles.pagination}>
                  {pageWindow(page, totalPages).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`${styles.pageBtn} ${p === page ? styles.pageBtnSelected : ''}`}
                      onClick={() => setPage(p)}
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`${styles.pageBtn} ${styles.pageNext} ${page >= totalPages ? styles.pageBtnDisabled : ''}`}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    aria-label="다음 페이지"
                  >
                    ⟩
                  </button>
                </div>
              )}
            </>
          )}

          <div className={styles.qrFooter}>
            <div className={styles.qrDivider} />
            <div className={styles.qrImg}>
              <img src={qrCodeImg} alt="QR" style={{ width: '100%', height: '100%', objectFit: 'contain' }} draggable={false} />
            </div>
            <p className={styles.qrLabel}>{t('SubHeader_Detail_Event', lang)}</p>
          </div>
        </>
      )}

      <OsanLeftNav onHome={goHome} onBack={goBack} />

      <OsanBanner onClick={() => controller.startPhoto()} />

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
    </>
  );
}
