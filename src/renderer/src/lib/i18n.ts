import type { SupportedLanguage } from '@shared/types/kiosk';
import { useLanguageStore } from '@renderer/store/languageStore';
import { hasLoc, t, tExact } from '@renderer/lib/loc';
import { ui, type UiTextKey } from '@renderer/lib/uiText';

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
  // ── 제주 W006 (Figma 6212:55184 뭐먹지 / 6212:55233 뭐사지) ──
  // Authored here, not synced: there is no AICategory_Jeju / Localization_Jeju
  // sheet yet, and an unmapped chip label silently renders Korean to every
  // non-Korean visitor. 한식 / 한정식 / 카페 / 기념품 / 특산품 / 먹거리 /
  // 공예품 / 기타 are already above and shared with the other locations.
  // Non-CJK labels separate with " · ", not the Korean tight "·": the middle dot
  // is NOT a line-break opportunity, so "Perikanan·Makanan" is one unbreakable
  // 460px run in a chip with 310px of inner width. The spaces let it wrap at the
  // separator instead of relying on the chip's break-anywhere guard.
  흑돼지: { en: 'Black Pork', ja: '黒豚', zh: '黑猪肉', vi: 'Thịt heo đen', th: 'หมูดำ', ru: 'Чёрная свинина', id: 'Babi Hitam' },
  '해산물·회': { en: 'Seafood · Sashimi', ja: '海鮮・刺身', zh: '海鲜·生鱼片', vi: 'Hải sản · Sashimi', th: 'อาหารทะเล · ซาชิมิ', ru: 'Рыба · Сашими', id: 'Seafood · Sashimi' },
  '갈치·고등어': { en: 'Hairtail · Mackerel', ja: 'タチウオ・サバ', zh: '带鱼·鲭鱼', vi: 'Cá hố · Cá thu', th: 'ปลาดาบ · ปลาทู', ru: 'Сабля · Макрель', id: 'Layur · Makerel' },
  고기국수: { en: 'Pork Noodles', ja: 'コギクッス', zh: '猪肉面', vi: 'Mì thịt heo', th: 'บะหมี่หมู', ru: 'Лапша со свининой', id: 'Mi Daging Babi' },
  '제주 향토음식': { en: 'Jeju Local Food', ja: '済州郷土料理', zh: '济州乡土料理', vi: 'Ẩm thực Jeju', th: 'อาหารพื้นเมือง', ru: 'Кухня Чеджу', id: 'Kuliner Jeju' },
  호텔뷔페: { en: 'Hotel Buffet', ja: 'ホテルビュッフェ', zh: '酒店自助餐', vi: 'Buffet khách sạn', th: 'บุฟเฟ่ต์โรงแรม', ru: 'Буфет отеля', id: 'Buffet Hotel' },
  '감귤·농산물': { en: 'Tangerines · Produce', ja: 'みかん・農産物', zh: '柑橘·农产品', vi: 'Quýt · Nông sản', th: 'ส้ม · ผลผลิต', ru: 'Мандарины · Продукты', id: 'Jeruk · Hasil Tani' },
  '수산물·해산물': { en: 'Seafood', ja: '水産物・海産物', zh: '水产·海鲜', vi: 'Thủy sản · Hải sản', th: 'อาหารทะเล', ru: 'Дары моря', id: 'Hasil Laut' },
  '전통주·차': { en: 'Liquor · Tea', ja: '伝統酒・茶', zh: '传统酒·茶', vi: 'Rượu · Trà', th: 'สุรา · ชา', ru: 'Алкоголь · Чай', id: 'Arak · Teh' },
  '제주 굿즈': { en: 'Jeju Goods', ja: '済州グッズ', zh: '济州周边', vi: 'Đồ Jeju', th: 'ของเชจู', ru: 'Товары Чеджу', id: 'Barang Jeju' },
  '체험 기념품': { en: 'DIY Souvenirs', ja: '体験土産', zh: '体验纪念品', vi: 'Quà trải nghiệm', th: 'ของที่ระลึก DIY', ru: 'DIY-сувениры', id: 'Suvenir DIY' },
  // 숙박안내 (6212:55288). 호텔 and 게스트하우스 are in the 숙박 block below.
  // zh is 度假屋, not the obvious 民宿: 게스트하우스 below already uses 民宿, and the
  // two chips sit side by side in this row.
  펜션: { en: 'Pension', ja: 'ペンション', zh: '度假屋', vi: 'Pension', th: 'เพนชัน', ru: 'Пансион', id: 'Pension' },
  // Keyed with the middle dot the catalogue uses ('3-리조트·콘도'), not the slash
  // the Figma frame draws — the key is matched against the API string.
  '리조트·콘도': { en: 'Resort · Condo', ja: 'リゾート・コンド', zh: '度假村·公寓', vi: 'Resort · Condo', th: 'รีสอร์ท · คอนโด', ru: 'Курорт · Кондо', id: 'Resor · Kondo' },
  '독채·단독이용': { en: 'Private House', ja: '一棟貸し', zh: '独栋包租', vi: 'Nhà riêng', th: 'บ้านเดี่ยว', ru: 'Дом целиком', id: 'Rumah Utuh' },
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
  // 제주 airport (도와줘 '하영', 6219:98787). '은행·환전' is one chip in that
  // frame, not the two separate 은행 / 환전소 categories above it.
  안내소: { en: 'Information', ja: '案内所', zh: '问询处', vi: 'Quầy thông tin', th: 'จุดบริการข้อมูล', ru: 'Справочная', id: 'Informasi' },
  식음료: { en: 'Food & drink', ja: '飲食', zh: '餐饮', vi: 'Đồ ăn & uống', th: 'อาหารและเครื่องดื่ม', ru: 'Еда и напитки', id: 'Makanan & minuman' },
  '은행·환전': { en: 'Bank & exchange', ja: '銀行・両替', zh: '银行·货币兑换', vi: 'Ngân hàng & đổi tiền', th: 'ธนาคารและแลกเงิน', ru: 'Банк и обмен', id: 'Bank & penukaran' },
  유아휴게실: { en: 'Nursing room', ja: '授乳室', zh: '母婴室', vi: 'Phòng cho bé bú', th: 'ห้องให้นมบุตร', ru: 'Комната матери и ребёнка', id: 'Ruang menyusui' },
  '교통약자\n편의시설': { ko: '교통약자\n편의시설', en: 'Accessibility\nfacilities', ja: 'バリアフリー\n設備', zh: '无障碍\n设施', vi: 'Tiện ích\ntiếp cận', th: 'สิ่งอำนวย\nความสะดวก', ru: 'Доступная\nсреда', id: 'Fasilitas\ndisabilitas' },
  유실물센터: { en: 'Lost & found', ja: '遺失物センター', zh: '失物招领', vi: 'Đồ thất lạc', th: 'ศูนย์ของหาย', ru: 'Бюро находок', id: 'Barang hilang' },
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
  // 제주 W006 — the frames spell the title with the quotes and question mark
  // (6212:55184 / 6212:55233), so those are the ids the screens pass. Kept OUT
  // of TITLE_KEYS on purpose: Jeju has no Localization_Jeju sheet yet and falls
  // back to the INSADONG bundled table, so MainButton_ToBuy would render
  // "'인사' 뭐사지" here.
  // 여기는 제주도 is kept out of TITLE_KEYS for the same reason: MainButton_Here
  // resolves to Insadong's own "여기는 인사동" through the fallback table.
  '여기는 제주도': { en: 'This is Jeju', ja: 'ここは済州島', zh: '这里是济州岛', vi: 'Đây là Jeju', th: 'ที่นี่คือเชจู', ru: 'Это Чеджудо', id: 'Ini Jeju' },
  // Curly quotes, as the frame writes it (6219:98770) — the straight-quote form
  // is Insadong's own '도와줘 ‘인사’' above. Hardcoded display id is now 제주
  // (jejuMascot); keep the old 하영 key so any stale caller still localizes.
  '도와줘 ‘제주’': { en: 'Help', ja: 'ヘルプ', zh: '帮助', vi: 'Trợ giúp', th: 'ช่วยเหลือ', ru: 'Помощь', id: 'Bantuan' },
  '도와줘 ‘하영’': { en: 'Help', ja: 'ヘルプ', zh: '帮助', vi: 'Trợ giúp', th: 'ช่วยเหลือ', ru: 'Помощь', id: 'Bantuan' },
  // W008 세계자연유산본부's mascot spelling of the same page (see jejuMascot).
  '도와줘 ‘유산’': { en: 'Help', ja: 'ヘルプ', zh: '帮助', vi: 'Trợ giúp', th: 'ช่วยเหลือ', ru: 'Помощь', id: 'Bantuan' },
  "'제주' 뭐먹지?": { en: 'What to Eat', ja: '何を食べる', zh: '吃什么', vi: 'Ăn gì', th: 'กินอะไรดี', ru: 'Что поесть', id: 'Mau makan apa' },
  "'제주' 뭐사지?": { en: 'What to Buy', ja: '何を買う', zh: '买什么', vi: 'Mua gì', th: 'ซื้ออะไรดี', ru: 'Что купить', id: 'Mau beli apa' },
  숙박안내: { en: 'Lodging', ja: '宿泊案内', zh: '住宿指南', vi: 'Lưu trú', th: 'ที่พัก', ru: 'Проживание', id: 'Penginapan' },
  고궁안내: { en: 'Royal Palaces', ja: '古宮案内', zh: '古宫指南', vi: 'Cung điện', th: 'พระราชวัง', ru: 'Дворцы', id: 'Istana' },
  언어선택: { en: 'Language', ja: '言語選択', zh: '语言选择', vi: 'Ngôn ngữ', th: 'เลือกภาษา', ru: 'Язык', id: 'Bahasa' },
  검색: { en: 'Search', ja: '検索', zh: '搜索', vi: 'Tìm kiếm', th: 'ค้นหา', ru: 'Поиск', id: 'Cari' },
  '교통 안내': { en: 'Transportation', ja: '交通案内', zh: '交通指南', vi: 'Giao thông', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi' },
  위드마켓: { en: 'With Market', ja: 'ウィズマーケット', zh: 'With市场', vi: 'With Market', th: 'วิธมาร์เก็ต', ru: 'With Market', id: 'With Market' },
  'AR 한복체험': { en: 'AR Hanbok', ja: 'AR韓服体験', zh: 'AR韩服体验', vi: 'Trải nghiệm Hanbok AR', th: 'ประสบการณ์ฮันบก AR', ru: 'AR-ханбок', id: 'Pengalaman Hanbok AR' },
  화장실: { en: 'Restroom', ja: 'トイレ', zh: '洗手间', vi: 'Nhà vệ sinh', th: 'ห้องน้ำ', ru: 'Туалет', id: 'Toilet' },
  상세: { en: 'Details', ja: '詳細', zh: '详情', vi: 'Chi tiết', th: 'รายละเอียด', ru: 'Подробнее', id: 'Detail' },
  // Ids used only by the 준비중 placeholder scaffolds; no sheet row exists for
  // these, and without an entry the header printed the raw Korean id.
  '상세 정보': { en: 'Details', ja: '詳細情報', zh: '详细信息', vi: 'Thông tin chi tiết', th: 'ข้อมูลรายละเอียด', ru: 'Подробная информация', id: 'Informasi detail' },
  '긴급 안내': { en: 'Emergency Info', ja: '緊急案内', zh: '紧急指引', vi: 'Thông tin khẩn cấp', th: 'ข้อมูลฉุกเฉิน', ru: 'Экстренная информация', id: 'Info darurat' },
  'AI 추천 여행': { en: 'AI Trip Picks', ja: 'AIおすすめ旅行', zh: 'AI推荐旅行', vi: 'Gợi ý du lịch AI', th: 'ทริปแนะนำโดย AI', ru: 'AI-подбор поездки', id: 'Rekomendasi wisata AI' },
  'AI 추천 결과': { en: 'AI Results', ja: 'AIおすすめ結果', zh: 'AI推荐结果', vi: 'Kết quả gợi ý AI', th: 'ผลลัพธ์แนะนำโดย AI', ru: 'Результаты AI', id: 'Hasil rekomendasi AI' },
};

/**
 * Korean header-title id → sheet localization keys (title + optional subtitle).
 * Lets the header pull both from Localization_Insa; ids without a key fall back
 * to the hand-written SCREEN_TITLES above / the localized page-description.
 *
 * A field may list SEVERAL keys, tried in order, for the ids that four locations
 * share while their sheets spell the key differently: 숙박안내 is MainButton_ToStay
 * on Insadong but MainButton_Accommodation on 제주, and 지역화폐 is
 * MainButton_MarketPaper on 화성 but MainButton_LocalCurrency on 제주. Only ONE of
 * the candidates is ever present, because `bundledTable()` has already narrowed
 * to the running kiosk's table by the time these resolve — so the order is a
 * spelling fallback, not a precedence rule between locations.
 */
type TitleKeySpec = { title: string | readonly string[]; sub?: string | readonly string[] };

const TITLE_KEYS: Record<string, TitleKeySpec> = {
  '여기는 인사동': { title: 'MainButton_Here', sub: 'SubHeader_Attraction' },
  'TAX - FREE': { title: 'MainButton_TaxFree', sub: 'SubHeader_TaxFree' },
  '‘인사’ 뭐하지 (AI 검색)': { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  // 제주's sheet has no SubHeader_Exchange; its welcome line is Exchange_Header.
  환율: { title: 'MainButton_Exchange', sub: ['SubHeader_Exchange', 'Exchange_Header'] },
  '도와줘 ‘인사’': { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  '인사 미술관': { title: 'MainButton_ToGallery', sub: 'SubHeader_ToGallery' },
  "'인사' 뭐먹지": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'인사' 뭐사지": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  // 제주 files this under MainButton_Accommodation (8/8 languages); Insadong and
  // 화성 use MainButton_ToStay. Both share SubHeader_ToStay.
  숙박안내: { title: ['MainButton_ToStay', 'MainButton_Accommodation'], sub: 'SubHeader_ToStay' },
  고궁안내: { title: 'MainButton_Palace', sub: 'SubHeader_Palace' },
  언어선택: { title: 'Language_Select_Language', sub: 'Language_Content' },
  '교통 안내': { title: 'MainButton_Transport', sub: 'SubHeader_Transport' },
  위드마켓: { title: 'MainButton_Goods' },
  화장실: { title: 'MainButton_WC', sub: 'SubHeader_ToHelp' },
  // ── Aliases for the ids the 준비중 placeholder scaffolds pass ────────────
  // They spell the same screens differently from the real headers — straight
  // quotes instead of curly, no space in '교통안내'/'인사동지도' — so they
  // matched nothing and rendered the raw Korean id in every language. A key
  // that a given location's sheet lacks simply falls through, so listing all
  // of them here is safe across W001–W005.
  "'인사' 모하지 (AI검색)": { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  인사랑: { title: 'MainButton_Insarang' },
  인사동미술관: { title: 'MainButton_ToGallery', sub: 'SubHeader_ToGallery' },
  "안녕 '인사'": { title: 'MainButton_Greeting' },
  "안녕 '정이'": { title: 'MainButton_Greeting' },
  "도와줘 '인사'": { title: 'MainButton_ToHelp', sub: 'SubHeader_ToHelp' },
  인사동지도: { title: 'MainButton_Map' },
  '오색시장 지도': { title: 'MainButton_Map' },
  교통안내: { title: 'MainButton_Transport', sub: 'SubHeader_Transport' },
  '언어 선택': { title: 'Language_Select_Language', sub: 'Language_Content' },
  '화장실 안내': { title: 'MainButton_WC', sub: 'SubHeader_ToHelp' },
  '여기는 오색시장': { title: 'MainButton_Here', sub: 'SubHeader_Attraction' },
  전국휴게소: { title: 'MainButton_ServiceArea', sub: 'SubHeader_ServiceArea' },
  // 이벤트 screens: each location's sheet carries its own MainButton_Event /
  // SubHeader_Event copy, so all three ids resolve through the same pair.
  '인사동 이벤트': { title: 'MainButton_Event', sub: 'SubHeader_Event' },
  '오산시 이벤트': { title: 'MainButton_Event', sub: 'SubHeader_Event' },
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
  // 화성 spells this MainButton_MarketPaper, 제주 MainButton_LocalCurrency; only
  // 제주 carries a subtitle row for it.
  "지역화폐": { title: ['MainButton_MarketPaper', 'MainButton_LocalCurrency'], sub: 'LocalCurrency_SubHeader' },
  // ── W006 제주공항 header titles + page descriptions (Localization_Jeju) ──
  // The ids are the literal strings each 제주 screen hands to JejuPageFrame, so a
  // renamed header must be renamed here too or it silently falls back to Korean.
  // 지역화폐/환율/언어선택/숙박안내/TAX-FREE/상세 already resolve through the shared
  // entries above — 제주's sheet carries the same key names, and bundledTable()
  // has already picked the 제주 table by then, so they land on 제주's own copy.
  "'제주' 뭐하지 (AI 검색)": { title: 'MainButton_AI', sub: 'SubHeader_AISearch' },
  // 탐나오&제주큐랑 (6493:118287). The sheet has already caught up with that
  // frame's two-tab redraw — MainButton_Tamnao reads 탐나오·제주큐랑 in all eight
  // languages — so the header follows the sheet, not the id, and the visitor sees
  // the SAME string the home tile shows (both resolve the one key). Note the
  // sheet joins the pair with a middle dot where the frame draws "&".
  // Tamnao_Subtitle is Korean-only in the sheet; SUBTITLE_OVERRIDES carries the
  // other seven, so mapping it no longer means printing Korean to everyone.
  "탐나오&제주큐랑": { title: 'MainButton_Tamnao', sub: 'Tamnao_Subtitle' },
  "'제주' 뭐먹지?": { title: 'MainButton_ToEat', sub: 'SubHeader_ToEat' },
  "'제주' 뭐사지?": { title: 'MainButton_ToBuy', sub: 'SubHeader_ToBuy' },
  // NOT SubHeader_Attraction (that is Insadong's key and 제주's sheet has no such
  // row) — 제주 writes this page's description as Here_IsJeju. With the wrong key
  // the header printed the Figma placeholder 페이지 설명문 on the device.
  "여기는 제주도": { title: 'MainButton_Here', sub: 'Here_IsJeju' },
  // Hardcoded page ids from jejuMascot (제주). Sheet cells still decide the
  // visible string via MainButton_*; these keys only route the lookup.
  "안녕 '제주'": { title: 'MainButton_Greeting', sub: 'Greeting_Introduce' },
  // Help_Subtitle is the map-tap copy; SubHeader_ToHelp is Insadong's search-result line.
  "도와줘 ‘제주’": { title: 'MainButton_ToHelp', sub: 'Help_Subtitle' },
  // Stale 하영 ids — kept so CMS analytics labels / older callers still resolve.
  "안녕 '하영'": { title: 'MainButton_Greeting', sub: 'Greeting_Introduce' },
  "도와줘 ‘하영’": { title: 'MainButton_ToHelp', sub: 'Help_Subtitle' },
  // W008 세계자연유산본부 passes the 유산 spellings (jejuMascot) — the KEYS are the
  // same because the sheet's mascot tie-break already answers per-layout, so the
  // header shows the 유산 row on a JEJU_HERITAGE machine and 하영's elsewhere.
  "안녕 '유산'": { title: 'MainButton_Greeting', sub: 'Greeting_Introduce' },
  "도와줘 ‘유산’": { title: 'MainButton_ToHelp', sub: 'Help_Subtitle' },
  "제주도 이벤트": { title: 'MainButton_Event', sub: 'SubHeader_Event' },
  "렌트카": { title: 'MainButton_RentCar', sub: 'RentCar_Subtitle' },
  탐나오: { title: 'MainButton_Tamnao', sub: 'Tamnao_Subtitle' },
  // W006 reads MainButton_Airplane_Schedule, W007 MainButton_Cruise — same header
  // id (운항정보), different title rows. OP_Schedule_Subtitle is the page copy.
  "운항정보": {
    title: ['MainButton_Airplane_Schedule', 'MainButton_Cruise'],
    sub: 'OP_Schedule_Subtitle',
  },
  // Header id stays `검색`; title/sub come from Localization_Jeju. `Main_Search`
  // is the home search-bar placeholder — not this page's title.
  검색: { title: 'Search_Result_Title', sub: 'Search_Result_Subtitle' },
};

/**
 * Curated fallbacks for button/title keys — used ONLY when the location's sheet
 * has NO value for that exact language. The sheet always wins (even if it stores
 * English in a ja/zh slot); these just fill genuinely-empty cells before the
 * Korean fallback.
 *
 * ★ This table was nine 화성 keys long and was DELETED on develop_1, for a good
 * reason: those nine only ever carried ko/en/ja/zh, so they could never help
 * vi/th/ru/id, and all nine now hold all eight languages in
 * Localization_Hwaseong — every entry was unreachable, and a partial shadow of
 * sheet data is the exact shape of bug this codebase keeps hitting. Those nine
 * stay deleted.
 *
 * That reasoning does NOT reach 제주's MainButton_LocalCurrency:
 * Localization_Jeju fills it in Korean only, so without this the 지역화폐 header
 * printed 지역화폐 to every visitor. It is kept, and kept at all EIGHT languages
 * — the shape develop_1 objected to was the partial one. Delete it the day the
 * sheet carries the other seven.
 */
const BUTTON_OVERRIDES: Record<string, Partial<Record<Lang, string>>> = {
  MainButton_LocalCurrency: {
    ko: '지역화폐',
    en: 'Local Currency',
    ja: '地域通貨',
    zh: '地方货币',
    vi: 'Tiền địa phương',
    th: 'สกุลเงินท้องถิ่น',
    ru: 'Местная валюта',
    id: 'Mata Uang Daerah',
  },
};

/**
 * Resolve a button/title localization key: the sheet's EXACT-language value
 * wins (even if it stores English in a ja/zh slot), then the curated fallback
 * above for a genuinely-empty cell, then the full chain (ko → key). Returns
 * undefined when the key isn't localized at all.
 */
export function buttonText(key: string, lang: Lang): string | undefined {
  const exact = tExact(key, lang);
  if (exact) return exact;
  const fallback = BUTTON_OVERRIDES[key]?.[lang];
  if (fallback) return fallback;
  return hasLoc(key) ? t(key, lang) : undefined;
}

/** Candidate keys for a title/sub field, as a list — see {@link TitleKeySpec}. */
const keyList = (k: string | readonly string[] | undefined): readonly string[] =>
  k == null ? [] : typeof k === 'string' ? [k] : k;

/** Localized page-header title, falling back to the hand map, then the id. */
export function screenTitle(id: string, lang: Lang): string {
  // Brand mark — never pull translated sheet copy (Hwaseong once had 텍스프리등록).
  if (id === 'TAX-FREE' || id === 'TAX - FREE') return id;
  const k = TITLE_KEYS[id]?.title;
  for (const candidate of keyList(k)) {
    const resolved = buttonText(candidate, lang);
    if (resolved) return resolved;
  }
  return SCREEN_TITLES[id]?.[lang] ?? id;
}

/** Header-title ids whose subtitle has no sheet row — the copy lives in
 *  lib/uiText.ts, which enforces all eight languages at compile time. */
const EXTRA_SUBTITLE_KEYS: Record<string, UiTextKey> = {
  위드마켓: 'withMarketSubtitle',
  // NOTE 검색 is NOT here, though it has no sheet row either. This map is keyed
  // by header id and consulted by EVERY layout's header, while 검색 is a page
  // Insadong, 오산 and 화성 all draw too — those three render no description row
  // at all today, and an entry here would silently give all three one. 제주's
  // 검색 passes the copy as a `subtitle` prop instead (see JejuSearch), which
  // reaches exactly the page it was written for.
};

/**
 * Curated subtitle fallbacks, keyed by the SHEET KEY rather than by the header
 * id — the same resolution {@link BUTTON_OVERRIDES} gives titles, and keyed this
 * way so a subtitle row one location has and another lacks can never leak
 * sideways. (지역화폐 is one header id shared by 화성 and 제주; only 제주's sheet
 * carries LocalCurrency_SubHeader, so only 제주 sees this.)
 *
 * Distinct from {@link EXTRA_SUBTITLE_KEYS}, which is for ids with NO sheet row
 * at all and whose copy lives in `uiText.ts` under compile-time enforcement.
 * This one fills an empty cell in a row that does exist.
 */
const SUBTITLE_OVERRIDES: Record<string, Partial<Record<Lang, string>>> = {
  LocalCurrency_SubHeader: {
    ko: '제주도에서 사용할 수 있는 지역화폐 입니다.',
    en: 'Local currencies you can use on Jeju Island.',
    ja: '済州島で使える地域通貨のご案内です。',
    zh: '这是可在济州岛使用的地方货币。',
    vi: 'Các loại tiền địa phương dùng được trên đảo Jeju.',
    th: 'เงินท้องถิ่นที่ใช้ได้บนเกาะเชจู',
    ru: 'Местные платёжные средства, которые принимают на острове Чеджу.',
    id: 'Mata uang daerah yang bisa dipakai di Pulau Jeju.',
  },
  /* 렌트카. The sheet writes only the Korean ("* 아래 리스트를 클릭하시면 상세한
     정보를 얻을 수 있어요"); these are that line in the other seven. DELETE an
     entry the moment its cell is filled in the sheet — `tExact` already prefers
     the sheet, so a filled cell makes the line here dead weight, not a conflict. */
  RentCar_Subtitle: {
    ko: '아래 리스트를 클릭하시면 상세한 정보를 얻을 수 있어요.',
    en: 'Tap an item in the list below to see the full details.',
    ja: '下のリストをタップすると詳しい情報をご覧いただけます。',
    zh: '点击下方列表即可查看详细信息。',
    vi: 'Chạm vào mục trong danh sách bên dưới để xem thông tin chi tiết.',
    th: 'แตะรายการด้านล่างเพื่อดูข้อมูลโดยละเอียด',
    ru: 'Нажмите на пункт списка ниже, чтобы увидеть подробности.',
    id: 'Ketuk item pada daftar di bawah untuk melihat detail lengkapnya.',
  },
  /* 탐나오&제주큐랑. The sheet's Korean is singular ("* 제주여행 공공플랫폼
     홈페이지입니다") and predates the two-tab redraw, so these seven say
     platformS — true of the page either way. Same delete-when-filled rule. */
  Tamnao_Subtitle: {
    ko: '제주여행 공공플랫폼 홈페이지입니다.',
    en: 'The public platforms for Jeju travel information.',
    ja: '済州旅行の公共プラットフォームのホームページです。',
    zh: '这里是济州旅游公共平台的官方网站。',
    vi: 'Các nền tảng công cộng về thông tin du lịch Jeju.',
    th: 'แพลตฟอร์มสาธารณะสำหรับข้อมูลท่องเที่ยวเชจู',
    ru: 'Государственные платформы с туристической информацией о Чеджу.',
    id: 'Platform publik untuk informasi wisata Jeju.',
  },
};

/** Localized page subtitle for a header-title id, or undefined if none mapped. */
export function screenSubtitle(id: string, lang: Lang): string | undefined {
  const extra = EXTRA_SUBTITLE_KEYS[id];
  if (extra) return ui(extra, lang);
  for (const k of keyList(TITLE_KEYS[id]?.sub)) {
    // Same order as `buttonText`: the sheet's own cell for this language, then
    // the curated fallback for genuinely-empty cells, then `t()`'s Korean chain.
    // A plain `t()` here answered Korean for every Korean-only row and looked
    // like it had worked.
    if (hasLoc(k)) return tExact(k, lang) || SUBTITLE_OVERRIDES[k]?.[lang] || t(k, lang);
  }
  return undefined;
}
