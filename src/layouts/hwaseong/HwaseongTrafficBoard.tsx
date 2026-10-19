/**
 * 화성휴게소 (W005) home board — Figma 화성 홈 7904:104580, board 7904:104707
 * (titled 도로교통상황) and its 더보기 group 7904:104690.
 *
 * Live expressway traffic from GET /api/traffic/expressway: the server filters
 * and sorts (nearby by distance → 서해안선 by recency → 서해안선 notices); the
 * board cycles through them in that order. The frame's four columns read, left
 * to right: 노선 = road, 방향 = direction, 위치 = location (a NOTICE has none, so
 * its message, on two lines), 현황 = typeName in the frame's blue. road/direction/location/
 * message are Korean source text and stay Korean in every language; 현황 is
 * the server's typeName in Korean and a translated type label elsewhere.
 *
 * The board and 더보기 open 전국도로교통상황 (the ITS page).
 *
 * Positioned in HwaseongHome's frame coordinates (1 CSS px = 1 Figma px).
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useExpresswayTraffic } from '@renderer/hooks/useExpresswayTraffic';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import type { Lang } from '@renderer/lib/i18n';
import { ui, type UiTextKey } from '@renderer/lib/uiText';
import type { ExpresswayTrafficItem } from '@shared/types/traffic';
import styles from './HwaseongTrafficBoard.module.css';

interface Props {
  controller: KioskController;
  lang: Lang;
  /** ♿ barrier-free home (7904:104975): the board sits inside the notice card. */
  low?: boolean;
}

/** How long each item stays on the board before the next one. */
const ROTATE_MS = 8000;
/** Smallest size a value may shrink to before it ellipsises (frame values are 45/38). */
const MIN_VALUE_PX = 28;

const TYPE_KEYS: Record<string, UiTextKey> = {
  CONGESTION: 'trafficTypeCongestion',
  ACCIDENT: 'trafficTypeAccident',
  WORK: 'trafficTypeWork',
  OBSTACLE: 'trafficTypeObstacle',
  WEATHER: 'trafficTypeWeather',
  NOTICE: 'trafficTypeNotice',
};

/** 현황: the server's own Korean typeName; other languages translate by type. */
function typeLabel(item: ExpresswayTrafficItem, lang: Lang): string {
  if (lang === 'ko' && item.typeName) return item.typeName;
  const key = TYPE_KEYS[item.type];
  return ui(key ?? 'trafficTypeOther', lang);
}

export function HwaseongTrafficBoard({ controller, lang, low = false }: Props): JSX.Element {
  const traffic = useExpresswayTraffic();
  const items = traffic?.items ?? [];

  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const timer = setInterval(() => setIndex((i) => i + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length]);
  const item = items.length ? items[index % items.length] : null;

  // Values are one line, as in the frame: a long Korean location steps down in
  // size until it fits, and only past MIN_VALUE_PX does it ellipsise. A NOTICE
  // message is a sentence, so it takes two lines at a set size instead.
  const rowRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    rowRef.current?.querySelectorAll<HTMLElement>(`.${styles.value}:not(.${styles.message})`).forEach((el) => {
      el.style.fontSize = '';
      let size = parseFloat(getComputedStyle(el).fontSize);
      while (el.scrollWidth > el.clientWidth + 1 && size > MIN_VALUE_PX) {
        size -= 1;
        el.style.fontSize = `${size}px`;
      }
    });
  }, [item, lang, low]);

  const openTraffic = (): void => controller.navigate('transport', '전국도로교통상황');

  const wide = lang !== 'ko';
  const moreArt = hwaseongIconUrl('home-more');

  return (
    <>
      <div
        className={`${styles.board} ${wide ? styles.boardWide : ''} ${low ? styles.boardLow : ''}`}
        role="button"
        aria-label={ui('trafficBoardTitle', lang)}
        onClick={openTraffic}
      >
        <p className={styles.title}>{ui('trafficBoardTitle', lang)}</p>
        <div className={styles.rule} />

        <span className={`${styles.head} ${styles.colRoad}`}>{ui('trafficHeadRoad', lang)}</span>
        <span className={`${styles.head} ${styles.colDirection}`}>{ui('trafficHeadDirection', lang)}</span>
        <span className={`${styles.head} ${styles.colLocation}`}>{ui('trafficHeadLocation', lang)}</span>
        <span className={`${styles.head} ${styles.colStatus}`}>{ui('trafficHeadStatus', lang)}</span>

        {traffic && !item ? (
          <span className={`${styles.value} ${styles.colAll} ${styles.status}`}>{ui('trafficNone', lang)}</span>
        ) : (
          <div key={item?.id ?? 'empty'} ref={rowRef} className={styles.row}>
            <span className={`${styles.value} ${styles.colRoad}`}>{item?.road || '-'}</span>
            <span className={`${styles.value} ${styles.colDirection}`}>{item?.direction || '-'}</span>
            {item && !item.location && item.message ? (
              <span className={`${styles.value} ${styles.colLocation} ${styles.message}`}>{item.message}</span>
            ) : (
              <span className={`${styles.value} ${styles.colLocation}`}>{item?.location || '-'}</span>
            )}
            <span className={`${styles.value} ${styles.colStatus} ${styles.status}`}>
              {item ? typeLabel(item, lang) : '-'}
            </span>
          </div>
        )}
      </div>

      <button type="button" className={`${styles.more} ${low ? styles.moreLow : ''}`} onClick={openTraffic}>
        <span className={styles.moreArrow}>
          {moreArt && <img src={moreArt} alt="" className={styles.moreArrowImg} draggable={false} />}
        </span>
        <span className={styles.moreText}>{ui('trafficMore', lang)}</span>
      </button>
    </>
  );
}
