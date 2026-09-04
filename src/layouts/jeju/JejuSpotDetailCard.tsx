/**
 * Shared 제주 상세 card.
 *
 * ONE component behind every detail screen — Figma draws them as separate
 * frames, but everything below the header is pixel-identical:
 *   · 검색 > 상세             node 6050:140706
 *   · AI 코스 spot 상세       node 6167:98729
 *   · 뭐먹지/뭐사지 > 상세     nodes 6212:55208 / 6212:55257 (card 164px lower)
 * (Diffing the two renders below y700: 976 of 4.75M pixels differ, all
 * antialiasing.) Only the page header changes, so the callers own that and
 * share this. Same split Osan uses with OsanSpotDetailCard.
 */
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { DetailItem } from '@renderer/store/detailStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { padImages, shopOpenTime } from '@renderer/lib/shops';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import mapRentalcarHouse from '@renderer/assets/photos/jeju/help/map-rentalcar-house.png';
import { ImageLightbox } from '../components/ImageLightbox';
import { JejuAirportDirections } from './JejuAirportDirections';
import styles from './JejuSpotDetailCard.module.css';

/** Photo slots in the gallery — the Figma draws a fixed 2×2. */
const PHOTOS = 4;

/**
 * Pin tip on `map-rentalcar-house` (fractions of the map box).
 * Aimed at GATE 2 — tweak these freely; the tip sits on (x, y).
 */
const RENTCAR_HOUSE_PIN = { x: 0.405, y: 0.35 };

/** Replaces the km directions heading on 렌터카하우스 detail. */
const RENTCAR_HOUSE_HEADING = {
  ko: '1층 2번 게이트',
  en: '1F Gate 2',
  ja: '1階2番ゲート',
  zh: '1层2号门',
  vi: 'Cổng số 2 tầng 1',
  th: 'ประตู 2 ชั้น 1',
  ru: 'Выход 2, 1-й этаж',
  id: 'Gerbang 2 Lantai 1',
};

/**
 * One 주소/영업시간/전화 icon: an 85×85 slot with the glyph drawn at the size
 * Figma gives it (see .infoIconSlot). Renders nothing when the export is
 * missing, so the row's text still lines up with the others.
 */
function InfoIcon({ name, size }: { name: string; size?: string }): JSX.Element | null {
  const url = jejuIconUrl(name);
  if (!url) return null;
  return (
    <span className={styles.infoIconSlot}>
      <img src={url} alt="" className={`${styles.infoIcon} ${size ?? ''}`} draggable={false} />
    </span>
  );
}

function RatingStar({ filled }: { filled: boolean }): JSX.Element {
  return (
    <svg className={styles.star} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M12 2.4l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 18.06l-5.88 3.09 1.12-6.55L2.48 9.96l6.58-.96z"
        fill={filled ? '#FECF45' : '#DADADA'}
      />
    </svg>
  );
}

interface Props {
  item: DetailItem;
  /**
   * Card top on the artboard. The 검색 and AI-course frames butt it against the
   * header at 700; the 뭐먹지 one (6212:55208) drops it to 864, and 관광명소
   * (6212:59326) to 1047 to clear the tab and 초성 rows. Everything below the
   * top edge is identical — shifting the two renders by exactly 164 leaves
   * 1045 of 3.88M pixels differing, all antialiasing.
   */
  top?: number;
  /**
   * Which Figma variant to draw: `R>검색상세-사진4개` (the 2×2 gallery, every
   * detail screen) or `R>검색상세-사진1개` (one big photo, 관광명소). The two
   * differ in the gallery and the name box, nothing else.
   */
  gallery?: 'grid' | 'single';
  /**
   * AI 코스 상세 with a 다음 장소 stop: the card rides in a page-level scroll
   * column instead of sitting at a fixed absolute y with its own max-height scroll.
   */
  flow?: boolean;
  /** In-card scroll cap — JejuDetail passes artboard foot − top in ♿. */
  maxScrollHeight?: number;
  lang?: Lang;
}

export function JejuSpotDetailCard({
  item,
  top = 700,
  gallery = 'grid',
  flow = false,
  maxScrollHeight,
  lang = 'ko',
}: Props): JSX.Element {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isRentcar = item.from === 'rentcar' && item.rentcarGuide != null;
  const isRentcarHouse = isRentcar && !!item.rentcarHouse;
  const single = !isRentcar && gallery === 'single';
  // Real photos drive the lightbox and the tap targets; the grid is padded to
  // its slot count with the shared no-image placeholder so an item with no
  // photos shows the same thing every other location shows.
  const realPhotos = item.photos.filter(Boolean);
  // Only a real URL becomes a QR; the shops API leaves this empty for many rows.
  // `blogReviews` carries the Naver link, not a review count — see JejuDetail.
  const qrLink = /^https?:\/\//i.test(item.blogReviews) ? item.blogReviews : null;
  const ratingValue = parseFloat(item.rating);
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const filledStars = Math.round(ratingValue);
  const showRatings = hasRating || !!item.instagram;
  const hoursRaw = shopOpenTime(item.hours);
  const breakRaw = item.breaktime ? shopOpenTime(item.breaktime) : '';
  const hours = [hoursRaw, breakRaw ? `(${breakRaw})` : ''].filter((h) => h.trim());
  /** 사진1개 draws exactly one slot; 사진4개 always draws four. */
  const slots = single ? 1 : PHOTOS;
  const photos = padImages(realPhotos, jejuIconUrl('noimage'), slots);
  const mapPin = jejuIconUrl('ico-map-pin');

  const guide = item.rentcarGuide;
  const route = item.rentcarRoute;
  const showShuttleDirections = isRentcar && !isRentcarHouse && guide?.isShuttle;
  const showFerryDirections = isRentcar && !isRentcarHouse && guide?.isFerry && !guide?.isShuttle;
  // AI 코스·뭐먹지·뭐사지·숙박·검색 상세 — 설명·태그·평점을 directions 위에 표시.
  const routeDetailFrom =
    item.from === 'eat' ||
    item.from === 'shop' ||
    item.from === 'lodging' ||
    item.from === 'search' ||
    item.from === 'ai_detail';
  const showShopRoute =
    route != null &&
    typeof route.distanceKm === 'number' &&
    Number.isFinite(route.distanceKm) &&
    routeDetailFrom;
  // 렌터카하우스 skips the km directions panel — floor plan map instead.
  const showDirectionsPanel =
    !isRentcarHouse &&
    ((isRentcar && (showShuttleDirections || showFerryDirections || route)) || showShopRoute);
  const routeDetailCard = routeDetailFrom || isRentcar;
  const scrollInsideCard = !flow && routeDetailCard;

  return (
    <>
      <div
        className={[
          styles.card,
          flow && styles.cardFlow,
          routeDetailCard && styles.cardRouteDetail,
          scrollInsideCard && styles.cardFixedScroll,
        ]
          .filter(Boolean)
          .join(' ')}
        style={
          flow
            ? undefined
            : {
                top,
                ...(maxScrollHeight != null ? { maxHeight: maxScrollHeight } : {}),
              }
        }
      >
        {/* ── Name + gallery / rentcar route guide ── */}
        <div className={styles.head}>
          <div className={`${styles.nameRow} ${item.rentcarBadge ? styles.nameRowWithBadge : ''}`}>
            <div className={styles.nameRowLeft}>
              <p className={`${styles.name} ${single ? styles.nameBoxed : ''}`}>{item.name}</p>
              {item.category && (
                <span className={styles.cat}>
                  <span className={styles.dot} />
                  {item.category}
                </span>
              )}
            </div>
            {item.rentcarBadge && (
              <span className={styles.houseBadge}>{item.rentcarBadge}</span>
            )}
          </div>

          {!isRentcar ? (
            <div className={single ? styles.photosSingle : styles.photos}>
              {Array.from({ length: slots }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  className={styles.photo}
                  onClick={realPhotos[i] ? () => setLightboxIndex(i) : undefined}
                  disabled={!realPhotos[i]}
                  aria-label={`사진 ${i + 1}`}
                >
                  {photos[i] && <img src={photos[i]} alt="" draggable={false} loading="lazy" />}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.divider} />

        {/* ── Address / hours / phone + QR ── */}
        <div className={styles.infoRow}>
          <div className={styles.infoList}>
            {item.address && (
              <div className={styles.infoItem}>
                <InfoIcon name="ico-marker" size={styles.iconMarker} />
                <p className={styles.infoText}>{item.address}</p>
              </div>
            )}

            {hours.length > 0 && (
              <div className={`${styles.infoItem} ${styles.infoItemHours}`}>
                <InfoIcon name="ico-alarm" size={styles.iconAlarm} />
                <div className={styles.hours}>
                  {hours.map((h) => (
                    <p key={h} className={styles.infoText}>{h}</p>
                  ))}
                </div>
              </div>
            )}

            {item.phone && (
              <div className={styles.infoItem}>
                <InfoIcon name="ico-phone" size={styles.iconPhone} />
                <p className={styles.infoText}>{item.phone}</p>
              </div>
            )}
          </div>

          {qrLink && (
            <div className={styles.qr}>
              <QRCodeSVG className={styles.qrCode} value={qrLink} bgColor="#ffffff" fgColor="#000000" />
            </div>
          )}
        </div>

        {!isRentcar && (
          <>
            <div className={styles.divider} />
            {item.description && <p className={styles.desc}>{item.description}</p>}
            {item.tags && <p className={styles.tags}>{item.tags}</p>}

            {/* ── Naver rating ──
                The Figma also draws an Instagram follower count (#127K) and a blog
                review count (블로그 리뷰 1,502개). The shops API carries NEITHER —
                only naverRating and naverLink — so those segments render solely when
                a value exists, which today means never. They need new API fields,
                not layout work. Osan drops them for the same reason. */}
            {showRatings && (
              <div className={styles.ratings}>
                {hasRating && (
                  <div className={styles.ratingItem}>
                    {jejuIconUrl('ico-naver') && (
                      <img src={jejuIconUrl('ico-naver')} alt="" className={styles.ratingIcon} draggable={false} />
                    )}
                    <span className={styles.stars}>
                      {[0, 1, 2, 3, 4].map((i) => (
                        <RatingStar key={i} filled={i < filledStars} />
                      ))}
                    </span>
                    <span className={styles.ratingText}>{item.rating}</span>
                  </div>
                )}

                {hasRating && item.instagram && <span className={styles.ratingSep} />}
                {item.instagram && (
                  <div className={styles.ratingItem}>
                    {jejuIconUrl('ico-instagram') && (
                      <img src={jejuIconUrl('ico-instagram')} alt="" className={styles.ratingIcon} draggable={false} />
                    )}
                    <span className={styles.ratingText}>{item.instagram}</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {isRentcarHouse && (
          <>
            <div className={styles.divider} />
            <div className={styles.houseMap}>
              <p className={styles.houseMapHeading}>{pick(RENTCAR_HOUSE_HEADING, lang)}</p>
              <div className={styles.houseMapFrame}>
                <img
                  src={mapRentalcarHouse}
                  alt=""
                  className={styles.houseMapImg}
                  draggable={false}
                />
                {mapPin && (
                  <img
                    src={mapPin}
                    alt=""
                    className={styles.houseMapPin}
                    style={{
                      left: `${RENTCAR_HOUSE_PIN.x * 100}%`,
                      top: `${RENTCAR_HOUSE_PIN.y * 100}%`,
                    }}
                    draggable={false}
                  />
                )}
              </div>
            </div>
          </>
        )}

        {showDirectionsPanel && (route || showFerryDirections) && (
          <>
            <div className={styles.divider} />
            <div className={styles.airportDirections}>
              <JejuAirportDirections
                route={route}
                destination={item.name}
                lang={lang}
                showShuttle={showShuttleDirections}
                showFerry={showFerryDirections}
                ferryModeLabel={guide?.modeLabel}
              />
            </div>
          </>
        )}
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={realPhotos}
          initialIndex={lightboxIndex}
          accent="#ff7f0f"
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </>
  );
}
