import type { Lang } from '@renderer/lib/i18n';
import type { LangText } from '@renderer/data/types';
import { pickText } from '@renderer/data/types';

/**
 * Local vi/th/ru/id translations for AI-search (즐길거리) categories.
 *
 * These come from the `AICategory_*` Google Sheets, which only carry
 * ko/en/ja/zh — so the generated `AI_CATEGORIES` are 4-language and would fall
 * back to Korean for the four newer languages. The sheet has no new-language
 * columns, so per the "create locally, no sheet-push scripts" decision these
 * translations live here, keyed by the canonical Korean category value. If a
 * column is ever added to the sheet, `aiCatLabel` prefers the sheet value.
 */
const AI_CAT_I18N: Record<string, { vi: string; th: string; ru: string; id: string }> = {
  'K POP': { vi: 'K-POP', th: 'K-POP', ru: 'K-POP', id: 'K-POP' },
  가구: { vi: 'Nội thất', th: 'เฟอร์นิเจอร์', ru: 'Мебель', id: 'Furnitur' },
  건강: { vi: 'Sức khỏe', th: 'สุขภาพ', ru: 'Здоровье', id: 'Kesehatan' },
  고미술: { vi: 'Mỹ thuật cổ', th: 'ศิลปะโบราณ', ru: 'Антикварное искусство', id: 'Seni antik' },
  공예품: { vi: 'Đồ thủ công', th: 'งานหัตถกรรม', ru: 'Ремёсла', id: 'Kerajinan' },
  기념품: { vi: 'Quà lưu niệm', th: 'ของที่ระลึก', ru: 'Сувениры', id: 'Suvenir' },
  '기름/방앗간': { vi: 'Dầu/Xưởng xay', th: 'น้ำมัน/โรงสี', ru: 'Масло/Мельница', id: 'Minyak/Penggilingan' },
  다과: { vi: 'Trà bánh', th: 'ของว่าง', ru: 'Закуски и чай', id: 'Kudapan' },
  동남아: { vi: 'Đông Nam Á', th: 'อาหารเอเชียตะวันออกเฉียงใต้', ru: 'Юго-Восточная Азия', id: 'Asia Tenggara' },
  '떡/두부': { vi: 'Bánh gạo/Đậu phụ', th: 'ต็อก/เต้าหู้', ru: 'Рисовые пирожки/Тофу', id: 'Kue beras/Tahu' },
  막걸리: { vi: 'Makgeolli', th: 'มักกอลลี', ru: 'Макколли', id: 'Makgeolli' },
  문구: { vi: 'Văn phòng phẩm', th: 'เครื่องเขียน', ru: 'Канцтовары', id: 'Alat tulis' },
  분식: { vi: 'Đồ ăn vặt', th: 'อาหารว่าง', ru: 'Закуски', id: 'Jajanan' },
  '뷰티/미용': { vi: 'Làm đẹp', th: 'ความงาม', ru: 'Красота', id: 'Kecantikan' },
  사진촬영: { vi: 'Chụp ảnh', th: 'ถ่ายภาพ', ru: 'Фотосъёмка', id: 'Fotografi' },
  사찰음식: { vi: 'Ẩm thực chùa', th: 'อาหารวัด', ru: 'Храмовая кухня', id: 'Makanan kuil' },
  생활용품: { vi: 'Đồ gia dụng', th: 'ของใช้ในบ้าน', ru: 'Товары для дома', id: 'Perlengkapan rumah' },
  '수산/건어물': { vi: 'Hải sản/Cá khô', th: 'อาหารทะเล/ปลาแห้ง', ru: 'Морепродукты/Сушёная рыба', id: 'Makanan laut/Ikan kering' },
  수제도장: { vi: 'Con dấu thủ công', th: 'ตราประทับทำมือ', ru: 'Печати ручной работы', id: 'Stempel buatan tangan' },
  신발: { vi: 'Giày dép', th: 'รองเท้า', ru: 'Обувь', id: 'Sepatu' },
  아시안: { vi: 'Món Á', th: 'อาหารเอเชีย', ru: 'Азиатская кухня', id: 'Masakan Asia' },
  '야채/과일': { vi: 'Rau/Trái cây', th: 'ผัก/ผลไม้', ru: 'Овощи/Фрукты', id: 'Sayur/Buah' },
  엔틱: { vi: 'Đồ cổ', th: 'ของโบราณ', ru: 'Антиквариат', id: 'Antik' },
  역사유적지: { vi: 'Di tích lịch sử', th: 'แหล่งประวัติศาสตร์', ru: 'Историческое место', id: 'Situs bersejarah' },
  의류: { vi: 'Quần áo', th: 'เสื้อผ้า', ru: 'Одежда', id: 'Pakaian' },
  '인삼/약재': { vi: 'Nhân sâm/Dược liệu', th: 'โสม/สมุนไพร', ru: 'Женьшень/Травы', id: 'Ginseng/Herbal' },
  '인테리어/수리': { vi: 'Nội thất/Sửa chữa', th: 'ตกแต่ง/ซ่อม', ru: 'Интерьер/Ремонт', id: 'Interior/Perbaikan' },
  잡화: { vi: 'Tạp hóa', th: 'สินค้าเบ็ดเตล็ด', ru: 'Разные товары', id: 'Aneka barang' },
  전시관: { vi: 'Nhà triển lãm', th: 'ห้องจัดแสดง', ru: 'Выставочный зал', id: 'Ruang pameran' },
  전통주: { vi: 'Rượu truyền thống', th: 'สุราพื้นเมือง', ru: 'Традиционные напитки', id: 'Minuman tradisional' },
  전통차: { vi: 'Trà truyền thống', th: 'ชาโบราณ', ru: 'Традиционный чай', id: 'Teh tradisional' },
  '족발/만두': { vi: 'Chân giò/Bánh bao', th: 'ขาหมู/เกี๊ยว', ru: 'Свиные ножки/Пельмени', id: 'Kaki babi/Pangsit' },
  중식: { vi: 'Món Trung', th: 'อาหารจีน', ru: 'Китайская кухня', id: 'Masakan Tionghoa' },
  '찌개류/국류': { vi: 'Canh/Lẩu', th: 'แกง/ต้ม', ru: 'Супы и рагу', id: 'Sup/Semur' },
  차이나: { vi: 'Trung Hoa', th: 'จีน', ru: 'Китай', id: 'Tiongkok' },
  '채소/농산': { vi: 'Rau/Nông sản', th: 'ผัก/ผลผลิต', ru: 'Овощи/Сельхозпродукты', id: 'Sayur/Hasil tani' },
  '채식/비건': { vi: 'Món chay', th: 'มังสวิรัติ', ru: 'Веган', id: 'Vegan' },
  체험: { vi: 'Trải nghiệm', th: 'กิจกรรม', ru: 'Впечатления', id: 'Pengalaman' },
  '축산/정육': { vi: 'Thịt', th: 'เนื้อสัตว์', ru: 'Мясо', id: 'Daging' },
  '치킨/강정': { vi: 'Gà rán', th: 'ไก่ทอด', ru: 'Курица', id: 'Ayam' },
  카페: { vi: 'Cà phê', th: 'คาเฟ่', ru: 'Кафе', id: 'Kafe' },
  '카페 및 베이커리': { vi: 'Cà phê & Bánh', th: 'คาเฟ่และเบเกอรี่', ru: 'Кафе и пекарня', id: 'Kafe & Roti' },
  코리안바베큐: { vi: 'BBQ Hàn Quốc', th: 'บาร์บีคิวเกาหลี', ru: 'Корейское барбекю', id: 'BBQ Korea' },
  패션잡화: { vi: 'Phụ kiện thời trang', th: 'สินค้าแฟชั่น', ru: 'Модные аксессуары', id: 'Aksesori fesyen' },
  표구: { vi: 'Bồi tranh', th: 'การใส่กรอบ', ru: 'Оформление картин', id: 'Pembingkaian' },
  표구액자: { vi: 'Đóng khung', th: 'กรอบรูป', ru: 'Багетные работы', id: 'Bingkai' },
  필방: { vi: 'Cửa hàng bút lông', th: 'ร้านพู่กัน', ru: 'Магазин кистей', id: 'Toko kuas' },
  한복: { vi: 'Hanbok', th: 'ฮันบก', ru: 'Ханбок', id: 'Hanbok' },
  한식: { vi: 'Món Hàn', th: 'อาหารเกาหลี', ru: 'Корейская кухня', id: 'Masakan Korea' },
  한정식: { vi: 'Cỗ Hàn Quốc', th: 'อาหารชุดเกาหลี', ru: 'Корейский сет', id: 'Set Korea' },
  화랑: { vi: 'Phòng tranh', th: 'หอศิลป์', ru: 'Галерея', id: 'Galeri' },
};

const NEW_LANGS = new Set(['vi', 'th', 'ru', 'id']);

/**
 * Localized AI-search category label: the sheet's value for the language if it
 * has one, else the local overlay (vi/th/ru/id), else the Korean fallback.
 */
export function aiCatLabel(cat: LangText, lang: Lang): string {
  const sheetVal = (cat as unknown as Record<string, string | undefined>)[lang];
  if (sheetVal && sheetVal.trim()) return sheetVal;
  if (NEW_LANGS.has(lang)) {
    const o = AI_CAT_I18N[cat.ko];
    if (o) return o[lang as 'vi' | 'th' | 'ru' | 'id'];
  }
  return pickText(cat, lang);
}
