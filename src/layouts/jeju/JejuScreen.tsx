/**
 * SCAFFOLD page for 제주공항 (W006) screens whose Figma frame is not built yet.
 *
 * It is real chrome — JejuPageFrame gives it the correct sub-page background,
 * header, left nav and banner — with a 준비중 body. Replace screen by screen:
 * read the node with `get_design_context`, take exact colours/dimensions, export
 * the real assets, then add a branch in JejuKiosk.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';
import { pick, useLang } from '@renderer/lib/i18n';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuScreen.module.css';

interface Props {
  screen: KioskScreenId;
  controller: KioskController;
}

const COMING_SOON = { ko: '준비중입니다', en: 'Coming soon', ja: '準備中です', zh: '敬请期待' };

/**
 * Working Korean titles per screen — the ids JejuHeader localizes. They match
 * the labels the home tiles pass to `navigate()`, so the header reads the same
 * as the tile the visitor just tapped.
 */
const SCREEN_LABELS: Partial<Record<KioskScreenId, string>> = {
  eat: "'제주'뭐먹지",
  shop: "'제주'뭐사지",
  lodging: '숙박안내',
  taxfree: 'TAX-FREE',
  about: '여기는 제주도',
  hello: "안녕 '제주'",
  help: "도와줘 '제주'",
  rentcar: '렌트카',
  exchange: '환율',
  tamnao: '탐나오',
  localpay: '지역화폐',
  market: '위드마켓',
  events: '제주도 이벤트',
  kdrama: 'K-DRAMA',
  restroom: '화장실',
  search: '검색',
  // Reached from a search-result card. Until JejuDetail is built this shows the
  // 준비중 scaffold — without an entry here the header would print the raw
  // screen id "detail" to a visitor.
  detail: '상세',
  ai_search: "'제주' 뭐하지",
  ai_result: 'AI 검색 결과',
  ai_detail: '상세 정보',
};

export function JejuScreen({ screen, controller }: Props): JSX.Element {
  const lang = useLang();
  const title = SCREEN_LABELS[screen] ?? screen;

  return (
    <JejuPageFrame controller={controller} title={title}>
      <div className={styles.body}>
        <span className={styles.placeholder}>{pick(COMING_SOON, lang)}</span>
        <span className={styles.screenId}>{screen}</span>
      </div>
    </JejuPageFrame>
  );
}
