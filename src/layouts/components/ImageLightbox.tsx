import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Swiper as SwiperClass } from 'swiper';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Zoom, Keyboard } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import 'swiper/css/zoom';
import styles from './ImageLightbox.module.css';

interface ImageLightboxProps {
  /** Real photos only — never the no-image placeholder. */
  images: string[];
  /** Slide to open on first (index into `images`). */
  initialIndex?: number;
  onClose: () => void;
  /** Accent colour for the active pagination bullet (kiosk theme). */
  accent?: string;
}

/** Chevron used by the prev/next buttons (flipped for prev). */
function Chevron(): JSX.Element {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 5 L17 12 L9 19" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Fullscreen photo lightbox with a swipeable, pinch-zoomable gallery.
 *
 * Opened from a detail card's photo grid so visitors can view each real photo
 * large and swipe between them. Padding placeholders are never passed in, so
 * the no-image icon never appears here. The backdrop is a light frosted blur
 * (no heavy dark box) so the photo is the focus. Closes via the ✕ button or
 * Escape — a backdrop tap can't dismiss it mid-swipe on the touchscreen.
 */
export function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
  accent = '#1a4d7e',
}: ImageLightboxProps): JSX.Element | null {
  const start = Math.min(Math.max(initialIndex, 0), Math.max(images.length - 1, 0));
  const [swiper, setSwiper] = useState<SwiperClass | null>(null);
  const [index, setIndex] = useState(start);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft') swiper?.slidePrev();
      else if (e.key === 'ArrowRight') swiper?.slideNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, swiper]);

  if (images.length === 0) return null;

  const multiple = images.length > 1;

  return (
    <div className={styles.overlay} style={{ '--lb-accent': accent } as CSSProperties} role="dialog" aria-modal="true">
      <button type="button" className={styles.close} onClick={onClose} aria-label="닫기">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6 L18 18 M18 6 L6 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
        </svg>
      </button>

      <div className={styles.stage}>
        <Swiper
          className={styles.swiper}
          modules={[Pagination, Zoom, Keyboard]}
          onSwiper={setSwiper}
          onSlideChange={(s) => setIndex(s.activeIndex)}
          initialSlide={start}
          pagination={multiple ? { clickable: true } : false}
          keyboard
          zoom={{ maxRatio: 3 }}
          slidesPerView={1}
          spaceBetween={60}
        >
          {images.map((src, i) => (
            <SwiperSlide key={i} className={styles.slide}>
              <div className={`swiper-zoom-container ${styles.zoomBox}`}>
                <img className={styles.img} src={src} alt="" draggable={false} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>

      {multiple && (
        <>
          <button
            type="button"
            className={`${styles.nav} ${styles.navPrev}`}
            onClick={() => swiper?.slidePrev()}
            disabled={index === 0}
            aria-label="이전 사진"
          >
            <Chevron />
          </button>
          <button
            type="button"
            className={`${styles.nav} ${styles.navNext}`}
            onClick={() => swiper?.slideNext()}
            disabled={index === images.length - 1}
            aria-label="다음 사진"
          >
            <Chevron />
          </button>
        </>
      )}
    </div>
  );
}
