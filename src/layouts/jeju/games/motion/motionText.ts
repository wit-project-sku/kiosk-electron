/**
 * Strings for the 제주 motion games, in the kiosk's eight languages.
 *
 * Separate from `gameText.ts` for the same reason the motion games are a
 * separate folder: these screens are on the CUSTOMER DISPLAY, read at a glance
 * by someone whose attention is on their own raised hand, so the copy is
 * written to a different brief — three words, an emoji that carries the meaning
 * on its own, and nothing that needs to be read twice. Keeping the two tables
 * apart stops that voice leaking into the touch games and vice versa.
 *
 * ── These lines are about a HAND now ──────────────────────────────────
 * The games were re-aimed from the whole body to one raised hand (the reasoning
 * is on HandTracker), and copy is most of what makes that land: a visitor does
 * what the screen asks, so a screen still saying "step in front" produces
 * somebody standing back with their arms down, waiting. The body-shaped lines
 * that survive — `stepInFront`, `standHereBody` — are the FALLBACK's, shown
 * only once the tracker has actually fallen back.
 *
 * ── Every one of these has to work as a GLANCE ────────────────────────
 * A visitor mid-game is not reading. The coaching lines especially (`stepInFront`,
 * `backIntoView`, `onePlayer`) are paired with a large glyph in the component,
 * and if the glyph alone does not carry it the line is wrong.
 */
import type { Lang } from '@renderer/lib/i18n';

type Str = Partial<Record<Lang, string>>;

export const MOTION = {
  // ── Cards ─────────────────────────────────────────────────────────────
  catchName: {
    ko: '손으로 감귤 받기',
    en: 'Hand Tangerine Catch',
    ja: '手でみかんキャッチ',
    zh: '用手接柑橘',
    vi: 'Hứng Quýt Bằng Tay',
    th: 'รับส้มด้วยมือ',
    ru: 'Лови мандарины рукой',
    id: 'Tangkap Jeruk dengan Tangan',
  } as Str,
  catchDesc: {
    ko: '손을 좌우로 움직여 감귤을 받으세요!',
    en: 'Move your hand left and right to catch them!',
    ja: '手を左右に動かしてみかんをキャッチ！',
    zh: '左右移动手掌接住柑橘！',
    vi: 'Di chuyển tay sang trái phải để hứng quýt!',
    th: 'ขยับมือซ้ายขวาเพื่อรับส้ม!',
    ru: 'Двигайте рукой влево-вправо и ловите!',
    id: 'Gerakkan tangan ke kiri-kanan untuk menangkap!',
  } as Str,

  /**
   * Renamed with the runner.
   *
   * It was 조랑말 달리기 / Jeju Pony Run, and the card is the promise the game
   * has to keep: a visitor who taps a pony and gets a girl in jeans has been
   * told the wrong thing about a game they chose on the strength of it. The new
   * name is deliberately about the ACTION rather than a character, because
   * nothing in this repo knows her name — give her one and this is the string
   * to put it in.
   */
  runName: {
    ko: '제주 달리기',
    en: 'Jeju Run',
    ja: '済州ラン',
    zh: '济州跑酷',
    vi: 'Chạy Jeju',
    th: 'วิ่งเชจู',
    ru: 'Бег по Чеджу',
    id: 'Lari Jeju',
  } as Str,
  runDesc: {
    ko: '손을 올리고 내려 장애물을 피하세요!',
    en: 'Raise and lower your hand to dodge!',
    ja: '手を上げ下げして障害物を避けよう！',
    zh: '抬手落手躲避障碍！',
    vi: 'Nâng và hạ tay để né chướng ngại!',
    th: 'ยกมือขึ้นลงเพื่อหลบสิ่งกีดขวาง!',
    ru: 'Поднимайте и опускайте руку, избегая преград!',
    id: 'Angkat dan turunkan tangan untuk menghindar!',
  } as Str,
  runHowTo: {
    ko: '손을 올리면 점프, 내리면 숙여요',
    en: 'Hand up to jump, hand down to duck',
    ja: '手を上げて跳び、下げてよける',
    zh: '抬手跳跃，落手低头',
    vi: 'Nâng tay để nhảy, hạ tay để cúi',
    th: 'ยกมือเพื่อกระโดด ลดมือเพื่อหมอบ',
    ru: 'Рука вверх — прыжок, вниз — уклон',
    id: 'Tangan naik melompat, turun menunduk',
  } as Str,
  /**
   * The countdown's one line, for the run.
   *
   * It used to repeat the controls, and that was the wrong thing to say at that
   * moment: the 3·2·1 is when the baseline is MEASURED (see useJejuRun), so what
   * the visitor needs to do during it is hold still — and where they hold their
   * hand now is what "up" and "down" will be measured from.
   */
  runHoldStill: {
    ko: '손을 가슴 앞에 들고 가만히 있어요',
    en: 'Hold your hand in front of you — keep still',
    ja: '手を胸の前に上げて、そのまま動かないで',
    zh: '把手举在胸前，保持不动',
    vi: 'Giơ tay trước ngực và giữ yên',
    th: 'ยกมือไว้ตรงหน้าอกแล้วอยู่นิ่งๆ',
    ru: 'Держите руку перед грудью — не двигайтесь',
    id: 'Angkat tangan di depan dada — tahan diam',
  } as Str,

  // ── Practice run ──────────────────────────────────────────────────────
  // One move at a time, on an empty track. See RunTutorial in useJejuRun.
  tutJump: {
    ko: '손을 위로 쭉 올려보세요!',
    en: 'Raise your hand up high!',
    ja: '手を上にぐっと上げてみて！',
    zh: '把手高高举起来！',
    vi: 'Giơ tay lên thật cao!',
    th: 'ยกมือขึ้นสูงๆ!',
    ru: 'Поднимите руку вверх!',
    id: 'Angkat tangan tinggi-tinggi!',
  } as Str,
  tutJumpSub: {
    ko: '손을 올리면 점프해요',
    en: 'Hand up = jump',
    ja: '手を上げるとジャンプ',
    zh: '抬手 = 跳跃',
    vi: 'Giơ tay = nhảy',
    th: 'ยกมือ = กระโดด',
    ru: 'Рука вверх = прыжок',
    id: 'Tangan naik = lompat',
  } as Str,
  tutDuck: {
    ko: '이번엔 손을 아래로 내려보세요!',
    en: 'Now lower your hand!',
    ja: '今度は手を下げてみて！',
    zh: '现在把手放低！',
    vi: 'Giờ hạ tay xuống!',
    th: 'คราวนี้ลดมือลง!',
    ru: 'Теперь опустите руку!',
    id: 'Sekarang turunkan tangan!',
  } as Str,
  tutDuckSub: {
    ko: '손을 내리면 몸을 숙여요',
    en: 'Hand down = duck',
    ja: '手を下げるとしゃがむ',
    zh: '落手 = 低头',
    vi: 'Hạ tay = cúi người',
    th: 'ลดมือ = หมอบ',
    ru: 'Рука вниз = пригнуться',
    id: 'Tangan turun = menunduk',
  } as Str,
  tutGood: {
    ko: '잘했어요!',
    en: 'Nice!',
    ja: 'いいね！',
    zh: '做得好！',
    vi: 'Tốt lắm!',
    th: 'เยี่ยม!',
    ru: 'Отлично!',
    id: 'Bagus!',
  } as Str,
  tutGo: {
    ko: '이제 진짜 시작!',
    en: 'Here we go!',
    ja: 'さあ、本番スタート！',
    zh: '正式开始！',
    vi: 'Bắt đầu nào!',
    th: 'เริ่มกันเลย!',
    ru: 'Поехали!',
    id: 'Ayo mulai!',
  } as Str,
  tutGoSub: {
    ko: '돌은 점프 ⬆️  갈매기는 숙이기 ⬇️',
    en: 'Jump the rocks ⬆️  Duck the gulls ⬇️',
    ja: '石はジャンプ ⬆️  カモメはしゃがむ ⬇️',
    zh: '石头跳过 ⬆️  海鸥低头 ⬇️',
    vi: 'Nhảy qua đá ⬆️  Cúi tránh chim ⬇️',
    th: 'หินให้กระโดด ⬆️  นกให้หมอบ ⬇️',
    ru: 'Камни — прыжок ⬆️  Чайки — пригнуться ⬇️',
    id: 'Batu lompati ⬆️  Camar tunduk ⬇️',
  } as Str,

  // ── Control meter ─────────────────────────────────────────────────────
  // The three zones her hand can be in, labelled with what SHE does, not with
  // what the hand does — the visitor already knows where their hand is.
  meterJump: {
    ko: '점프',
    en: 'JUMP',
    ja: 'ジャンプ',
    zh: '跳跃',
    vi: 'NHẢY',
    th: 'กระโดด',
    ru: 'ПРЫЖОК',
    id: 'LOMPAT',
  } as Str,
  meterRun: {
    ko: '달리기',
    en: 'RUN',
    ja: 'ラン',
    zh: '奔跑',
    vi: 'CHẠY',
    th: 'วิ่ง',
    ru: 'БЕГ',
    id: 'LARI',
  } as Str,
  meterDuck: {
    ko: '숙이기',
    en: 'DUCK',
    ja: 'しゃがむ',
    zh: '低头',
    vi: 'CÚI',
    th: 'หมอบ',
    ru: 'ПРИГНУТЬСЯ',
    id: 'TUNDUK',
  } as Str,
  meterHand: {
    ko: '내 손',
    en: 'Your hand',
    ja: 'あなたの手',
    zh: '你的手',
    vi: 'Tay bạn',
    th: 'มือคุณ',
    ru: 'Ваша рука',
    id: 'Tangan Anda',
  } as Str,
  runResult: {
    ko: '잘 달렸어요!',
    en: 'Great run!',
    ja: 'ナイスラン！',
    zh: '跑得漂亮！',
    vi: 'Chạy tốt lắm!',
    th: 'วิ่งได้เยี่ยม!',
    ru: 'Отличный забег!',
    id: 'Lari yang hebat!',
  } as Str,
  runBest: {
    ko: '최고 기록',
    en: 'Best',
    ja: 'ベスト',
    zh: '最佳',
    vi: 'Kỷ lục',
    th: 'สถิติ',
    ru: 'Рекорд',
    id: 'Terbaik',
  } as Str,

  // ── Calibration / coaching ────────────────────────────────────────────
  /**
   * The gate's headline, and now the whole instruction.
   *
   * It used to read "step in front of the screen", which was the right ask for
   * a game played with a torso and is the wrong one for a game played with a
   * hand: a visitor who steps back and waits is a visitor the hand model cannot
   * see, holding still, doing exactly what the screen told them. The wave glyph
   * beside it carries this on its own for anyone not reading.
   */
  raiseHand: {
    ko: '한 손을 들어주세요',
    en: 'Raise one hand',
    ja: '片手を上げてください',
    zh: '请举起一只手',
    vi: 'Hãy giơ một tay lên',
    th: 'ยกมือขึ้นหนึ่งข้าง',
    ru: 'Поднимите одну руку',
    id: 'Angkat satu tangan',
  } as Str,
  /** The old line, kept: it is what the BODY fallback should say. */
  stepInFront: {
    ko: '화면 앞에 서주세요',
    en: 'Step in front of the screen',
    ja: '画面の前に立ってください',
    zh: '请站到屏幕前',
    vi: 'Hãy đứng trước màn hình',
    th: 'กรุณายืนหน้าจอ',
    ru: 'Встаньте перед экраном',
    id: 'Berdirilah di depan layar',
  } as Str,
  ready: {
    ko: '준비 완료!',
    en: 'READY!',
    ja: '準備完了！',
    zh: '准备好了！',
    vi: 'SẴN SÀNG!',
    th: 'พร้อมแล้ว!',
    ru: 'ГОТОВО!',
    id: 'SIAP!',
  } as Str,
  backIntoView: {
    ko: '손을 다시 들어주세요',
    en: 'Raise your hand again',
    ja: 'もう一度手を上げてください',
    zh: '请再次举起手',
    vi: 'Hãy giơ tay lên lại',
    th: 'ยกมือขึ้นอีกครั้ง',
    ru: 'Поднимите руку снова',
    id: 'Angkat tangan lagi',
  } as Str,
  moveIntoArea: {
    ko: '손을 화면 가운데로 옮겨주세요',
    en: 'Bring your hand back to the middle',
    ja: '手を画面の中央に戻してください',
    zh: '请把手移回画面中间',
    vi: 'Hãy đưa tay về giữa khung hình',
    th: 'ขยับมือกลับมากลางจอ',
    ru: 'Верните руку к центру кадра',
    id: 'Kembalikan tangan ke tengah layar',
  } as Str,
  onePlayer: {
    ko: '한 명만 플레이해 주세요',
    en: 'One player please',
    ja: '一人でプレイしてください',
    zh: '请一人游玩',
    vi: 'Chỉ một người chơi',
    th: 'ขอผู้เล่นคนเดียว',
    ru: 'Пожалуйста, играйте по одному',
    id: 'Satu pemain saja',
  } as Str,
  /** The line that answers "I AM standing here" — they were too close. */
  stepBack: {
    ko: '손을 조금 뒤로 빼주세요',
    en: 'Move your hand back a little',
    ja: '手を少し後ろに引いてください',
    zh: '请把手稍微往后一点',
    vi: 'Hãy đưa tay lùi lại một chút',
    th: 'ถอยมือกลับอีกนิด',
    ru: 'Отведите руку чуть дальше',
    id: 'Tarik tangan sedikit ke belakang',
  } as Str,
  stepCloser: {
    ko: '손을 조금 더 가까이 들어주세요',
    en: 'Hold your hand a little closer',
    ja: '手をもう少し近づけてください',
    zh: '请把手举得近一点',
    vi: 'Hãy giơ tay gần hơn một chút',
    th: 'ยกมือเข้ามาใกล้อีกนิด',
    ru: 'Поднесите руку чуть ближе',
    id: 'Dekatkan tangan sedikit',
  } as Str,
  /**
   * Shown under the hand outline.
   *
   * Answers the question the old copy created and the new copy inherits: people
   * back away from a camera game because they assume it wants all of them. It
   * does not — it wants a palm, and standing where they already are is right.
   */
  standHere: {
    ko: '그 자리에서 손만 들면 돼요',
    en: 'Just your hand, from where you are',
    ja: 'その場で手を上げるだけで大丈夫です',
    zh: '就站在原地，举手即可',
    vi: 'Chỉ cần giơ tay, đứng nguyên tại chỗ',
    th: 'ยืนตรงนั้นแล้วยกมือก็พอ',
    ru: 'Достаточно руки — стойте, где стоите',
    id: 'Cukup tangan Anda, dari tempat Anda berdiri',
  } as Str,
  /** The body fallback's equivalent, for a visitor whose hands are full. */
  standHereBody: {
    ko: '전신이 다 보이지 않아도 괜찮아요',
    en: "Your whole body doesn't need to fit",
    ja: '全身が入らなくても大丈夫です',
    zh: '不用露出全身也可以',
    vi: 'Không cần lộ toàn thân',
    th: 'ไม่ต้องเห็นทั้งตัวก็ได้',
    ru: 'Всё тело показывать не нужно',
    id: 'Tidak perlu seluruh tubuh terlihat',
  } as Str,
  moveLeftRight: {
    ko: '손을 좌우로 움직이세요',
    en: 'Move your hand left and right',
    ja: '手を左右に動かしてください',
    zh: '左右移动手掌',
    vi: 'Di chuyển tay sang trái phải',
    th: 'ขยับมือซ้ายขวา',
    ru: 'Двигайте рукой влево и вправо',
    id: 'Gerakkan tangan ke kiri dan kanan',
  } as Str,
  cameraOff: {
    ko: '카메라를 사용할 수 없어요',
    en: 'The camera is unavailable',
    ja: 'カメラを使用できません',
    zh: '摄像头无法使用',
    vi: 'Không dùng được camera',
    th: 'ใช้กล้องไม่ได้',
    ru: 'Камера недоступна',
    id: 'Kamera tidak tersedia',
  } as Str,
  cameraOffSub: {
    ko: '터치로 즐기는 다른 게임을 해보세요',
    en: 'Try one of the touch games instead',
    ja: 'タッチで遊べる他のゲームをどうぞ',
    zh: '试试其他触屏游戏吧',
    vi: 'Hãy thử các trò chơi cảm ứng khác',
    th: 'ลองเกมแบบสัมผัสอื่นดูสิ',
    ru: 'Попробуйте игры с сенсорным экраном',
    id: 'Coba gim sentuh lainnya',
  } as Str,
  /** Monitor 2 has no touch — this points the visitor at the screen that does. */
  useTouchScreen: {
    ko: '아래 화면에서 조작해 주세요',
    en: 'Use the screen below',
    ja: '下の画面で操作してください',
    zh: '请使用下方屏幕操作',
    vi: 'Hãy dùng màn hình bên dưới',
    th: 'ใช้หน้าจอด้านล่าง',
    ru: 'Используйте нижний экран',
    id: 'Gunakan layar di bawah',
  } as Str,
  starting: {
    ko: '카메라를 준비하고 있어요…',
    en: 'Getting the camera ready…',
    ja: 'カメラを準備しています…',
    zh: '正在准备摄像头…',
    vi: 'Đang chuẩn bị camera…',
    th: 'กำลังเตรียมกล้อง…',
    ru: 'Готовим камеру…',
    id: 'Menyiapkan kamera…',
  } as Str,

  /** The remote's headline: the game is on the OTHER screen. */
  lookAtBigScreen: {
    ko: '위쪽 큰 화면을 봐주세요!',
    en: 'Look at the big screen above!',
    ja: '上の大きな画面を見てください！',
    zh: '请看上方大屏幕！',
    vi: 'Hãy nhìn màn hình lớn phía trên!',
    th: 'ดูที่จอใหญ่ด้านบน!',
    ru: 'Смотрите на большой экран сверху!',
    id: 'Lihat layar besar di atas!',
  } as Str,
  /** Offered mid-game when the photo lands — see MotionRemote. */
  keepPlaying: {
    ko: '계속 놀기',
    en: 'Keep playing',
    ja: '遊び続ける',
    zh: '继续玩',
    vi: 'Chơi tiếp',
    th: 'เล่นต่อ',
    ru: 'Продолжить игру',
    id: 'Lanjut main',
  } as Str,
  photoWaiting: {
    ko: '사진은 여기서 기다릴게요',
    en: 'Your photo will wait here',
    ja: '写真はここで待っています',
    zh: '照片会在这里等您',
    vi: 'Ảnh sẽ đợi bạn ở đây',
    th: 'ภาพจะรออยู่ตรงนี้',
    ru: 'Фото подождёт здесь',
    id: 'Foto Anda menunggu di sini',
  } as Str,

  /** The one control available while a motion game runs. */
  stopGame: {
    ko: '그만하기',
    en: 'Stop',
    ja: 'やめる',
    zh: '结束',
    vi: 'Dừng lại',
    th: 'หยุด',
    ru: 'Остановить',
    id: 'Berhenti',
  } as Str,

  // ── Catch ─────────────────────────────────────────────────────────────
  catchResult: {
    ko: '대단해요!',
    en: 'AMAZING!',
    ja: 'すごい！',
    zh: '太棒了！',
    vi: 'TUYỆT VỜI!',
    th: 'เยี่ยมมาก!',
    ru: 'ПОТРЯСАЮЩЕ!',
    id: 'LUAR BIASA!',
  } as Str,
  catchCount: {
    ko: '개의 감귤을 받았어요',
    en: 'tangerines caught',
    ja: '個のみかんをキャッチ',
    zh: '个柑橘已接住',
    vi: 'quả quýt đã hứng',
    th: 'ลูกที่รับได้',
    ru: 'мандаринов поймано',
    id: 'jeruk tertangkap',
  } as Str,
  tangerineMaster: {
    ko: '감귤 마스터',
    en: 'Tangerine Master',
    ja: 'みかんマスター',
    zh: '柑橘大师',
    vi: 'Bậc thầy hứng quýt',
    th: 'เจ้าแห่งส้ม',
    ru: 'Мастер мандаринов',
    id: 'Master Jeruk',
  } as Str,
} as const;
