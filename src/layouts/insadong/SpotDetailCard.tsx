import iconMarker from '@renderer/assets/photos/insadong/ai/icon-marker.png';
import iconAlarm from '@renderer/assets/photos/insadong/ai/icon-alarm.png';
import iconPhone from '@renderer/assets/photos/insadong/ai/icon-phone.png';
import iconNaver from '@renderer/assets/photos/insadong/ai/icon-naver.png';
import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import qrImg from '@renderer/assets/photos/insadong/ai/detail-qr.png';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { padImages } from '@renderer/lib/shops';
import { ImageLightbox } from '../components/ImageLightbox';
import styles from './SpotDetailCard.module.css';

/** Normalised data for the shared 상세 card. */
export interface SpotDetailData {
  name: string;
  category: string;
  /** Up to 4 photos. */
  photos: string[];
  address: string;
  /** One line per row (e.g. hours + breaktime). */
  hours: string[];
  phone: string;
  description: string;
  tags: string;
  rating: string;
  instagram: string;
  blog: string;
}

/** Real QR for the shop's Naver place link (falls back to the static art). */
/** Rating star — inline SVG so it always renders (Figma gold #FECF45 / gray #DADADA). */
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

/**
 * Shared place-detail card (gallery + info + QR + reviews) using the AI 검색상세
 * design and icons. Driven by props so every 상세 page looks identical.
 */
export function SpotDetailCard({ data }: { data: SpotDetailData }): JSX.Element {
  // Real photos drive the lightbox; the grid is padded to 4 with the no-image
  // icon like the cards so the 2×2 layout always holds its shape.
  const realPhotos = (data.photos ?? []).filter(Boolean);
  const photos = padImages(realPhotos, iconUrl('noimage'), 4);
  // `str` guards every field this card calls a string method on. detailStore is
  // written from a dozen screens and its fields are typed `string`, but shop
  // rows can carry a null address (see main/services/normalizeShop.ts) — before
  // this, `data.address.trim()` threw and blanked the whole detail page for the
  // five 뭐먹지 shops at 오색시장 with no address.
  const str = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');
  const hours = (data.hours ?? []).filter((h) => str(h).trim());
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // The QR encodes the shop's Naver link (blog field); static art when absent.
  const qrLink = /^https?:\/\//i.test(str(data.blog)) ? data.blog : null;
  // Real Naver rating — stars are derived from it; hidden when there is none.
  const ratingValue = parseFloat(str(data.rating));
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const filledStars = Math.round(ratingValue);

  return (
    <div className={styles.content}>
      <div className={styles.card}>
        {/* Title + gallery */}
        <div className={styles.head}>
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{data.name}</h2>
            <span className={styles.cat}>
              <span className={styles.dot} />
              {data.category}
            </span>
          </div>
          <div className={styles.gallery}>
            {photos.map((src, i) => {
              const isReal = i < realPhotos.length;
              return (
                <div
                  key={i}
                  className={styles.galleryCell}
                  data-clickable={isReal ? 'true' : undefined}
                  onClick={isReal ? () => setLightboxIndex(i) : undefined}
                >
                  <img className={styles.galleryImg} src={src} alt="" draggable={false} />
                </div>
              );
            })}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Address / hours / phone + QR — each row (icon + text) is hidden when
            its field has no data, so no stray icon sits next to an empty value. */}
        <div className={styles.info}>
          <div className={styles.infoCol}>
            {str(data.address).trim() && (
              <div className={styles.infoRow}>
                <img className={styles.infoIcon} src={iconMarker} alt="" draggable={false} />
                <span className={styles.infoText}>{data.address}</span>
              </div>
            )}
            {hours.length > 0 && (
              <div className={styles.infoRow}>
                <img className={styles.infoIcon} src={iconAlarm} alt="" draggable={false} />
                <div className={styles.infoTextCol}>
                  {hours.map((h) => (
                    <span key={h} className={styles.infoText}>
                      {h}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {str(data.phone).trim() && (
              <div className={styles.infoRow}>
                <img className={styles.infoIcon} src={iconPhone} alt="" draggable={false} />
                <span className={styles.infoText}>{data.phone}</span>
              </div>
            )}
          </div>
          <div className={styles.qr}>
            {qrLink ? (
              <QRCodeSVG value={qrLink} level="M" style={{ width: '100%', height: '100%' }} />
            ) : (
              <img className={styles.qrImg} src={qrImg} alt="QR" draggable={false} />
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* Description + tags */}
        <p className={styles.desc}>{data.description}</p>
        <p className={styles.descTags}>{data.tags}</p>

        <div className={styles.divider} />

        {/* Naver rating only — stars reflect the real rating; hidden when none. */}
        <div className={styles.ratings}>
          <div className={styles.ratingItem}>
            <img className={styles.ratingIcon} src={iconNaver} alt="" draggable={false} />
            {hasRating && (
              <>
                <span className={styles.stars}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <RatingStar key={i} filled={i < filledStars} />
                  ))}
                </span>
                <span className={styles.ratingText}>{data.rating}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={realPhotos}
          initialIndex={lightboxIndex}
          accent="var(--kiosk-primary)"
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
