import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import iconNaver from '@renderer/assets/photos/insadong/ai/icon-naver.png';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { useDetailStore } from '@renderer/store/detailStore';
import { padImages } from '@renderer/lib/shops';
import { pick, screenTitle, useLang } from '@renderer/lib/i18n';
import { ImageLightbox } from '../components/ImageLightbox';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongMarketDetail.module.css';

const BLOG_REVIEWS = { ko: '블로그 리뷰', en: 'Blog Reviews', ja: 'ブログレビュー', zh: '博客评价' };

interface Props {
  controller: KioskController;
}

function Star({ filled }: { filled: boolean }): JSX.Element {
  return (
    <svg className={styles.star} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M12 2.4l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 18.06l-5.88 3.09 1.12-6.55L2.48 9.96l6.58-.96z" fill={filled ? '#FECF45' : '#DADADA'} />
    </svg>
  );
}

/** 전국시장 상세 — gallery + info + QR + Naver ratings (Figma 4167:173281). */
export function HwaseongMarketDetail({ controller }: Props): JSX.Element {
  const banner = useRotatingBanner(hwaseongIconUrl('fg-banner'));
  const item = useDetailStore((s) => s.item);
  const lang = useLang();
  const goBack = (): void => controller.navigate(item?.from ?? 'home', 'Back');
  const [lightbox, setLightbox] = useState<number | null>(null);
  const title = `${screenTitle('전국시장', lang)} > ${screenTitle('상세', lang)}`;

  const real = (item?.photos ?? []).filter(Boolean);
  const photos = padImages(real, hwaseongIconUrl('noimage') ?? '', 4);
  const qrLink = /^https?:\/\//i.test(item?.blogReviews ?? '') ? item!.blogReviews : '';
  const ratingValue = parseFloat(item?.rating ?? '');
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;
  const filledStars = Math.round(ratingValue);

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title={title} />

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Title + 2×2 gallery */}
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{item?.name ?? ''}</h2>
              {item?.category && (
                <span className={styles.cat}><span className={styles.dot} />{item.category}</span>
              )}
            </div>
            <div className={styles.gallery}>
              {photos.map((src, i) => {
                const isReal = i < real.length;
                return (
                  <div key={i} className={styles.cell} onClick={isReal ? () => setLightbox(i) : undefined}>
                    {src ? <img src={src} alt="" draggable={false} /> : <div className={styles.cellEmpty} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Info (address / hours / phone) + QR */}
          <div className={styles.infoRow}>
            <div className={styles.info}>
              {item?.address?.trim() && (
                <div className={styles.line}>
                  <svg className={styles.icon} viewBox="0 0 85 85" fill="none"><path d="M42.5 8C28 8 16 19.6 16 34c0 19 26.5 43 26.5 43S69 53 69 34C69 19.6 57 8 42.5 8Zm0 36a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" fill="#005ab4" /></svg>
                  <span className={styles.infoText}>{item.address}</span>
                </div>
              )}
              {item?.hours?.trim() && (
                <div className={styles.line}>
                  <svg className={styles.icon} viewBox="0 0 85 85" fill="none"><circle cx="42.5" cy="44" r="30" stroke="#005ab4" strokeWidth="6" /><path d="M42.5 27v18l13 8" stroke="#005ab4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  <div className={styles.infoCol}>
                    <span className={styles.infoText}>{item.hours}</span>
                    {item.breaktime && <span className={styles.infoText}>(Breaktime {item.breaktime})</span>}
                  </div>
                </div>
              )}
              {item?.phone?.trim() && (
                <div className={styles.line}>
                  <svg className={styles.icon} viewBox="0 0 85 85" fill="none"><path d="M26 14c-3 0-6 2-7 5-2 7 1 18 9 26s19 11 26 9c3-1 5-4 5-7v-9l-13-4-5 6c-5-3-9-7-12-12l6-5-4-13z" fill="#005ab4" /></svg>
                  <span className={styles.infoText}>{item.phone}</span>
                </div>
              )}
            </div>
            {/* Only render the QR (with its border) when there's a real link. */}
            {qrLink && (
              <div className={styles.qr}>
                <QRCodeSVG value={qrLink} level="M" style={{ width: '100%', height: '100%' }} />
              </div>
            )}
          </div>

          <div className={styles.divider} />

          {/* Description + tags */}
          {item?.description?.trim() && <p className={styles.desc}>{item.description}</p>}
          {item?.tags?.trim() && <p className={styles.tags}>{item.tags}</p>}

          <div className={styles.divider} />

          {/* Ratings — each Naver row renders its own icon; only show the rating
              row when there's a rating, so a lone (duplicate) icon never appears. */}
          {(hasRating || item?.blogReviews?.trim()) && (
            <div className={styles.ratings}>
              {hasRating && (
                <div className={styles.ratingItem}>
                  <img className={styles.naver} src={iconNaver} alt="" draggable={false} />
                  <span className={styles.stars}>{[0, 1, 2, 3, 4].map((i) => <Star key={i} filled={i < filledStars} />)}</span>
                  <span className={styles.ratingText}>{item?.rating}</span>
                </div>
              )}
              {item?.blogReviews?.trim() && (
                <>
                  {hasRating && <span className={styles.vline} />}
                  <div className={styles.ratingItem}>
                    <img className={styles.naver} src={iconNaver} alt="" draggable={false} />
                    <span className={styles.ratingText}>{pick(BLOG_REVIEWS, lang)}</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={goBack} aria-label="뒤로" />
      </div>

      <div className={styles.banner}>
        {banner && (
          <img src={banner} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>

      {lightbox !== null && (
        <ImageLightbox images={real} initialIndex={lightbox} accent="#005ab4" onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
