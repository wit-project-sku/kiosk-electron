/**
 * 제주 관광명소 card — Figma node 6212:59244.
 *
 * One attraction: photo, name, address, opening hours. Tapping it opens the
 * 사진1개 상세 (6212:59326) in place of the grid — the tab and 초성 rows stay,
 * so the drill-down never leaves this page.
 *
 * Distinct from JejuShopCard (which is a wide row: 2×2 photo grid, description
 * and hashtags) and from JejuSpotDetailCard (the 상세 itself). This is the grid
 * tile.
 */
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import styles from './JejuAttractionCard.module.css';

interface Props {
  name: string;
  address: string;
  /** One line per drawn row — the frame's third row carries a breaktime line. */
  hours: string[];
  /** First photo, or undefined while the shop has none; the slot stays. */
  photo?: string;
  onClick: () => void;
}

export function JejuAttractionCard({ name, address, hours, photo, onClick }: Props): JSX.Element {
  const marker = jejuIconUrl('ico-marker');
  const alarm = jejuIconUrl('ico-alarm');

  return (
    <button type="button" className={styles.card} onClick={onClick}>
      <div className={styles.photo}>
        {/* The shared no-image placeholder when the shop carries no photo —
            same asset the other locations fall back to. */}
        {(photo ?? jejuIconUrl('noimage')) && (
          <img src={photo ?? jejuIconUrl('noimage')} alt="" draggable={false} loading="lazy" />
        )}
      </div>

      <div className={styles.body}>
        <p className={styles.name}>{name}</p>

        <div className={styles.info}>
          {address && (
            <div className={`${styles.infoRow} ${styles.rowMarker}`}>
              <span className={styles.markerSlot}>
                {marker && <img src={marker} alt="" draggable={false} />}
              </span>
              <p className={styles.address}>{address}</p>
            </div>
          )}

          {hours.length > 0 && (
            <div className={`${styles.infoRow} ${styles.rowHours}`}>
              <span className={styles.alarmSlot}>
                {alarm && <img src={alarm} alt="" draggable={false} />}
              </span>
              <div className={styles.hours}>
                {hours.map((h) => (
                  <p key={h}>{h}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
