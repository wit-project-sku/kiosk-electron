import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLang, pick, type Lang } from '@renderer/lib/i18n';
import { kdramaAsset } from '@renderer/assets/icons/insadong/kdrama';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import { usePhotoStore } from '@renderer/store/photoStore';
import { OsanHeader } from './OsanHeader';
import styles from '../insadong/InsadongKdrama.module.css';

type View = 'main' | 'quest' | 'reward';

const TITLE: Partial<Record<Lang, string>> = {
  ko: '티빙 오리지널 취사병 전설이 되다',
  en: 'Tving Original: Cook Soldier — Become a Legend',
  ja: 'Tvingオリジナル 취사병 전설이 되다',
  zh: 'Tving 原创剧 취사병 전설이 되다',
  vi: 'Tving Original: Anh Nuôi Trở Thành Huyền Thoại',
  th: 'Tving Original: พลทหารครัวสู่ตำนาน',
  ru: 'Tving Original: Повар-солдат становится легендой',
  id: 'Tving Original: Prajurit Juru Masak Jadi Legenda',
};
const BTN_INTRO: Partial<Record<Lang, string>> = { ko: '이벤트 소개', en: 'Event Info', ja: 'イベント紹介', zh: '活动介绍', vi: 'Giới thiệu sự kiện', th: 'แนะนำกิจกรรม', ru: 'О событии', id: 'Info Acara' };
const BTN_PRIZE: Partial<Record<Lang, string>> = { ko: '이벤트 상품', en: 'Prizes', ja: 'イベント賞品', zh: '活动奖品', vi: 'Quà tặng sự kiện', th: 'ของรางวัล', ru: 'Призы', id: 'Hadiah Acara' };
const BTN_JOIN: Partial<Record<Lang, string>> = { ko: '이벤트 참여', en: 'Participate', ja: 'イベント参加', zh: '参与活动', vi: 'Tham gia sự kiện', th: 'เข้าร่วมกิจกรรม', ru: 'Участвовать', id: 'Ikut Serta' };

const PROMO_VIDEO = 'media://video/osaek/promotion.mp4';

interface OsanKdramaProps {
  controller: KioskController;
}

/** K-DRAMA promotion — same Tving drama promo as insadong, Osaek chrome. */
export function OsanKdrama({ controller }: OsanKdramaProps): JSX.Element {
  const lang = useLang() as Lang;
  const [view, setView] = useState<View>('main');
  const { navigate, startPhoto } = controller;
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);

  const joinEvent = (): void => {
    setInitialCategory('프로모션');
    startPhoto();
  };

  const bg = kdramaAsset('bg');
  const questImg = kdramaAsset(`quest-${lang}`) ?? kdramaAsset('quest-ko');
  const rewardImg = kdramaAsset(`reward-${lang}`) ?? kdramaAsset('reward-ko');

  const title = pick(TITLE, lang);
  const btnIntro = pick(BTN_INTRO, lang);
  const btnPrize = pick(BTN_PRIZE, lang);
  const btnJoin = pick(BTN_JOIN, lang);

  const Tri = ({ flip }: { flip?: boolean }): JSX.Element => (
    <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true">
      <path d={flip ? 'M0 17.3203L30 0L30 34.6408Z' : 'M30 17.3203L0 34.6408L0 0Z'} fill="black" />
    </svg>
  );

  const GoldBtn = ({ cls, label, onClick }: { cls?: string; label: string; onClick: () => void }): JSX.Element => (
    <button type="button" className={`${styles.goldBtnWrap} ${cls ?? ''}`} onClick={onClick}>
      <div className={styles.goldBtnBg} />
      <span className={styles.goldBtnLabel}>
        <Tri />
        {label}
        <Tri flip />
      </span>
    </button>
  );

  return (
    <div className={styles.screen}>
      {bg && <img className={styles.bg} src={bg} alt="" draggable={false} />}
      <div className={styles.bgOverlay} />

      <OsanHeader
        title={title}
        light
        onHome={() => navigate('home', 'Back')}
        onBack={() => (view !== 'main' ? setView('main') : navigate('home', 'Back'))}
      />

      <div className={styles.contentFrame} />

      {view === 'main' && (
        <video className={styles.trailerVideo} src={PROMO_VIDEO} autoPlay muted loop playsInline preload="auto" />
      )}
      {view === 'quest' && questImg && <img className={styles.cardImg} src={questImg} alt="quest" draggable={false} />}
      {view === 'reward' && rewardImg && <img className={styles.cardImg} src={rewardImg} alt="reward" draggable={false} />}

      {view === 'main' && (
        <>
          <GoldBtn cls={styles.btnLeftMain} label={btnIntro} onClick={() => setView('quest')} />
          <GoldBtn cls={styles.btnRightMain} label={btnJoin} onClick={joinEvent} />
        </>
      )}
      {view === 'quest' && (
        <>
          <GoldBtn cls={styles.btnLeftCard} label={btnPrize} onClick={() => setView('reward')} />
          <GoldBtn cls={styles.btnRightCard} label={btnJoin} onClick={joinEvent} />
        </>
      )}
      {view === 'reward' && (
        <>
          <GoldBtn cls={styles.btnLeftReward} label={btnIntro} onClick={() => setView('quest')} />
          <GoldBtn cls={styles.btnRightReward} label={btnJoin} onClick={joinEvent} />
        </>
      )}

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={() => navigate('home', 'Back')} aria-label="홈으로">
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button
          type="button"
          className={styles.leftNavBtn}
          onClick={() => (view !== 'main' ? setView('main') : navigate('home', 'Back'))}
          aria-label="뒤로"
        >
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>
    </div>
  );
}
