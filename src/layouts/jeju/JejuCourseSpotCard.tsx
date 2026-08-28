/**
 * 제주 코스 장소 카드 — one scheduled stop of an AI course, drawn as the 515px
 * white plate with a 620×399 photo and a 875px body column.
 *
 * ONE component behind both places the design puts it:
 *   · the itinerary list on 제주>제주모하지(AI검색)-03 (6289:55320 / 6289:55078),
 *     w1678, beside its numbered disc;
 *   · the 다음 장소 card under the spot detail on -04 (6516:72906), w1793 —
 *     there is no disc there, so the plate takes the gutter back and centres.
 * Everything inside the plate is identical in the two frames, so only the width
 * is a prop. Same split JejuSpotDetailCard uses for the 상세 card.
 */
import type { CSSProperties } from 'react';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuCourseSpotCard.module.css';

interface Props {
  /** Already resolved by the caller, placeholder included — an empty string
   *  draws the plate's own #f2ede6 slot rather than a broken image. */
  photo: string;
  name: string;
  /** The grey #category beside the name. */
  category: string;
  address: string;
  description: string;
  /** 소요시간 at this stop, e.g. "2-3시간". */
  dwell: string;
  /** "난이도 쉬움". Empty draws no second stat — an ungraded spot gets no row
   *  rather than a wrong one. */
  difficulty: string;
  /** Plate width in artboard px; see the CSS note on .spot. */
  width: number;
  className?: string;
  style?: CSSProperties;
  onClick: () => void;
}

export function JejuCourseSpotCard({
  photo,
  name,
  category,
  address,
  description,
  dwell,
  difficulty,
  width,
  className,
  style,
  onClick,
}: Props): JSX.Element {
  return (
    <button
      type="button"
      className={[styles.spot, className].filter(Boolean).join(' ')}
      style={{ width, ...style }}
      onClick={onClick}
    >
      {photo ? (
        <img src={photo} alt="" className={styles.spotImg} draggable={false} loading="lazy" />
      ) : (
        <span className={styles.spotImg} />
      )}

      <span className={styles.spotBody}>
        <span className={styles.spotTop}>
          <span className={styles.spotNameRow}>
            <p className={styles.spotName}>{name}</p>
            <p className={styles.spotTag}>{category}</p>
          </span>

          <span className={styles.spotAddrRow}>
            {jejuIconUrl('ico-marker') && (
              <img src={jejuIconUrl('ico-marker')} alt="" className={styles.spotAddrIcon} draggable={false} />
            )}
            <p className={styles.spotAddr}>{address}</p>
          </span>

          <p className={styles.spotDesc}>{description}</p>
        </span>

        <span className={styles.spotMeta}>
          <span className={styles.metaItem}>
            {jejuIconUrl('ico-duration') && (
              <img src={jejuIconUrl('ico-duration')} alt="" className={styles.metaIcon} draggable={false} />
            )}
            <span className={styles.metaText}>{dwell}</span>
          </span>
          {difficulty && (
            <span className={styles.metaItem}>
              {jejuIconUrl('ico-difficulty') && (
                <img src={jejuIconUrl('ico-difficulty')} alt="" className={styles.metaIcon} draggable={false} />
              )}
              <span className={styles.metaText}>{difficulty}</span>
            </span>
          )}
        </span>
      </span>
    </button>
  );
}
