import { useRef, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import iconNaver from '@renderer/assets/photos/insadong/ai/icon-naver.png';
import qrImg from '@renderer/assets/photos/insadong/ai/detail-qr.png';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { padImages } from '@renderer/lib/shops';
import { useLang } from '@renderer/lib/i18n';
import { useFitText } from '@layouts/components/fitText';
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
 * Osan place-detail card — Figma 오산>검색-03 7812:105263 (R>검색상세-사진4개):
 * name · category, four photos, address / hours / phone with the QR, the
 * description and tags, then the Naver rating. Icons are the existing navy
 * marker / alarm / phone exports and the shared Naver mark.
 */
export function OsanSpotDetailCard({
  data,
  lowered = false,
  map,
  className,
}: {
  data: SpotDetailData;
  /** 오산>여기는오색시장-01-2 (7862:44961): a 1514×631 map above the title; the
      card grows to 2215 to hold it. */
  map?: ReactNode;
  /** Extra class on the positioned wrapper (a page-specific top). */
  className?: string;
  /** 오산>정이 뭐먹지-02 (7838:116041): from the 뭐먹지/뭐사지 lists the card
      sits at y977 rather than 검색-03's y700. */
  lowered?: boolean;
}): JSX.Element {
  // Real photos drive the lightbox; the grid is padded to 4 with the no-image
  // placeholder so the 2×2 layout always holds its shape.
  // See SpotDetailCard: shop rows can carry a null address/tags, and a string
  // method on one blanks the page. Guard every such access.
  const str = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');
  /* A URL the API lists can still 404 — 관광명소's photos point at files missing
     from the storage bucket. One that fails to load is dropped, so its cell
     takes the no-image plate like any short gallery and the lightbox never
     opens on a broken file. */
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const realPhotos = (data.photos ?? []).filter((u) => Boolean(u) && !broken.has(u));
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

  /* Other languages: the name shrinks to fit its row instead of ending in "…".
     The full-text rules for every language are "Show everything" in the CSS. */
  const long = useLang() !== 'ko';
  const rootRef = useRef<HTMLDivElement>(null);
  useFitText(rootRef, styles.title, long, 0.7, str(data.name));

  return (
    <div
      ref={rootRef}
      className={`${styles.content} ${lowered ? styles.contentLowered : ''} ${long ? styles.long : ''} ${className ?? ''}`}
    >
      <div className={`${styles.card} ${map ? styles.cardWithMap : ''}`}>
        {map && <div className={styles.mapSlot}>{map}</div>}
        <div className={styles.titleRow}>
          <h2 className={styles.title}>{data.name}</h2>
          {str(data.category).trim() && (
            <span className={styles.cat}>
              <span className={styles.dot} />
              {data.category}
            </span>
          )}
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
                <img
                  className={styles.galleryImg}
                  src={src}
                  alt=""
                  draggable={false}
                  onError={isReal ? () => setBroken((prev) => new Set(prev).add(src)) : undefined}
                />
              </div>
            );
          })}
        </div>

        <div className={styles.divider} />

        {/* Address / hours / phone + QR — each row (icon + text) is hidden when
            its field has no data, so no stray icon sits next to an empty value. */}
        <div className={styles.info}>
          <div className={styles.infoCol}>
            {str(data.address).trim() && (
              <div className={`${styles.infoRow} ${styles.rowAddress}`}>
                {marker && <img className={styles.infoIcon} src={marker} alt="" draggable={false} />}
                <span className={styles.infoText}>{data.address}</span>
              </div>
            )}
            {hours.length > 0 && (
              <div className={`${styles.infoRow} ${styles.rowHours}`}>
                <span className={styles.alarmFrame}>
                  {alarm && <img className={styles.alarmIcon} src={alarm} alt="" draggable={false} />}
                </span>
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
              <div className={`${styles.infoRow} ${styles.rowPhone}`}>
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

        <div className={styles.descBlock}>
          <div className={styles.desc}>
            <p className={styles.descClamp}>{data.description}</p>
          </div>
          <p className={styles.descTags}>{data.tags}</p>
        </div>

        {/* Ratings — the frame also draws Instagram followers and a blog-review
            count, but the shop data carries neither, so only Naver is shown,
            and only when the shop HAS a Naver rating: a bare Naver logo with
            nothing beside it read as a broken review. Same rule as 제주. */}
        {hasRating && (
          <>
            <div className={styles.divider} />
            <div className={styles.ratings}>
              <div className={styles.ratingItem}>
                <img className={styles.ratingIcon} src={iconNaver} alt="" draggable={false} />
                <span className={styles.stars}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <RatingStar key={i} filled={i < filledStars} />
                  ))}
                </span>
                <span className={styles.ratingText}>{data.rating}</span>
              </div>
            </div>
          </>
        )}
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
