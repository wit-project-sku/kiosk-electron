import { useEffect, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { padImages } from '@renderer/lib/shops';
import { screenTitle, useLang } from '@renderer/lib/i18n';
import { ImageLightbox } from '../components/ImageLightbox';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongDetail.module.css';

interface Props {
  controller: KioskController;
}

export function HwaseongDetail({ controller }: Props): JSX.Element {
  const item = useDetailStore((s) => s.item);
  const lang = useLang();
  const goBack = (): void => controller.navigate(item?.from ?? 'home', 'Back');

  useEffect(() => {
    if (item?.from) void window.api.kiosk.setScreen(`${item.from}_detail`);
  }, [item?.from]);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // Localize both the source-page title and the "상세" (detail) suffix; the
  // header passes this composite through unchanged (it isn't a TITLE_KEYS id).
  const detailWord = screenTitle('상세', lang);
  const title = item ? `${screenTitle(item.title, lang)} > ${detailWord}` : detailWord;
  const real = (item?.photos ?? []).filter(Boolean);
  const photos = padImages(real, hwaseongIconUrl('noimage') ?? '', 4);
  const hours = item?.hours?.trim()
    ? item.breaktime
      ? `${item.hours} (Breaktime ${item.breaktime})`
      : item.hours
    : '';

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      <HwaseongHeader controller={controller} title={title} />

      <div className={styles.content}>
        <div className={styles.card}>
          {/* Title + category */}
          <div className={styles.head}>
            <div className={styles.titleRow}>
              <h2 className={styles.title}>{item?.name ?? ''}</h2>
              {item?.category && (
                <span className={styles.cat}>
                  <span className={styles.dot} />
                  {item.category}
                </span>
              )}
            </div>

            {/* 2×2 photo gallery (575×324, radius 45, gap 45) */}
            <div className={styles.gallery}>
              {photos.map((src, i) => {
                const isReal = i < real.length;
                return (
                  <div
                    key={i}
                    className={styles.cell}
                    onClick={isReal ? () => setLightbox(i) : undefined}
                  >
                    {src ? <img src={src} alt="" draggable={false} /> : <div className={styles.cellEmpty} />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.dividerTop} />

          {/* Address + hours */}
          <div className={styles.info}>
            {item?.address?.trim() && (
              <div className={styles.infoRow}>
                <svg className={styles.infoIcon} viewBox="0 0 85 85" fill="none">
                  <path d="M42.5 8C28 8 16 19.6 16 34c0 19 26.5 43 26.5 43S69 53 69 34C69 19.6 57 8 42.5 8Zm0 36a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" fill="#005ab4" />
                </svg>
                <span className={styles.infoText}>{item.address}</span>
              </div>
            )}
            {hours && (
              <div className={styles.infoRow}>
                <svg className={styles.infoIcon} viewBox="0 0 85 85" fill="none">
                  <circle cx="42.5" cy="44" r="30" stroke="#005ab4" strokeWidth="6" />
                  <path d="M42.5 27v18l13 8" stroke="#005ab4" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className={styles.infoText}>{hours}</span>
              </div>
            )}
          </div>

          {/* Description */}
          {item?.description?.trim() && <p className={styles.desc}>{item.description}</p>}

          <div className={styles.dividerBottom} />

          {/* Floor map (static Figma render) */}
          {hwaseongIconUrl('fg-detail-map') && (
            <img src={hwaseongIconUrl('fg-detail-map')} alt="" className={styles.map} draggable={false} />
          )}
          {/* Category legend (static Figma render) */}
          {hwaseongIconUrl('fg-detail-legend') && (
            <img src={hwaseongIconUrl('fg-detail-legend')} alt="" className={styles.legend} draggable={false} />
          )}
        </div>
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={goBack} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>

      {lightbox !== null && (
        <ImageLightbox images={real} initialIndex={lightbox} accent="#005ab4" onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
