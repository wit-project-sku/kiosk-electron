/**
 * 화성휴게소 상세 — Figma 7956:61087 ('휴' 뭐먹지 > 상세, frame named 오산>정이
 * 뭐먹지-02 in the 화성 file).
 *
 * The 1820×2455 white card at (170, 700) is a window the content scrolls in
 * (the frame clips it at 2455): name · category, four photos, address / hours /
 * phone with the QR, description and tags, the rest-area floor map, its legend,
 * and the Naver rating. Positions in HwaseongDetail.module.css are the frame's
 * values (1 CSS px = 1 Figma px).
 *
 * The frame draws a red walking route on the map from 현위치 to 한식당 — the
 * shop it shows. Routes are per shop, so ROUTES holds the one the design gives
 * (keyed by shopNameKr) and every other shop shows the plain map.
 */
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { useDetailStore } from '@renderer/store/detailStore';
import { useShopStore } from '@renderer/store/shopStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { padImages } from '@renderer/lib/shops';
import { screenSubtitle, screenTitle, useLang } from '@renderer/lib/i18n';
import { tExact } from '@renderer/lib/loc';
import { ImageLightbox } from '../components/ImageLightbox';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import { FloorLegend, FloorMap, ROUTES } from './HwaseongFloorMap';
import styles from './HwaseongDetail.module.css';


interface Props {
  controller: KioskController;
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

const str = (v: string | null | undefined): string => (typeof v === 'string' ? v : '');

export function HwaseongDetail({ controller }: Props): JSX.Element {
  const item = useDetailStore((s) => s.item);
  const shops = useShopStore((s) => s.shops);
  const lang = useLang();
  const goBack = (): void => controller.navigate(item?.from ?? 'home', 'Back');

  useEffect(() => {
    if (item?.from) void window.api.kiosk.setScreen(`${item.from}_detail`);
  }, [item?.from]);
  const [lightbox, setLightbox] = useState<number | null>(null);
  /* ♿ (7956:60794): the 가상 한복 promo moves up under the mode bar, the header
     drops to 719 and the card runs 1424 → 3724 (2300 tall). */
  const low = useAccessibilityStore((st) => st.lowReach);

  // Localize both the source-page title and the "상세" suffix; the header passes
  // this composite through unchanged (it isn't a TITLE_KEYS id).
  const detailWord = screenTitle('상세', lang);
  const title = item ? `${screenTitle(item.title, lang)} > ${detailWord}` : detailWord;
  const subtitle = (item && screenSubtitle(item.title, lang)) || tExact('SubHeader_Detail', lang) || undefined;

  const real = (item?.photos ?? []).filter(Boolean);
  const photos = padImages(real, hwaseongIconUrl('noimage') ?? '', 4);
  const hours = [str(item?.hours).trim(), item?.breaktime ? `(Breaktime ${item.breaktime})` : ''].filter(Boolean);
  const qrLink = /^https?:\/\//i.test(str(item?.blogReviews)) ? item!.blogReviews : null;
  const ratingValue = parseFloat(str(item?.rating));
  const hasRating = Number.isFinite(ratingValue) && ratingValue > 0;

  const shopNameKr = item?.shopId != null ? shops.find((s) => s.id === item.shopId)?.shopNameKr : undefined;
  const route = shopNameKr ? ROUTES[shopNameKr.trim()] : undefined;
  /** A shop at this rest area (not a 전국시장 / 전국 휴게소 row). */
  const onSite = item?.from !== 'market';

  const icon = hwaseongIconUrl;

  return (
    <div className={styles.root}>
      <HwaseongPageBg image="detail-page-bg" opacity={0.7} />

      {low ? (
        <div style={{ position: 'absolute', top: 719, left: 0, width: 2160, height: 700 }}>
          <HwaseongHeader controller={controller} title={title} subtitle={subtitle} onBack={goBack} />
        </div>
      ) : (
        <HwaseongHeader controller={controller} title={title} subtitle={subtitle} onBack={goBack} />
      )}

      <div className={low ? `${styles.card} ${styles.cardLow}` : styles.card}>
        <div className={styles.scroll}>
          {/* Name · category */}
          <div className={styles.titleRow}>
            <h2 className={styles.title}>{item?.name ?? ''}</h2>
            {str(item?.category).trim() && (
              <span className={styles.cat}>
                <span className={styles.dot} />
                {item!.category}
              </span>
            )}
          </div>

          {/* Four photos across the row */}
          <div className={styles.gallery}>
            {photos.map((src, i) => {
              const isReal = i < real.length;
              return (
                <div
                  key={i}
                  className={styles.galleryCell}
                  data-clickable={isReal ? 'true' : undefined}
                  onClick={isReal ? () => setLightbox(i) : undefined}
                >
                  {src && <img src={src} alt="" draggable={false} />}
                </div>
              );
            })}
          </div>

          <div className={styles.divider} />

          {/* Address / hours / phone + QR — a row is dropped when its field is empty. */}
          <div className={styles.info}>
            <div className={styles.infoCol}>
              {str(item?.address).trim() && (
                <div className={`${styles.infoRow} ${styles.rowAddress}`}>
                  {icon('detail-marker') && <img className={styles.infoIcon} src={icon('detail-marker')} alt="" draggable={false} />}
                  <span className={styles.infoText}>{item!.address}</span>
                </div>
              )}
              {hours.length > 0 && (
                <div className={`${styles.infoRow} ${styles.rowHours}`}>
                  <span className={styles.alarmFrame}>
                    {icon('detail-alarm') && <img className={styles.alarmIcon} src={icon('detail-alarm')} alt="" draggable={false} />}
                  </span>
                  <span className={styles.infoTextCol}>
                    {hours.map((h) => (
                      <span key={h} className={styles.infoText}>{h}</span>
                    ))}
                  </span>
                </div>
              )}
              {str(item?.phone).trim() && (
                <div className={`${styles.infoRow} ${styles.rowPhone}`}>
                  {icon('detail-phone') && <img className={styles.infoIcon} src={icon('detail-phone')} alt="" draggable={false} />}
                  <span className={styles.infoText}>{item!.phone}</span>
                </div>
              )}
            </div>
            <div className={styles.qr}>
              {qrLink ? (
                <QRCodeSVG value={qrLink} level="M" className={styles.qrCode} />
              ) : (
                icon('detail-qr') && <img className={styles.qrImg} src={icon('detail-qr')} alt="QR" draggable={false} />
              )}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Description + tags */}
          <div className={styles.descBlock}>
            <div className={styles.desc}>
              <p className={styles.descClamp}>{str(item?.description)}</p>
            </div>
            <p className={styles.tags}>{str(item?.tags)}</p>
          </div>

          {/* Floor map (화성휴게소_식당2번_한식당) with this shop's route, if known.
              전국시장 / 전국 휴게소 rows are elsewhere in Korea, so the rest-area
              map and its legend are left off their 상세 (7956:61987 copies them). */}
          {onSite && <FloorMap route={route} />}

          {/* Legend */}
          {onSite && <FloorLegend />}

          <div className={styles.divider} />

          {/* Ratings — the frame also draws Instagram followers and a blog-review
              count, but the shop data carries neither, so only Naver is shown. */}
          <div className={styles.ratings}>
            {icon('detail-naver') && <img className={styles.ratingIcon} src={icon('detail-naver')} alt="" draggable={false} />}
            {hasRating && (
              <>
                <span className={styles.stars}>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <RatingStar key={i} filled={i < Math.round(ratingValue)} />
                  ))}
                </span>
                <span className={styles.ratingText}>{item!.rating}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <HwaseongLeftNav onHome={() => controller.navigate('home', 'Back')} onBack={goBack} />

      {/* The frame's banner is the 제주 placeholder; the live 화성 banner stays. */}
      <HwaseongBanner onClick={() => controller.startPhoto()} top={low ? 146 : undefined} />

      {lightbox !== null && (
        <ImageLightbox images={real} initialIndex={lightbox} accent="#005ab4" onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
