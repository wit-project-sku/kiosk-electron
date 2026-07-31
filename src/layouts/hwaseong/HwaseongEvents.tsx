import { useState } from 'react';
import qrCodeImg from '@renderer/assets/event-qr.png';
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { EventCategory, EventRecommendation, EventRegion } from '@shared/types/events';
import { isOk } from '@shared/types/result';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useEvents, pageWindow } from '@renderer/hooks/useEvents';
import { EventDetailScreen } from '@layouts/components/EventDetailScreen';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongEvents.module.css';

/** Region tabs → API eventRegion (MBTI has no region; it opens the quiz). */
const REGION_TABS: { label: string; region: EventRegion | null }[] = [
  { label: '화성시', region: 'HWASEONG' },
  { label: 'MBTI', region: null },
];
/** Category tabs → API eventCategory. */
const CATEGORY_TABS: { label: string; value: EventCategory }[] = [
  { label: '전체', value: 'ALL' },
  { label: '공연', value: 'SHOW' },
  { label: '전시', value: 'EXHIBITION' },
  { label: '기타', value: 'ETC' },
];
const PAGE_SIZE = 6;

type MbtiAxis = 'E' | 'I' | 'S' | 'N' | 'T' | 'F' | 'J' | 'P';
const MBTI_PAIRS: [MbtiAxis, MbtiAxis][] = [
  ['E', 'I'],
  ['S', 'N'],
  ['T', 'F'],
  ['J', 'P'],
];
// Figma row-major order (5494:158632): E S T J / I N F P.
const MBTI_GRID: MbtiAxis[] = ['E', 'S', 'T', 'J', 'I', 'N', 'F', 'P'];
const MBTI_LABELS: Record<MbtiAxis, string> = {
  E: '외향적',
  I: '내향적',
  S: '경험적',
  N: '상상적',
  T: '이성적',
  F: '감성적',
  J: '계획적',
  P: '즉흥적',
};

interface MbtiSectionProps {
  onOpenQr: () => void;
  /** API region for the recommendation call (fixed per kiosk). */
  region: EventRegion;
}

/**
 * MBTI 선택 워크플로우 (Figma 5494:158615 / 158665 / 158724): a 4×2 toggle grid
 * (one pick per E/I·S/N·T/F·J/P axis) → "추천 결과 보기" → "결과 로딩중.." spinner →
 * a recommended-event RESULTS MODAL (dark overlay + centered card) whose QR opens
 * the QR-zoom modal. TODO: wire the real recommendation call once an endpoint
 * exists — currently returns the first 2 mock events after a fake delay.
 */
function MbtiSection({ onOpenQr, region }: MbtiSectionProps): JSX.Element {
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
            <span className={styles.mbtiLabel}>{MBTI_LABELS[letter]}</span>
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
        MBTI 성향과 취향을 반영해 <span className={styles.mbtiAccent}>화성시 이벤트</span>를 맞춤 추천해드립니다!
        <br />
        <br />
        MBTI 4가지 유형을 전부 선택하지 않아도
        <br />
        나만의 추천 결과를 받아볼 수 있어요!
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
                <span className={styles.resultsQrLabel}>모바일에서 확인하기</span>
              </button>
            </div>
          ) : (
            <div className={styles.noDataBox} onClick={(e) => e.stopPropagation()}>
              <p className={styles.noDataText}>추천 결과가 없습니다.</p>
            </div>
          )}
        </div>
      )}
    </>
  );
}

interface HwaseongEventsProps {
  controller: KioskController;
}

/**
 * Native replacement for the withevent.kr <webview> embed on W005 (화성시 이벤트).
 * Same 화성휴게소 chrome (bg, header, image left-nav, banner) as HwaseongWebScreen,
 * laid out at exact Figma px on the 2160×3840 artboard (node 5494:158615). Two
 * centered region tabs (화성시 · MBTI); the 화성시 tab shows a category-filtered
 * event grid, MBTI swaps the body for the quiz workflow. Blue [화성휴게소] main1 #005ab4.
 */
export function HwaseongEvents({ controller }: HwaseongEventsProps): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const [regionLabel, setRegionLabel] = useState(REGION_TABS[0]!.label);
  const [categoryLabel, setCategoryLabel] = useState(CATEGORY_TABS[0]!.label);
  const [page, setPage] = useState(1);
  const [qrZoomOpen, setQrZoomOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);

  const activeRegion = REGION_TABS.find((r) => r.label === regionLabel) ?? REGION_TABS[0]!;
  const activeCategory = CATEGORY_TABS.find((c) => c.label === categoryLabel) ?? CATEGORY_TABS[0]!;
  const isMbti = activeRegion.region === null;

  const { items, totalPages, loading, error } = useEvents(
    isMbti ? null : activeRegion.region,
    activeCategory.value,
    page,
    PAGE_SIZE,
  );

  const selectRegion = (label: string): void => {
    setRegionLabel(label);
    setPage(1);
    setDetailId(null);
  };
  const selectCategory = (label: string): void => {
    setCategoryLabel(label);
    setPage(1);
    setDetailId(null);
  };
  // Back closes the detail page first; from the list it leaves the screen.
  const goBack = (): void => {
    if (detailId !== null) setDetailId(null);
    else controller.navigate('home', 'Back');
  };

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title="화성시 이벤트" subtitle="페이지 설명문" onBack={goBack} />

      <div className={styles.regionTabs}>
        {REGION_TABS.map((r) => (
          <button
            key={r.label}
            type="button"
            className={`${styles.regionTab} ${r.label === regionLabel ? styles.regionTabSelected : ''}`}
            onClick={() => selectRegion(r.label)}
          >
            {r.label}
          </button>
        ))}
      </div>

      {isMbti ? (
        <MbtiSection onOpenQr={() => setQrZoomOpen(true)} region="HWASEONG" />
      ) : (
        <>
          <div className={styles.categoryTabs}>
            {CATEGORY_TABS.map((c) => (
              <button
                key={c.label}
                type="button"
                className={`${styles.categoryTab} ${c.label === categoryLabel ? styles.categoryTabSelected : ''}`}
                onClick={() => selectCategory(c.label)}
              >
                {c.label}
              </button>
            ))}
          </div>

          {detailId !== null ? (
            <EventDetailScreen eventId={detailId} accent="#005ab4" />
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
                  {error ? '이벤트를 불러오지 못했습니다.' : '등록된 이벤트가 없습니다.'}
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
            <p className={styles.qrLabel}>
              QR 클릭! ←
              <br />
              모바일에서 확인하기
            </p>
          </div>
        </>
      )}

      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home', 'Back')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={goBack} aria-label="뒤로" />
      </div>

      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>

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
            <p className={styles.qrZoomHint}>QR코드를 화면에 맞춰주세요.</p>
          </div>
        </div>
      )}
    </div>
  );
}
