/**
 * 제주 shop list card — Figma component `4030:74958` (R>리스트-사진4개).
 *
 * One card: name • category / address / description / hashtags on the left, a
 * 2×2 photo grid on the right. Shared because the 검색 results (6050:140667) and
 * the 뭐먹지 category list (6212:55184) draw the byte-identical component; the
 * only difference is that search highlights the typed query.
 */
import type { Lang } from '@renderer/lib/i18n';
import type { Shop } from '@shared/types/shop';
import {
  padImages,
  shopAddress,
  shopDescription,
  shopHashtag,
  shopImages,
  shopName,
  shopRentcarRouteSummary,
  shopSecondCategory,
} from '@renderer/lib/shops';
import { highlightMatch } from '@renderer/lib/highlightMatch';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuShopCard.module.css';

/** Thumbnails per card — the Figma draws a fixed 2×2 grid. */
const THUMBS = 4;

type RentcarBadgeVariant = 'primary' | 'shuttle' | 'noShuttle' | 'ferry';

function rentcarBadgeClass(variant: RentcarBadgeVariant): string {
  switch (variant) {
    case 'shuttle':
      return styles.badgeShuttle || styles.badge || '';
    case 'noShuttle':
      return styles.badgeNoShuttle || styles.badge || '';
    case 'ferry':
      return styles.badgeFerry || styles.badge || '';
    default:
      return styles.badgePrimary || styles.badge || '';
  }
}

interface Props {
  shop: Shop;
  lang: Lang;
  /** When set, occurrences are drawn in the brand colour (search only). */
  query?: string;
  /** 렌트카 list: text-only row — no photo grid, no hashtag line, shorter plate. */
  compact?: boolean;
  /** Optional top-right badge (렌터카하우스 "공항 내 데스크" chip). */
  badge?: string;
  /** Badge colour — rentcar compact list variants. */
  badgeVariant?: RentcarBadgeVariant;
  /** 렌트카 compact row override — e.g. 렌터카하우스 wayfinding line. */
  routeLine?: string;
  /** 렌터카하우스 목록 — #ffeac7 plate + primary border. */
  house?: boolean;
  onClick: () => void;
}

export function JejuShopCard({
  shop,
  lang,
  query = '',
  compact = false,
  badge,
  badgeVariant = 'primary',
  routeLine,
  house = false,
  onClick,
}: Props): JSX.Element {
  // Real photos first, then the shared no-image placeholder — the same asset
  // (byte-identical noimage.png) and the same padImages() the other three
  // locations use, so a shop with no photos reads as "no photo" instead of an
  // empty tinted tile.
  const images = padImages(shopImages(shop), jejuIconUrl('noimage'), THUMBS);
  const routeSummary = compact ? routeLine ?? shopRentcarRouteSummary(shop, lang) : '';
  const mark = (text: string): ReturnType<typeof highlightMatch> | string =>
    query ? highlightMatch(text, query, styles.hl) : text;

  return (
    <button
      type="button"
      className={`${styles.card} ${compact ? styles.cardCompact : ''} ${house ? styles.cardHouse : ''}`}
      onClick={onClick}
    >
      <span className={`${styles.info} ${compact ? styles.infoCompact : ''}`}>
        <span className={`${styles.nameRow} ${compact ? styles.nameRowCompact : ''}`}>
          <span className={styles.name}>{mark(shopName(shop, lang))}</span>
          {compact && badge ? (
            <span className={`${styles.badge} ${rentcarBadgeClass(badgeVariant)}`}>
              {badge}
            </span>
          ) : (
            !compact && (
              <span className={styles.cat}>
                <span className={styles.dot} />
                {shopSecondCategory(shop, lang)}
              </span>
            )
          )}
        </span>
        {compact ? (
          routeSummary ? <p className={styles.route}>{routeSummary}</p> : null
        ) : (
          <>
            <p className={styles.address}>{mark(shopAddress(shop, lang))}</p>
            <p className={styles.desc}>{mark(shopDescription(shop, lang))}</p>
            <p className={styles.tags}>{mark(shopHashtag(shop, lang))}</p>
          </>
        )}
      </span>

      {!compact && (
        /* Always four slots so the 2×2 grid holds its shape; padImages fills the
           spare ones with the no-image placeholder. */
        <span className={styles.photos}>
          {Array.from({ length: THUMBS }, (_, j) => (
            <span key={j} className={styles.thumb}>
              {images[j] && <img src={images[j]} alt="" draggable={false} loading="lazy" />}
            </span>
          ))}
        </span>
      )}
    </button>
  );
}
