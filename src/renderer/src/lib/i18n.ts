import type { SupportedLanguage } from '@shared/types/kiosk';
import { useLanguageStore } from '@renderer/store/languageStore';
import { hasLoc, t, tExact } from '@renderer/lib/loc';

export type Lang = SupportedLanguage;

/** Pick the value for the active language, falling back to Korean. */
export function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

/** Hook: current UI language. */
export function useLang(): Lang {
  return useLanguageStore((s) => s.currentLanguage);
}

/** Category labels (food / shopping / lodging tabs) keyed by their Korean id. */
const CATEGORY_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  // 뭐먹지
  한식: { en: 'Korean', ja: '韓国料理', zh: '韩餐', vi: 'Món Hàn', th: 'อาหารเกาหลี', ru: 'Корейская кухня', id: 'Masakan Korea' },
  한정식: { en: 'Korean course', ja: '韓定食', zh: '韩定食', vi: 'Cỗ Hàn Quốc', th: 'อาหารชุดเกาหลี', ru: 'Корейский сет', id: 'Set Korea' },
  바베큐: { en: 'BBQ', ja: 'バーベキュー', zh: '烧烤', vi: 'Đồ nướng', th: 'บาร์บีคิว', ru: 'Барбекю', id: 'Barbeku' },
  분식: { en: 'Snacks', ja: '粉食', zh: '小吃', vi: 'Đồ ăn vặt', th: 'อาหารว่าง', ru: 'Закуски', id: 'Jajanan' },
  사찰음식: { en: 'Temple food', ja: '精進料理', zh: '寺院料理', vi: 'Ẩm thực chùa', th: 'อาหารวัด', ru: 'Храмовая кухня', id: 'Makanan kuil' },
  먹거리: { en: 'Street Food', ja: '軽食', zh: '小吃', vi: 'Ẩm thực đường phố', th: 'อาหารริมทาง', ru: 'Уличная еда', id: 'Makanan jalanan' },
  특산품: { en: 'Specialties', ja: '特産品', zh: '特产', vi: 'Đặc sản', th: 'ของขึ้นชื่อ', ru: 'Деликатесы', id: 'Produk khas' },
  샐러드샵: { en: 'Salad', ja: 'サラダ', zh: '沙拉', vi: 'Salad', th: 'สลัด', ru: 'Салат', id: 'Salad' },
  '채식·비건': { en: 'Vegan', ja: 'ビーガン', zh: '素食', vi: 'Món chay', th: 'มังสวิรัติ', ru: 'Веган', id: 'Vegan' },
  '아시안·중식': { en: 'Asian·Chinese', ja: 'アジア・中華', zh: '亚洲·中餐', vi: 'Món Á·Trung', th: 'อาหารเอเชีย·จีน', ru: 'Азиатская·Китайская', id: 'Asia·Tionghoa' },
  전통차: { en: 'Tea house', ja: '伝統茶', zh: '传统茶', vi: 'Trà truyền thống', th: 'ชาโบราณ', ru: 'Чайхана', id: 'Kedai teh' },
  카페: { en: 'Café', ja: 'カフェ', zh: '咖啡', vi: 'Cà phê', th: 'คาเฟ่', ru: 'Кафе', id: 'Kafe' },
  // 뭐사지
  의류: { en: 'Clothing', ja: '衣類', zh: '服装', vi: 'Quần áo', th: 'เสื้อผ้า', ru: 'Одежда', id: 'Pakaian' },
  공예품: { en: 'Crafts', ja: '工芸品', zh: '工艺品', vi: 'Đồ thủ công', th: 'งานหัตถกรรม', ru: 'Ремёсла', id: 'Kerajinan' },
  수제도장: { en: 'Stamps', ja: '手作りはんこ', zh: '手工印章', vi: 'Con dấu thủ công', th: 'ตราประทับทำมือ', ru: 'Печати ручной работы', id: 'Stempel buatan tangan' },
  엔틱: { en: 'Antiques', ja: 'アンティーク', zh: '古董', vi: 'Đồ cổ', th: 'ของโบราณ', ru: 'Антиквариат', id: 'Antik' },
  화방: { en: 'Art supplies', ja: '画材店', zh: '画材店', vi: 'Dụng cụ mỹ thuật', th: 'อุปกรณ์ศิลปะ', ru: 'Товары для художников', id: 'Perlengkapan seni' },
  한복: { en: 'Hanbok', ja: '韓服', zh: '韩服', vi: 'Hanbok', th: 'ฮันบก', ru: 'Ханбок', id: 'Hanbok' },
  잡화: { en: 'Goods', ja: '雑貨', zh: '杂货', vi: 'Tạp hóa', th: 'สินค้าเบ็ดเตล็ด', ru: 'Разные товары', id: 'Aneka barang' },
  '표구·액자': { en: 'Framing', ja: '額装', zh: '装裱·画框', vi: 'Đóng khung', th: 'กรอบรูป', ru: 'Багетные работы', id: 'Bingkai' },
  기념품: { en: 'Souvenirs', ja: 'お土産', zh: '纪念品', vi: 'Quà lưu niệm', th: 'ของที่ระลึก', ru: 'Сувениры', id: 'Suvenir' },
  // 숙박
  호텔: { en: 'Hotel', ja: 'ホテル', zh: '酒店', vi: 'Khách sạn', th: 'โรงแรม', ru: 'Отель', id: 'Hotel' },
  호스텔: { en: 'Hostel', ja: 'ホステル', zh: '旅舍', vi: 'Nhà nghỉ', th: 'โฮสเทล', ru: 'Хостел', id: 'Hostel' },
  게스트하우스: { en: 'Guesthouse', ja: 'ゲストハウス', zh: '民宿', vi: 'Nhà khách', th: 'เกสต์เฮาส์', ru: 'Гостевой дом', id: 'Wisma' },
  // 미술관
  고미술: { en: 'Antique Art', ja: '古美術', zh: '古美术', vi: 'Mỹ thuật cổ', th: 'ศิลปะโบราณ', ru: 'Антикварное искусство', id: 'Seni antik' },
  화랑: { en: 'Gallery', ja: '画廊', zh: '画廊', vi: 'Phòng tranh', th: 'หอศิลป์', ru: 'Галерея', id: 'Galeri' },
  표구: { en: 'Framing', ja: '表具', zh: '裱框', vi: 'Bồi tranh', th: 'การใส่กรอบ', ru: 'Оформление картин', id: 'Pembingkaian' },
  전시관: { en: 'Exhibition', ja: '展示館', zh: '展览馆', vi: 'Nhà triển lãm', th: 'ห้องจัดแสดง', ru: 'Выставочный зал', id: 'Ruang pameran' },
  역사유적지: { en: 'Historic Site', ja: '史跡', zh: '历史遗跡', vi: 'Di tích lịch sử', th: 'แหล่งประวัติศาสตร์', ru: 'Историческое место', id: 'Situs bersejarah' },
  // shared
  기타: { en: 'Other', ja: 'その他', zh: '其他', vi: 'Khác', th: 'อื่นๆ', ru: 'Другое', id: 'Lainnya' },
};

/** Localized category label, falling back to the Korean id. */
export function catLabel(id: string, lang: Lang): string {
  return CATEGORY_LABELS[id]?.[lang] ?? id;
}

/** Korean province / metro names → other languages (전국 filter tabs, regions).
 *  Both the bare metro name ("서울") and full province name are keyed so the
 *  markets sheet's province values resolve either way. */
const PROVINCE_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  // 도 (provinces) — vi/id keep the standard romanization; th/ru transliterate.
  경기도: { en: 'Gyeonggi-do', ja: '京畿道', zh: '京畿道', vi: 'Gyeonggi-do', th: 'คยองกีโด', ru: 'Кёнгидо', id: 'Gyeonggi-do' },
  강원도: { en: 'Gangwon-do', ja: '江原道', zh: '江原道', vi: 'Gangwon-do', th: 'คังวอนโด', ru: 'Канвондо', id: 'Gangwon-do' },
  충청북도: { en: 'Chungcheongbuk-do', ja: '忠清北道', zh: '忠清北道', vi: 'Chungcheongbuk-do', th: 'ชุงช็องบุกโด', ru: 'Чхунчхон-Пукто', id: 'Chungcheongbuk-do' },
  충청남도: { en: 'Chungcheongnam-do', ja: '忠清南道', zh: '忠清南道', vi: 'Chungcheongnam-do', th: 'ชุงช็องนัมโด', ru: 'Чхунчхон-Намдо', id: 'Chungcheongnam-do' },
  경상북도: { en: 'Gyeongsangbuk-do', ja: '慶尚北道', zh: '庆尚北道', vi: 'Gyeongsangbuk-do', th: 'คย็องซังบุกโด', ru: 'Кёнсан-Пукто', id: 'Gyeongsangbuk-do' },
  경상남도: { en: 'Gyeongsangnam-do', ja: '慶尚南道', zh: '庆尚南道', vi: 'Gyeongsangnam-do', th: 'คย็องซังนัมโด', ru: 'Кёнсан-Намдо', id: 'Gyeongsangnam-do' },
  전라북도: { en: 'Jeollabuk-do', ja: '全羅北道', zh: '全罗北道', vi: 'Jeollabuk-do', th: 'ช็อลลาบุกโด', ru: 'Чолла-Пукто', id: 'Jeollabuk-do' },
  전라남도: { en: 'Jeollanam-do', ja: '全羅南道', zh: '全罗南道', vi: 'Jeollanam-do', th: 'ช็อลลานัมโด', ru: 'Чолла-Намдо', id: 'Jeollanam-do' },
  제주도: { en: 'Jeju-do', ja: '済州島', zh: '济州岛', vi: 'Jeju-do', th: 'เชจูโด', ru: 'Чеджудо', id: 'Jeju-do' },
  // 시 (metros / cities)
  서울시: { en: 'Seoul', ja: 'ソウル', zh: '首尔', vi: 'Seoul', th: 'โซล', ru: 'Сеул', id: 'Seoul' },
  서울: { en: 'Seoul', ja: 'ソウル', zh: '首尔', vi: 'Seoul', th: 'โซล', ru: 'Сеул', id: 'Seoul' },
  인천: { en: 'Incheon', ja: '仁川', zh: '仁川', vi: 'Incheon', th: 'อินช็อน', ru: 'Инчхон', id: 'Incheon' },
  대전: { en: 'Daejeon', ja: '大田', zh: '大田', vi: 'Daejeon', th: 'แทจ็อน', ru: 'Тэджон', id: 'Daejeon' },
  대구: { en: 'Daegu', ja: '大邱', zh: '大邱', vi: 'Daegu', th: 'แทกู', ru: 'Тэгу', id: 'Daegu' },
  부산: { en: 'Busan', ja: '釜山', zh: '釜山', vi: 'Busan', th: 'ปูซาน', ru: 'Пусан', id: 'Busan' },
  세종: { en: 'Sejong', ja: '世宗', zh: '世宗', vi: 'Sejong', th: 'เซจง', ru: 'Седжон', id: 'Sejong' },
  광주: { en: 'Gwangju', ja: '光州', zh: '光州', vi: 'Gwangju', th: 'ควังจู', ru: 'Кванджу', id: 'Gwangju' },
  울산: { en: 'Ulsan', ja: '蔚山', zh: '蔚山', vi: 'Ulsan', th: 'อุลซัน', ru: 'Ульсан', id: 'Ulsan' },
};

/** Localized province / metro name, falling back to the Korean id. */
export function provinceLabel(id: string, lang: Lang): string {
  return PROVINCE_LABELS[id]?.[lang] ?? id;
}

/** Korean facility-category names (도와줘 휴 filter tabs + card chips). */
const FACILITY_LABELS: Record<string, Partial<Record<Lang, string>>> = {
  상인회: { en: 'All', ja: 'すべて', zh: '全部', vi: 'Tất cả', th: 'ทั้งหมด', ru: 'Все', id: 'Semua' },
  편의점: { en: 'Convenience', ja: 'コンビニ', zh: '便利店', vi: 'Cửa hàng tiện lợi', th: 'ร้านสะดวกซื้อ', ru: 'Магазин', id: 'Minimarket' },
  병원: { en: 'Hospital', ja: '病院', zh: '医院', vi: 'Bệnh viện', th: 'โรงพยาบาล', ru: 'Больница', id: 'Rumah sakit' },
  약국: { en: 'Pharmacy', ja: '薬局', zh: '药店', vi: 'Nhà thuốc', th: 'ร้านขายยา', ru: 'Аптека', id: 'Apotek' },
  은행: { en: 'Bank', ja: '銀行', zh: '银行', vi: 'Ngân hàng', th: 'ธนาคาร', ru: 'Банк', id: 'Bank' },
  환전소: { en: 'Exchange', ja: '両替所', zh: '货币兑换', vi: 'Đổi tiền', th: 'แลกเงิน', ru: 'Обмен валюты', id: 'Penukaran uang' },
  종교: { en: 'Religion', ja: '宗教', zh: '宗教', vi: 'Tôn giáo', th: 'ศาสนา', ru: 'Религия', id: 'Agama' },
  화장실: { en: 'Restroom', ja: 'トイレ', zh: '洗手间', vi: 'Nhà vệ sinh', th: 'ห้องน้ำ', ru: 'Туалет', id: 'Toilet' },
  흡연실: { en: 'Smoking', ja: '喫煙室', zh: '吸烟室', vi: 'Phòng hút thuốc', th: 'ห้องสูบบุหรี่', ru: 'Курительная', id: 'Ruang merokok' },
  기타: { en: 'Other', ja: 'その他', zh: '其他', vi: 'Khác', th: 'อื่นๆ', ru: 'Другое', id: 'Lainnya' },
};

/** Localized facility-category name, falling back to the Korean id. */
export function facilityLabel(id: string, lang: Lang): string {
  return FACILITY_LABELS[id]?.[lang] ?? id;
}

/**
 * Page-header titles keyed by their Korean string (the id passed to
 * InsadongHeader). Pages keep passing the Korean title; the header localizes it.
 * Unknown / already-localized strings fall through unchanged.
 */
const SCREEN_TITLES: Record<string, Partial<Record<Lang, string>>> = {
  '여기는 인사동': { en: 'Here is Insadong', ja: 'ここは仁寺洞', zh: '这里是仁寺洞', vi: 'Đây là Insadong', th: 'ที่นี่คืออินซาดง', ru: 'Это Инсадон', id: 'Ini Insadong' },
  '‘인사’ 뭐하지 (AI 검색)': { en: 'What to Do (AI Search)', ja: '何しよう (AI検索)', zh: '做什么 (AI搜索)', vi: 'Làm gì (Tìm kiếm AI)', th: 'ทำอะไรดี (ค้นหา AI)', ru: 'Чем заняться (AI-поиск)', id: 'Mau apa (Pencarian AI)' },
  환율: { en: 'Exchange Rate', ja: '為替レート', zh: '汇率', vi: 'Tỷ giá', th: 'อัตราแลกเปลี่ยน', ru: 'Курс валют', id: 'Nilai tukar' },
  '도와줘 ‘인사’': { en: 'Help', ja: 'ヘルプ', zh: '帮助', vi: 'Trợ giúp', th: 'ช่วยเหลือ', ru: 'Помощь', id: 'Bantuan' },
  '인사 미술관': { en: 'Insa Gallery', ja: '仁寺美術館', zh: '仁寺美术馆', vi: 'Bảo tàng Insa', th: 'หอศิลป์อินซา', ru: 'Галерея Инса', id: 'Galeri Insa' },
  "'인사' 뭐먹지": { en: 'What to Eat', ja: '何を食べる', zh: '吃什么', vi: 'Ăn gì', th: 'กินอะไรดี', ru: 'Что поесть', id: 'Mau makan apa' },
  "'인사' 뭐사지": { en: 'What to Buy', ja: '何を買う', zh: '买什么', vi: 'Mua gì', th: 'ซื้ออะไรดี', ru: 'Что купить', id: 'Mau beli apa' },
  숙박안내: { en: 'Lodging', ja: '宿泊案内', zh: '住宿指南', vi: 'Lưu trú', th: 'ที่พัก', ru: 'Проживание', id: 'Penginapan' },
  고궁안내: { en: 'Royal Palaces', ja: '古宮案内', zh: '古宫指南', vi: 'Cung điện', th: 'พระราชวัง', ru: 'Дворцы', id: 'Istana' },
  언어선택: { en: 'Language', ja: '言語選択', zh: '语言选择', vi: 'Ngôn ngữ', th: 'เลือกภาษา', ru: 'Язык', id: 'Bahasa' },
  검색: { en: 'Search', ja: '検索', zh: '搜索', vi: 'Tìm kiếm', th: 'ค้นหา', ru: 'Поиск', id: 'Cari' },
  '교통 안내': { en: 'Transportation', ja: '交通案内', zh: '交通指南', vi: 'Giao thông', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi' },
  위드마켓: { en: 'With Market', ja: 'ウィズマーケット', zh: 'With市场', vi: 'With Market', th: 'วิธมาร์เก็ต', ru: 'With Market', id: 'With Market' },
  'AR 한복체험': { en: 'AR Hanbok', ja: 'AR韓服体験', zh: 'AR韩服体验', vi: 'Trải nghiệm Hanbok AR', th: 'ประสบการณ์ฮันบก AR', ru: 'AR-ханбок', id: 'Pengalaman Hanbok AR' },
  화장실: { en: 'Restroom', ja: 'トイレ', zh: '洗手间', vi: 'Nhà vệ sinh', th: 'ห้องน้ำ', ru: 'Туалет', id: 'Toilet' },
  상세: { en: 'Details', ja: '詳細', zh: '详情', vi: 'Chi tiết', th: 'รายละเอียด', ru: 'Подробнее', id: 'Detail' },
};

/**
 * Korean header-title id → sheet localization keys (title + optional subtitle).
 * Lets the header pull both from Localization_Insa; ids without a key fall back
 * to the hand-written SCREEN_TITLES above / the localized page-description.
 */
const TITLE_KEYS: Record<string, { title: string; sub?: string }> = {
  '여기는 인사동': { title: 'MainButton_Here', sub: 'SubHeader_Attraction' },
  'TAX - FREE': { title: 'MainButton_TaxFree', sub: 'SubHeader_TaxFree' },
  '‘인사’ 뭐하지 (AI 검색)': { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  환율: { title: 'MainButton_Exchange', sub: 'SubHeader_Exchange' },
  '도와줘 ‘인사’': { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  '인사 미술관': { title: 'MainButton_ToGallery', sub: 'SubHeader_ToGallery' },
  "'인사' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'인사' 뭐사지": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  숙박안내: { title: 'MainButton_ToStay', sub: 'SubHeader_ToStay' },
  고궁안내: { title: 'MainButton_Palace', sub: 'SubHeader_Palace' },
  언어선택: { title: 'Language_Select_Language', sub: 'Language_Content' },
  '교통 안내': { title: 'MainButton_Transport', sub: 'SubHeader_Transport' },
  위드마켓: { title: 'MainButton_Goods' },
  화장실: { title: 'MainButton_WC', sub: 'SubHeader_ToHelp' },
  // ── W004 오산 오색시장 header titles + page descriptions (Localization_Osaek) ──
  "도와줘 '정이'": { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  "'정이' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'정이' 뭐사지(식품)": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  "'정이' 뭐사지(물품)": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  "'정이' 모하지 (AI 검색)": { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  "'정이' 모하지(AI 검색)": { title: 'MainButton_AI', sub: 'SubHeader_AICourse' },
  // ── W005 화성휴게소 header titles + page descriptions (Localization_Hwaseong) ──
  // The Korean ids are the literal strings the Hwaseong screens pass to
  // HwaseongHeader; keys resolve against the Hwaseong bundled/synced table.
  "전국도로교통상황": { title: 'MainButton_TrafficInfo', sub: 'SubHeader_TrafficInfo' },
  "전국 휴게소": { title: 'MainButton_ServiceArea', sub: 'SubHeader_ServiceArea' },
  "화성시 이벤트": { title: 'MainButton_Event', sub: 'SubHeader_Event' },
  "'휴' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'휴' 뭐사지": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  "전국시장": { title: 'MainButton_TraditionalMarket', sub: 'SubHeader_TraditionalMarket' },
  "TAX-FREE": { title: 'MainButton_TaxFree', sub: 'SubHeader_TaxFree' },
  "화성휴게소": { title: 'MainButton_Here' },
  "안녕 '휴'": { title: 'MainButton_Greeting' },
  "도와줘 '휴'": { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  "화성휴게소 지도": { title: 'MainButton_SAMap', sub: 'SubHeader_SAMap' },
  "지역화폐": { title: 'MainButton_MarketPaper' },
};

/**
 * Curated 4-language fallbacks for button/title keys — used ONLY when the
 * Localization_Hwaseong sheet has NO value for that exact language. The sheet
 * always wins (even if it stores English in a ja/zh slot); these just fill
 * genuinely-empty cells before the Korean fallback.
 */
const BUTTON_OVERRIDES: Record<string, Partial<Record<Lang, string>>> = {
  MainButton_TrafficInfo: { ko: '도로 교통상황', en: 'Traffic Info', ja: '道路交通状況', zh: '道路交通状况' },
  MainButton_TraditionalMarket: { ko: '전국시장', en: 'Nationwide Markets', ja: '全国市場', zh: '全国市场' },
  MainButton_ServiceArea: { ko: '전국휴게소', en: 'Rest Areas', ja: '全国サービスエリア', zh: '全国休息站' },
  MainButton_TaxFree: { ko: '텍스프리등록', en: 'Tax-Free', ja: 'タックスフリー', zh: '退税登记' },
  MainButton_Here: { ko: '화성휴게소', en: 'Hwaseong SA', ja: '華城サービスエリア', zh: '华城休息站' },
  MainButton_Greeting: { ko: "안녕 '휴'", en: "Hello 'HUE'", ja: 'こんにちは「HUE」', zh: '你好「HUE」' },
  MainButton_SAMap: { ko: '화성휴게소 지도', en: 'SA Map', ja: 'サービスエリアマップ', zh: '休息站地图' },
  // 기부 has no sheet row yet, so this curated entry is its ONLY source — without
  // it the tile renders the raw key. Drop it once the sheet carries the key.
  MainButton_Donation: { ko: '기부', en: 'Donation', ja: '寄付', zh: '捐赠' },
  MainButton_Property: { ko: '문화재(준비중)', en: 'Heritage (Soon)', ja: '文化財（準備中）', zh: '文化遗产（筹备中）' },
  MainButton_KCulture: { ko: 'K-컬쳐(준비중)', en: 'K-Culture (Soon)', ja: 'Kカルチャー（準備中）', zh: 'K文化（筹备中）' },
};

/**
 * Resolve a button/title localization key: the sheet's EXACT-language value
 * wins (even if English), then the curated fallback for empty cells, then the
 * full chain (ko → key). Returns undefined when the key isn't localized at all.
 */
export function buttonText(key: string, lang: Lang): string | undefined {
  const exact = tExact(key, lang);
  if (exact) return exact;
  const fallback = BUTTON_OVERRIDES[key]?.[lang];
  if (fallback) return fallback;
  return hasLoc(key) ? t(key, lang) : undefined;
}

/** Localized page-header title, falling back to the hand map, then the id. */
export function screenTitle(id: string, lang: Lang): string {
  const k = TITLE_KEYS[id]?.title;
  if (k) {
    const resolved = buttonText(k, lang);
    if (resolved) return resolved;
  }
  return SCREEN_TITLES[id]?.[lang] ?? id;
}

/** Localized page subtitle for a header-title id, or undefined if none mapped. */
/** Localized subtitles not (yet) in the sheet, keyed by header-title id. */
const EXTRA_SUBTITLES: Record<string, Partial<Record<Lang, string>>> = {
  위드마켓: {
    ko: '오직 현장에서만 할인받을 수 있는 상품들을 확인해보세요!',
    en: 'Check out the products available at a discount only here, on-site!',
    ja: '現場でしか割引を受けられない商品をぜひチェックしてください！',
    zh: '快来看看只有在现场才能享受折扣的商品吧！',
  },
};

export function screenSubtitle(id: string, lang: Lang): string | undefined {
  const extra = EXTRA_SUBTITLES[id];
  if (extra) return extra[lang] ?? extra.ko;
  const k = TITLE_KEYS[id]?.sub;
  return k && hasLoc(k) ? t(k, lang) : undefined;
}
