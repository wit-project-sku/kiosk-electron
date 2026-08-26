import { useEffect, useState } from 'react';
import { Region, type Rect } from '../components/KioskScreenImage';
import styles from './InsadongHeaderDate.module.css';

/** Covers the baked date in the header (cream core sampled as var(--kiosk-secondary)). */
const DATE_RECT: Rect = { x: 79.5, y: 3.5, w: 13, h: 1.6 };

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Format as the design does: `2025-09-13(Mon)`. */
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}(${WEEKDAYS[d.getDay()]})`;
}

/**
 * Live date overlay for the Insadong header. Masks the baked placeholder date
 * with the sampled header colour and renders today's date in its place. The
 * header colour is identical across every exported screen, so this drops into
 * each screen unchanged.
 */
export function InsadongHeaderDate(): JSX.Element {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    // Cheap minute tick so the date rolls over at midnight without a restart.
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Region rect={DATE_RECT} className={styles.date}>
      {formatDate(now)}
    </Region>
  );
}
