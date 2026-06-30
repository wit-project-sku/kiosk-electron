/**
 * Generic page for Hwaseong screens not yet designed. Uses the shared chrome
 * (background, header, left nav, banner) so every page is visually consistent;
 * the body shows a 준비중 placeholder until the real design is built.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang } from '@renderer/lib/i18n';
import { HwaseongHeader } from './HwaseongHeader';
import styles from './HwaseongScreen.module.css';

interface Props {
  screen: KioskScreenId;
  controller: KioskController;
}

/** "Coming soon" placeholder shown until a screen is designed. */
const COMING_SOON = { ko: '준비중입니다', en: 'Coming soon', ja: '準備中です', zh: '敬请期待' };

const SCREEN_LABELS: Partial<Record<KioskScreenId, string>> = {
  rest_info:   '전국도로교통상황',
  food_court:  "'휴' 뭐먹지",
  convenience: '전국휴게소',
  tourism:     '화성휴게소',
  parking:     '화성휴게소 지도',
  exchange:    '환율',
  emergency:   '긴급 안내',
  ai_search:   'AI 추천 여행',
  ai_result:   'AI 추천 결과',
  ai_detail:   '상세 정보',
  language:    '언어선택',
  events:      '화성시 이벤트',
  market:      '전국시장',
  taxfree:     'TAX-FREE',
  shop:        "'휴' 뭐사지",
  hello:       "안녕 '휴'",
  help:        "도와줘 '휴'",
  restroom:    '화장실',
  search:      '검색',
};

export function HwaseongScreen({ screen, controller }: Props): JSX.Element {
  const lang = useLang();
  const title = SCREEN_LABELS[screen] ?? screen;

  return (
    <div className={styles.root}>
      {/* Background */}
      <div className={styles.bgBase} />
      {hwaseongIconUrl('bg') && (
        <img src={hwaseongIconUrl('bg')} alt="" className={styles.bgImage} draggable={false} />
      )}

      {/* Shared header */}
      <HwaseongHeader controller={controller} title={title} />

      {/* Body — placeholder until the real screen is designed */}
      <div className={styles.body}>
        <span className={styles.placeholder}>{pick(COMING_SOON, lang)}</span>
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
