/**
 * 지역화폐 — Figma 7918:130132 (희망화성지역화폐) and 7918:130079 (온누리상품권).
 *
 * Header · two tabs at y700 · the tab's cards in one column that scrolls between
 * the header and the 상점 검색 promo (3267), as on 오산's 시장화폐 page:
 *
 *   희망화성지역화폐  a new layout: "란?" intro card with the card art (944,
 *                     1820×1002) and "신청부터 사용까지" (1998, 1820×1194) —
 *                     four app steps, 사용처 with the Android / Apple app QRs,
 *                     and the 소득공제 box
 *   온누리상품권      오산's 온누리 cards (OsanLocalpay) in 화성 main 1 / main 2,
 *                     reading 오산's eight-language copy (LOCALPAY_CONTENT)
 *
 * The 희망화성 copy is the frame's (Korean) with English written here; the
 * other languages read English. Localization_Hwaseong's MarketPaper_Osaekjeon_*
 * rows are older text (행복화성, 오산 banks) and are not used. The frames title
 * the page 환율 — copied from the 환율 frame — so the header keeps 지역화폐.
 */
import { type ReactNode, useRef, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { hwaseongIconUrl } from '@renderer/assets/icons/hwaseong';
import { pick, useLang, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { ui } from '@renderer/lib/uiText';
import { useFitText } from '@layouts/components/fitText';
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriMascot from '@renderer/assets/photos/hwaseong/localpay/onnuri-mascot.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
import onnuriAppQr from '@renderer/assets/photos/osan/localpay/app-qr.png';
import hopeCard from '@renderer/assets/photos/hwaseong/localpay/hope-card.png';
import androidQr from '@renderer/assets/photos/hwaseong/localpay/app-android.png';
import iosQr from '@renderer/assets/photos/hwaseong/localpay/app-ios.png';
import { LOCALPAY_CONTENT } from '../osan/OsanLocalpay';
import { HwaseongHeader } from './HwaseongHeader';
import { HwaseongLeftNav } from './HwaseongLeftNav';
import { HwaseongPageBg } from './HwaseongPageBg';
import styles from './HwaseongLocalpay.module.css';

type Text = Partial<Record<Lang, string>>;
/** Korean from the frame, English authored, the other six written here —
 *  Localization_Hwaseong has no rows for this card. `\n` starts a paragraph. */
const tr = (ko: string, en: string, rest: Omit<Text, 'ko' | 'en'>): Text => ({ ko, en, ...rest });

/** 희망화성지역화폐 (7956:81013). */
const HOPE = {
  tab: tr("희망화성지역화폐", "Hope Hwaseong Currency", {"ja":"希望華城地域通貨","zh":"希望华城地方货币","vi":"Tiền địa phương Hy vọng Hwaseong","th":"สกุลเงินท้องถิ่นโฮปฮวาซอง","ru":"Местная валюта «Надежда Хвасона»","id":"Mata Uang Lokal Hope Hwaseong"}),
  name: tr("희망화성지역화폐", "Hope Hwaseong Currency", {"ja":"希望華城地域通貨","zh":"希望华城地方货币","vi":"Tiền địa phương Hy vọng Hwaseong","th":"สกุลเงินท้องถิ่นโฮปฮวาซอง","ru":"«Надежда Хвасона»","id":"Hope Hwaseong"}),
  nameSuffix: tr("란?", ": what is it?", {"ja":"とは？","zh":"是什么？","vi":" là gì?","th":" คืออะไร?","ru":" — что это?","id":": apa itu?"}),
  intro: tr("화성시 등록 가맹점에서 사용할 수 있는 충전식 카드형 지역화폐입니다.\n지역 상점에서 결제한 금액이 지역 안에서 순환하며, 소상공인과 지역 경제에\n힘이 됩니다. 거주지와 관계없이 만 14세 이상이면 누구나 신청할 수 있습니다.", "A rechargeable card-type local currency for stores registered in Hwaseong. Money spent at local shops circulates within the region, supporting small businesses and the local economy. Anyone aged 14 or over can apply, wherever they live.", {"ja":"華城市の登録加盟店で使えるチャージ式カード型の地域通貨です。地元のお店で支払ったお金が地域内で循環し、小規模事業者と地域経済を支えます。居住地に関係なく、満14歳以上ならどなたでも申し込めます。","zh":"可在华城市登记加盟店使用的充值式卡片型地方货币。在本地商店消费的金额在地区内循环，助力小商户和地方经济。不论居住地，年满14岁即可申请。","vi":"Tiền địa phương dạng thẻ nạp tiền, dùng tại các cửa hàng đã đăng ký ở Hwaseong. Số tiền chi tiêu tại cửa hàng địa phương sẽ lưu thông trong khu vực, hỗ trợ tiểu thương và kinh tế địa phương. Bất kỳ ai từ 14 tuổi trở lên đều có thể đăng ký, dù sống ở đâu.","th":"สกุลเงินท้องถิ่นแบบบัตรเติมเงิน ใช้ได้ที่ร้านค้าที่ลงทะเบียนในฮวาซอง เงินที่ใช้จ่ายในร้านท้องถิ่นจะหมุนเวียนในพื้นที่ ช่วยสนับสนุนผู้ประกอบการรายย่อยและเศรษฐกิจท้องถิ่น ผู้ที่มีอายุ 14 ปีขึ้นไปสมัครได้ทุกคน ไม่ว่าจะอาศัยอยู่ที่ใด","ru":"Пополняемая карта местной валюты для магазинов, зарегистрированных в Хвасоне. Деньги, потраченные в местных магазинах, остаются в регионе и поддерживают малый бизнес и местную экономику. Оформить карту может любой человек от 14 лет, независимо от места проживания.","id":"Mata uang lokal berbentuk kartu isi ulang untuk toko terdaftar di Hwaseong. Uang yang dibelanjakan di toko lokal berputar di dalam daerah, mendukung usaha kecil dan ekonomi lokal. Siapa pun berusia 14 tahun ke atas dapat mendaftar, di mana pun tinggalnya."}),
  keyTitle: tr("앱에서 충전하고, 카드로 결제!", "Top up in the app, pay by card!", {"ja":"アプリでチャージ、カードで支払い！","zh":"在App充值，用卡支付！","vi":"Nạp tiền trong ứng dụng, thanh toán bằng thẻ!","th":"เติมเงินในแอป จ่ายด้วยบัตร!","ru":"Пополняйте в приложении, платите картой!","id":"Isi ulang di aplikasi, bayar dengan kartu!"}),
  keyBody: tr("경기지역화폐 앱에서 카드 신청,\n충전 및 가맹점 확인이 가능합니다.", "Apply for the card, top up and find\nmember stores in the Gyeonggi Local Currency app.", {"ja":"京畿地域通貨アプリでカードの申し込み、チャージ、加盟店の確認ができます。","zh":"可在京畿地方货币App申请卡片、充值并查询加盟店。","vi":"Đăng ký thẻ, nạp tiền và tìm cửa hàng liên kết trong ứng dụng Tiền địa phương Gyeonggi.","th":"สมัครบัตร เติมเงิน และค้นหาร้านค้าที่ร่วมรายการได้ในแอปสกุลเงินท้องถิ่นคย็องกี","ru":"Оформление карты, пополнение и поиск магазинов — в приложении местной валюты провинции Кёнгидо.","id":"Ajukan kartu, isi ulang, dan cari toko mitra di aplikasi Mata Uang Lokal Gyeonggi."}),
  keyPrep: tr("준비물: 본인 명의 휴대폰·계좌", "You need: a phone and bank account in your name", {"ja":"必要なもの：本人名義の携帯電話・口座","zh":"所需材料：本人名下的手机·银行账户","vi":"Cần có: điện thoại và tài khoản ngân hàng đứng tên bạn","th":"สิ่งที่ต้องใช้: โทรศัพท์และบัญชีธนาคารในชื่อของคุณ","ru":"Нужны: телефон и банковский счёт на ваше имя","id":"Yang diperlukan: ponsel dan rekening bank atas nama Anda"}),
  applyTitle: tr("신청부터 사용까지", "From applying to paying", {"ja":"申し込みから利用まで","zh":"从申请到使用","vi":"Từ đăng ký đến thanh toán","th":"ตั้งแต่สมัครจนถึงใช้งาน","ru":"От заявки до оплаты","id":"Dari pendaftaran hingga pembayaran"}),
  applyBody: tr("경기지역화폐 앱에서 신청하세요. 본인 명의 휴대폰과 계좌가 필요합니다.", "Apply in the Gyeonggi Local Currency app. You need a phone and bank account in your name.", {"ja":"京畿地域通貨アプリで申し込んでください。本人名義の携帯電話と口座が必要です。","zh":"请在京畿地方货币App申请。需要本人名下的手机和银行账户。","vi":"Đăng ký trong ứng dụng Tiền địa phương Gyeonggi. Cần điện thoại và tài khoản ngân hàng đứng tên bạn.","th":"สมัครได้ในแอปสกุลเงินท้องถิ่นคย็องกี ต้องใช้โทรศัพท์และบัญชีธนาคารในชื่อของคุณ","ru":"Подайте заявку в приложении местной валюты Кёнгидо. Нужны телефон и банковский счёт на ваше имя.","id":"Daftar di aplikasi Mata Uang Lokal Gyeonggi. Diperlukan ponsel dan rekening bank atas nama Anda."}),
  steps: [
    { title: tr("01 회원가입", "01 Sign up", {"ja":"01 会員登録","zh":"01 注册会员","vi":"01 Đăng ký","th":"01 สมัครสมาชิก","ru":"01 Регистрация","id":"01 Daftar"}), body: tr("경기지역화폐 앱", "Gyeonggi Local Currency app", {"ja":"京畿地域通貨アプリ","zh":"京畿地方货币App","vi":"Ứng dụng Tiền địa phương Gyeonggi","th":"แอปสกุลเงินท้องถิ่นคย็องกี","ru":"Приложение валюты Кёнгидо","id":"Aplikasi Mata Uang Lokal Gyeonggi"}) },
    { title: tr("02 카드 신청", "02 Apply for a card", {"ja":"02 カード申込","zh":"02 申请卡片","vi":"02 Đăng ký thẻ","th":"02 สมัครบัตร","ru":"02 Заявка на карту","id":"02 Ajukan kartu"}), body: tr("앱에서 카드 신청", "Apply in the app", {"ja":"アプリでカード申込","zh":"在App申请卡片","vi":"Đăng ký trong ứng dụng","th":"สมัครบัตรในแอป","ru":"Заявка в приложении","id":"Ajukan di aplikasi"}) },
    { title: tr("03 카드 등록·계좌 연결", "03 Register · link account", {"ja":"03 カード登録・口座連携","zh":"03 绑卡·关联账户","vi":"03 Đăng ký thẻ · liên kết tài khoản","th":"03 ลงทะเบียนบัตร · ผูกบัญชี","ru":"03 Привязка карты и счёта","id":"03 Daftarkan kartu · tautkan rekening"}), body: tr("본인 명의 계좌 연결", "Link your own bank account", {"ja":"本人名義の口座を連携","zh":"关联本人名下账户","vi":"Liên kết tài khoản của bạn","th":"ผูกบัญชีในชื่อของคุณ","ru":"Привяжите свой счёт","id":"Tautkan rekening Anda"}) },
    { title: tr("04 충전·사용", "04 Top up · pay", {"ja":"04 チャージ・利用","zh":"04 充值·使用","vi":"04 Nạp tiền · thanh toán","th":"04 เติมเงิน · ใช้จ่าย","ru":"04 Пополнение и оплата","id":"04 Isi ulang · bayar"}), body: tr("가맹점에서 카드 결제", "Pay by card at member stores", {"ja":"加盟店でカード払い","zh":"在加盟店刷卡支付","vi":"Thanh toán thẻ tại cửa hàng liên kết","th":"ชำระด้วยบัตรที่ร้านค้าที่ร่วมรายการ","ru":"Оплата картой в магазинах-участниках","id":"Bayar dengan kartu di toko mitra"}) },
  ],
  usageTitle: tr("희망화성지역화폐 사용처", "Where to use it", {"ja":"希望華城地域通貨の使える場所","zh":"希望华城地方货币使用场所","vi":"Nơi sử dụng","th":"สถานที่ใช้งาน","ru":"Где можно использовать","id":"Tempat penggunaan"}),
  usageBody: tr("화성시 등록 가맹점에서 사용 가능합니다. 가맹점은 앱에서 확인하세요.\n백화점·대형마트·기업형 슈퍼마켓·유흥 및 사행업종,\n본사 직영 프랜차이즈·대중교통·일반 온라인 결제는 제한됩니다.\n배달특급에서는 지역화폐를 사용할 수 있습니다.", "Usable at stores registered in Hwaseong — find them in the app.\nNot accepted at department stores, large marts, corporate supermarkets, entertainment and gambling venues, franchise head-office stores, public transport or general online payments.\nIt can be used on Baedal Teukgeup.", {"ja":"華城市の登録加盟店で使えます。加盟店はアプリで確認してください。\n百貨店・大型スーパー・企業型スーパー・遊興および射幸業種、本社直営フランチャイズ・公共交通機関・一般オンライン決済では使えません。\n配達特急では地域通貨が使えます。","zh":"可在华城市登记加盟店使用，加盟店请在App中查询。\n百货商店、大型超市、企业型超市、娱乐及博彩业、总部直营连锁店、公共交通及一般网上支付不可使用。\n“配达特急”可使用地方货币。","vi":"Dùng được tại các cửa hàng đã đăng ký ở Hwaseong — xem danh sách trong ứng dụng.\nKhông áp dụng tại trung tâm thương mại, đại siêu thị, siêu thị chuỗi doanh nghiệp, cơ sở giải trí và cờ bạc, cửa hàng nhượng quyền do trụ sở trực tiếp vận hành, giao thông công cộng và thanh toán trực tuyến thông thường.\nCó thể dùng trên ứng dụng giao đồ ăn Baedal Teukgeup.","th":"ใช้ได้ที่ร้านค้าที่ลงทะเบียนในฮวาซอง ตรวจสอบรายชื่อร้านได้ในแอป\nใช้ไม่ได้ที่ห้างสรรพสินค้า ไฮเปอร์มาร์เก็ต ซูเปอร์มาร์เก็ตของบริษัทใหญ่ สถานบันเทิงและการพนัน ร้านแฟรนไชส์ที่บริษัทแม่บริหารเอง ระบบขนส่งสาธารณะ และการชำระเงินออนไลน์ทั่วไป\nใช้ได้บนแอปสั่งอาหาร Baedal Teukgeup","ru":"Принимается в магазинах, зарегистрированных в Хвасоне, — список смотрите в приложении.\nНе принимается в универмагах, гипермаркетах, сетевых супермаркетах, развлекательных и игорных заведениях, собственных магазинах франшиз, общественном транспорте и при обычной онлайн-оплате.\nМожно платить в сервисе доставки Baedal Teukgeup.","id":"Dapat digunakan di toko terdaftar di Hwaseong — cek daftarnya di aplikasi.\nTidak berlaku di department store, hipermarket, supermarket korporasi, tempat hiburan dan perjudian, gerai waralaba milik kantor pusat, transportasi umum, dan pembayaran online umum.\nDapat digunakan di aplikasi pesan antar Baedal Teukgeup."}),
  benefitTitle: tr("소득공제 30% · 충전 혜택은 앱에서 확인", "30% income deduction · see top-up benefits in the app", {"ja":"所得控除30%・チャージ特典はアプリで確認","zh":"30%所得扣除 · 充值优惠请在App查看","vi":"Khấu trừ thu nhập 30% · xem ưu đãi nạp tiền trong ứng dụng","th":"ลดหย่อนภาษี 30% · ดูสิทธิประโยชน์การเติมเงินในแอป","ru":"Налоговый вычет 30% · бонусы за пополнение — в приложении","id":"Potongan pajak 30% · cek bonus isi ulang di aplikasi"}),
  benefitPoints: tr("· 본인 명의 카드만 소득공제가 가능합니다.\n· 카드 등록 시 자동 신청되며, 이전 사용분은 소급 공제되지 않습니다.", "· Only cards in your own name qualify for the deduction.\n· It is applied for automatically when you register the card; earlier spending is not deducted retroactively.", {"ja":"· 所得控除は本人名義のカードのみ対象です。\n· カード登録時に自動で申請され、それ以前の利用分は遡って控除されません。","zh":"· 仅本人名下的卡片可享受所得扣除。\n· 绑卡时自动申请，此前的消费不追溯扣除。","vi":"· Chỉ thẻ đứng tên bạn mới được khấu trừ thu nhập.\n· Tự động đăng ký khi bạn đăng ký thẻ; chi tiêu trước đó không được khấu trừ hồi tố.","th":"· ลดหย่อนได้เฉพาะบัตรในชื่อของคุณเท่านั้น\n· ระบบสมัครให้อัตโนมัติเมื่อลงทะเบียนบัตร ยอดใช้จ่ายก่อนหน้านั้นจะไม่ได้รับการลดหย่อนย้อนหลัง","ru":"· Вычет действует только для карт, оформленных на ваше имя.\n· Заявка подаётся автоматически при регистрации карты; более ранние расходы не учитываются.","id":"· Hanya kartu atas nama Anda yang berhak atas potongan pajak.\n· Diajukan otomatis saat kartu didaftarkan; pengeluaran sebelumnya tidak dipotong surut."}),
  benefitNote: tr("충전 인센티브와 한도는 시기·예산에 따라 달라질 수 있습니다.\n경기지역화폐 앱에서 확인하세요.", "Top-up incentives and limits may change with timing and budget.\nCheck the Gyeonggi Local Currency app.", {"ja":"チャージ特典と上限額は時期・予算により変わることがあります。\n京畿地域通貨アプリで確認してください。","zh":"充值奖励和限额可能因时期和预算而变动。\n请在京畿地方货币App中确认。","vi":"Ưu đãi và hạn mức nạp tiền có thể thay đổi theo thời điểm và ngân sách.\nVui lòng kiểm tra trong ứng dụng Tiền địa phương Gyeonggi.","th":"สิทธิประโยชน์และวงเงินการเติมเงินอาจเปลี่ยนแปลงตามช่วงเวลาและงบประมาณ\nโปรดตรวจสอบในแอปสกุลเงินท้องถิ่นคย็องกี","ru":"Бонусы и лимиты пополнения могут меняться в зависимости от периода и бюджета.\nПодробности — в приложении местной валюты Кёнгидо.","id":"Insentif dan batas isi ulang dapat berubah sesuai periode dan anggaran.\nCek di aplikasi Mata Uang Lokal Gyeonggi."}),
};

/** Render body copy where **…** segments are emphasised (600 weight). */
function renderRich(text: string): ReactNode {
  return text.split('**').map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className={styles.bodyBold}>
        {part}
      </strong>
    ) : (
      part
    ),
  );
}

/** A heading ending in 이란? shows that suffix in black, the rest main 1. */
function renderHeading(text: string): ReactNode {
  return text.endsWith('이란?') ? (
    <>
      {text.slice(0, -3)}
      <span className={styles.headBlack}>이란?</span>
    </>
  ) : (
    text
  );
}

/** One `\n`-separated line per paragraph. */
function Lines({ text, className }: { text: string; className?: string }): JSX.Element {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <p key={i} className={className}>
          {line}
        </p>
      ))}
    </>
  );
}

interface Props {
  controller: KioskController;
}

export function HwaseongLocalpay({ controller }: Props): JSX.Element {
  const lang = useLang();
  const T = (text: Text): string => pick(text, lang);
  const onnuri = pick(LOCALPAY_CONTENT, lang).onnuri;
  const [tab, setTab] = useState(0);
  const goHome = (): void => controller.navigate('home', 'Back');
  const banner = hwaseongIconUrl('banner-search');

  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  useFitText(tabsRef, styles.tab, wide, 0.72, lang);
  /* 온누리 benefit bullets: a translation that wraps past the light box shrinks
     the list together (keyed on the tab — the box only exists on 온누리). */
  const lightBoxRef = useRef<HTMLDivElement>(null);
  useFitText(lightBoxRef, styles.benefits, wide, 0.7, `${lang}|${tab}`, 'height');
  const tabs = [T(HOPE.tab), pick(LOCALPAY_CONTENT, lang).tabs[1]];

  return (
    <div className={styles.root}>
      <HwaseongPageBg />

      <HwaseongHeader
        controller={controller}
        title="지역화폐"
        subtitle={sheetText('MarketPaper_SubHeader', lang) || undefined}
        onHome={goHome}
      />

      <div className={styles.page}>
        <div ref={tabsRef} className={styles.tabs}>
          {tabs.map((label, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.tab} ${wide ? styles.tabLong : ''} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 0 ? (
          <>
            {/* 지역화폐 소개 (7956:81014) */}
            <section className={`${styles.hopeCard} ${styles.hopeIntro}`}>
              <p className={styles.heading}>
                {T(HOPE.name)}
                <span className={styles.headBlack}>{T(HOPE.nameSuffix)}</span>
              </p>
              <div>
                <Lines text={T(HOPE.intro)} className={styles.body} />
              </div>
              <div className={styles.keyBox}>
                <div className={styles.keyCard}>
                  <img src={hopeCard} alt="" draggable={false} />
                </div>
                <div className={styles.keyText}>
                  <p className={styles.keyTitle}>{T(HOPE.keyTitle)}</p>
                  <div className={styles.keyBody}>
                    <Lines text={T(HOPE.keyBody)} />
                  </div>
                  <p className={styles.keyPrep}>{T(HOPE.keyPrep)}</p>
                </div>
              </div>
            </section>

            {/* 신청 및 사용 안내 (7956:81025) */}
            <section className={`${styles.hopeCard} ${styles.hopeApply}`}>
              <p className={styles.heading}>{T(HOPE.applyTitle)}</p>
              <p className={styles.body}>{T(HOPE.applyBody)}</p>
              <div className={styles.steps}>
                {HOPE.steps.map((s, i) => (
                  <div key={i} className={styles.step}>
                    <p className={styles.stepTitle}>{T(s.title)}</p>
                    <p className={styles.stepBody}>{T(s.body)}</p>
                  </div>
                ))}
              </div>
              <p className={styles.subHeading}>{T(HOPE.usageTitle)}</p>
              <div className={styles.usageRow}>
                <div className={styles.usageText}>
                  <Lines text={T(HOPE.usageBody)} />
                </div>
                {[
                  { src: androidQr, label: 'Android' },
                  { src: iosQr, label: 'Apple' },
                ].map((q) => (
                  <div key={q.label} className={styles.appTile}>
                    <img src={q.src} alt="" draggable={false} />
                    <span>{q.label}</span>
                  </div>
                ))}
              </div>
              <div className={styles.benefitBox}>
                <p className={styles.benefitTitle}>{T(HOPE.benefitTitle)}</p>
                <div className={styles.benefitPoints}>
                  <Lines text={T(HOPE.benefitPoints)} />
                </div>
                <div className={styles.benefitNote}>
                  <Lines text={T(HOPE.benefitNote)} />
                </div>
              </div>
            </section>
          </>
        ) : (
          /* 온누리상품권 (7918:130124 / 130104) — 오산's two cards. */
          <>
            <div className={styles.cardOnnuriTop}>
              <div className={styles.topText}>
                <p className={styles.heading}>{renderHeading(onnuri.introH)}</p>
                <p className={styles.body}>{onnuri.introBody}</p>
              </div>
              <div className={styles.paperBox}>
                <p className={styles.paperLabel}>{onnuri.paperH}</p>
                <img className={styles.paperImg} src={onnuriPaper} alt="" draggable={false} />
              </div>
            </div>

            <div className={styles.cardOnnuriBottom}>
              <div className={styles.bottomText}>
                <p className={styles.heading}>{renderHeading(onnuri.digitalH)}</p>
                {onnuri.digitalBefore.map((line, i) => (
                  <p key={i} className={styles.body}>
                    {line}
                  </p>
                ))}
                <p className={styles.body}>{renderRich(onnuri.digitalAfter)}</p>
              </div>

              <img className={styles.mascot} src={onnuriMascot} alt="" draggable={false} />

              <div className={styles.usageSection}>
                <p className={styles.subHeading}>{onnuri.usageH}</p>
                <p className={styles.body}>{renderRich(onnuri.usageBody)}</p>
              </div>

              <div ref={lightBoxRef} className={`${styles.lightBox} ${wide ? styles.lightBoxLong : ''}`}>
                <p className={styles.lightNote}>{onnuri.digitalNote}</p>
                {(onnuri.benefits ?? []).length > 0 && (
                  <div className={styles.benefits}>
                    {(onnuri.benefits ?? []).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
                <img className={styles.lightBi} src={onnuriBi} alt="" draggable={false} />
                <div className={styles.lightQr}>
                  <img src={onnuriAppQr} alt="" draggable={false} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <HwaseongLeftNav onHome={goHome} />

      {/* The 상점 검색 promo (orange strip) — opens 검색. */}
      {banner && (
        <button
          type="button"
          className={styles.banner}
          onClick={() => controller.navigate('search', '검색')}
          aria-label={ui('searchShops', lang)}
        >
          <img src={banner} alt="" draggable={false} />
        </button>
      )}
    </div>
  );
}
