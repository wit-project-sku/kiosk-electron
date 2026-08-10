import { QRCodeSVG } from 'qrcode.react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useLang } from '@renderer/lib/i18n';
import { palaceCategory } from '@renderer/lib/palace';
import { useDetailStore } from '@renderer/store/detailStore';
import { PALACES } from '@renderer/data/palaces.generated';
import { pickText } from '@renderer/data/types';
import { PALACE_PHOTOS } from '@renderer/assets/photos/insadong/palace/halls';
import storePhoto from '@renderer/assets/photos/insadong/palace/store.png';
import { InsadongHeader } from './InsadongHeader';
import styles from './InsadongPalace.module.css';

interface InsadongPalaceProps {
  controller: KioskController;
  debug?: boolean;
}

/** 고궁안내 — single-photo + QR result cards, data from PalaceInfo_Insa (sheet). */
export function InsadongPalace({ controller }: InsadongPalaceProps): JSX.Element {
  const lang = useLang();
  const goHome = (): void => controller.navigate('home', 'Back');
  const setDetail = useDetailStore((s) => s.setItem);
  const cat = palaceCategory(lang);

  const openDetail = (i: number): void => {
    const p = PALACES[i]!;
    const photos = PALACE_PHOTOS[i];
    setDetail({
      from: controller.screen,
      title: '고궁안내',
      palaceIndex: i,
      name: pickText(p.name, lang),
      category: cat,
      // photos[0] = main large photo; [1..4] = four thumbnails at bottom
      photos: photos ? [photos.main, ...photos.thumbs] : [storePhoto],
      address: pickText(p.highlights, lang),
      hours: pickText(p.hours, lang),
      phone: pickText(p.admission, lang),
      description: pickText(p.info, lang),
      tags: pickText(p.hashtag, lang),
      rating: '4.8',
      instagram: '#palace',
      blogReviews: '',
    });
    controller.navigate('detail', '고궁안내 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="고궁안내" onHome={goHome} />

      <div className={styles.results}>
        {PALACES.map((p, i) => (
          <button type="button" key={i} className={styles.card} onClick={() => openDetail(i)}>
            <div className={styles.photo}>
              <img src={PALACE_PHOTOS[i]?.main ?? storePhoto} alt="" draggable={false} />
            </div>
            <div className={styles.info}>
              <div className={styles.nameRow}>
                <span className={styles.name}>{pickText(p.name, lang)}</span>
                <span className={styles.cat}>
                  <span className={styles.dot} />
                  {cat}
                </span>
              </div>
              <p className={styles.address}>{pickText(p.address, lang)}</p>
              <p className={styles.hours}>{pickText(p.hours, lang)}</p>
              <p className={styles.tags}>
                {pickText(p.hashtag, lang).split(/\s+/).filter(Boolean).slice(0, 3).join(' ')}
              </p>
            </div>
            {/* QR (Figma) — links to a Naver map search for the place. */}
            <div className={styles.qr}>
              <QRCodeSVG
                value={`https://map.naver.com/p/search/${encodeURIComponent(pickText(p.name, lang))}`}
                level="M"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
          </button>
        ))}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

    </>
  );
}
