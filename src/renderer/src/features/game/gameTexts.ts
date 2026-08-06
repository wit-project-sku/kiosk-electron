import type { SupportedLanguage } from '@shared/types/kiosk';
import { pick } from '@renderer/lib/i18n';

/**
 * Copy for the wait-time mini game, shared by the Monitor 2 game screen and the
 * Monitor 1 control panel so the two never drift apart.
 *
 * ko/en/ja/zh are the base kiosk languages; `pick` falls back to Korean for the
 * extra languages W003 enables (vi/th/es).
 */
export const GAME_TEXT = {
  generating: {
    ko: 'AI가 사진을 만들고 있어요',
    en: 'Your AI photo is being created',
    ja: 'AIが写真を作成しています',
    zh: 'AI 正在生成照片',
  },
  inviteTitle: {
    ko: '기다리는 동안 몸으로 게임하세요!',
    en: 'Play with your body while you wait!',
    ja: '待っている間、体を動かして遊ぼう！',
    zh: '等待时用身体来玩游戏吧！',
  },
  playTitle: {
    ko: '점프! 그리고 숙이세요!',
    en: 'Jump! And duck!',
    ja: 'ジャンプ！そしてかがんで！',
    zh: '跳跃！然后蹲下！',
  },
  crashed: {
    ko: '아쉬워요!',
    en: 'So close!',
    ja: '惜しい！',
    zh: '真可惜！',
  },
  jumpTip: {
    ko: '제자리에서 점프하면 뛰어넘어요',
    en: 'Jump in place to leap over',
    ja: 'その場でジャンプすると飛び越えます',
    zh: '原地跳跃即可跳过',
  },
  duckTip: {
    ko: '앉으면 몸을 숙여요',
    en: 'Crouch down to duck under',
    ja: 'しゃがむと身をかがめます',
    zh: '蹲下即可低头躲避',
  },
  pressPlay: {
    ko: '터치 화면의 PLAY를 눌러 시작하세요',
    en: 'Press PLAY on the touch screen to start',
    ja: 'タッチ画面のPLAYを押して開始',
    zh: '请按触摸屏上的 PLAY 开始',
  },
  go: { ko: '시작!', en: 'GO!', ja: 'スタート！', zh: '开始！' },
  score: { ko: '점수', en: 'SCORE', ja: 'スコア', zh: '得分' },
  best: { ko: '최고', en: 'BEST', ja: 'ベスト', zh: '最高' },
  checkTouchScreen: {
    ko: '터치 화면에서 선택해 주세요',
    en: 'Choose on the touch screen',
    ja: 'タッチ画面で選んでください',
    zh: '请在触摸屏上选择',
  },
  standInFrame: {
    ko: '카메라 앞에 서 주세요',
    en: 'Please stand in front of the camera',
    ja: 'カメラの前に立ってください',
    zh: '请站在镜头前',
  },
  bodyFound: {
    ko: '준비 완료!',
    en: 'Ready!',
    ja: '準備完了！',
    zh: '准备就绪！',
  },
  poseLoading: {
    ko: '동작 인식 준비 중…',
    en: 'Getting motion control ready…',
    ja: 'モーション認識を準備中…',
    zh: '正在准备动作识别…',
  },

  // ── Monitor 1 control panel ──────────────────────────────────────────────
  play: { ko: 'PLAY', en: 'PLAY', ja: 'PLAY', zh: 'PLAY' },
  playAgain: { ko: '다시 하기', en: 'Play again', ja: 'もう一度', zh: '再玩一次' },
  showResult: { ko: '사진 보기', en: 'See my photo', ja: '写真を見る', zh: '查看照片' },
  waitingForAi: {
    ko: 'AI 사진 생성 중…',
    en: 'Still generating your photo…',
    ja: 'AI写真を生成中…',
    zh: '照片仍在生成中…',
  },
  photoReady: {
    ko: '사진이 완성되었어요!',
    en: 'Your photo is ready!',
    ja: '写真が完成しました！',
    zh: '您的照片已完成！',
  },
  lookAtBigScreen: {
    ko: '오른쪽 큰 화면을 보세요',
    en: 'Watch the big screen',
    ja: '大きな画面をご覧ください',
    zh: '请看大屏幕',
  },
  playingNow: {
    ko: '플레이 중!',
    en: 'Playing!',
    ja: 'プレイ中！',
    zh: '游戏进行中！',
  },
  getReady: {
    ko: '준비하세요!',
    en: 'Get ready!',
    ja: '準備して！',
    zh: '准备好！',
  },
  stepIntoView: {
    ko: '카메라 앞에 서면 시작할 수 있어요',
    en: 'Step in front of the camera to start',
    ja: 'カメラの前に立つと始められます',
    zh: '站到镜头前即可开始',
  },
  motionUnavailable: {
    ko: '동작 인식을 사용할 수 없어요. 사진이 곧 완성됩니다.',
    en: 'Motion control is unavailable. Your photo will be ready shortly.',
    ja: 'モーション認識が使えません。写真はまもなく完成します。',
    zh: '无法使用动作识别。照片即将完成。',
  },
  autoContinue: {
    ko: '사진이 완성되면 자동으로 넘어갑니다',
    en: 'You will move on automatically when the photo is ready',
    ja: '写真が完成すると自動的に進みます',
    zh: '照片完成后将自动跳转',
  },
} as const;

export type GameTextKey = keyof typeof GAME_TEXT;

export function gameText(key: GameTextKey, lang: SupportedLanguage): string {
  return pick(GAME_TEXT[key], lang);
}
