/**
 * Embeds an external website in the body region while keeping the shared
 * 화성휴게소 chrome (background, header, left nav, banner). Used for pages whose
 * content is a live site — e.g. 전국도로교통상황 → https://www.its.go.kr/.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongWebScreen.module.css';

interface Props {
  controller: KioskController;
  title: string;
  url: string;
}

export function HwaseongWebScreen({ controller, title, url }: Props): JSX.Element {
  return (
    <div className={styles.root}>
      {/* Background */}
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {/* Shared header */}
      <HwaseongHeader controller={controller} title={title} />

      {/* Webview body — 1820 × 2250 */}
      <div className={styles.body}>
        {/* eslint-disable-next-line react/no-unknown-property */}
        <webview src={url} partition="persist:embeds" className={styles.embed} />
      </div>

      {/* Left nav */}
      <div className={styles.leftNav}>
        {hwaseongIconUrl('fg-leftnav') && (
          <img src={hwaseongIconUrl('fg-leftnav')} alt="" className={styles.leftNavImg} draggable={false} />
        )}
        <button type="button" className={styles.leftNavZoneHome} onClick={() => controller.navigate('home')} aria-label="홈" />
        <button type="button" className={styles.leftNavZoneBack} onClick={() => controller.navigate('home')} aria-label="뒤로" />
      </div>

      {/* Bottom banner */}
      <div className={styles.banner}>
        {hwaseongIconUrl('fg-banner') && (
          <img src={hwaseongIconUrl('fg-banner')} alt="" className={styles.bannerImg} draggable={false} />
        )}
      </div>
    </div>
  );
}
