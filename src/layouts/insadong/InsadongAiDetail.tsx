import type { KioskController } from '@renderer/hooks/useKioskController';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { useRotatingBanner } from '@renderer/hooks/useRotatingBanner';
import { InsadongHeader } from './InsadongHeader';
import { SpotDetailCard, type SpotDetailData } from './SpotDetailCard';
import detail1 from '@renderer/assets/photos/insadong/ai/detail-1.jpg';
import detail2 from '@renderer/assets/photos/insadong/ai/detail-2.jpg';
import detail3 from '@renderer/assets/photos/insadong/ai/detail-3.jpg';
import styles from './InsadongAiDetail.module.css';

/**
 * '인사' 뭐하지 (AI 검색) — spot DETAIL (Figma "인사>인사모하지(AI검색)-04",
 * node 4167:90939). Reached by tapping a recommendation card on the results
 * page. Sample content mirrors the Figma placeholder; wire to real data later.
 */
const DETAIL: SpotDetailData = {
  name: '을지정육',
  category: '한식',
  photos: [detail1, detail2, detail3, detail1],
  address: '서울시 중구 충무로5길 24 1층',
  hours: ['매일 13:00 ~ 22:00', '(Breaktime 15:00~17:00)'],
  phone: '02-000-0000',
  description:
    '점심엔 순두부와 솥밥으로 균형잡힌 한상을 저녁엔 파전에 막걸리를 인사동에서 보기 힘든 가성비 좋은 가격으로 판매합니다.',
  tags: '#야장맛집 #인사동야장 #고기맛집 #항정살 #두툼항정 #종로맛집',
  rating: '4.3',
  instagram: '#127K',
  blog: '블로그 리뷰 1,502개',
};

interface InsadongAiDetailProps {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongAiDetail({ controller }: InsadongAiDetailProps): JSX.Element {
  const banner = useRotatingBanner();
  const goHome = (): void => controller.navigate('home', 'Back');
  const goBack = (): void => controller.navigate('ai_result', 'Back');

  return (
    <>
      {iconUrl('bg') && <img className={styles.bg} src={iconUrl('bg')} alt="" draggable={false} />}

      <InsadongHeader title="‘인사’ 뭐하지 (AI 검색)" onHome={goHome} onBack={goBack} />

      <SpotDetailCard data={DETAIL} />

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goBack} aria-label="뒤로">
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      {banner && (
        <button type="button" className={styles.banner} onClick={() => controller.startPhoto()} aria-label="가상 한복 체험">
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </>
  );
}
