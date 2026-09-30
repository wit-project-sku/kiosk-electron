import { useMemo, useRef } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useLang } from '@renderer/lib/i18n';
import { palaceCategory } from '@renderer/lib/palace';
import { useDetailStore } from '@renderer/store/detailStore';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { PALACES } from '@renderer/data/palaces.generated';
import { pickText } from '@renderer/data/types';
import { PALACE_PHOTOS } from '@renderer/assets/photos/insadong/palace/halls';
import { padImages } from '@renderer/lib/shops';
import { InsadongHeader } from './InsadongHeader';
import { InsadongLeftNav } from './InsadongLeftNav';
import styles from './InsadongListScreen.module.css';

interface InsadongPalaceProps {
  controller: KioskController;
  debug?: boolean;
}

const SCROLL_STEP = 450;

/**
 * 고궁안내 — Figma 7553:57278.
 *
 * The same card row as 뭐먹지 / 뭐사지 (name, category, address, one-line
 * description, two photos) with no consonant index and no category
 * tabs. Tapping a card opens the shared spot detail (7553:57198).
 */
export function InsadongPalace({ controller }: InsadongPalaceProps): JSX.Element {
  const lang = useLang();
  /* Korean category labels fit beside the title at 52px; the translations do
     not — see .catLong. The other five card screens already made this call;
     고궁안내 was passing `styles.cat` alone and so kept the Korean size in
     every language. */
  const wide = lang !== 'ko';
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  const goHome = (): void => controller.navigate('home', 'Back');
  const setDetail = useDetailStore((s) => s.setItem);
  const cat = palaceCategory(lang);
  const listRef = useRef<HTMLDivElement>(null);
  const noImg = iconUrl('noimage');

  const visible = useMemo(() => PALACES.map((p, i) => ({ p, i })), []);

  const openDetail = (i: number): void => {
    const p = PALACES[i]!;
    const photos = PALACE_PHOTOS[i];
    const urls = photos ? [photos.main, ...photos.thumbs].filter(Boolean) : [];
    setDetail({
      from: controller.screen,
      title: '고궁안내',
      palaceIndex: i,
      name: pickText(p.name, lang),
      category: cat,
      photos: padImages(urls, noImg, 4),
      address: pickText(p.address, lang),
      hours: [pickText(p.hours, lang), pickText(p.admission, lang).replace(/\s*\n+\s*/g, ' ')]
        .filter(Boolean)
        .join('\n'),
      phone: p.phone,
      description: pickText(p.info, lang).replace(/\s*\n+\s*/g, ' '),
      tags: pickText(p.hashtag, lang),
      rating: '',
      instagram: '',
      blogReviews: '',
    });
    controller.navigate('detail', '고궁안내 상세');
  };

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="고궁안내" onHome={goHome} />

      <div className={lowReach ? `${styles.results} ${styles.resultsLow}` : styles.results}>
        <div ref={listRef} className={styles.listScroll}>
          <div className={styles.list}>
            {visible.map(({ p, i }) => {
              const photos = PALACE_PHOTOS[i];
              const urls = photos ? [photos.main, ...photos.thumbs].filter(Boolean) : [];
              const imgs = padImages(urls, noImg, 2);
              return (
                <button type="button" key={i} className={styles.card} onClick={() => openDetail(i)}>
                  <div className={styles.info}>
                    <div className={styles.nameRow}>
                      <span className={styles.name}>{pickText(p.name, lang)}</span>
                      <span className={`${styles.cat} ${wide ? styles.catLong : ''}`}>
                        <span className={styles.dot} />
                        {cat}
                      </span>
                    </div>
                    <p className={styles.address}>{pickText(p.address, lang)}</p>
                    <p className={styles.desc}>{pickText(p.info, lang).replace(/\s*\n+\s*/g, ' ')}</p>
                  </div>
                  <div className={styles.photos}>
                    {imgs.map((src, j) => (
                      <div key={j} className={styles.thumb}>
                        <img src={src} alt="" draggable={false} loading="lazy" />
                      </div>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {visible.length > 0 && (
        <>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollUp}`}
            onClick={() => listRef.current?.scrollBy({ top: -SCROLL_STEP, behavior: 'smooth' })}
            aria-label="위로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
          <button
            type="button"
            className={`${styles.scrollBtn} ${styles.scrollDown}`}
            onClick={() => listRef.current?.scrollBy({ top: SCROLL_STEP, behavior: 'smooth' })}
            aria-label="아래로"
          >
            {iconUrl('scroll-arrow') && (
              <img src={iconUrl('scroll-arrow')} alt="" className={styles.scrollBtnImg} draggable={false} />
            )}
          </button>
        </>
      )}

      <InsadongLeftNav onHome={goHome} />
    </>
  );
}
