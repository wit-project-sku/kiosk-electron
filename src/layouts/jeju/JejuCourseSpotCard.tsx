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
  /**
   * 'compact' is the 311px "추천 코스" card (7038:18453, 289px there; 311 since
   * 7128:72710): the orange pill, name, address and the two stats — no photo,
   * no description. The AI course detail draws it for a stop the visitor did
   * not pick. Default 'full'.
   */
  variant?: 'full' | 'compact';
  /**
   * The "추천 코스" pill. Always drawn by 'compact'; on 'full' it is drawn
   * beside the name only when given — 7128:72710's EXPANDED recommended stop,
   * which keeps saying it was the recommender's pick once it is opened up.
   */
  badge?: string;
  /**
   * 7128:72710's 펼치기 / 접기 control. Given, 'compact' draws "펼치기 ⌄" in its
   * bottom-right corner and 'full' draws "접기 ⌃" at the end of its stats row;
   * tapping it calls `onToggle` INSTEAD of `onClick`, so the rest of the plate
   * still opens the spot. Omitted, neither card draws it (the 다음 장소 card).
   */
  toggle?: { label: string; onToggle: () => void };
  className?: string;
  style?: CSSProperties;
  onClick: () => void;
}

/**
 * The 펼치기 / 접기 pill. A span rather than a nested <button> — a button may
 * not contain another — that swallows its own tap so the plate's `onClick`
 * (open the spot) does not also fire.
 */
function ToggleChip({
  label,
  onToggle,
  expanded,
  className,
}: {
  label: string;
  onToggle: () => void;
  expanded: boolean;
  className?: string;
}): JSX.Element {
  const icon = jejuIconUrl(expanded ? 'ico-chevron-up' : 'ico-chevron-down');
  return (
    <span
      role="button"
      aria-expanded={expanded}
      className={[styles.toggle, className].filter(Boolean).join(' ')}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      <span className={styles.toggleText}>{label}</span>
      {icon && <img src={icon} alt="" className={styles.toggleIcon} draggable={false} />}
    </span>
  );
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
  variant = 'full',
  badge = '',
  toggle,
  className,
  style,
  onClick,
}: Props): JSX.Element {
  const marker = jejuIconUrl('ico-marker');
  const durationIcon = jejuIconUrl('ico-duration');
  const difficultyIcon = jejuIconUrl('ico-difficulty');

  if (variant === 'compact') {
    return (
      <button
        type="button"
        className={[styles.spot, styles.spotCompact, className].filter(Boolean).join(' ')}
        style={{ width, ...style }}
        onClick={onClick}
      >
        <span className={styles.compactBadge}>{badge}</span>

        <span className={styles.compactNameRow}>
          <p className={styles.compactName}>{name}</p>
          <p className={styles.spotTag}>{category}</p>
        </span>

        <span className={`${styles.spotAddrRow} ${styles.compactAddr}`}>
          {marker && <img src={marker} alt="" className={styles.spotAddrIcon} draggable={false} />}
          <p className={styles.spotAddr}>{address}</p>
        </span>

        <span className={`${styles.spotMeta} ${styles.compactMeta}`}>
          <span className={styles.metaItem}>
            {durationIcon && (
              <img src={durationIcon} alt="" className={styles.metaIcon} draggable={false} />
            )}
            <span className={styles.metaText}>{dwell}</span>
          </span>
          {difficulty && (
            <span className={styles.metaItem}>
              {difficultyIcon && (
                <img src={difficultyIcon} alt="" className={styles.metaIcon} draggable={false} />
              )}
              <span className={styles.metaText}>{difficulty}</span>
            </span>
          )}
        </span>

        {toggle && (
          <ToggleChip
            label={toggle.label}
            onToggle={toggle.onToggle}
            expanded={false}
            className={styles.toggleCompact}
          />
        )}
      </button>
    );
  }

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
            {badge ? (
              <span className={styles.spotNameBadged}>
                <p className={styles.spotName}>{name}</p>
                <span className={`${styles.compactBadge} ${styles.nameBadge}`}>{badge}</span>
              </span>
            ) : (
              <p className={styles.spotName}>{name}</p>
            )}
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

        <span className={toggle ? `${styles.spotMeta} ${styles.spotMetaToggle}` : styles.spotMeta}>
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
          {toggle && <ToggleChip label={toggle.label} onToggle={toggle.onToggle} expanded />}
        </span>
      </span>
    </button>
  );
}
