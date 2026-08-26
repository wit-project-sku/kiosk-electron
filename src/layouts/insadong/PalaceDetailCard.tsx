import type { DetailItem } from '@renderer/store/detailStore';
import { useLang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { palaceCategory } from '@renderer/lib/palace';
import { PALACES } from '@renderer/data/palaces.generated';
import { pickText } from '@renderer/data/types';
import iconHistory from '@renderer/assets/photos/insadong/palace/icons/history.png';
import iconSightseeing from '@renderer/assets/photos/insadong/palace/icons/sightseeing.png';
import iconHours from '@renderer/assets/photos/insadong/palace/icons/hours.png';
import iconTicket from '@renderer/assets/photos/insadong/palace/icons/ticket.png';
import styles from './PalaceDetailCard.module.css';

interface PalaceDetailCardProps {
  item: DetailItem;
}

/**
 * Palace-specific detail card — matches the Figma 고궁안내 상세 design (node 4167:101467):
 *   title (name + category dot) → main wide photo → divider →
 *   four "icon · label : value" rows (역사 / 볼거리 / 영업시간 / 입장료) → divider →
 *   four bottom thumbnails.
 *
 * Text comes from PalaceInfo_Insa (sheet) when palaceIndex is set, so language
 * switches live; otherwise it falls back to the snapshot stored on the item.
 */
export function PalaceDetailCard({ item }: PalaceDetailCardProps): JSX.Element {
  const lang = useLang();
  const p = item.palaceIndex != null ? PALACES[item.palaceIndex] : undefined;

  const name = p ? pickText(p.name, lang) : item.name;
  // Resolved here, not read off `item.category`: that field is a SNAPSHOT taken
  // when the card was tapped, so switching language on this page left the chip
  // in the previous one while every other field re-read the sheet.
  const category = p ? palaceCategory(lang) : item.category;
  const history = p ? pickText(p.info, lang) : item.description;
  const highlights = p ? pickText(p.highlights, lang) : item.address;
  const hours = p ? pickText(p.hours, lang) : item.hours;
  const admission = p ? pickText(p.admission, lang) : item.phone;

  const [mainPhoto, ...rest] = item.photos;
  const thumbs = rest.slice(0, 4);

  const rows: Array<{ icon: string; label: string; value: string }> = [
    { icon: iconHistory, label: t('Palace_History', lang), value: history },
    { icon: iconSightseeing, label: t('Palace_Attraction', lang), value: highlights },
    { icon: iconHours, label: t('Palace_OpeningTime', lang), value: hours },
    { icon: iconTicket, label: t('Palace_Fee', lang), value: admission },
  ];

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        {/* Title */}
        <div className={styles.titleRow}>
          <h2 className={styles.name}>{name}</h2>
          <span className={styles.cat}>
            <span className={styles.dot} />
            {category}
          </span>
        </div>

        {/* Main wide photo */}
        {mainPhoto && (
          <div className={styles.mainPhoto}>
            <img src={mainPhoto} alt={name} draggable={false} />
          </div>
        )}

        <div className={styles.divider} />

        {/* Info rows — rows with no value are hidden (no icon next to empty data). */}
        <div className={styles.rows}>
          {rows.filter((row) => row.value.trim()).map((row) => (
            <div key={row.label} className={styles.row}>
              <div className={styles.rowLabel}>
                <img className={styles.rowIcon} src={row.icon} alt="" draggable={false} />
                <span className={styles.rowLabelText}>{row.label}</span>
              </div>
              <div className={styles.rowValue}>
                <span className={styles.colon}>:</span>
                <span className={styles.rowValueText}>{row.value}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={styles.divider} />

        {/* Bottom thumbnails */}
        {thumbs.length > 0 && (
          <div className={styles.thumbs}>
            {thumbs.map((src, i) => (
              <div key={i} className={styles.thumb}>
                <img src={src} alt="" draggable={false} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
