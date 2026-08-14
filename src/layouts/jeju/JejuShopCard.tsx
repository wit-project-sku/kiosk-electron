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
  shopSecondCategory,
} from '@renderer/lib/shops';
import { highlightMatch } from '@renderer/lib/highlightMatch';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuShopCard.module.css';

/** Thumbnails per card — the Figma draws a fixed 2×2 grid. */
const THUMBS = 4;

interface Props {
  shop: Shop;
  lang: Lang;
  /** When set, occurrences are drawn in the brand colour (search only). */
  query?: string;
  onClick: () => void;
}

export function JejuShopCard({ shop, lang, query = '', onClick }: Props): JSX.Element {
  // Real photos first, then the shared no-image placeholder — the same asset
  // (byte-identical noimage.png) and the same padImages() the other three
  // locations use, so a shop with no photos reads as "no photo" instead of an
  // empty tinted tile.
  const images = padImages(shopImages(shop), jejuIconUrl('noimage'), THUMBS);
  const mark = (text: string): ReturnType<typeof highlightMatch> | string =>
    query ? highlightMatch(text, query, styles.hl) : text;

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <span className={styles.info}>
        <span className={styles.nameRow}>
          <span className={styles.name}>{mark(shopName(shop, lang))}</span>
          <span className={styles.cat}>
            <span className={styles.dot} />
            {shopSecondCategory(shop, lang)}
          </span>
        </span>
        <p className={styles.address}>{mark(shopAddress(shop, lang))}</p>
        <p className={styles.desc}>{mark(shopDescription(shop, lang))}</p>
        <p className={styles.tags}>{mark(shopHashtag(shop, lang))}</p>
      </span>

      {/* Always four slots so the 2×2 grid holds its shape; padImages fills the
          spare ones with the no-image placeholder. */}
      <span className={styles.photos}>
        {Array.from({ length: THUMBS }, (_, j) => (
          <span key={j} className={styles.thumb}>
            {images[j] && <img src={images[j]} alt="" draggable={false} loading="lazy" />}
          </span>
        ))}
      </span>
    </button>
  );
}
