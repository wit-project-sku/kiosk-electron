import type { Lang } from '@renderer/lib/i18n';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';

/**
 * Every user-visible string the app owns in CODE, in all eight kiosk languages.
 *
 * Copy that exists in a Localization sheet row belongs in the sheet — call
 * `t()`/`tPlain()` for those, so an operator can edit it without a release. This
 * file is only for strings with NO sheet row: error and empty states, loading
 * text, the MBTI panel, and a handful of labels the sheets never carried.
 *
 * WHY A SEPARATE FILE, AND WHY THIS TYPE: the same bug kept recurring — a screen
 * would declare `{ ko, en, ja, zh }` inline and every one of vi/th/ru/id would
 * silently fall back to Korean. `Record<LocalizedLang, string>` is NOT Partial,
 * so omitting a language is a COMPILE ERROR. Adding a ninth language to
 * `LANGUAGES` breaks this file until every entry is translated, which is the
 * point: the gap becomes loud instead of shipping as Korean.
 *
 * `{region}` in a value is substituted by the caller (see `uiParts`).
 */
const UI_TEXT = {
  // ── generic states ────────────────────────────────────────────────────
  comingSoon: {
    ko: '준비 중입니다',
    en: 'Coming soon',
    ja: '準備中です',
    zh: '敬请期待',
    vi: 'Sắp ra mắt',
    th: 'กำลังเตรียมการ',
    ru: 'Скоро открытие',
    id: 'Segera hadir',
  },
  backHome: {
    ko: '← 홈으로',
    en: '← Home',
    ja: '← ホームへ',
    zh: '← 返回主页',
    vi: '← Trang chủ',
    th: '← หน้าแรก',
    ru: '← На главную',
    id: '← Beranda',
  },
  // Accessible name for a bare camera button — used where the design draws a
  // glyph with no visible label (KADA's 한복 설명 capture button).
  takePhoto: {
    ko: '사진 촬영',
    en: 'Take photo',
    ja: '写真撮影',
    zh: '拍照',
    vi: 'Chụp ảnh',
    th: 'ถ่ายภาพ',
    ru: 'Сделать фото',
    id: 'Ambil foto',
  },
  loading: {
    ko: '불러오는 중..',
    en: 'Loading..',
    ja: '読み込み中..',
    zh: '加载中..',
    vi: 'Đang tải..',
    th: 'กำลังโหลด..',
    ru: 'Загрузка..',
    id: 'Memuat..',
  },
  noWebsite: {
    ko: '웹사이트 주소가 설정되지 않았습니다',
    en: 'No website address is configured',
    ja: 'ウェブサイトのアドレスが設定されていません',
    zh: '未设置网站地址',
    vi: 'Chưa thiết lập địa chỉ trang web',
    th: 'ยังไม่ได้ตั้งค่าที่อยู่เว็บไซต์',
    ru: 'Адрес сайта не настроен',
    id: 'Alamat situs web belum diatur',
  },

  // ── 이벤트 (events list + detail) ──────────────────────────────────────
  eventsLoadFailed: {
    ko: '이벤트를 불러오지 못했습니다.',
    en: 'Could not load events.',
    ja: 'イベントを読み込めませんでした。',
    zh: '无法加载活动。',
    vi: 'Không thể tải sự kiện.',
    th: 'ไม่สามารถโหลดกิจกรรมได้',
    ru: 'Не удалось загрузить события.',
    id: 'Tidak dapat memuat acara.',
  },
  eventsEmpty: {
    ko: '등록된 이벤트가 없습니다.',
    en: 'No events registered.',
    ja: '登録されたイベントがありません。',
    zh: '暂无已登记的活动。',
    vi: 'Chưa có sự kiện nào.',
    th: 'ยังไม่มีกิจกรรมที่ลงทะเบียน',
    ru: 'Событий не найдено.',
    id: 'Belum ada acara terdaftar.',
  },
  eventDetailFailed: {
    ko: '이벤트 정보를 불러오지 못했습니다.',
    en: 'Could not load event details.',
    ja: 'イベント情報を読み込めませんでした。',
    zh: '无法加载活动信息。',
    vi: 'Không thể tải thông tin sự kiện.',
    th: 'ไม่สามารถโหลดข้อมูลกิจกรรมได้',
    ru: 'Не удалось загрузить информацию о событии.',
    id: 'Tidak dapat memuat informasi acara.',
  },
  directions: {
    ko: '오시는 길 안내',
    en: 'Directions',
    ja: 'アクセス案内',
    zh: '交通指引',
    vi: 'Chỉ đường',
    th: 'การเดินทาง',
    ru: 'Как добраться',
    id: 'Petunjuk arah',
  },
  // The six fixed info rows of the event-detail card (Figma spec).
  eventPlace: { ko: '장소', en: 'Venue', ja: '場所', zh: '地点', vi: 'Địa điểm', th: 'สถานที่', ru: 'Место', id: 'Lokasi' },
  eventPeriod: { ko: '기간', en: 'Period', ja: '期間', zh: '期间', vi: 'Thời gian', th: 'ระยะเวลา', ru: 'Период', id: 'Periode' },
  eventTarget: { ko: '모집대상', en: 'Who can join', ja: '募集対象', zh: '招募对象', vi: 'Đối tượng', th: 'กลุ่มเป้าหมาย', ru: 'Для кого', id: 'Peserta' },
  eventPrice: { ko: '기본가', en: 'Price', ja: '基本料金', zh: '基本价格', vi: 'Giá cơ bản', th: 'ราคาเริ่มต้น', ru: 'Цена', id: 'Harga dasar' },
  eventInquiry: { ko: '문의', en: 'Contact', ja: 'お問い合わせ', zh: '咨询', vi: 'Liên hệ', th: 'ติดต่อสอบถาม', ru: 'Контакты', id: 'Kontak' },
  eventNotes: { ko: '비고', en: 'Notes', ja: '備考', zh: '备注', vi: 'Ghi chú', th: 'หมายเหตุ', ru: 'Примечание', id: 'Catatan' },
  noMapInfo: {
    ko: '지도 정보가 없습니다.',
    en: 'No map information.',
    ja: '地図情報がありません。',
    zh: '暂无地图信息。',
    vi: 'Không có thông tin bản đồ.',
    th: 'ไม่มีข้อมูลแผนที่',
    ru: 'Нет данных карты.',
    id: 'Tidak ada informasi peta.',
  },

  // ── MBTI 추천 패널 (이벤트 화면) ───────────────────────────────────────
  mbtiSubmit: {
    ko: '추천 결과 보기',
    en: 'See recommendations',
    ja: 'おすすめを見る',
    zh: '查看推荐结果',
    vi: 'Xem gợi ý',
    th: 'ดูผลลัพธ์แนะนำ',
    ru: 'Показать рекомендации',
    id: 'Lihat rekomendasi',
  },
  mbtiLoading: {
    ko: '결과 로딩중..',
    en: 'Loading results..',
    ja: '結果を読み込み中..',
    zh: '结果加载中..',
    vi: 'Đang tải kết quả..',
    th: 'กำลังโหลดผลลัพธ์..',
    ru: 'Загрузка результатов..',
    id: 'Memuat hasil..',
  },
  /** `{region}` = the localized "<region> 이벤트" phrase, rendered accented. */
  mbtiIntro: {
    ko: 'MBTI 성향과 취향을 반영해 {region}를 맞춤 추천해드립니다!',
    en: 'We recommend {region} tailored to your MBTI type and tastes!',
    ja: 'MBTIの傾向と好みに合わせて{region}をおすすめします！',
    zh: '根据您的MBTI性格和喜好，为您推荐{region}！',
    vi: 'Chúng tôi gợi ý {region} phù hợp với MBTI và sở thích của bạn!',
    th: 'เราแนะนำ{region}ให้เหมาะกับบุคลิก MBTI และความชอบของคุณ!',
    ru: 'Мы подберём {region} по вашему типу MBTI и предпочтениям!',
    id: 'Kami merekomendasikan {region} sesuai tipe MBTI dan selera Anda!',
  },
  mbtiHint: {
    ko: 'MBTI 4가지 유형을 전부 선택하지 않아도\n나만의 추천 결과를 받아볼 수 있어요!',
    en: 'You can still get your own recommendations\nwithout picking all four MBTI axes!',
    ja: 'MBTIの4つのタイプをすべて選ばなくても\nあなただけのおすすめを受け取れます！',
    zh: '即使不选择全部四个MBTI维度，\n也能获得专属推荐！',
    vi: 'Bạn vẫn nhận được gợi ý riêng\ndù không chọn đủ cả 4 nhóm MBTI!',
    th: 'แม้ไม่เลือกครบทั้ง 4 ด้านของ MBTI\nคุณก็ยังรับผลแนะนำเฉพาะคุณได้!',
    ru: 'Вы получите свои рекомендации,\nдаже если выберете не все четыре шкалы MBTI!',
    id: 'Anda tetap bisa mendapat rekomendasi\nmeski tidak memilih keempat sumbu MBTI!',
  },
  mbtiE: { ko: '외향적', en: 'Extroverted', ja: '外向的', zh: '外向', vi: 'Hướng ngoại', th: 'เปิดเผย', ru: 'Экстраверт', id: 'Ekstrovert' },
  mbtiI: { ko: '내향적', en: 'Introverted', ja: '内向的', zh: '内向', vi: 'Hướng nội', th: 'เก็บตัว', ru: 'Интроверт', id: 'Introvert' },
  mbtiS: { ko: '경험적', en: 'Sensing', ja: '現実的', zh: '现实', vi: 'Thực tế', th: 'อิงประสบการณ์', ru: 'Сенсорик', id: 'Penginderaan' },
  mbtiN: { ko: '상상적', en: 'Intuitive', ja: '直感的', zh: '直觉', vi: 'Trực giác', th: 'ใช้สัญชาตญาณ', ru: 'Интуит', id: 'Intuitif' },
  mbtiT: { ko: '이성적', en: 'Thinking', ja: '論理的', zh: '理性', vi: 'Lý trí', th: 'ใช้เหตุผล', ru: 'Логик', id: 'Berpikir' },
  mbtiF: { ko: '감성적', en: 'Feeling', ja: '感情的', zh: '感性', vi: 'Cảm xúc', th: 'ใช้ความรู้สึก', ru: 'Этик', id: 'Perasa' },
  mbtiJ: { ko: '계획적', en: 'Judging', ja: '計画的', zh: '计划', vi: 'Có kế hoạch', th: 'วางแผน', ru: 'Планирующий', id: 'Terencana' },
  mbtiP: { ko: '즉흥적', en: 'Perceiving', ja: '柔軟型', zh: '随性', vi: 'Linh hoạt', th: 'ยืดหยุ่น', ru: 'Спонтанный', id: 'Spontan' },
  viewOnMobile: {
    ko: '모바일에서 확인하기',
    en: 'View on mobile',
    ja: 'スマホで見る',
    zh: '在手机上查看',
    vi: 'Xem trên điện thoại',
    th: 'ดูบนมือถือ',
    ru: 'Открыть на телефоне',
    id: 'Lihat di ponsel',
  },
  noRecommendations: {
    ko: '추천 결과가 없습니다.',
    en: 'No recommendations found.',
    ja: 'おすすめ結果がありません。',
    zh: '没有推荐结果。',
    vi: 'Không có kết quả gợi ý.',
    th: 'ไม่พบผลลัพธ์แนะนำ',
    ru: 'Рекомендаций не найдено.',
    id: 'Tidak ada rekomendasi.',
  },
  qrAlign: {
    ko: 'QR코드를 화면에 맞춰주세요.',
    en: 'Align the QR code with the screen.',
    ja: 'QRコードを画面に合わせてください。',
    zh: '请将二维码对准屏幕。',
    vi: 'Hãy căn mã QR vào màn hình.',
    th: 'กรุณาจัดคิวอาร์โค้ดให้ตรงกับหน้าจอ',
    ru: 'Наведите QR-код на экран.',
    id: 'Sejajarkan kode QR dengan layar.',
  },

  // ── 화성휴게소 ────────────────────────────────────────────────────────
  hwaseongFloorPlan: {
    ko: '화성휴게소 배치도',
    en: 'Hwaseong SA floor plan',
    ja: '華城SA配置図',
    zh: '华城休息站平面图',
    vi: 'Sơ đồ trạm dừng Hwaseong',
    th: 'ผังจุดพักรถฮวาซอง',
    ru: 'План зоны отдыха Хвасон',
    id: 'Denah rest area Hwaseong',
  },
  hwaseongMapSubtitle: {
    ko: '화성휴게소: 먹거리랑 지역 특색 체험까지 가능한 작은 복합공간',
    en: 'Hwaseong SA: a compact complex for food and local specialties',
    ja: '華城SA：グルメから地域の特色体験まで楽しめる小さな複合空間',
    zh: '华城休息站：可以体验美食和地方特色的小型综合空间',
    vi: 'Trạm dừng Hwaseong: không gian phức hợp nhỏ với ẩm thực và đặc sản địa phương',
    th: 'จุดพักรถฮวาซอง: พื้นที่รวมขนาดเล็กที่มีทั้งของกินและของขึ้นชื่อประจำถิ่น',
    ru: 'Зона отдыха Хвасон: компактное пространство с едой и местными деликатесами',
    id: 'Rest area Hwaseong: ruang komplek kecil dengan kuliner dan produk khas daerah',
  },
  /** Appended after a number, hence the leading space on the Latin forms. */
  won: {
    ko: '원',
    en: ' KRW',
    ja: 'ウォン',
    zh: '韩元',
    vi: ' KRW',
    th: ' วอน',
    ru: ' вон',
    id: ' KRW',
  },
  /** Generic fallbacks for the AR-한복 nav buttons. Insadong/오색시장 have
   *  location-specific sheet rows (MainButton_Map / MainButton_WC); 화성휴게소
   *  has neither, and this screen is shared, so `t()` alone would print the raw
   *  key there. Callers read the sheet first and fall back to these. */
  navMap: { ko: '지도', en: 'Map', ja: '地図', zh: '地图', vi: 'Bản đồ', th: 'แผนที่', ru: 'Карта', id: 'Peta' },
  navRestroom: { ko: '화장실', en: 'Restroom', ja: 'トイレ', zh: '洗手间', vi: 'Nhà vệ sinh', th: 'ห้องน้ำ', ru: 'Туалет', id: 'Toilet' },
  blogReviews: {
    ko: '블로그 리뷰',
    en: 'Blog Reviews',
    ja: 'ブログレビュー',
    zh: '博客评价',
    vi: 'Đánh giá blog',
    th: 'รีวิวบล็อก',
    ru: 'Отзывы в блогах',
    id: 'Ulasan blog',
  },

  // ── 위드마켓 ──────────────────────────────────────────────────────────
  marketComingSoon: {
    ko: '위드마켓 준비 중',
    en: 'With Market coming soon',
    ja: 'ウィズマーケット準備中',
    zh: 'With市场敬请期待',
    vi: 'With Market sắp ra mắt',
    th: 'วิธมาร์เก็ตกำลังเตรียมการ',
    ru: 'With Market скоро',
    id: 'With Market segera hadir',
  },
  withMarketSubtitle: {
    ko: '오직 현장에서만 할인받을 수 있는 상품들을 확인해보세요!',
    en: 'Check out the products available at a discount only here, on-site!',
    ja: '現場でしか割引を受けられない商品をぜひチェックしてください！',
    zh: '快来看看只有在现场才能享受折扣的商品吧！',
    vi: 'Khám phá những sản phẩm chỉ được giảm giá tại chỗ!',
    th: 'มาดูสินค้าที่ลดราคาเฉพาะที่หน้างานเท่านั้น!',
    ru: 'Посмотрите товары со скидкой, доступной только здесь!',
    id: 'Lihat produk yang diskonnya hanya tersedia di lokasi!',
  },
} satisfies Record<string, Record<LocalizedLang, string>>;

export type UiTextKey = keyof typeof UI_TEXT;

/** Localized code-owned string. Always defined — the type guarantees all 8. */
export function ui(key: UiTextKey, lang: Lang): string {
  return UI_TEXT[key][toLocalizedLang(lang)];
}

/**
 * Split a `{region}`-style template into [before, after] so the caller can wrap
 * the substituted value in its own element (the MBTI line accents the region).
 * Falls back to [whole, ''] if a translation forgot the placeholder.
 */
export function uiParts(key: UiTextKey, lang: Lang, token = '{region}'): [string, string] {
  const s = ui(key, lang);
  const i = s.indexOf(token);
  return i < 0 ? [s, ''] : [s.slice(0, i), s.slice(i + token.length)];
}
