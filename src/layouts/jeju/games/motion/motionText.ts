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
    ko: '브이(✌️)는 점프, 주먹(✊)은 숙이기!',
    en: 'V-sign to jump, fist to duck!',
    ja: 'ピースでジャンプ、グーでしゃがむ！',
    zh: '比耶跳跃，握拳低头！',
    vi: 'Giơ chữ V để nhảy, nắm tay để cúi!',
    th: 'ชูสองนิ้วเพื่อกระโดด กำมือเพื่อหมอบ!',
    ru: 'Знак V — прыжок, кулак — пригнуться!',
    id: 'Tanda V untuk lompat, kepal untuk menunduk!',
  } as Str,
  runHowTo: {
    ko: '브이(✌️)는 점프, 주먹(✊)은 숙여요',
    en: 'V-sign to jump, fist to duck',
    ja: 'ピースでジャンプ、グーでしゃがむ',
    zh: '比耶跳跃，握拳低头',
    vi: 'Chữ V để nhảy, nắm tay để cúi',
    th: 'ชูสองนิ้วกระโดด กำมือหมอบ',
    ru: 'Знак V — прыжок, кулак — пригнуться',
    id: 'Tanda V lompat, kepal menunduk',
  } as Str,
  /**
   * The countdown's one line, for the run: get an open hand in front of the
   * camera — the resting shape the run starts from. Nothing needs holding still:
   * a hand plays by shape, so no baseline is measured.
   */
  runHoldStill: {
    ko: '손바닥을 펴서 카메라에 보여주세요',
    en: 'Show your open hand to the camera',
    ja: '手のひらを開いてカメラに見せてね',
    zh: '张开手掌对着摄像头',
    vi: 'Xòe bàn tay về phía camera',
    th: 'แบมือให้กล้องเห็น',
    ru: 'Покажите камере открытую ладонь',
    id: 'Tunjukkan telapak tangan terbuka ke kamera',
  } as Str,

  // ── Practice run ──────────────────────────────────────────────────────
  // One move at a time, on an empty track. See RunTutorial in useJejuRun.
  tutJump: {
    ko: '브이(✌️)를 만들어보세요!',
    en: 'Make a V-sign!',
    ja: 'ピースをしてみて！',
    zh: '比个耶！',
    vi: 'Giơ ngón tay chữ V nào!',
    th: 'ชูสองนิ้วดูสิ!',
    ru: 'Покажите знак V!',
    id: 'Buat tanda V!',
  } as Str,
  tutJumpSub: {
    ko: '브이를 하면 점프해요',
    en: 'V-sign = jump',
    ja: 'ピースでジャンプ',
    zh: '比耶 = 跳跃',
    vi: 'Chữ V = nhảy',
    th: 'ชูสองนิ้ว = กระโดด',
    ru: 'Знак V = прыжок',
    id: 'Tanda V = lompat',
  } as Str,
  tutDuck: {
    ko: '이번엔 주먹을 꽉 쥐어보세요!',
    en: 'Now make a fist!',
    ja: '今度はグーをにぎってみて！',
    zh: '现在握紧拳头！',
    vi: 'Giờ hãy nắm chặt tay lại!',
    th: 'คราวนี้กำมือแน่นๆ!',
    ru: 'Теперь сожмите кулак!',
    id: 'Sekarang kepalkan tangan!',
  } as Str,
  tutDuckSub: {
    ko: '주먹을 쥐고 있으면 숙여요',
    en: 'Fist = duck',
    ja: 'グーでしゃがむ',
    zh: '握拳 = 低头',
    vi: 'Nắm tay = cúi người',
    th: 'กำมือ = หมอบ',
    ru: 'Кулак = пригнуться',
    id: 'Kepal = menunduk',
  } as Str,
  /**
   * Said with the praise after the first duck. Without it a visitor who has just
   * been told "good" keeps the fist closed, stays crouched, and wonders why the
   * game will not carry on.
   */
  tutDuckRelease: {
    ko: '손을 다시 펴면 일어나요',
    en: 'Open your hand to stand up',
    ja: '手を開くと立ち上がります',
    zh: '张开手就会站起来',
    vi: 'Mở tay ra để đứng dậy',
    th: 'แบมือเพื่อลุกขึ้น',
    ru: 'Разожмите руку, чтобы встать',
    id: 'Buka tangan untuk berdiri',
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
    ko: '돌은 브이 ✌️  갈매기는 주먹 ✊',
    en: 'Rocks: V-sign ✌️  Gulls: fist ✊',
    ja: '石はピース ✌️  カモメはグー ✊',
    zh: '石头：比耶 ✌️  海鸥：握拳 ✊',
    vi: 'Đá: chữ V ✌️  Chim: nắm tay ✊',
    th: 'หิน: ชูสองนิ้ว ✌️  นก: กำมือ ✊',
    ru: 'Камни: знак V ✌️  Чайки: кулак ✊',
    id: 'Batu: tanda V ✌️  Camar: kepal ✊',
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
    ko: '카메라가 본 내 손',
    en: 'What the camera sees',
    ja: 'カメラが見た手',
    zh: '摄像头看到的手势',
    vi: 'Camera đang thấy',
    th: 'สิ่งที่กล้องเห็น',
    ru: 'Что видит камера',
    id: 'Yang dilihat kamera',
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

  /** The remote's status line while the hand is being tracked normally. */
  handTracked: {
    ko: '손을 인식하고 있어요',
    en: 'Your hand is being tracked',
    ja: '手を認識しています',
    zh: '正在识别你的手',
    vi: 'Đang nhận diện tay của bạn',
    th: 'กำลังจับมือของคุณ',
    ru: 'Рука распознана',
    id: 'Tangan Anda terdeteksi',
  } as Str,
  /** The remote's controls legend heading. */
  controls: {
    ko: '조작 방법',
    en: 'Controls',
    ja: '操作方法',
    zh: '操作方式',
    vi: 'Cách điều khiển',
    th: 'วิธีควบคุม',
    ru: 'Управление',
    id: 'Kontrol',
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
