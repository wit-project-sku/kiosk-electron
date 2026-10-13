import type { KioskController } from '@renderer/hooks/useKioskController';
import { OsanListScreen } from './OsanListScreen';

interface OsanHelpProps {
  controller: KioskController;
  /** Category to open on first render (e.g. 화장실 from the restroom tile). */
  initialTab?: string;
}

/**
 * 도와줘 '정이' — Figma 7865:47290 (list) / 7865:47140 (상세). The facility list
 * is the 뭐먹지/뭐사지 list screen with no ㄱ–ㅎ row: category tabs from the
 * '정이 도와줘' shops (온누리상품권 · 은행 · 흡연실 · 화장실 · 주차장 · 마트&편의점),
 * 390px cards in the 2589 window, and the same lowered 상세 card.
 */
export function OsanHelp({ controller, initialTab }: OsanHelpProps): JSX.Element {
  return <OsanListScreen title="도와줘 '정이'" controller={controller} initials={false} initialTab={initialTab} />;
}
