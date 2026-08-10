import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import iconNaver from '@renderer/assets/photos/insadong/ai/icon-naver.png';
import qrImg from '@renderer/assets/photos/insadong/ai/detail-qr.png';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { padImages } from '@renderer/lib/shops';
import { ImageLightbox } from '../components/ImageLightbox';
import styles from './OsanSpotDetailCard.module.css';

/** Normalised data for the shared 상세 card. */
export interface SpotDetailData {
  name: string;
  category: string;
  photos: string[];
  address: string;
  hours: string[];
  phone: string;
  description: string;
  tags: string;
  rating: string;
  instagram: string;
  blog: string;
}

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
 * Osan place-detail card — same layout as the insadong 검색상세, but with the
 * Osaek navy theme (#1a4d7e accents) and the user-provided marker/alarm/phone icons.
 */
export function OsanSpotDetailCard({ data }: { data: SpotDetailData }): JSX.Element {
  // Real photos drive the lightbox; the grid is padded to 4 with the no-image
  // placeholder so the 2×2 layout always holds its shape.
  // See SpotDetailCard: shop rows can carry a null address/tags, and a string
  // method on one blanks the page. Guard every such access.
  const str = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');
  const realPhotos = (data.photos ?? []).filter(Boolean);
  const photos = padImages(realPhotos, osanIconUrl('noimage'), 4);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const qrLink = /^https?:\/\//i.test(str(data.blog)) ? data.blog : null;
  const ratingValue = parseFloat(str(data.rating));
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const filledStars = Math.round(ratingValue);

  const marker = osanIconUrl('marker');
  const alarm = osanIconUrl('alarm');
  const phone = osanIconUrl('phone');
  const hours = (data.hours ?? []).filter((h) => str(h).trim());

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
                {marker && <img className={styles.infoIcon} src={marker} alt="" draggable={false} />}
                <span className={styles.infoText}>{data.address}</span>
              </div>
            )}
            {hours.length > 0 && (
              <div className={styles.infoRow}>
                {alarm && <img className={styles.infoIcon} src={alarm} alt="" draggable={false} />}
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
                {phone && <img className={styles.infoIcon} src={phone} alt="" draggable={false} />}
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

        {/* Naver rating */}
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
          accent="#1a4d7e"
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
