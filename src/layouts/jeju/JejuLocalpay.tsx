/**
 * 지역화폐 — Figma 6249:32350 (제주>지역화폐=온누리상품권) and 6249:32283
 * (제주>지역화폐=탐나는전). The 베리어프리 (♿) half follows 6326:80281 and
 * 6326:80332, re-read 2026-08-27 — see the low-reach block in the CSS.
 *
 * Two tabs. 온누리상품권 is the national voucher (the same screen Osan and
 * Hwaseong draw, with 제주's own shorter copy); 탐나는전 is 제주특별자치도's own
 * local currency. Each tab is its own Figma frame and they share nothing but the
 * tab row, so this file draws two independent bodies rather than one template.
 *
 * The 온누리 tab is TWO stacked cards (1002 + 1194); 탐나는전 is one tall card
 * (2250). That is the frames' own structure, not a layout choice.
 */
import { useState, type ReactNode } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick, type Lang } from '@renderer/lib/i18n';
import { sheetText, tExact } from '@renderer/lib/loc';
import { trackEvent } from '@renderer/lib/analytics';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuLocalpay.module.css';

/**
 * 온누리 artwork is NATIONAL — the same two files Osan and Hwaseong already
 * bundle, byte-identical to what this frame uses (verified by hash), so it is
 * imported rather than copied. HwaseongLocalpay does the same.
 */
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
/** 제주's own exports. */
import onnuriMascot from '@renderer/assets/photos/jeju/localpay/onnuri-mascot.png';
import onnuriQr from '@renderer/assets/photos/jeju/localpay/onnuri-qr.png';
import tamnaLogo from '@renderer/assets/photos/jeju/localpay/tamna-logo.png';
import tamnaCard from '@renderer/assets/photos/jeju/localpay/tamna-card.png';
import tamnaMobile from '@renderer/assets/photos/jeju/localpay/tamna-mobile.png';
import tamnaPaper from '@renderer/assets/photos/jeju/localpay/tamna-paper.png';
import tamnaAndroid from '@renderer/assets/photos/jeju/localpay/tamna-android.png';
import tamnaIos from '@renderer/assets/photos/jeju/localpay/tamna-ios.png';

type TabId = 'onnuri' | 'tamna';

/**
 * 탐나는전 card — block positions (card-relative px).
 * English keeps the tuned layout; other languages use separate tops.
 */
const TAMNA_BLOCK_TOP = {
  en: { head: 40, kwonjong: 700, apply: 1380, useRow: 1970 },
  locale: { head: 100, kwonjong: 630, apply: 1380, useRow: 1900 },
} as const;

type TamnaBlockTop = { head: number; kwonjong: number; apply: number; useRow: number };

const tamnaBlockTop = (lang: Lang): TamnaBlockTop =>
  lang === 'en' ? TAMNA_BLOCK_TOP.en : TAMNA_BLOCK_TOP.locale;

interface Content {
  tabs: Record<TabId, string>;
  onnuri: {
    /** Heading split at the colour change: [orange, black]. */
    introH: [string, string];
    introBody: string;
    paperLabel: string;
    digitalH: [string, string];
    digitalBody: string;
    usageH: string;
    usageBody: string;
    note: string;
    bullets: [string, string, string, string];
  };
  tamna: {
    introH: string;
    introBody: string;
    kwonjongH: string;
    kwonjongLabels: [string, string, string];
    applyH: string;
    applyBody: string;
    useH: string;
    useBody: string;
  };
}

/**
 * Copy — the FALLBACK layer. `**…**` marks the segments Figma sets in SemiBold
 * and `\n` a paragraph break the frame draws.
 *
 * Localization_Jeju now supplies this page through {@link SHEET_KEYS}; what
 * survives here is what the sheet does not answer. Today that is the seven
 * translations, because all 20 LocalCurrency_* rows are KOREAN ONLY — so Korean
 * follows the sheet and the other seven languages read the copy below.
 *
 * ★ INVARIANT: for every field listed in {@link SHEET_KEYS}, the `ko` copy below
 * is the sheet's own Korean verbatim (only `**`/`\n`, which the sheet cannot
 * store, are added), and the other seven are translations OF THAT KOREAN — not
 * of the Figma frame. Korean already renders the sheet's cell, so anything else
 * would make the page say different things in different languages. Four fields
 * were re-aligned on 2026-08-14 for exactly that reason: introBody (desc_2),
 * digitalBody's first paragraph (desc_5), note (desc_7), and the third sentence
 * of tamna.introBody (desc_11), all of which had been transcribed from the frame
 * while the sheet says something else. Re-check this invariant when the sheet's
 * Korean is reworded.
 *
 * TODO(제주 W006): those seven translations are authored here, following
 * OsanLocalpay, because a Korean-only 지역화폐 page on an international airport
 * kiosk is worse than a careful translation. They describe DISCOUNTS, LIMITS and
 * ELIGIBILITY, so have a person check them — and then move them into the sheet's
 * own language columns, at which point this map is pure fallback.
 */
const CONTENT: Partial<Record<Lang, Content>> = {
  ko: {
    tabs: { onnuri: '온누리상품권', tamna: '탐나는전' },
    onnuri: {
      introH: ['온누리상품권', '이란?'],
      introBody:
        '전국 16개 금융기관에서 5천원, 1만원, 3만원권 단위로 구매하여 사용하는 온누리상품권',
      paperLabel: '지류상품권 권종',
      digitalH: ['디지털 온누리상품권', '이란?'],
      digitalBody:
        '디지털 온누리상품권 앱 설치 후 기존 갖고 있는 카드를 등록하고 금액 충전 후, 실물카드 또는 QR코드 결제 방식으로 이용 가능한 온누리상품권\n상품권 금액의 **10% 할인가**로 충전 가능! **최대 보유한도금액**은 **200만원**입니다.',
      usageH: '온누리상품권 사용처',
      usageBody: '**온누리상품권 가맹점 스티커**가 있는 곳에서 사용이 가능합니다.',
      note: '※ 단, 예산소진 상황에 따라 특별판매 내용 및 기간이 변경될 수 있습니다.',
      bullets: [
        '할인 혜택 : 충전 시 약 10% 할인 적용됨',
        '소득공제 혜택 : 전통시장 사용 시 최대 40% 소득공제 가능',
        '사용처 확대 : 전통시장, 소상공인 매장뿐 아니라 온라인몰·배달앱까지',
        '간편하게 사용 가능 (카드 또는 QR코드 결제)',
      ],
    },
    tamna: {
      introH: '탐나는전이란?',
      introBody:
        '지역 내 소비 진작을 통한 지역상권 활성화와 지역자금의 선순환을 위해 **제주특별자치도가 발행한 제주 전용 지역화폐**입니다.\n제주도 내 가맹점에서만 사용할 수 있는 지역화폐로, 대형마트·기업형 슈퍼마켓·유흥 및 사행성 업소·일부 직영 프랜차이즈 매장을 제외한 IC 카드 단말기를 사용하는 가맹점에서 이용 가능합니다. 또한 탐나는전 앱을 통해 언제 어디서나 간편하게 충전하고 사용 내역과 잔액을 편리하게 관리할 수 있습니다.',
      kwonjongH: '상품권 권종',
      kwonjongLabels: ['카드형', '모바일형', '지류형'],
      applyH: '누구나 신청 가능하나요?',
      applyBody:
        '**제주도민뿐만 아니라 제주를 방문하는 관광객도 신청 가능합니다.**\n만 14세 이상 누구나 이용 가능한 제주 전용 지역화폐로, 제주 내 소비를 통해 지역상권 활성화와 지역경제 선순환에 함께 참여할 수 있습니다. 탐나는전 가맹점에서 사용 시 다양한 혜택을 받을 수 있습니다.\n신청방법은 **탐나는전 앱 회원가입 후 카드 신청 또는 지정 발급처 방문을 통해 신청**할 수 있습니다. 발급된 카드는 앱에서 충전 후 제주 지역 내 가맹점에서 사용할 수 있습니다.',
      useH: '탐나는전 사용처',
      useBody:
        '**제주 지역 내** 음식점·카페·전통시장·소상공인 매장 등 **IC 카드 단말기를 사용하는 대부분의 가맹점**에서 이용 가능합니다.',
    },
  },

  en: {
    tabs: { onnuri: 'Onnuri Voucher', tamna: 'Tamnanunjeon' },
    onnuri: {
      introH: ['Onnuri Voucher', ' — what is it?'],
      introBody:
        'An Onnuri voucher bought in 5,000 / 10,000 / 30,000 won denominations at 16 financial institutions nationwide.',
      paperLabel: 'Paper voucher denominations',
      digitalH: ['Digital Onnuri Voucher', ' — what is it?'],
      digitalBody:
        'An Onnuri voucher you use by installing the Digital Onnuri app, registering a card you already have, topping it up, and paying with the physical card or a QR code.\nTop up at a **10% discount** on the voucher amount. The **maximum balance** you may hold is **KRW 2,000,000**.',
      usageH: 'Where to use it',
      usageBody: 'Accepted anywhere showing the **Onnuri member-store sticker**.',
      note: '※ However, the terms and period of the special sale may change depending on how quickly the budget is used up.',
      bullets: [
        'Discount: about 10% off when you top up',
        'Tax deduction: up to 40% income deduction on traditional-market spending',
        'Wider acceptance: traditional markets and small businesses, plus online malls and delivery apps',
        'Easy to pay with (card or QR code)',
      ],
    },
    tamna: {
      introH: 'What is Tamnanunjeon?',
      introBody:
        'It is **a local currency issued by Jeju Special Self-Governing Province for use in Jeju only**, to boost local spending and keep money circulating in the region.\nIt works only at member stores on Jeju Island — any store with an IC card terminal, except large marts, corporate supermarkets, entertainment and gambling venues, and some directly-operated franchise stores. You can also top up anytime, anywhere in the Tamnanunjeon app and keep track of your spending and balance there.',
      kwonjongH: 'Voucher types',
      kwonjongLabels: ['Card', 'Mobile', 'Paper'],
      applyH: 'Can anyone apply?',
      applyBody:
        '**Visitors to Jeju can apply too, not just Jeju residents.**\nAnyone aged 14 or over can use this Jeju-only local currency and take part in supporting local businesses through spending on the island. Member stores offer a range of benefits.\nTo apply, **sign up in the Tamnanunjeon app and request a card, or visit a designated issuing point**. Top the card up in the app and use it at member stores across Jeju.',
      useH: 'Where to use it',
      useBody:
        'Accepted **on Jeju Island** at restaurants, cafés, traditional markets and small businesses — **most member stores with an IC card terminal**.',
    },
  },

  ja: {
    tabs: { onnuri: 'オンヌリ商品券', tamna: 'タムナヌンジョン' },
    onnuri: {
      introH: ['オンヌリ商品券', 'とは?'],
      introBody:
        '全国16の金融機関で5千ウォン・1万ウォン・3万ウォン券の単位で購入して使うオンヌリ商品券です。',
      paperLabel: '紙商品券の券種',
      digitalH: ['デジタルオンヌリ商品券', 'とは?'],
      digitalBody:
        'デジタルオンヌリ商品券アプリをインストールし、お持ちのカードを登録して金額をチャージした後、実物カードまたはQRコード決済で利用できるオンヌリ商品券です。\n商品券額面の**10%割引**でチャージ可能。**保有限度額**は**200万ウォン**です。',
      usageH: 'オンヌリ商品券の利用先',
      usageBody: '**オンヌリ商品券加盟店ステッカー**のある店舗でご利用いただけます。',
      note: '※ ただし、予算の消尽状況により、特別販売の内容および期間が変更される場合があります。',
      bullets: [
        '割引特典 : チャージ時に約10%割引',
        '所得控除 : 伝統市場での利用時、最大40%の所得控除',
        '利用先の拡大 : 伝統市場・小規模店舗に加え、オンラインモールや宅配アプリでも',
        '手軽に決済 (カードまたはQRコード)',
      ],
    },
    tamna: {
      introH: 'タムナヌンジョンとは?',
      introBody:
        '地域内の消費を促し、商圏の活性化と地域資金の好循環のために**済州特別自治道が発行した済州専用の地域通貨**です。\n済州島内の加盟店でのみ使える地域通貨で、大型マート・企業型スーパー・遊興および射幸業種・一部の直営フランチャイズ店舗を除く、ICカード端末を導入した加盟店で利用できます。また、タムナヌンジョンアプリでいつでもどこでも簡単にチャージでき、利用履歴と残高も手軽に管理できます。',
      kwonjongH: '商品券の種類',
      kwonjongLabels: ['カード型', 'モバイル型', '紙型'],
      applyH: '誰でも申し込めますか?',
      applyBody:
        '**済州道民だけでなく、済州を訪れる観光客も申し込めます。**\n満14歳以上なら誰でも利用できる済州専用の地域通貨で、島内での消費を通じて地域経済の好循環に参加できます。加盟店での利用時にはさまざまな特典があります。\n申請は**タムナヌンジョンアプリの会員登録後にカードを申請するか、指定の発給窓口を訪問**して行います。発行されたカードはアプリでチャージし、済州島内の加盟店で使えます。',
      useH: 'タムナヌンジョンの利用先',
      useBody:
        '**済州島内**の飲食店・カフェ・伝統市場・小規模店舗など、**ICカード端末を導入したほとんどの加盟店**でご利用いただけます。',
    },
  },

  zh: {
    tabs: { onnuri: '温努里商品券', tamna: '耽罗钱' },
    onnuri: {
      introH: ['温努里商品券', '是什么?'],
      introBody:
        '可在全国16家金融机构以5千韩元、1万韩元、3万韩元面额购买使用的温努里商品券。',
      paperLabel: '纸质商品券面额',
      digitalH: ['数字温努里商品券', '是什么?'],
      digitalBody:
        '安装数字温努里商品券应用后，登记您已有的卡片并充值，即可通过实体卡或二维码支付使用的温努里商品券。\n可按商品券金额的**九折**充值，**最高持有限额**为**200万韩元**。',
      usageH: '温努里商品券使用处',
      usageBody: '凡张贴**温努里商品券加盟店贴纸**的店铺均可使用。',
      note: '※ 但根据预算使用情况，特别销售的内容及期间可能会有变动。',
      bullets: [
        '折扣优惠：充值时约享九折',
        '所得扣除：在传统市场使用可享最高40%所得扣除',
        '使用范围扩大：不仅传统市场和小微店铺，线上商城和外卖应用也可使用',
        '支付便捷（刷卡或二维码）',
      ],
    },
    tamna: {
      introH: '耽罗钱是什么?',
      introBody:
        '这是为促进本地消费、振兴商圈并让地方资金良性循环，由**济州特别自治道发行的济州专用地方货币**。\n仅可在济州岛内的加盟店使用，除大型超市、企业型超市、娱乐及博彩场所和部分直营连锁店外，凡使用IC卡终端的加盟店均可使用。此外，还可通过耽罗钱应用随时随地轻松充值，并方便地管理使用记录和余额。',
      kwonjongH: '商品券种类',
      kwonjongLabels: ['卡片型', '手机型', '纸质型'],
      applyH: '任何人都能申请吗?',
      applyBody:
        '**不仅济州岛民，来济州旅游的游客也可以申请。**\n年满14周岁均可使用的济州专用地方货币，通过在岛内消费参与地方商圈振兴与经济良性循环。在加盟店使用还可享受多种优惠。\n申请方式为**在耽罗钱应用注册会员后申请卡片，或前往指定发放处办理**。领到的卡片在应用内充值后，即可在济州地区的加盟店使用。',
      useH: '耽罗钱使用处',
      useBody:
        '在**济州地区**的餐厅、咖啡厅、传统市场、小微店铺等，**大部分使用IC卡终端的加盟店**均可使用。',
    },
  },

  vi: {
    tabs: { onnuri: 'Phiếu Onnuri', tamna: 'Tamnanunjeon' },
    onnuri: {
      introH: ['Phiếu Onnuri', ' là gì?'],
      introBody:
        'Phiếu Onnuri được mua tại 16 tổ chức tài chính trên toàn quốc theo mệnh giá 5.000 / 10.000 / 30.000 won.',
      paperLabel: 'Các mệnh giá phiếu giấy',
      digitalH: ['Phiếu Onnuri điện tử', ' là gì?'],
      digitalBody:
        'Phiếu Onnuri dùng được bằng cách cài ứng dụng Phiếu Onnuri điện tử, đăng ký thẻ bạn đang có, nạp tiền rồi thanh toán bằng thẻ thật hoặc mã QR.\nNạp tiền với **mức giảm 10%** so với mệnh giá. **Hạn mức nắm giữ tối đa** là **2.000.000 KRW**.',
      usageH: 'Nơi sử dụng',
      usageBody: 'Dùng được ở những nơi có dán **nhãn cửa hàng thành viên Onnuri**.',
      note: '※ Tuy nhiên, nội dung và thời gian của đợt bán đặc biệt có thể thay đổi tùy theo tình hình sử dụng ngân sách.',
      bullets: [
        'Ưu đãi giảm giá: giảm khoảng 10% khi nạp tiền',
        'Khấu trừ thuế: khấu trừ thu nhập tối đa 40% khi chi tiêu ở chợ truyền thống',
        'Mở rộng nơi dùng: chợ truyền thống, cửa hàng nhỏ, và cả sàn thương mại điện tử, ứng dụng giao hàng',
        'Thanh toán đơn giản (thẻ hoặc mã QR)',
      ],
    },
    tamna: {
      introH: 'Tamnanunjeon là gì?',
      introBody:
        'Đây là **đồng tiền địa phương dành riêng cho Jeju, do tỉnh tự trị đặc biệt Jeju phát hành**, nhằm kích cầu tiêu dùng tại chỗ và giữ dòng tiền luân chuyển trong vùng.\nChỉ dùng được tại các cửa hàng thành viên trên đảo Jeju — mọi cửa hàng có máy đọc thẻ IC, trừ siêu thị lớn, siêu thị doanh nghiệp, cơ sở giải trí và cờ bạc, và một số cửa hàng nhượng quyền trực thuộc. Ngoài ra, bạn có thể nạp tiền mọi lúc mọi nơi qua ứng dụng Tamnanunjeon và dễ dàng theo dõi lịch sử sử dụng cùng số dư.',
      kwonjongH: 'Các loại phiếu',
      kwonjongLabels: ['Dạng thẻ', 'Dạng di động', 'Dạng giấy'],
      applyH: 'Ai cũng đăng ký được không?',
      applyBody:
        '**Không chỉ người dân Jeju, du khách đến Jeju cũng có thể đăng ký.**\nBất kỳ ai từ 14 tuổi trở lên đều dùng được đồng tiền địa phương này và cùng góp phần vào vòng tuần hoàn kinh tế của đảo. Các cửa hàng thành viên có nhiều ưu đãi.\nĐể đăng ký, **hãy tạo tài khoản trên ứng dụng Tamnanunjeon rồi yêu cầu cấp thẻ, hoặc đến điểm phát hành được chỉ định**. Thẻ đã cấp được nạp tiền trong ứng dụng và dùng tại các cửa hàng thành viên ở Jeju.',
      useH: 'Nơi sử dụng',
      useBody:
        'Dùng được **trên đảo Jeju** tại nhà hàng, quán cà phê, chợ truyền thống, cửa hàng nhỏ — **hầu hết cửa hàng thành viên có máy đọc thẻ IC**.',
    },
  },

  th: {
    tabs: { onnuri: 'บัตรกำนัลอนนูรี', tamna: 'ทัมนานึนจอน' },
    onnuri: {
      introH: ['บัตรกำนัลอนนูรี', ' คืออะไร?'],
      introBody:
        'บัตรกำนัลอนนูรีที่ซื้อได้ที่สถาบันการเงิน 16 แห่งทั่วประเทศ ในมูลค่า 5,000 / 10,000 / 30,000 วอน',
      paperLabel: 'มูลค่าบัตรกำนัลแบบกระดาษ',
      digitalH: ['บัตรกำนัลอนนูรีดิจิทัล', ' คืออะไร?'],
      digitalBody:
        'บัตรกำนัลอนนูรีที่ใช้ได้โดยติดตั้งแอปบัตรกำนัลอนนูรีดิจิทัล ลงทะเบียนบัตรที่มีอยู่เดิม เติมเงิน แล้วชำระด้วยบัตรจริงหรือคิวอาร์โค้ด\nเติมเงินได้ในราคา**ลด 10%** ของมูลค่าบัตร **วงเงินถือครองสูงสุด**คือ **2,000,000 วอน**',
      usageH: 'สถานที่ใช้บัตรกำนัลอนนูรี',
      usageBody: 'ใช้ได้ที่ร้านซึ่งติด**สติกเกอร์ร้านค้าสมาชิกอนนูรี**',
      note: '※ ทั้งนี้ เนื้อหาและระยะเวลาของการจำหน่ายพิเศษอาจเปลี่ยนแปลงตามสถานการณ์การใช้งบประมาณ',
      bullets: [
        'ส่วนลด : ลดประมาณ 10% เมื่อเติมเงิน',
        'ลดหย่อนภาษี : ลดหย่อนเงินได้สูงสุด 40% เมื่อใช้จ่ายในตลาดดั้งเดิม',
        'ขยายจุดใช้งาน : ทั้งตลาดดั้งเดิม ร้านค้ารายย่อย รวมถึงห้างออนไลน์และแอปส่งอาหาร',
        'ชำระเงินง่าย (บัตรหรือคิวอาร์โค้ด)',
      ],
    },
    tamna: {
      introH: 'ทัมนานึนจอนคืออะไร?',
      introBody:
        'เป็น**เงินท้องถิ่นเฉพาะเชจูที่ออกโดยจังหวัดปกครองตนเองพิเศษเชจู** เพื่อกระตุ้นการใช้จ่ายในพื้นที่และให้เงินหมุนเวียนอยู่ในท้องถิ่น\nใช้ได้เฉพาะร้านค้าสมาชิกบนเกาะเชจู คือร้านที่มีเครื่องรูดบัตร IC ยกเว้นห้างค้าปลีกขนาดใหญ่ ซูเปอร์มาร์เก็ตของบริษัท สถานบันเทิงและการพนัน และร้านแฟรนไชส์ที่บริษัทดำเนินการเองบางแห่ง นอกจากนี้ยังเติมเงินได้ทุกที่ทุกเวลาผ่านแอปทัมนานึนจอน และดูประวัติการใช้จ่ายกับยอดคงเหลือได้อย่างสะดวก',
      kwonjongH: 'ประเภทบัตรกำนัล',
      kwonjongLabels: ['แบบบัตร', 'แบบมือถือ', 'แบบกระดาษ'],
      applyH: 'ใครก็สมัครได้ไหม?',
      applyBody:
        '**ไม่ใช่แค่ชาวเชจู นักท่องเที่ยวที่มาเยือนเชจูก็สมัครได้**\nผู้มีอายุ 14 ปีขึ้นไปใช้ได้ทุกคน และร่วมเป็นส่วนหนึ่งของการหมุนเวียนเศรษฐกิจบนเกาะผ่านการใช้จ่าย ร้านค้าสมาชิกมีสิทธิประโยชน์หลากหลาย\nวิธีสมัครคือ**สมัครสมาชิกในแอปทัมนานึนจอนแล้วขอออกบัตร หรือไปที่จุดออกบัตรที่กำหนด** บัตรที่ได้รับให้เติมเงินในแอป แล้วใช้ที่ร้านค้าสมาชิกในเชจูได้เลย',
      useH: 'สถานที่ใช้ทัมนานึนจอน',
      useBody:
        'ใช้ได้**ในพื้นที่เชจู** ทั้งร้านอาหาร คาเฟ่ ตลาดดั้งเดิม ร้านค้ารายย่อย และ**ร้านค้าสมาชิกส่วนใหญ่ที่มีเครื่องรูดบัตร IC**',
    },
  },

  ru: {
    tabs: { onnuri: 'Ваучер Оннури', tamna: 'Тамнанынджон' },
    onnuri: {
      introH: ['Ваучер Оннури', ' — что это?'],
      introBody:
        'Ваучер Оннури, который покупают номиналами 5 000, 10 000 и 30 000 вон в 16 финансовых учреждениях по всей стране.',
      paperLabel: 'Номиналы бумажного ваучера',
      digitalH: ['Цифровой ваучер Оннури', ' — что это?'],
      digitalBody:
        'Ваучер Оннури, которым пользуются так: установить приложение «Цифровой ваучер Оннури», привязать уже имеющуюся карту, пополнить баланс и платить самой картой или по QR-коду.\nПополнение — со **скидкой 10%** от номинала. **Максимальный остаток** — **2 000 000 вон**.',
      usageH: 'Где принимают',
      usageBody: 'Принимают там, где есть **наклейка магазина-участника Оннури**.',
      note: '※ Однако содержание и сроки специальной продажи могут измениться в зависимости от расходования бюджета.',
      bullets: [
        'Скидка: около 10% при пополнении',
        'Налоговый вычет: до 40% вычета при тратах на традиционных рынках',
        'Больше мест приёма: традиционные рынки и малый бизнес, а также онлайн-магазины и приложения доставки',
        'Простая оплата (картой или по QR-коду)',
      ],
    },
    tamna: {
      introH: 'Что такое Тамнанынджон?',
      introBody:
        'Это **местная валюта только для Чеджу, выпущенная особой самоуправляемой провинцией Чеджудо**, чтобы оживить местную торговлю и удержать деньги в регионе.\nПринимается только в магазинах-участниках на острове Чеджу — в любой точке с терминалом IC-карт, кроме гипермаркетов, сетевых супермаркетов, развлекательных и игорных заведений и части фирменных франчайзинговых магазинов. Кроме того, в приложении Тамнанынджон можно пополнять баланс в любое время и в любом месте и удобно следить за историей трат и остатком.',
      kwonjongH: 'Виды ваучера',
      kwonjongLabels: ['Карта', 'Мобильный', 'Бумажный'],
      applyH: 'Может ли оформить любой?',
      applyBody:
        '**Оформить может не только житель Чеджу, но и турист, приехавший на остров.**\nВалютой может пользоваться любой человек от 14 лет, участвуя тратами в обороте местной экономики. В магазинах-участниках действуют разные льготы.\nЧтобы оформить, **зарегистрируйтесь в приложении Тамнанынджон и закажите карту либо обратитесь в назначенный пункт выдачи**. Полученную карту пополняют в приложении и используют в магазинах-участниках на Чеджу.',
      useH: 'Где принимают',
      useBody:
        'Принимают **на острове Чеджу** в ресторанах, кафе, на традиционных рынках и в небольших магазинах — **в большинстве магазинов-участников с терминалом IC-карт**.',
    },
  },

  id: {
    tabs: { onnuri: 'Voucher Onnuri', tamna: 'Tamnanunjeon' },
    onnuri: {
      introH: ['Voucher Onnuri', ' itu apa?'],
      introBody:
        'Voucher Onnuri yang dibeli dalam pecahan 5.000 / 10.000 / 30.000 won di 16 lembaga keuangan di seluruh negeri.',
      paperLabel: 'Pecahan voucher kertas',
      digitalH: ['Voucher Onnuri digital', ' itu apa?'],
      digitalBody:
        'Voucher Onnuri yang dipakai dengan memasang aplikasi Voucher Onnuri Digital, mendaftarkan kartu yang sudah Anda miliki, mengisi saldo, lalu membayar dengan kartu fisik atau kode QR.\nIsi saldo dengan **potongan 10%** dari nilai voucher. **Batas saldo maksimum** adalah **KRW 2.000.000**.',
      usageH: 'Tempat pemakaian',
      usageBody: 'Berlaku di tempat yang memasang **stiker toko anggota Onnuri**.',
      note: '※ Namun, isi dan periode penjualan khusus dapat berubah tergantung penyerapan anggaran.',
      bullets: [
        'Diskon: potongan sekitar 10% saat isi saldo',
        'Potongan pajak: pengurangan penghasilan hingga 40% untuk belanja di pasar tradisional',
        'Cakupan lebih luas: pasar tradisional dan usaha kecil, juga mal daring dan aplikasi pesan-antar',
        'Pembayaran mudah (kartu atau kode QR)',
      ],
    },
    tamna: {
      introH: 'Apa itu Tamnanunjeon?',
      introBody:
        'Ini **mata uang daerah khusus Jeju yang diterbitkan Provinsi Otonomi Khusus Jeju**, untuk mendorong belanja setempat dan menjaga perputaran uang di daerah.\nHanya berlaku di toko anggota di Pulau Jeju — semua toko bermesin kartu IC, kecuali hypermarket, supermarket korporat, tempat hiburan dan perjudian, serta sebagian gerai waralaba milik perusahaan. Selain itu, Anda bisa mengisi saldo kapan saja dan di mana saja lewat aplikasi Tamnanunjeon serta memantau riwayat pemakaian dan sisa saldo dengan mudah.',
      kwonjongH: 'Jenis voucher',
      kwonjongLabels: ['Kartu', 'Ponsel', 'Kertas'],
      applyH: 'Apakah semua orang bisa mendaftar?',
      applyBody:
        '**Bukan hanya warga Jeju, wisatawan yang berkunjung ke Jeju pun bisa mendaftar.**\nSiapa pun berusia 14 tahun ke atas bisa memakainya dan ikut menggerakkan ekonomi pulau lewat belanja. Toko anggota menawarkan beragam manfaat.\nCara mendaftar: **buat akun di aplikasi Tamnanunjeon lalu ajukan kartu, atau datang ke tempat penerbitan yang ditunjuk**. Kartu yang terbit diisi saldo lewat aplikasi dan dipakai di toko anggota di Jeju.',
      useH: 'Tempat pemakaian',
      useBody:
        'Berlaku **di wilayah Jeju** pada restoran, kafe, pasar tradisional dan usaha kecil — **sebagian besar toko anggota bermesin kartu IC**.',
    },
  },
};

/** Split `**…**` into SemiBold runs and `\n` into paragraphs. */
function rich(text: string): ReactNode {
  return text.split('\n').map((line, li) => (
    <p key={li} className={styles.body}>
      {line.split('**').map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className={styles.bodyBold}>
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </p>
  ));
}

/**
 * Localization_Jeju key for each editable field, so the 지역화폐 copy is changed
 * in the sheet rather than in a release.
 *
 * `digitalBody` takes TWO keys because the frame draws two paragraphs and the
 * sheet stores them as separate rows (desc_5 the description, desc_6 the
 * discount and holding limit); they are joined with the `\n` this page's
 * renderer already treats as a paragraph break.
 *
 * The two-tone headings — onnuri.introH and digitalH, drawn as [orange, black] —
 * are NOT listed. Their sheet rows (desc_1 / desc_4) store the heading as one
 * string, and {@link splitHeading} re-derives the colour split from it, so they
 * still follow the sheet without needing the split encoded in a cell.
 *
 * `**…**` works inside these cells: `richRuns` renders it as SemiBold, the same
 * way the home screen's NoticeContent carries literal `<b>` markers. The sheet's
 * Korean does not use them today, so the emphasis the frame draws on
 * "10% 할인가" / "최대 보유한도금액" / "200만원" is absent until someone adds them.
 */
const SHEET_KEYS = {
  tabs: { onnuri: 'LocalCurrency_Tab_1', tamna: 'LocalCurrency_Tab_2' },
  onnuri: {
    introBody: 'LocalCurrency_desc_2',
    paperLabel: 'LocalCurrency_desc_3',
    digitalBody: ['LocalCurrency_desc_5', 'LocalCurrency_desc_6'],
    usageH: 'LocalCurrency_desc_8',
    usageBody: 'LocalCurrency_desc_9',
    note: 'LocalCurrency_desc_7',
    bullets: 'LocalCurrency_desc_10',
  },
  tamna: {
    introH: 'LocalCurrency_desc_11',
    introBody: 'LocalCurrency_desc_12',
    kwonjongH: 'LocalCurrency_desc_13',
    applyH: 'LocalCurrency_desc_14',
    applyBody: 'LocalCurrency_desc_15',
    useH: 'LocalCurrency_desc_16',
    useBody: 'LocalCurrency_desc_17',
  },
} as const;

/**
 * Rows whose Korean is this page's, but whose OTHER seven columns still hold
 * copy from a different screen — desc_10 answers "Search for the name of the
 * company you booked", desc_11 "All", desc_12 "Desk inside the airport",
 * desc_13 "Airport Shuttle", desc_14 "No shuttle". Re-read against the live
 * Localization_Jeju tab on 2026-09-02; the generated table matches it, so this
 * is the SHEET's own state, not a stale sync.
 *
 * {@link sheetText} takes any non-empty cell for the visitor's language, so
 * without this set an English visitor on 탐나는전 reads those strings verbatim.
 * Korean still follows the sheet; the other seven languages fall back to the
 * authored translation in {@link CONTENT}. DELETE a key from here as soon as its
 * language columns are refilled — while it is listed the sheet cannot drive that
 * row's translations.
 */
const KO_ONLY_ROWS = new Set<string>([
  'LocalCurrency_desc_10',
  'LocalCurrency_desc_11',
  'LocalCurrency_desc_12',
  'LocalCurrency_desc_13',
  'LocalCurrency_desc_14',
]);

/**
 * Split the sheet's bullet cell into the frame's four lines.
 *
 * desc_10 stores all four benefits in ONE cell: every line is prefixed "・ " and
 * the separator is a literal backslash-n the author typed, FOLLOWED by a real
 * newline. The list renderer draws its own "·" marker, so both the marker and
 * separator come off here. A cell that does not yield exactly four lines is
 * ignored and the authored four stand — the card's height is fixed and the
 * .bullets block already overflows it (see the KNOWN note in the CSS).
 */
function sheetBullets(
  cell: string,
  authored: Content['onnuri']['bullets'],
): Content['onnuri']['bullets'] {
  const lines = cell
    .split(/\\n|\n/)
    .map((line) => line.replace(/^\s*[・·•*]\s*/, '').trim())
    .filter(Boolean);
  return lines.length === authored.length
    ? (lines as unknown as Content['onnuri']['bullets'])
    : authored;
}

/**
 * Re-split a sheet heading into the frame's [orange, black] pair.
 *
 * The sheet stores "온누리상품권이란?" as one cell while the frame colours the
 * TERM and leaves the "이란?" after it black. When the sheet's heading still
 * begins with the authored orange segment the split is exact; when it does not —
 * a rewritten heading, or a language whose grammar puts the term elsewhere — the
 * whole heading takes the accent rather than being cut at a guessed offset.
 */
function splitHeading(sheet: string, authored: readonly [string, string]): [string, string] {
  if (!sheet) return [authored[0], authored[1]];
  return sheet.startsWith(authored[0])
    ? [authored[0], sheet.slice(authored[0].length)]
    : [sheet, ''];
}

/** Overlay the sheet's cells for `lang` onto the authored copy. */
function withSheet(c: Content, lang: Lang): Content {
  /**
   * Sheet cell for THIS language, else the authored copy — which `c` has ALREADY
   * resolved to `lang` (it is `pick(CONTENT, lang)`), so it belongs in that
   * language's slot.
   *
   * ★ Until 2026-08-14 this passed `{ ko: fallback }`, putting an English (or
   * Japanese, or Thai) string in the Korean slot. `sheetText` then found nothing
   * at step 2 and fell through to `t()`, which answers the sheet's KOREAN for a
   * language it has no cell for — and every LocalCurrency_* row is Korean-only.
   * The result was a 지역화폐 page that rendered Korean to every visitor except
   * for the four bullets, the three 권종 labels and the two accent headings,
   * which carry no sheet key and so never went through here. Nothing errored.
   *
   * `ko` is still filled so the very last branch — key missing from the sheet
   * entirely — returns copy rather than ''.
   */
  const s = (key: string, fallback: string): string =>
    KO_ONLY_ROWS.has(key) && lang !== 'ko'
      ? fallback
      : sheetText(key, lang, { ko: fallback, [lang]: fallback });
  const k = SHEET_KEYS;
  const digital = k.onnuri.digitalBody
    .map((key, i) => s(key, c.onnuri.digitalBody.split('\n')[i] ?? ''))
    .filter(Boolean)
    .join('\n');

  return {
    tabs: {
      onnuri: s(k.tabs.onnuri, c.tabs.onnuri),
      tamna: s(k.tabs.tamna, c.tabs.tamna),
    },
    onnuri: {
      ...c.onnuri,
      introH: splitHeading(tExact('LocalCurrency_desc_1', lang), c.onnuri.introH),
      introBody: s(k.onnuri.introBody, c.onnuri.introBody),
      paperLabel: s(k.onnuri.paperLabel, c.onnuri.paperLabel),
      digitalH: splitHeading(tExact('LocalCurrency_desc_4', lang), c.onnuri.digitalH),
      digitalBody: digital || c.onnuri.digitalBody,
      usageH: s(k.onnuri.usageH, c.onnuri.usageH),
      usageBody: s(k.onnuri.usageBody, c.onnuri.usageBody),
      note: s(k.onnuri.note, c.onnuri.note),
      bullets: sheetBullets(s(k.onnuri.bullets, ''), c.onnuri.bullets),
    },
    tamna: {
      ...c.tamna,
      introH: s(k.tamna.introH, c.tamna.introH),
      introBody: s(k.tamna.introBody, c.tamna.introBody),
      kwonjongH: s(k.tamna.kwonjongH, c.tamna.kwonjongH),
      applyH: s(k.tamna.applyH, c.tamna.applyH),
      applyBody: s(k.tamna.applyBody, c.tamna.applyBody),
      useH: s(k.tamna.useH, c.tamna.useH),
      useBody: s(k.tamna.useBody, c.tamna.useBody),
    },
  };
}

interface Props {
  controller: KioskController;
}

export function JejuLocalpay({ controller }: Props): JSX.Element {
  const lang = useLanguageStore((s) => s.currentLanguage);
  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /**
   * 탐나는전 leads the tab row (left); 온누리상품권 is second. 제주's own local
   * currency is what visitors come to this screen for, so it is also the landing
   * tab. The Figma frames draw 온누리 first — deliberately not followed. The row
   * order below is the drawn order, so the first entry is the landing tab.
   */
  const [tab, setTab] = useState<TabId>('tamna');
  // `pick` falls back to Korean for the language codes this copy does not carry
  // (zh_cn / zh_tw / es), exactly as every other 제주 screen's label maps do;
  // `withSheet` then lets Localization_Jeju override whatever it has filled.
  const c = withSheet(pick(CONTENT, lang), lang);
  const tamnaTop = tamnaBlockTop(lang);

  /*
   * ♿ re-lays this page out rather than shifting it, so almost every positioned
   * element takes a second class. Type and copy are untouched — see the low-reach
   * block in the CSS for the y map and the two normalisations behind it.
   */
  const low = (base?: string, alt?: string): string =>
    `${base ?? ''} ${lowReach ? alt ?? '' : ''}`;
  /* The shell is identical in both layouts — only the card's own top and height
     differ, which is what `variantLow` carries. */
  const card = (variant?: string, variantLow?: string): string =>
    `${styles.card} ${low(variant, variantLow)}`;

  const select = (id: TabId): void => {
    trackEvent({
      name: 'button_clicked',
      payload: { screen: 'localpay', tab: id, kioskId: controller.kioskId },
    });
    setTab(id);
  };

  return (
    // Same 상점 검색 promo the 상세 pages carry, which is what both frames draw.
    <JejuPageFrame
      controller={controller}
      title="지역화폐"
      bannerFallback="banner-detail"
      /* ♿: the 113px mode bar replaces the promo banner entirely and the header
         drops to y116. The body stays at 0 — the cards below carry their own
         low-reach coordinates. */
      lowReachModeBar
      lowReachShift={116}
    >
      <div className={low(styles.tabs, styles.tabsLow)}>
        {(['tamna', 'onnuri'] as const).map((id) => (
          <button
            key={id}
            type="button"
            className={`${styles.tab} ${id === tab ? styles.tabActive : ''}`}
            onClick={() => select(id)}
          >
            {c.tabs[id]}
          </button>
        ))}
      </div>

      {tab === 'onnuri' ? (
        <>
          {/* ── 온누리상품권이란? + 지류상품권 권종 (6249:32378) ── */}
          <section className={card(styles.cardIntro, styles.cardIntroLow)}>
            <div className={low(styles.introText, styles.introTextLow)}>
              <p className={styles.h70}>
                <span className={styles.accent}>{c.onnuri.introH[0]}</span>
                {c.onnuri.introH[1]}
              </p>
              <p className={styles.body}>{c.onnuri.introBody}</p>
            </div>

            <div className={low(styles.paperPanel, styles.paperPanelLow)}>
              <p className={styles.paperLabel}>{c.onnuri.paperLabel}</p>
              <div className={styles.paperImage}>
                <img src={onnuriPaper} alt="" draggable={false} />
              </div>
            </div>
          </section>

          {/* ── 디지털 온누리상품권이란? + 사용처 (6249:32386) ── */}
          <section className={card(styles.cardDigital, styles.cardDigitalLow)}>
            <div className={low(styles.digitalText, styles.digitalTextLow)}>
              <p className={styles.h70}>
                <span className={styles.accent}>{c.onnuri.digitalH[0]}</span>
                {c.onnuri.digitalH[1]}
              </p>
              <div>{rich(c.onnuri.digitalBody)}</div>
            </div>

            <div className={low(styles.usageBlock, styles.usageBlockLow)}>
              <p className={styles.h50}>{c.onnuri.usageH}</p>
              <div>{rich(c.onnuri.usageBody)}</div>
            </div>

            <div className={low(styles.beige, styles.beigeLow)} />
            {/* AFTER .beige, as the frame stacks them (32390 → 32392): the
                mascots' feet stand ON the beige plate, not under it. */}
            <img
              className={low(styles.mascot, styles.mascotLow)}
              src={onnuriMascot}
              alt=""
              draggable={false}
            />
            <p className={low(styles.beigeNote, styles.beigeNoteLow)}>{c.onnuri.note}</p>
            <ul className={low(styles.bullets, styles.bulletsLow)}>
              {c.onnuri.bullets.map((b) => (
                <li key={b}>· {b}</li>
              ))}
            </ul>
            <img className={low(styles.bi, styles.biLow)} src={onnuriBi} alt="" draggable={false} />
            <div className={low(styles.qrPlate, styles.qrPlateLow)} />
            <img
              className={low(styles.qrImage, styles.qrImageLow)}
              src={onnuriQr}
              alt=""
              draggable={false}
            />
          </section>
        </>
      ) : (
        /* ── 탐나는전 (6249:32310) ── */
        <section className={card(styles.cardTamna, styles.cardTamnaLow)}>
          {/* Head + lower blocks: tops from `TAMNA_BLOCK_TOP` per language. */}
          <div className={styles.tamnaHead} style={{ top: tamnaTop.head }}>
            <img className={styles.tamnaLogo} src={tamnaLogo} alt="" draggable={false} />
            <div className={styles.tamnaIntro}>
              <p className={styles.h60}>{c.tamna.introH}</p>
              <div>{rich(c.tamna.introBody)}</div>
            </div>
          </div>

          <div className={styles.kwonjong} style={{ top: tamnaTop.kwonjong }}>
            <p className={styles.h60}>{c.tamna.kwonjongH}</p>
            <div className={styles.kwonjongPanel} />
            <img
              className={`${styles.kwonjongImg} ${styles.kwCard}`}
              src={tamnaCard}
              alt=""
              draggable={false}
            />
            <img
              className={`${styles.kwonjongImg} ${styles.kwMobile}`}
              src={tamnaMobile}
              alt=""
              draggable={false}
            />
            <img
              className={`${styles.kwonjongImg} ${styles.kwPaper}`}
              src={tamnaPaper}
              alt=""
              draggable={false}
            />
            <p className={`${styles.kwLabel} ${styles.kwLabelCard}`}>{c.tamna.kwonjongLabels[0]}</p>
            <p className={`${styles.kwLabel} ${styles.kwLabelMobile}`}>{c.tamna.kwonjongLabels[1]}</p>
            <p className={`${styles.kwLabel} ${styles.kwLabelPaper}`}>{c.tamna.kwonjongLabels[2]}</p>
            {/* Last, as the frame stacks them (6249:32325 / 32326): the column
                rules sit ON TOP of the artwork, not under it. */}
            <div className={`${styles.kwDivider} ${styles.kwDividerLeft}`} />
            <div className={`${styles.kwDivider} ${styles.kwDividerRight}`} />
          </div>

          <div className={styles.apply} style={{ top: tamnaTop.apply }}>
            <p className={styles.h60}>{c.tamna.applyH}</p>
            <div>{rich(c.tamna.applyBody)}</div>
          </div>

          <div className={styles.useRow} style={{ top: tamnaTop.useRow }}>
            <div className={styles.useText}>
              <p className={styles.h60}>{c.tamna.useH}</p>
              <div>{rich(c.tamna.useBody)}</div>
            </div>

            <div className={styles.stores}>
              <div className={`${styles.store} ${styles.storeAndroid}`}>
                <img
                  className={`${styles.storeQr} ${styles.storeQrAndroid}`}
                  src={tamnaAndroid}
                  alt=""
                  draggable={false}
                />
                <p className={styles.storeLabel}>Android</p>
              </div>
              <div className={`${styles.store} ${styles.storeIos}`}>
                <img
                  className={`${styles.storeQr} ${styles.storeQrIos}`}
                  src={tamnaIos}
                  alt=""
                  draggable={false}
                />
                <p className={styles.storeLabel}>iOS</p>
              </div>
            </div>
          </div>
        </section>
      )}
    </JejuPageFrame>
  );
}
