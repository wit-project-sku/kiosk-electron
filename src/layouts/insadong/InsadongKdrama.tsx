import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLang, pick } from '@renderer/lib/i18n';
import { kdramaAsset } from '@renderer/assets/icons/insadong/kdrama';
import { iconUrl } from '@renderer/assets/icons/insadong';
import { usePhotoStore } from '@renderer/store/photoStore';
import { InsadongHeader } from './InsadongHeader';
import { useState } from 'react';
import styles from './InsadongKdrama.module.css';

type View = 'main' | 'quest' | 'reward';
type Lang = 'ko' | 'en' | 'ja' | 'zh';

const TITLE: Partial<Record<Lang, string>> = {
  ko: '티빙 오리지널 취사병 전설이 되다',
  en: 'Tving Original: Cook Soldier — Become a Legend',
  ja: 'Tvingオリジナル 취사병 전설이 되다',
  zh: 'Tving 原创剧 취사병 전설이 되다',
};

const BTN_INTRO: Partial<Record<Lang, string>> = {
  ko: '이벤트 소개',
  en: 'Event Info',
  ja: 'イベント紹介',
  zh: '活动介绍',
};

const BTN_PRIZE: Partial<Record<Lang, string>> = {
  ko: '이벤트 상품',
  en: 'Prizes',
  ja: 'イベント賞品',
  zh: '活动奖品',
};

const BTN_JOIN: Partial<Record<Lang, string>> = {
  ko: '이벤트 참여',
  en: 'Participate',
  ja: 'イベント参加',
  zh: '参与活动',
};

/** Promotion trailer — streamed from resources/videos via the media:// protocol. */
const PROMO_VIDEO = 'media://video/insadong/promotion.mp4';

interface InsadongKdramaProps {
  controller: KioskController;
  debug?: boolean;
}

export function InsadongKdrama({ controller }: InsadongKdramaProps): JSX.Element {
  const lang = useLang() as Lang;
  const [view, setView] = useState<View>('main');
  const { navigate, startPhoto } = controller;
  const setInitialCategory = usePhotoStore((s) => s.setInitialCategory);

  // 이벤트 참여 → open the photo flow with the 프로모션 tab pre-selected.
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

  return (
    <div className={styles.screen}>
      {/* Full-screen kitchen background */}
      {bg && <img className={styles.bg} src={bg} alt="" draggable={false} />}

      {/* Radial gradient overlay */}
      <div className={styles.bgOverlay} />

      {/* Header — standard InsadongHeader with promo title */}
      <InsadongHeader
        title={title}
        light
        onHome={() => navigate('home', 'Back')}
        onBack={() => (view !== 'main' ? setView('main') : navigate('home', 'Back'))}
      />

      {/* Golden conic-gradient frame — decorative overlay, not a container */}
      <div className={styles.contentFrame} />

      {/* Main view: promotion trailer video centred on artboard */}
      {view === 'main' && (
        <video
          className={styles.trailerVideo}
          src={PROMO_VIDEO}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        />
      )}

      {/* Quest view: card image centred on artboard */}
      {view === 'quest' && questImg && (
        <img
          className={styles.cardImg}
          src={questImg}
          alt="quest"
          draggable={false}
        />
      )}

      {/* Reward view: card image centred on artboard */}
      {view === 'reward' && rewardImg && (
        <img
          className={styles.cardImg}
          src={rewardImg}
          alt="reward"
          draggable={false}
        />
      )}

      {/* Bottom buttons — blurred border bg is a separate layer so text stays sharp */}
      {view === 'main' && (
        <>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnLeftMain}`}
            onClick={() => setView('quest')}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnIntro}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnRightMain}`}
            onClick={joinEvent}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnJoin}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
        </>
      )}
      {view === 'quest' && (
        <>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnLeftCard}`}
            onClick={() => setView('reward')}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnPrize}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnRightCard}`}
            onClick={joinEvent}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnJoin}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
        </>
      )}
      {view === 'reward' && (
        <>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnLeftReward}`}
            onClick={() => setView('quest')}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnIntro}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
          <button
            type="button"
            className={`${styles.goldBtnWrap} ${styles.btnRightReward}`}
            onClick={joinEvent}
          >
            <div className={styles.goldBtnBg} />
            <span className={styles.goldBtnLabel}>
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M30 17.3203L0 34.6408L0 0Z" fill="black" /></svg>
              {btnJoin}
              <svg className={styles.goldBtnTri} width="30" height="35" viewBox="0 0 30 35" fill="none" aria-hidden="true"><path d="M0 17.3203L30 0L30 34.6408Z" fill="black" /></svg>
            </span>
          </button>
        </>
      )}

      {/* Left-edge nav (home / back) */}
      <div className={styles.leftNav}>
        <button
          type="button"
          className={styles.leftNavBtn}
          onClick={() => navigate('home', 'Back')}
          aria-label="홈으로"
        >
          {iconUrl('home-btn') && <img src={iconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button
          type="button"
          className={styles.leftNavBtn}
          onClick={() => (view !== 'main' ? setView('main') : navigate('home', 'Back'))}
          aria-label="뒤로"
        >
          {iconUrl('back-arrow') && <img src={iconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>
    </div>
  );
}
