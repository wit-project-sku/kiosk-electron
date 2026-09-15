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
  /**
   * "영업 시간 08:00-20:00". Given (even empty), the stats row is the itinerary
   * one from 7058:21462 / 7128:72710 — hours by the clock, then `dwell` by the
   * bars, no 난이도; an empty string draws no hours item. Omitted, the row stays
   * `dwell` · `difficulty` (the 다음 장소 card under the spot detail).
   */
  hours?: string;
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
  /**
   * The 2026-09-15 itinerary plate (7229:100396, on 7058:21462): 453 tall, a
   * 496×319 photo, and ONE 1039-wide text column spread top to bottom — name ·
   * #tag, the description (now above the address, 30px), the address, the
   * stats. The course list opts in; the 다음 장소 card under the spot detail
   * keeps the older plate until its own frame is redrawn.
   */
  slim?: boolean;
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
  hours,
  dwell,
  difficulty,
  width,
  variant = 'full',
  badge = '',
  toggle,
  slim = false,
  className,
  style,
  onClick,
}: Props): JSX.Element {
  const marker = jejuIconUrl('ico-marker');
  const durationIcon = jejuIconUrl('ico-duration');
  const difficultyIcon = jejuIconUrl('ico-difficulty');

  /* The two stats, in order. The itinerary row (hours given) keeps the frame's
     icons in place — clock first, bars second — and moves the text under them. */
  const itinerary = hours !== undefined;
  const stats = (itinerary
    ? [
        { key: 'hours', icon: durationIcon, text: hours },
        { key: 'dwell', icon: difficultyIcon, text: dwell },
      ]
    : [
        { key: 'dwell', icon: durationIcon, text: dwell },
        { key: 'difficulty', icon: difficultyIcon, text: difficulty },
      ]
  ).filter((s) => s.text);
  const statItems = stats.map((s) => (
    <span
      key={s.key}
      className={s.key === 'hours' ? `${styles.metaItem} ${styles.metaItemHours}` : styles.metaItem}
      title={s.key === 'hours' ? s.text : undefined}
    >
      {s.icon && (
        <img
          src={s.icon}
          alt=""
          className={s.icon === difficultyIcon ? `${styles.metaIcon} ${styles.metaIconBars}` : styles.metaIcon}
          draggable={false}
        />
      )}
      <span className={styles.metaText}>{s.text}</span>
    </span>
  ));

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

        <span
          className={[styles.spotMeta, styles.compactMeta, itinerary ? styles.spotMetaHours : '']
            .filter(Boolean)
            .join(' ')}
        >
          {statItems}
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

  const nameRow = (
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
  );

  const addrRow = (
    <span className={styles.spotAddrRow}>
      {marker && <img src={marker} alt="" className={styles.spotAddrIcon} draggable={false} />}
      <p className={styles.spotAddr}>{address}</p>
    </span>
  );

  const meta = (
    <span
      className={[styles.spotMeta, toggle ? styles.spotMetaToggle : '', itinerary ? styles.spotMetaHours : '']
        .filter(Boolean)
        .join(' ')}
    >
      {statItems}
      {toggle && <ToggleChip label={toggle.label} onToggle={toggle.onToggle} expanded />}
    </span>
  );

  return (
    <button
      type="button"
      className={[styles.spot, slim ? styles.spotSlim : '', className].filter(Boolean).join(' ')}
      style={{ width, ...style }}
      onClick={onClick}
    >
      {photo ? (
        <img src={photo} alt="" className={styles.spotImg} draggable={false} loading="lazy" />
      ) : (
        <span className={styles.spotImg} />
      )}

      <span className={styles.spotBody}>
        {slim ? (
          /* 7229:100400 — one column, top to bottom: name · #tag, description,
             address, stats. */
          <>
            {nameRow}
            <p className={styles.spotDesc}>{description}</p>
            {addrRow}
            {meta}
          </>
        ) : (
          <>
            <span className={styles.spotTop}>
              {nameRow}
              {addrRow}
              <p className={styles.spotDesc}>{description}</p>
            </span>
            {meta}
          </>
        )}
      </span>
    </button>
  );
}
