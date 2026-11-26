/**
 * Screen copy the 롯데 screens draw in every language — for the lines the 롯데 sheet
 * (Localization_Lotte) does not carry yet, or carries with different Korean wording.
 *
 * `tc(key, lang)`: the sheet row `key` when it exists — in every language, Korean included, so an
 * operator's edit to the sheet reaches the screen — then the line written here for that language.
 *
 * Every key is named as a Localization_Lotte row would be, so adding the row to the sheet takes
 * over without a code change. Keys marked (sheet) already exist there.
 *
 * Also here: `lotteTitle` (page titles by their Korean id → the MainButton_* rows) and
 * `placeName` (a building / site name in the visitor's language, from the FacilityData tabs'
 * translated locations — "롯데월드몰 B1F" → "LOTTE WORLD MALL B1F").
 */
import type { Lang } from '@renderer/lib/i18n';
import { hasLoc, sheetText, tExact } from '@renderer/lib/loc';
import { screenTitle } from '@renderer/lib/i18n';
import type { KioskId } from '@shared/types/kiosk';
import { lotteFacilityRows } from './lotteFacilities';

/** The eight languages the 롯데 kiosk offers; any other Lang falls back to English. */
type Eight = 'ko' | 'en' | 'ja' | 'zh' | 'vi' | 'th' | 'ru' | 'id';
type Copy = Record<Eight, string>;
/** A sheet text cell (or Copy) read in `lang`, English when that language has none. */
const inLang = (t: Partial<Record<string, string>>, lang: Lang): string => t[lang] || t.en || '';
const L = (ko: string, en: string, ja: string, zh: string, vi: string, th: string, ru: string, id: string): Copy => ({
  ko, en, ja, zh, vi, th, ru, id,
});

export const COPY = {
  // ── shared placeholders ──
  Photo_Slot: L('사진 자리', 'Photo coming soon', '写真準備中', '图片准备中', 'Ảnh sắp có', 'รูปภาพเร็ว ๆ นี้', 'Фото скоро', 'Foto segera hadir'),
  Data_Soon: L('자료를 받으면 표시합니다', 'Coming soon', '準備中です', '即将推出', 'Sắp có', 'เร็ว ๆ นี้', 'Скоро', 'Segera hadir'),
  Content_Soon: L('콘텐츠 준비 중입니다', 'Content coming soon', 'コンテンツ準備中です', '内容准备中', 'Nội dung đang được chuẩn bị', 'กำลังเตรียมเนื้อหา', 'Контент скоро появится', 'Konten segera hadir'),
  Content_Soon_Note: L('{tab} 정보를 받으면 이곳에 표시합니다', '{tab} will appear here once we receive it.', '{tab}の情報が届き次第ここに表示します', '收到{tab}信息后将在此显示', '{tab} sẽ hiển thị tại đây khi có thông tin.', 'จะแสดง{tab}ที่นี่เมื่อได้รับข้อมูล', '{tab}: данные появятся здесь, как только мы их получим.', '{tab} akan tampil di sini setelah datanya diterima.'),

  // ── 상세 · 목록 · 시네마 ──
  Detail_Subtitle: L('위치와 정보를 확인하세요', 'Check the location and details.', '場所と情報をご確認ください', '请查看位置和信息', 'Xem vị trí và thông tin.', 'ดูตำแหน่งและข้อมูล', 'Расположение и подробности.', 'Lihat lokasi dan informasinya.'),
  Detail_Empty: L('정보를 찾을 수 없습니다', 'Nothing to show.', '情報が見つかりません', '未找到信息', 'Không tìm thấy thông tin.', 'ไม่พบข้อมูล', 'Информация не найдена.', 'Informasi tidak ditemukan.'),
  List_Empty: L('조건에 맞는 상점이 없습니다', 'No matching shops.', '条件に合う店舗がありません', '没有符合条件的店铺', 'Không có cửa hàng phù hợp.', 'ไม่มีร้านที่ตรงเงื่อนไข', 'Подходящих магазинов нет.', 'Tidak ada toko yang cocok.'),
  Cinema_Subtitle: L('오늘 남은 상영 회차를 확인하세요', "Today's remaining showtimes.", '本日の残りの上映回をご確認ください', '查看今天剩余的场次', 'Các suất chiếu còn lại hôm nay.', 'รอบฉายที่เหลือของวันนี้', 'Оставшиеся сеансы на сегодня.', 'Jadwal tayang tersisa hari ini.'),
  Unit_Min: L('{n}분', '{n} min', '{n}分', '{n}分钟', '{n} phút', '{n} นาที', '{n} мин', '{n} mnt'),
  Unit_Hour: L('{n}시간', '{n} h', '{n}時間', '{n}小时', '{n} giờ', '{n} ชม.', '{n} ч', '{n} jam'),

  // ── 화장실 ──
  WC_Subtitle: L('층별 화장실을 확인하세요', 'Restrooms by floor.', '階ごとのトイレをご確認ください', '按楼层查看洗手间', 'Xem nhà vệ sinh theo tầng.', 'ดูห้องน้ำแต่ละชั้น', 'Туалеты по этажам.', 'Lihat toilet per lantai.'),
  WC_Plan_Slot: L('{place} 도면 자리', '{place} floor plan', '{place} フロアマップ', '{place} 楼层平面图', 'Sơ đồ tầng {place}', 'แผนผังชั้น {place}', 'План этажа: {place}', 'Denah lantai {place}'),
  WC_Preparing: L('층별 화장실 위치를 준비 중입니다', 'Restroom locations are being prepared.', 'トイレの位置情報は準備中です', '洗手间位置信息正在准备中', 'Vị trí nhà vệ sinh đang được cập nhật.', 'กำลังเตรียมข้อมูลตำแหน่งห้องน้ำ', 'Расположение туалетов скоро появится.', 'Lokasi toilet sedang disiapkan.'),
  WC_AskDesk: L('{place}에 문의해 주세요', 'Please ask at {place}.', '{place}にお問い合わせください', '请咨询{place}', 'Vui lòng hỏi tại {place}.', 'โปรดสอบถามที่ {place}', 'Обратитесь: {place}.', 'Silakan tanyakan di {place}.'),
  WC_AskStaff: L('가까운 직원에게 문의해 주세요', 'Please ask a nearby staff member.', 'お近くのスタッフにお尋ねください', '请咨询附近的工作人员', 'Vui lòng hỏi nhân viên gần nhất.', 'โปรดสอบถามพนักงานที่อยู่ใกล้', 'Обратитесь к ближайшему сотруднику.', 'Silakan tanyakan petugas terdekat.'),

  // ── 롯데 이벤트 · 여기는 롯데 ──
  Event_Subtitle: L('진행 중인 행사와 혜택을 확인하세요', 'See current events and offers.', '開催中のイベントと特典をご確認ください', '查看正在进行的活动和优惠', 'Xem sự kiện và ưu đãi đang diễn ra.', 'ดูกิจกรรมและสิทธิพิเศษที่กำลังจัด', 'Текущие события и предложения.', 'Lihat acara dan promo yang sedang berlangsung.'),
  Event_DescPending: L('이벤트 소개는 등록 후 표시합니다. 지금은 화면 확인용 예시 문구입니다.', 'The event description will appear once it is registered.', 'イベント紹介は登録後に表示されます。', '活动介绍将在登记后显示。', 'Mô tả sự kiện sẽ hiển thị sau khi được đăng ký.', 'รายละเอียดกิจกรรมจะแสดงหลังลงทะเบียน', 'Описание появится после регистрации события.', 'Deskripsi acara akan tampil setelah didaftarkan.'),
  Here_Subtitle: L('이곳의 시설과 볼거리를 소개합니다', 'Facilities and sights here.', 'ここの施設と見どころをご紹介します', '介绍这里的设施和看点', 'Giới thiệu tiện ích và điểm tham quan tại đây.', 'แนะนำสิ่งอำนวยความสะดวกและจุดน่าสนใจที่นี่', 'Объекты и достопримечательности.', 'Fasilitas dan tempat menarik di sini.'),

  // ── 안녕 로씨 ──
  Hello_Tab_Intro: L('소개', 'About', '紹介', '介绍', 'Giới thiệu', 'แนะนำ', 'О себе', 'Profil'),
  Hello_Tab_Hobby: L('취미생활', 'Hobbies', '趣味', '爱好', 'Sở thích', 'งานอดิเรก', 'Хобби', 'Hobi'),
  Hello_Tab_Health: L('건강습관', 'Health habits', '健康習慣', '健康习惯', 'Thói quen sức khỏe', 'นิสัยสุขภาพ', 'Здоровье', 'Kebiasaan sehat'),

  // ── 오늘의 사연 ──
  Story_QR_Sub: L('WITS 앱에서 보낼 수 있어요. 검수를 거쳐 이 화면에 올라옵니다.', 'Send one from the WITS app. After review it appears on this screen.', 'WITSアプリから送れます。確認後、この画面に表示されます。', '可在WITS应用中发送，审核后显示在此屏幕上。', 'Gửi từ ứng dụng WITS. Sau khi duyệt sẽ hiển thị trên màn hình này.', 'ส่งได้จากแอป WITS หลังตรวจสอบแล้วจะแสดงบนหน้าจอนี้', 'Отправьте через приложение WITS. После проверки история появится здесь.', 'Kirim dari aplikasi WITS. Setelah ditinjau, akan tampil di layar ini.'),
  Story_Empty_Sub: L('첫 사연을 보내 보세요.', 'Be the first to send a story.', '最初のストーリーを送ってみましょう。', '来发送第一个故事吧。', 'Hãy gửi câu chuyện đầu tiên.', 'ส่งเรื่องราวแรกกันเลย', 'Отправьте первую историю.', 'Kirim cerita pertama.'),
  Story_Count: L('사연 {n}개', '{n} stories', 'ストーリー {n}件', '{n}个故事', '{n} câu chuyện', '{n} เรื่องราว', 'Историй: {n}', '{n} cerita'),
  Story_Order: L('최근 순', 'Newest first', '新しい順', '最新优先', 'Mới nhất', 'ล่าสุด', 'Сначала новые', 'Terbaru'),
  Story_View: L('보기 ›', 'View ›', '見る ›', '查看 ›', 'Xem ›', 'ดู ›', 'Открыть ›', 'Lihat ›'),
  Story_Media: L('사연 사진 · 영상 (30초)', 'Story photo · video (30 s)', '写真・動画（30秒）', '照片·视频（30秒）', 'Ảnh · video (30 giây)', 'รูปภาพ · วิดีโอ (30 วินาที)', 'Фото · видео (30 с)', 'Foto · video (30 dtk)'),
  Story_Author: L('— {name} 님', '— {name}', '— {name} さん', '— {name}', '— {name}', '— คุณ{name}', '— {name}', '— {name}'),
  Story_SendMine: L('내 사연도 보내기', 'Send your story too', '私のストーリーも送る', '也发送我的故事', 'Gửi câu chuyện của bạn', 'ส่งเรื่องราวของฉัน', 'Отправить свою историю', 'Kirim ceritamu juga'),
  Story_SendSub: L('WITS 앱에서 보낼 수 있어요', 'Send it from the WITS app', 'WITSアプリから送れます', '可在WITS应用中发送', 'Gửi từ ứng dụng WITS', 'ส่งได้จากแอป WITS', 'Через приложение WITS', 'Kirim dari aplikasi WITS'),

  // ── 영화 나눔 ──
  FilmShare_Cinemas: L('월드타워 · 건대입구 · 청량리', 'World Tower · Konkuk Univ. · Cheongnyangni', 'ワールドタワー・建大入口・清凉里', '世界塔 · 建大入口 · 清凉里', 'World Tower · Konkuk Univ. · Cheongnyangni', 'เวิลด์ทาวเวอร์ · คอนกุก · ชองนยังนี', 'World Tower · Konkuk Univ. · Cheongnyangni', 'World Tower · Konkuk Univ. · Cheongnyangni'),
  FilmShare_Step2_Sub: L('상영이 끝난 뒤 7일 안에', 'Within 7 days after the screening', '上映終了後7日以内', '放映结束后7天内', 'Trong 7 ngày sau suất chiếu', 'ภายใน 7 วันหลังฉายจบ', 'В течение 7 дней после сеанса', 'Dalam 7 hari setelah penayangan'),
  FilmShare_Step3_Sub: L('이웃에게 관람권 1장이 전달됩니다', 'A neighbour receives one movie ticket', 'ご近所の方に鑑賞券1枚が届きます', '一张观影券将送给邻居', 'Một vé xem phim được trao cho hàng xóm', 'ตั๋วหนัง 1 ใบส่งถึงเพื่อนบ้าน', 'Соседу передаётся один билет', 'Satu tiket film diberikan kepada tetangga'),
  FilmShare_Caption: L('영화 1편 = 필름 1칸 (그림은 예시)', '1 movie = 1 film frame (illustration)', '映画1本 = フィルム1コマ（イメージ）', '1部电影 = 1格胶片（示意图）', '1 phim = 1 ô phim (minh họa)', 'หนัง 1 เรื่อง = ฟิล์ม 1 ช่อง (ภาพตัวอย่าง)', '1 фильм = 1 кадр (иллюстрация)', '1 film = 1 bingkai (ilustrasi)'),
  FilmShare_QR_Sub: L('WITS 앱의 영화 나눔이 열립니다. 앱이 없으면 설치 안내로 이어져요.', "Opens Film Sharing in the WITS app. Without the app, you'll be shown how to install it.", 'WITSアプリの映画シェアが開きます。アプリがない場合はインストール案内に進みます。', '将打开WITS应用中的电影分享。如未安装应用，将跳转到安装指南。', 'Mở Chia sẻ phim trong ứng dụng WITS. Nếu chưa có ứng dụng, bạn sẽ được hướng dẫn cài đặt.', 'เปิดแบ่งปันหนังในแอป WITS หากยังไม่มีแอปจะพาไปยังหน้าติดตั้ง', 'Откроется «Кино в дар» в приложении WITS. Если приложения нет — подскажем, как установить.', 'Membuka Berbagi Film di aplikasi WITS. Jika belum ada aplikasinya, Anda diarahkan untuk memasangnya.'),

  // ── '롯데' 뭐하지 (영화 전후 코스) ──
  Course_Subtitle_Pick: L('영화 전후 코스 · 영화 앞뒤 시간을 알차게 보내 보세요', 'Before & after the movie · Make the most of your time', '映画の前後コース・上映前後の時間を有効に', '观影前后路线 · 充分利用观影前后的时间', 'Trước & sau phim · Tận dụng thời gian của bạn', 'ก่อนและหลังหนัง · ใช้เวลาให้คุ้มค่า', 'До и после кино · Проведите время с пользой', 'Sebelum & sesudah film · Manfaatkan waktumu'),
  Course_Subtitle_Result: L('영화 전후 코스 · 상영 시각에 맞춘 추천 코스입니다', 'Before & after the movie · Planned around your showtime', '映画の前後コース・上映時刻に合わせたおすすめ', '观影前后路线 · 根据场次推荐', 'Trước & sau phim · Gợi ý theo giờ chiếu', 'ก่อนและหลังหนัง · แนะนำตามรอบฉาย', 'До и после кино · Маршрут под ваш сеанс', 'Sebelum & sesudah film · Sesuai jam tayang'),
  Course_PickMovie: L('보실 영화와 시간', 'Movie & showtime', '映画と上映回', '影片和场次', 'Phim & suất chiếu', 'หนังและรอบฉาย', 'Фильм и сеанс', 'Film & jam tayang'),
  Course_Span_Before: L('상영 전 {t}', '{t} before', '上映前 {t}', '观影前 {t}', 'Trước phim {t}', 'ก่อนฉาย {t}', 'До сеанса {t}', '{t} sebelum film'),
  Course_Span_After: L('상영 후 {t}', '{t} after', '上映後 {t}', '观影后 {t}', 'Sau phim {t}', 'หลังฉาย {t}', 'После сеанса {t}', '{t} setelah film'),
  Course_OpenOnly: L('그 시각에 열려 있는 곳만 골랐어요', 'Only places open at that time', 'その時間に営業中の場所だけを選びました', '只选了那时营业的地方', 'Chỉ chọn nơi mở cửa vào giờ đó', 'เลือกเฉพาะที่เปิดในเวลานั้น', 'Только места, открытые в это время', 'Hanya tempat yang buka saat itu'),
  Course_Kind_Both: L('앞뒤 코스', 'Before & after', '前後コース', '前后路线', 'Trước & sau', 'ก่อนและหลัง', 'До и после', 'Sebelum & sesudah'),
  Course_Kind_Before: L('상영 전 코스', 'Before the movie', '上映前コース', '观影前路线', 'Trước phim', 'ก่อนหนัง', 'До фильма', 'Sebelum film'),
  Course_Kind_After: L('상영 후 코스', 'After the movie', '上映後コース', '观影后路线', 'Sau phim', 'หลังหนัง', 'После фильма', 'Setelah film'),
  Course_NoTimeBefore: L('상영 전에는 들를 시간이 부족해요', 'Not enough time for a stop before the movie', '上映前に立ち寄る時間が足りません', '观影前时间不够', 'Không đủ thời gian ghé trước phim', 'มีเวลาไม่พอแวะก่อนหนัง', 'До сеанса не хватит времени', 'Waktu sebelum film tidak cukup'),
  Course_NoneOpenBefore: L('상영 전에는 지금 문을 연 곳이 없어요', 'Nothing is open before the movie', '上映前に営業中の場所がありません', '观影前没有营业的地方', 'Không có nơi mở cửa trước phim', 'ก่อนหนังไม่มีที่เปิดอยู่', 'До сеанса ничего не открыто', 'Tidak ada yang buka sebelum film'),
  Course_NoneOpenAfter: L('상영 후에는 지금 문을 연 곳이 없어요', 'Nothing is open after the movie', '上映後に営業中の場所がありません', '观影后没有营业的地方', 'Không có nơi mở cửa sau phim', 'หลังหนังไม่มีที่เปิดอยู่', 'После сеанса ничего не открыто', 'Tidak ada yang buka setelah film'),
  Course_QR_Title: L('코스를 휴대폰으로 가져가기', 'Take this course on your phone', 'コースをスマホへ', '把路线带到手机上', 'Mang lộ trình theo điện thoại', 'นำเส้นทางไปบนมือถือ', 'Маршрут на телефон', 'Bawa rute ke ponsel'),
  Course_QR_Sub: L('QR 을 찍으면 이 코스와 매장 위치가 열립니다.', 'Scan the QR to open this course and the store locations.', 'QRを読み取るとコースと店舗の場所が開きます。', '扫描二维码即可打开路线和店铺位置。', 'Quét QR để mở lộ trình và vị trí cửa hàng.', 'สแกน QR เพื่อเปิดเส้นทางและตำแหน่งร้าน', 'Отсканируйте QR — откроются маршрут и адреса магазинов.', 'Pindai QR untuk membuka rute dan lokasi toko.'),
  Course_Walk_Short: L('도보 {n}분', '{n} min walk', '徒歩{n}分', '步行{n}分钟', 'Đi bộ {n} phút', 'เดิน {n} นาที', '{n} мин пешком', 'Jalan {n} mnt'),
  Course_Here: L('지금 여기', 'You are here', '現在地', '当前位置', 'Bạn đang ở đây', 'คุณอยู่ที่นี่', 'Вы здесь', 'Anda di sini'),
  Course_Kiosk: L('키오스크', 'Kiosk', 'キオスク', '自助终端', 'Kiosk', 'คีออสก์', 'Киоск', 'Kios'),
  Course_EnterName: L('상영관 입장', 'Enter the theater', '入場', '入场', 'Vào rạp', 'เข้าโรงภาพยนตร์', 'Вход в зал', 'Masuk teater'),
  Course_EnterShort: L('입장', 'In', '入場', '入场', 'Vào', 'เข้า', 'Вход', 'Masuk'),
  Course_ArriveEarly: L('상영 {n}분 전 도착', 'Arrive {n} min early', '上映{n}分前に到着', '开映前{n}分钟到达', 'Đến trước {n} phút', 'มาถึงก่อนฉาย {n} นาที', 'Приходите за {n} мин', 'Tiba {n} menit lebih awal'),
  Course_Meal: L('식사', 'Meal', '食事', '用餐', 'Bữa ăn', 'มื้ออาหาร', 'Еда', 'Makan'),
  Course_Dinner: L('저녁', 'Dinner', '夕食', '晚餐', 'Bữa tối', 'มื้อเย็น', 'Ужин', 'Makan malam'),
  Course_OpenUntil: L('영업 중 · {t} 까지', 'Open until {t}', '営業中・{t}まで', '营业中 · 至{t}', 'Mở cửa đến {t}', 'เปิดถึง {t}', 'Открыто до {t}', 'Buka hingga {t}'),
  Course_OpenAfterUntil: L('상영 후에도 영업 · {t} 까지', 'Still open after the movie · until {t}', '上映後も営業・{t}まで', '观影后仍营业 · 至{t}', 'Vẫn mở sau phim · đến {t}', 'ยังเปิดหลังหนัง · ถึง {t}', 'Открыто и после сеанса · до {t}', 'Masih buka setelah film · hingga {t}'),

  // ── 안녕 로씨 · 시네마 ──
  Hello_Label_Role: L('역할', 'Role', '役割', '角色', 'Vai trò', 'บทบาท', 'Роль', 'Peran'),
  Cinema_Hall_N: L('{n}관', 'Screen {n}', '{n}番スクリーン', '{n}号厅', 'Phòng {n}', 'โรง {n}', 'Зал {n}', 'Studio {n}'),

  // ── 건물 안내 · 핫스팟 card tags ──
  Spot_Cat_시네마: L('시네마', 'Cinema', 'シネマ', '影院', 'Rạp phim', 'โรงภาพยนตร์', 'Кино', 'Bioskop'),
  Spot_Cat_문화: L('문화', 'Culture', '文化', '文化', 'Văn hóa', 'วัฒนธรรม', 'Культура', 'Budaya'),
  Spot_Cat_휴식: L('휴식', 'Rest', '休憩', '休息', 'Nghỉ ngơi', 'พักผ่อน', 'Отдых', 'Istirahat'),
  Spot_Cat_키즈: L('키즈', 'Kids', 'キッズ', '儿童', 'Trẻ em', 'เด็ก', 'Детям', 'Anak'),
  Spot_Cat_외국인: L('외국인', 'Foreign visitors', '外国人', '外国游客', 'Khách nước ngoài', 'ชาวต่างชาติ', 'Иностранцам', 'Wisatawan asing'),
  Spot_Cat_라운지: L('라운지', 'Lounge', 'ラウンジ', '休息室', 'Phòng chờ', 'เลานจ์', 'Лаунж', 'Lounge'),
  Spot_Cat_식당가: L('식당가', 'Dining', 'レストラン街', '餐饮区', 'Khu ẩm thực', 'โซนร้านอาหาร', 'Рестораны', 'Area kuliner'),
  Spot_Cat_웨딩: L('웨딩', 'Wedding', 'ウェディング', '婚礼', 'Cưới hỏi', 'งานแต่งงาน', 'Свадьбы', 'Pernikahan'),

  // ── 건물 안내 ──
  Site_Hours_MallDept: L('쇼핑몰 {mall} · 백화점 {dept}', 'Mall {mall} · Department store {dept}', 'モール {mall}・百貨店 {dept}', '购物中心 {mall} · 百货店 {dept}', 'Trung tâm {mall} · Bách hóa {dept}', 'ห้าง {mall} · ห้างสรรพสินค้า {dept}', 'ТЦ {mall} · Универмаг {dept}', 'Mal {mall} · Department store {dept}'),
} as const satisfies Record<string, Copy>;

export type CopyKey = keyof typeof COPY;

/**
 * The copy for `key` in `lang`: the sheet's row when it has one (any language), else the line
 * above. `{x}` slots are filled from `vars`.
 */
export function tc(key: CopyKey, lang: Lang, vars?: Record<string, string | number>): string {
  const authored = COPY[key];
  let text = hasLoc(key) ? sheetText(key, lang, authored) : inLang(authored, lang);
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/**
 * A sheet row whose key differs from the copy key — the row's cell in `lang` (Korean included),
 * else `tc(key)`. For lines the sheet already carries under its own name ('MainButton_Here_Subtext'
 * for 여기는 롯데's description, 'Weather_Title' for the 날씨 box).
 */
export function tcRow(row: string, key: CopyKey, lang: Lang, vars?: Record<string, string | number>): string {
  if (!tExact(row, lang)) return tc(key, lang, vars);
  let text = tExact(row, lang);
  if (vars) for (const [k, v] of Object.entries(vars)) text = text.split(`{${k}}`).join(String(v));
  return text;
}

/** '1시간 20분' / '50분' in the visitor's language. */
export const spanText = (min: number, lang: Lang): string => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return tc('Unit_Min', lang, { n: m });
  return m ? `${tc('Unit_Hour', lang, { n: h })} ${tc('Unit_Min', lang, { n: m })}` : tc('Unit_Hour', lang, { n: h });
};

/** Korean-only placeholder text → the shared "photo coming soon" line in other languages. */
export const slot = (ko: string, lang: Lang): string => (lang === 'ko' ? ko : tc('Photo_Slot', lang));

/**
 * Header titles by their Korean id → the sheet's MainButton_* row (home tile names, already in
 * all eight languages). Korean keeps the id — "'롯데' 뭐먹지?" with its question mark, as drawn.
 */
const TITLE_KEYS: Record<string, string> = {
  "'롯데' 뭐먹지?": 'MainButton_ToEat',
  "'롯데' 뭐사지?": 'MainButton_ToBuy',
  '롯데 시설안내': 'MainButton_ToHelp',
  "'롯데' 뭐하지": 'MainButton_AI',
  '롯데 이벤트': 'MainButton_Event',
  '여기는 롯데': 'MainButton_Here',
  '오늘의 사연': 'Story_Title',
};

export function lotteTitle(id: string, lang: Lang): string {
  const key = TITLE_KEYS[id];
  if (lang === 'ko') return key ? id : screenTitle(id, lang);
  return key && hasLoc(key) ? sheetText(key, lang, { ko: id }) : screenTitle(id, lang);
}

/** "롯데월드몰 B1F" / "LOTTE WORLD MALL 8F ~ 10F" → the place without its trailing floor(s). */
const stripFloor = (s: string): string => s.replace(/\s+B?\d+F(\s*[~-]\s*B?\d+F)?\s*$/, '').trim();

/**
 * A building or site named in Korean ("롯데월드몰", "롯데백화점 청량리점", "에비뉴엘") in the
 * visitor's language, taken from a FacilityData row located there. Korean, or a name no row is
 * located in, comes back unchanged.
 */
export function placeName(ko: string, kioskId: KioskId, lang: Lang): string {
  if (lang === 'ko' || !ko) return ko;
  const row = lotteFacilityRows(kioskId).find((r) => stripFloor(r.location.ko) === ko)
    ?? lotteFacilityRows(kioskId).find((r) => r.location.ko.includes(ko));
  if (!row) return ko;
  // A partial match ("타워" in "롯데월드타워 1F") names the whole building — right for a tab.
  return stripFloor(inLang(row.location as unknown as Record<string, string>, lang)) || ko;
}

/** The 건물 안내 building chips by Korean name → the home's 건물 단추 rows (Building_Btn_*@W011). */
const BUILDING_KEYS: Record<string, string> = {
  롯데월드몰: 'Building_Btn_Mall',
  롯데월드타워: 'Building_Btn_Tower',
  롯데타워: 'Building_Btn_Tower',
  롯데백화점: 'Building_Btn_Dept',
  롯데월드: 'Building_Btn_LotteWorld',
};

export function buildingName(ko: string, kioskId: KioskId, lang: Lang): string {
  if (lang === 'ko') return ko;
  const key = BUILDING_KEYS[ko];
  const siteKey = key && hasLoc(`${key}@${kioskId}`) ? `${key}@${kioskId}` : key;
  return siteKey && hasLoc(siteKey) ? sheetText(siteKey, lang, { ko }) : placeName(ko, kioskId, lang);
}

/** '쇼핑몰 10:30 ~ 22:00 · 백화점 10:30 ~ 20:00' in the visitor's language; plain hours pass through. */
export function siteHours(ko: string, lang: Lang): string {
  if (lang === 'ko') return ko;
  const m = /쇼핑몰\s*(.+?)\s*·\s*백화점\s*(.+)$/.exec(ko);
  return m ? tc('Site_Hours_MallDept', lang, { mall: m[1]!, dept: m[2]! }) : ko;
}

/** The part of a 핫스팟 card the sheet can name: its FacilityData row, matched by Korean name. */
export interface SpotText {
  name: string;
  intro?: string;
  place: string;
  hours?: string;
  category?: string;
  /** Full location ("LOTTE WORLD MALL B1F") when a row matched — for the 상세 address. */
  location?: string;
  description?: string;
  tel?: string;
}

const hasHangul = (s: string | undefined): boolean => !!s && /[가-힣]/.test(s);

/**
 * A 핫스팟 card (lotteBuildingData, Korean) in the visitor's language. Its FacilityData row —
 * same name, or the row's name inside the card's ("시네마" in "롯데시네마 청량리") — gives the
 * name, category, location, hours and description in all eight languages. Without a row the card
 * stays as written (월드몰's 롯데콘서트홀 · 롯데마트 … are not in the sheet yet).
 */
export function localSpot(
  spot: { name: string; intro?: string; place: string; hours?: string; category?: string },
  kioskId: KioskId,
  lang: Lang,
): SpotText {
  if (lang === 'ko') return spot;
  const rows = lotteFacilityRows(kioskId);
  const tagged = { ...spot, category: spot.category ? spotCategory(spot.category, lang) : undefined };
  const row =
    rows.find((r) => r.name.ko === spot.name) ??
    rows.find((r) => r.name.ko.length >= 3 && spot.name.includes(r.name.ko));
  if (!row) return tagged;
  const pick = (t: object): string => inLang(t as Record<string, string>, lang);
  const floorOnly = /^B?\d/.test(spot.place);
  return {
    name: pick(row.name) || spot.name,
    // The card's one-liner is 월드몰's own; the department stores' rows describe at length,
    // which goes to the 상세 rather than onto the card.
    intro: spot.intro && hasHangul(spot.intro) ? undefined : spot.intro,
    place: floorOnly ? spot.place : stripFloor(pick(row.location)) ? pick(row.location) : spot.place,
    hours: hasHangul(spot.hours) ? row.hours || undefined : spot.hours,
    category: spot.category ? spotCategory(spot.category, lang) : undefined,
    location: pick(row.location),
    description: pick(row.description) || undefined,
    tel: row.tel || undefined,
  };
}

/** A 핫스팟 card's tag ('키즈', '외국인' …) — the card's own word, not the sheet's facility group. */
export function spotCategory(ko: string, lang: Lang): string {
  const key = `Spot_Cat_${ko}` as CopyKey;
  return key in COPY ? tc(key, lang) : ko;
}

/** A cinema hall as the feed names it ('6관') in the visitor's language; 'IMAX관' etc. pass through. */
export function hallName(screen: string, lang: Lang): string {
  const m = /^(\d+)관$/.exec(screen);
  if (!m) return screen;
  const word = tExact('Cinema_Hall', lang); // the sheet's 관 / Hall / 館 …
  if (word) return SUFFIX_LANGS.has(lang) ? `${m[1]}${word}` : `${word} ${m[1]}`;
  return lang === 'ko' ? screen : tc('Cinema_Hall_N', lang, { n: m[1]! });
}

/** Languages that write a counter word straight after the number (3관 · 3館 · 3厅 · 122分). */
const SUFFIX_LANGS: ReadonlySet<Lang> = new Set<Lang>(['ko', 'ja', 'zh']);

/** '122분' / '122 min' — the sheet's Cinema_RunTime unit, else Unit_Min. */
export function minutes(n: number | string, lang: Lang): string {
  const unit = tExact('Cinema_RunTime', lang);
  if (!unit) return tc('Unit_Min', lang, { n });
  return SUFFIX_LANGS.has(lang) ? `${n}${unit}` : `${n} ${unit}`;
}

/** The sheet's spelled-out rating (Cinema_Rating_*) for a badge's '전체' / '12' / '15' / '19'. */
export function ratingLabel(grade: string, lang: Lang): string {
  const row = grade === '전체' ? 'Cinema_Rating_All' : grade === '19' ? 'Cinema_Rating_18' : `Cinema_Rating_${grade}`;
  return tExact(row, lang) || grade;
}
