/**
 * Shared frame for every 제주공항 sub-page: background, header, left nav and
 * bottom banner. Screens supply only their own body.
 *
 * Osan and Hwaseong repeat this chrome in each screen file; 제주 has it once so
 * the ~20 sub-pages still to build can't drift apart — and so the sub-page
 * background lives in exactly one place.
 */
import type { ReactNode } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { jejuIconUrl } from '@renderer/assets/icons/jeju';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { JejuHeader } from './JejuHeader';
import styles from './JejuPageFrame.module.css';

interface Props {
  controller: KioskController;
  /** Header title (Korean id — localized by JejuHeader). */
  title: string;
  /** Optional header subtitle; omitted means "use the sheet, else hide". */
  subtitle?: string;
  /** Override the back button (defaults to going home, like the other layouts). */
  onBack?: () => void;
  /**
   * Show the bottom 한복 banner. Off for pages whose content runs past y3267 —
   * the AI search page ends at y3591, so a banner would sit on top of its CTA.
   */
  showBanner?: boolean;
  children?: ReactNode;
}

export function JejuPageFrame({
  controller,
  title,
  subtitle,
  onBack,
  showBanner = true,
  children,
}: Props): JSX.Element {
  // Live API banner when one is active, else the bundled 한복 promo.
  const banner = useRotatingBanner(jejuIconUrl('banner-page'));
  const bg = jejuIconUrl('bg-page');
  const goHome = (): void => controller.navigate('home', '홈');

  return (
    <div className={styles.root}>
      <div className={styles.bgBase} />
      {bg && <img src={bg} alt="" className={styles.bgImage} draggable={false} />}

      <JejuHeader controller={controller} title={title} subtitle={subtitle} onBack={onBack} />

      <div className={styles.body}>{children}</div>

      <div className={styles.leftNav}>
        {jejuIconUrl('nav-left') && (
          <img src={jejuIconUrl('nav-left')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavHome}`}
          onClick={goHome}
          aria-label="홈"
        />
        <button
          type="button"
          className={`${styles.leftNavZone} ${styles.leftNavBack}`}
          onClick={onBack ?? goHome}
          aria-label="뒤로"
        />
      </div>
      {jejuIconUrl('ico-accessibility') && (
        <img src={jejuIconUrl('ico-accessibility')} alt="" className={styles.accessibility} draggable={false} />
      )}

      {showBanner && (
        <div className={styles.banner}>
          {banner && <img src={banner} alt="" className={styles.bannerImg} draggable={false} />}
        </div>
      )}
    </div>
  );
}
