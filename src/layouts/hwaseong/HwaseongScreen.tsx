/**
 * Generic placeholder screen for Hwaseong screens not yet designed.
 * Replace individual exports with real screens as Figma designs arrive.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import type { KioskScreenId } from '@shared/types/kiosk';

interface Props {
  screen: KioskScreenId;
  controller: KioskController;
}

const SCREEN_LABELS: Partial<Record<KioskScreenId, string>> = {
  rest_info: '휴게소 안내',
  food_court: '푸드코트',
  convenience: '편의시설',
  tourism: '주변 관광',
  parking: '주차 안내',
  exchange: '환율',
  emergency: '긴급 안내',
  ai_search: 'AI 추천 여행',
  ai_result: 'AI 추천 결과',
  ai_detail: '상세 정보',
  language: '언어 선택',
};

export function HwaseongScreen({ screen, controller }: Props): JSX.Element {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: '#0a3d6b',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 40,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div style={{ fontSize: 80, opacity: 0.3 }}>🚧</div>
      <div style={{ fontSize: 52, fontWeight: 700 }}>
        {SCREEN_LABELS[screen] ?? screen}
      </div>
      <div style={{ fontSize: 36, opacity: 0.6 }}>준비중입니다</div>
      <button
        onClick={() => controller.navigate('home')}
        style={{
          marginTop: 40,
          padding: '28px 72px',
          background: '#4db8ff',
          color: '#fff',
          border: 'none',
          borderRadius: 24,
          fontSize: 40,
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        홈으로
      </button>
    </div>
  );
}
