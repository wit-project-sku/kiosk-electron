import type { KioskScreenId } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { Hotspot, KioskScreenImage } from '../components/KioskScreenImage';
import { KioskButton } from '../components/KioskButton';
import { DEFAULT_BACK_RECTS, INSADONG_SCREENS } from './screenAssets';
import { InsadongHeaderDate } from './InsadongHeaderDate';
import styles from './InsadongScreen.module.css';

/** Korean titles for the themed fallback (used until a frame is exported). */
const SCREEN_TITLES: Partial<Record<KioskScreenId, string>> = {
  ai_search: "'인사' 모하지 (AI검색)",
  market: '위드마켓',
  insarang: '인사랑',
  events: '인사동 이벤트',
  eat: "'인사' 뭐먹지",
  shop: "'인사' 뭐사지",
  museum: '인사동미술관',
  taxfree: 'TAX-FREE',
  about: '여기는 인사동',
  hello: "안녕 '인사'",
  help: "도와줘 '인사'",
  map: '인사동지도',
  exchange: '환율',
  transport: '교통안내',
  lodging: '숙박안내',
  palace: '고궁안내',
  language: '언어 선택',
  search: '검색',
  kdrama: 'K-DRAMA',
  restroom: '화장실 안내',
};

interface InsadongScreenProps {
  screen: KioskScreenId;
  controller: KioskController;
  debug?: boolean;
}

/**
 * Renders a non-home Insadong screen. If the Figma frame has been exported it
 * shows the pixel-perfect background with back/home hotspots; otherwise a themed
 * placeholder keeps navigation working until the asset is added.
 */
export function InsadongScreen({ screen, controller, debug = false }: InsadongScreenProps): JSX.Element {
  const { navigate } = controller;
  const asset = INSADONG_SCREENS[screen];
  const title = SCREEN_TITLES[screen] ?? screen;

  if (asset) {
    const backRects = asset.back ?? DEFAULT_BACK_RECTS;
    return (
      <KioskScreenImage image={asset.image} alt={title}>
        <InsadongHeaderDate />
        {backRects.map((rect, i) => (
          <Hotspot key={i} rect={rect} label="홈으로" onClick={() => navigate('home', 'Back')} debug={debug} />
        ))}
      </KioskScreenImage>
    );
  }

  return (
    <div className={styles.fallback}>
      <div className={styles.inner}>
        <h1 className={styles.title}>{title}</h1>
        <p className={styles.note}>준비 중입니다</p>
        <KioskButton variant="secondary" onClick={() => navigate('home', 'Back')}>
          ← 홈으로
        </KioskButton>
      </div>
    </div>
  );
}
