/**
 * Generic page for Hwaseong screens not yet designed. Uses the shared chrome
 * (background, header, left nav, banner) so every page is visually consistent;
 * the body shows a 준비중 placeholder until the real design is built.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { screenTitle, useLang } from '@renderer/lib/i18n';
import { ui } from '@renderer/lib/uiText';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongBanner } from './HwaseongBanner';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import styles from './HwaseongScreen.module.css';

interface Props {
  screen: KioskScreenId;
  controller: KioskController;
}

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
  // Localized through the same resolver the real headers use — the placeholder
  // must not be the one screen that shows a raw Korean id.
  const title = screenTitle(SCREEN_LABELS[screen] ?? screen, lang);

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
        <span className={styles.placeholder}>{ui('comingSoon', lang)}</span>
      </div>

      <HwaseongLeftNav onHome={() => controller.navigate('home', 'Back')} />

      <HwaseongBanner onClick={() => controller.startPhoto()} />
    </div>
  );
}
