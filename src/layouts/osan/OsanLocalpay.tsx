import { type ReactNode, useRef, useState } from 'react';
import type { SupportedLanguage } from '@shared/types/kiosk';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useLanguageStore } from '@renderer/store/languageStore';
import { osanIconUrl } from '@renderer/assets/icons/osan';
import onnuriPaper from '@renderer/assets/photos/osan/localpay/onnuri-paper.png';
import onnuriDigital from '@renderer/assets/photos/osan/localpay/onnuri-digital.png';
import onnuriBi from '@renderer/assets/photos/osan/localpay/onnuri-bi.png';
import card1 from '@renderer/assets/photos/osan/localpay/card1.png';
import card2 from '@renderer/assets/photos/osan/localpay/card2.png';
import iosQr from '@renderer/assets/photos/osan/localpay/ios.png';
import androidQr from '@renderer/assets/photos/osan/localpay/android.png';
import appQr from '@renderer/assets/photos/osan/localpay/app-qr.png';
import { OsanHeader } from './OsanHeader';
import { sheetText } from '@renderer/lib/loc';
import bannerImg from '@renderer/assets/photos/osan/exchange/exchange-banner.png';
import { OsanLeftNav } from './OsanLeftNav';
import styles from './OsanLocalpay.module.css';
import { useFitText } from '@layouts/components/fitText';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';

type Lang = SupportedLanguage;
function pick<T>(map: Partial<Record<Lang, T>>, lang: Lang): T {
  return (map[lang] ?? map.ko ?? (Object.values(map)[0] as T)) as T;
}

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

interface LocalpayContent {
  title: string;
  tabs: [string, string];
  onnuri: {
    title: string;
    introH: string;
    introBody: string;
    paperH: string;
    digitalH: string;
    digitalBefore: string[];
    digitalAfter: string;
    digitalNote: string;
    usageH: string;
    usageBody: string;
    /** Benefit bullets in the light box (Korean only for now). */
    benefits?: string[];
  };
  osaek: {
    title: string;
    introH: string;
    introBody: string[];
    iosLabel: string;
    androidLabel: string;
    applyH: string;
    applyBody: string[];
    usageH: string;
    usageBody: string;
    usageList: string[];
  };
}

/** 지역화폐 — text verbatim from Figma (오산>지역화폐=온누리상품권 / =오색전);
 *  other languages translate the same copy. */
const CONTENT: Partial<Record<Lang, LocalpayContent>> = {
  ko: {
    title: '지역화폐',
    tabs: ['오색전', '온누리상품권'],
    onnuri: {
      title: '온누리상품권',
      introH: '온누리상품권이란?',
      introBody: '전통시장과 상점가의 활성화를 위해 발행된 전용 상품권으로, 전국의 온누리상품권 가맹점에서 다양한 상품과 서비스를 구매할 때 사용할 수 있습니다. 전통시장과 지역 상점가를 이용하면서 할인 혜택도 받고, 지역 경제 활성화에도 도움을 줄 수 있는 편리한 상품권입니다.',
      paperH: '지류상품권 권종',
      digitalH: '디지털 온누리상품권이란?',
      digitalBefore: [
        '스마트폰을 이용해 더욱 편리하게 사용할 수 있는 디지털 형태의 온누리상품권입니다. 모바일 앱을 통해 상품권을 충전하고, 가맹점에서 QR 또는 카드 결제 방식으로 간편하게 사용할 수 있습니다.',
      ],
      digitalAfter: '상품권 금액의 **10% 할인가**로 충전 가능! **최대 보유한도금액**은 **200만원**입니다.',
      digitalNote: '※ 할인율 및 혜택은 정책 및 판매 상황에 따라 변경될 수 있습니다.',
      usageH: '온누리상품권 사용처',
      usageBody: '**온누리상품권 가맹점 스티커**가 있는 곳에서 사용이 가능합니다.',
      benefits: [
        '· 할인 혜택 : 충전 시 약 10% 할인 적용됨',
        '· 소득공제 혜택 : 전통시장 사용 시 최대 40% 소득공제 가능',
        '· 사용처 확대 : 전통시장, 소상공인 매장뿐 아니라 온라인몰·배달앱까지',
        '· 간편하게 사용 가능 (카드 또는 QR코드 결제)',
      ],
    },
    osaek: {
      title: '오산화폐 「오색전」이란?',
      introH: '오산화폐 오색전이란?',
      introBody: [
        '**오산시 내에서만 사용할 수 있는 카드형 지역화폐 입니다.**',
        '대형마트, 기업형 슈퍼마켓, 유흥업소, 사행성 업소, 오산에 주소지를 두고 있지 않은 프랜차이즈 직영점을 제외한 **관내 IC 카드 단말기를 사용하는 업소 어디에서나 사용 가능**합니다. 또한 경기지역화폐 APP과 연동하여 언제, 어디서나 편리하게 충전하고 잔액을 관리 할 수 있습니다.',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: '누구나 신청 가능 하나요?',
      applyBody: [
        '**본인 명의의 은행계좌를 가지고 있는 만14세 이상이면 신청 가능합니다.**',
        '오산 자금의 역외유출을 방지하여 우리 지역경제 활성화와 지역공동체 강화를 도모하는 오산시 지역화폐로, **거주지역에 상관없이 오산시에서 소비하고 추가 포인트 혜택 받고싶은 누구나 신청 가능합니다.**',
        '신청방법은 **모바일앱(경기지역화폐APP)** 또는 **관내 NH농협은행, 오산농협, 새마을금고, 새오산신협**에서 신청해주세요.',
      ],
      usageH: '지역화폐사용처',
      usageBody: '백화점, 대형마트, 기업형슈퍼마켓(SSM), 프랜차이즈 직영점 및 유흥 사행업소는 사용이 제한되며 **연 매출 10억 이하인 소상공인 점포에서만 사용 가능합니다.**',
      usageList: [
        '주유소 · 전통시장 · 골목상권 · 레저업소 (헬스클럽, 필라테스, 수영장, 골프연습장, 볼링장)',
        '병·의원 (치과, 한의원 등) · 편의점 · 학원 (기능학원, 보습학원 등) · 보건위생 (안경, 미용원 등)',
        '기타의료기관 (동물병원 등)',
      ],
    },
  },
  en: {
    title: 'Local Currency',
    tabs: ['Osaek-jeon', 'Onnuri Voucher'],
    onnuri: {
      title: 'Onnuri Gift Voucher',
      introH: 'What is the Onnuri voucher?',
      introBody: 'An Onnuri voucher made to support traditional markets and shopping streets. It can be used at Onnuri voucher member stores nationwide for a wide range of goods and services. Shopping at traditional markets and local shopping streets earns discounts while supporting the local economy.',
      paperH: 'Paper voucher denominations',
      digitalH: 'What is the digital Onnuri voucher?',
      digitalBefore: [
        'The digital form of the Onnuri voucher, made for more convenient use on your smartphone. Top up through the mobile app and pay at member stores by QR code or card.',
      ],
      digitalAfter: 'Top up at a **10% discount** on the voucher amount! The **maximum balance** is **₩2,000,000**.',
      digitalNote: '※ Discount rates and benefits may change depending on policy and sales conditions.',
      usageH: 'Where to use',
      usageBody: 'Can be used at places displaying the **Onnuri voucher member-store sticker**.',
      benefits: [
        '· Discount: about 10% off when you top up',
        '· Income deduction: up to 40% deduction for use at traditional markets',
        '· Wider use: traditional markets, small-business stores, online malls and delivery apps',
        '· Easy to use (card or QR-code payment)',
      ],
    },
    osaek: {
      title: 'Osan Currency “Osaek-jeon”',
      introH: 'What is Osan currency Osaek-jeon?',
      introBody: [
        '**A card-type local currency that can be used only within Osan City.**',
        'Except for large marts, corporate supermarkets, entertainment and gambling venues, and franchise direct stores not based in Osan, it can be used at **any store with an in-city IC card terminal**. It also links with the Gyeonggi Local Currency app, so you can top up and manage your balance anytime, anywhere.',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: 'Can anyone apply?',
      applyBody: [
        '**Anyone aged 14+ with a bank account in their own name can apply.**',
        'As Osan’s local currency it prevents capital outflow and boosts the local economy and community — **anyone who wants to spend in Osan and earn extra points can apply, regardless of where they live.**',
        'Apply via the **mobile app (Gyeonggi Local Currency app)** or at **local NH Bank, Osan Nonghyup, Saemaeul Geumgo or Sae-Osan Credit Union**.',
      ],
      usageH: 'Where to use',
      usageBody: 'Use is restricted at department stores, large marts, corporate supermarkets (SSM), franchise direct stores and entertainment/gambling venues; **usable only at small-business stores with annual sales of ₩1 billion or less.**',
      usageList: [
        'Gas stations · traditional markets · alley shops · leisure (gym, pilates, pool, golf range, bowling)',
        'Clinics (dental, oriental medicine, etc.) · convenience stores · academies · health & beauty (optical, salon)',
        'Other medical facilities (animal hospitals, etc.)',
      ],
    },
  },
  ja: {
    title: '地域通貨',
    tabs: ['五色銭', 'オンヌリ商品券'],
    onnuri: {
      title: 'オンヌリ商品券',
      introH: 'オンヌリ商品券とは？',
      introBody: '伝統市場と商店街の活性化のために発行された専用商品券で、全国のオンヌリ商品券加盟店で多様な商品やサービスを購入するときに使えます。伝統市場や地域の商店街を利用しながら割引特典も受けられ、地域経済の活性化にも役立ちます。',
      paperH: '紙商品券の券種',
      digitalH: 'デジタルオンヌリ商品券とは？',
      digitalBefore: [
        'スマートフォンでより便利に使えるデジタル形式のオンヌリ商品券です。モバイルアプリでチャージし、加盟店でQRコードまたはカードで手軽に支払えます。',
      ],
      digitalAfter: '商品券金額の**10%割引価格**でチャージ可能！**最大保有限度額**は**200万ウォン**です。',
      digitalNote: '※ 割引率および特典は政策や販売状況により変更される場合があります。',
      usageH: 'オンヌリ商品券の使用先',
      usageBody: '**オンヌリ商品券加盟店ステッカー**のある場所で使用できます。',
      benefits: [
        '· 割引特典：チャージ時に約10%割引',
        '· 所得控除特典：伝統市場での利用時、最大40%の所得控除',
        '· 利用先の拡大：伝統市場、小商工人の店舗に加え、オンラインモールや配達アプリまで',
        '· 手軽に利用可能（カードまたはQRコード決済）',
      ],
    },
    osaek: {
      title: '烏山貨幣「五色銭」',
      introH: '烏山貨幣 五色銭とは？',
      introBody: [
        '**烏山市内でのみ使えるカード型地域通貨です。**',
        '大型マート、企業型スーパー、遊興業所、射幸業所、烏山に住所のないフランチャイズ直営店を除き、**市内のICカード端末を使う店舗ならどこでも使用可能**です。京畿地域通貨アプリと連動し、いつでもどこでもチャージと残高管理ができます。',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: '誰でも申請できますか？',
      applyBody: [
        '**本人名義の銀行口座を持つ満14歳以上なら申請可能です。**',
        '烏山資金の域外流出を防ぎ地域経済の活性化と地域共同体の強化を図る烏山市の地域通貨で、**居住地に関係なく烏山市で消費し追加ポイント特典を受けたい方は誰でも申請可能です。**',
        '申請は、**モバイルアプリ（京畿地域通貨APP）**または**市内のNH農協銀行、烏山農協、セマウル金庫、セ烏山信協**で行ってください。',
      ],
      usageH: '地域通貨の使用先',
      usageBody: 'デパート、大型マート、企業型スーパー(SSM)、フランチャイズ直営店および遊興・射幸業所は使用が制限され、**年間売上10億ウォン以下の小商工人店舗でのみ使用可能です。**',
      usageList: [
        'ガソリンスタンド・伝統市場・路地商圏・レジャー施設（ジム、ピラティス、プール、ゴルフ練習場、ボウリング場）',
        '病院（歯科、韓医院など）・コンビニ・学院・保健衛生（眼鏡、美容院など）',
        'その他医療機関（動物病院など）',
      ],
    },
  },
  zh: {
    title: '地区货币',
    tabs: ['五色钱', '온누리商品券'],
    onnuri: {
      title: 'Onnuri商品券',
      introH: '什么是Onnuri商品券？',
      introBody: '为振兴传统市场和商店街而发行的专用商品券，可在全国Onnuri商品券加盟店购买多样商品和服务时使用。在传统市场和本地商店街消费还能享受优惠，同时有助于地区经济活跃。',
      paperH: '纸质商品券面额',
      digitalH: '什么是数字Onnuri商品券？',
      digitalBefore: [
        '更便捷的数字形式Onnuri商品券，可通过手机应用充值，并在加盟店以二维码或卡片支付。',
      ],
      digitalAfter: '可按商品券金额的**9折**充值！**最高持有额度**为**200万韩元**。',
      digitalNote: '※ 折扣率及优惠内容可能因政策和销售情况而变更。',
      usageH: 'Onnuri商品券使用处',
      usageBody: '可在贴有**Onnuri商品券加盟店贴纸**的地方使用。',
      benefits: [
        '· 优惠：充值时约9折',
        '· 所得扣除：在传统市场使用时最高可享40%所得扣除',
        '· 扩大使用范围：传统市场、小商户店铺，以及网络商城和外卖应用',
        '· 使用便捷（卡片或二维码支付）',
      ],
    },
    osaek: {
      title: '乌山货币「五色钱」',
      introH: '什么是乌山货币五色钱？',
      introBody: [
        '**仅限在乌山市内使用的卡片式地区货币。**',
        '除大型超市、企业型超市、娱乐场所、博彩场所以及非乌山注册地的连锁直营店外，**市内配备IC卡终端的店铺均可使用**。同时与京畿地区货币APP联动，可随时随地方便地充值并管理余额。',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: '人人都能申请吗？',
      applyBody: [
        '**持有本人名义银行账户、年满14岁即可申请。**',
        '作为防止乌山资金外流、促进本地经济活力与社区强化的乌山市地区货币，**无论居住地，凡希望在乌山消费并获得额外积分优惠者均可申请。**',
        '申请方式：通过**手机App（京畿地区货币App）**或在**市内NH农协银行、乌山农协、新村金库、新乌山信协**办理。',
      ],
      usageH: '地区货币使用处',
      usageBody: '百货店、大型超市、企业型超市(SSM)、连锁直营店及娱乐博彩场所限制使用，**仅可在年销售额10亿韩元以下的小工商户店铺使用。**',
      usageList: [
        '加油站 · 传统市场 · 街巷商圈 · 休闲场所（健身房、普拉提、游泳池、高尔夫练习场、保龄球馆）',
        '医院（牙科、韩医院等）· 便利店 · 学院 · 保健卫生（眼镜、美容院等）',
        '其他医疗机构（动物医院等）',
      ],
    },
  },
  vi: {
    title: 'Tiền tệ địa phương',
    tabs: ['Osaek-jeon', 'Phiếu quà tặng Onnuri'],
    onnuri: {
      title: 'Phiếu quà tặng Onnuri',
      introH: 'Phiếu Onnuri là gì?',
      introBody: 'Phiếu quà tặng được phát hành để hỗ trợ chợ truyền thống và các phố buôn bán, có thể dùng tại các cửa hàng liên kết phiếu Onnuri trên toàn quốc để mua nhiều loại hàng hóa và dịch vụ. Mua sắm tại chợ truyền thống và phố buôn bán địa phương vừa được giảm giá vừa góp phần phát triển kinh tế địa phương.',
      paperH: 'Các mệnh giá phiếu giấy',
      digitalH: 'Phiếu Onnuri kỹ thuật số là gì?',
      digitalBefore: [
        'Phiên bản kỹ thuật số của phiếu quà tặng Onnuri, tiện dụng hơn khi dùng trên điện thoại thông minh. Nạp tiền qua ứng dụng di động và thanh toán tại cửa hàng liên kết bằng mã QR hoặc thẻ.',
      ],
      digitalAfter: 'Nạp tiền với giá **giảm 10%** trên mệnh giá phiếu! **Hạn mức số dư tối đa** là **2.000.000 won**.',
      digitalNote: '※ Mức giảm giá và quyền lợi có thể thay đổi tùy theo chính sách và tình hình bán hàng.',
      usageH: 'Nơi sử dụng phiếu Onnuri',
      usageBody: 'Có thể dùng tại những nơi có **nhãn dán cửa hàng liên kết phiếu Onnuri**.',
      benefits: [
        '· Ưu đãi: giảm khoảng 10% khi nạp tiền',
        '· Khấu trừ thu nhập: tối đa 40% khi dùng tại chợ truyền thống',
        '· Mở rộng nơi sử dụng: chợ truyền thống, cửa hàng tiểu thương, mua sắm trực tuyến và ứng dụng giao hàng',
        '· Thanh toán tiện lợi (thẻ hoặc mã QR)',
      ],
    },
    osaek: {
      title: 'Tiền Osan「Osaek-jeon」',
      introH: 'Tiền Osan Osaek-jeon là gì?',
      introBody: [
        '**Là tiền tệ địa phương dạng thẻ, chỉ dùng được trong thành phố Osan.**',
        'Có thể dùng tại **mọi cửa hàng trong thành phố có thiết bị đọc thẻ IC**, ngoại trừ đại siêu thị, siêu thị doanh nghiệp, quán giải trí và cờ bạc, cùng các cửa hàng nhượng quyền trực thuộc không có địa chỉ tại Osan. Liên kết với ứng dụng tiền tệ địa phương Gyeonggi, giúp nạp tiền và quản lý số dư mọi lúc, mọi nơi.',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: 'Ai cũng có thể đăng ký không?',
      applyBody: [
        '**Người từ 14 tuổi trở lên có tài khoản ngân hàng đứng tên chính mình đều có thể đăng ký.**',
        'Là tiền tệ địa phương của thành phố Osan nhằm ngăn dòng vốn Osan chảy ra ngoài, thúc đẩy kinh tế địa phương và củng cố cộng đồng, **bất kỳ ai muốn tiêu dùng tại Osan và nhận thêm điểm ưu đãi đều có thể đăng ký, không phân biệt nơi cư trú.**',
        'Cách đăng ký: qua **ứng dụng di động (Ứng dụng Tiền tệ địa phương Gyeonggi)** hoặc tại **ngân hàng NH Nonghyup trong khu vực, Osan Nonghyup, Saemaeul Geumgo, Sae-Osan Sinhyup**.',
      ],
      usageH: 'Nơi sử dụng tiền tệ địa phương',
      usageBody: 'Bị hạn chế sử dụng tại bách hóa, đại siêu thị, siêu thị doanh nghiệp (SSM), cửa hàng trực thuộc chuỗi nhượng quyền và các quán giải trí, cờ bạc; **chỉ có thể dùng tại các cửa hàng tiểu thương có doanh thu năm từ 1 tỷ won trở xuống.**',
      usageList: [
        'Trạm xăng · chợ truyền thống · phố buôn bán nhỏ · cơ sở giải trí (phòng gym, pilates, hồ bơi, sân tập golf, sân bowling)',
        'Bệnh viện · phòng khám (nha khoa, đông y v.v.) · cửa hàng tiện lợi · trung tâm dạy học · vệ sinh sức khỏe (kính mắt, thẩm mỹ v.v.)',
        'Cơ sở y tế khác (bệnh viện thú y v.v.)',
      ],
    },
  },
  th: {
    title: 'สกุลเงินท้องถิ่น',
    tabs: ['Osaek-jeon', 'บัตรกำนัล Onnuri'],
    onnuri: {
      title: 'บัตรกำนัล Onnuri',
      introH: 'บัตรกำนัล Onnuri คืออะไร?',
      introBody: 'บัตรกำนัลที่ออกเพื่อส่งเสริมตลาดดั้งเดิมและถนนการค้า ใช้ซื้อสินค้าและบริการหลากหลายได้ที่ร้านค้าสมาชิกบัตรกำนัล Onnuri ทั่วประเทศ การจับจ่ายในตลาดดั้งเดิมและย่านการค้าท้องถิ่นยังได้รับส่วนลดและช่วยให้เศรษฐกิจท้องถิ่นเติบโต',
      paperH: 'มูลค่าบัตรกำนัลแบบกระดาษ',
      digitalH: 'บัตรกำนัล Onnuri แบบดิจิทัลคืออะไร?',
      digitalBefore: [
        'บัตรกำนัล Onnuri รูปแบบดิจิทัลที่ใช้งานบนสมาร์ทโฟนได้สะดวกยิ่งขึ้น เติมเงินผ่านแอปมือถือ แล้วชำระที่ร้านค้าสมาชิกด้วย QR code หรือบัตร',
      ],
      digitalAfter: 'เติมเงินในราคาลด **10%** จากมูลค่าบัตรกำนัล! **วงเงินถือครองสูงสุด**คือ **2,000,000 วอน**',
      digitalNote: '※ ส่วนลดและสิทธิประโยชน์อาจเปลี่ยนแปลงตามนโยบายและสถานการณ์การขาย',
      usageH: 'สถานที่ใช้บัตรกำนัล Onnuri',
      usageBody: 'สามารถใช้ได้ในสถานที่ที่มี **สติกเกอร์ร้านค้าสมาชิกบัตรกำนัล Onnuri**',
      benefits: [
        '· สิทธิส่วนลด: ลดประมาณ 10% เมื่อเติมเงิน',
        '· สิทธิหักลดหย่อนรายได้: สูงสุด 40% เมื่อใช้ในตลาดดั้งเดิม',
        '· ขยายการใช้งาน: ตลาดดั้งเดิม ร้านผู้ประกอบการรายย่อย ร้านค้าออนไลน์และแอปส่งอาหาร',
        '· ใช้งานง่าย (ชำระด้วยบัตรหรือ QR code)',
      ],
    },
    osaek: {
      title: 'สกุลเงินโอซาน「Osaek-jeon」',
      introH: 'สกุลเงินโอซาน Osaek-jeon คืออะไร?',
      introBody: [
        '**สกุลเงินท้องถิ่นแบบบัตรที่ใช้ได้เฉพาะภายในเมืองโอซานเท่านั้น**',
        'ยกเว้นห้างค้าปลีกขนาดใหญ่ ซูเปอร์มาร์เก็ตแบบองค์กร สถานบันเทิง สถานพนัน และร้านสาขาแฟรนไชส์ที่ไม่มีที่อยู่ในโอซาน **สามารถใช้ได้ที่ร้านค้าทุกแห่งในเมืองที่มีเครื่องอ่านบัตร IC** และเชื่อมต่อกับแอปสกุลเงินท้องถิ่นของจังหวัดคย็องกี ทำให้เติมเงินและจัดการยอดคงเหลือได้ทุกที่ทุกเวลา',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: 'ใครก็สมัครได้หรือไม่?',
      applyBody: [
        '**ผู้ที่มีอายุตั้งแต่ 14 ปีขึ้นไปและมีบัญชีธนาคารในชื่อของตนเองสามารถสมัครได้**',
        'เป็นสกุลเงินท้องถิ่นของเมืองโอซานที่ช่วยป้องกันการไหลออกของเงินทุนจากโอซาน ส่งเสริมเศรษฐกิจท้องถิ่นและเสริมสร้างชุมชน **ไม่ว่าจะอาศัยอยู่ที่ใด ผู้ที่ต้องการใช้จ่ายในโอซานและรับสิทธิ์คะแนนเพิ่มเติมสามารถสมัครได้ทุกคน**',
        'วิธีสมัคร: ผ่าน**แอปมือถือ (แอปสกุลเงินท้องถิ่นคยองกี)** หรือที่**ธนาคาร NH Nonghyup ในพื้นที่ Osan Nonghyup, Saemaeul Geumgo, Sae-Osan Sinhyup**',
      ],
      usageH: 'สถานที่ใช้สกุลเงินท้องถิ่น',
      usageBody: 'ห้ามใช้ที่ห้างสรรพสินค้า ห้างค้าปลีกขนาดใหญ่ ซูเปอร์มาร์เก็ตแบบองค์กร (SSM) ร้านสาขาแฟรนไชส์ และสถานบันเทิงหรือสถานพนัน **สามารถใช้ได้เฉพาะที่ร้านค้าผู้ประกอบการรายย่อยที่มียอดขายต่อปีไม่เกิน 1 พันล้านวอนเท่านั้น**',
      usageList: [
        'ปั๊มน้ำมัน · ตลาดดั้งเดิม · ย่านร้านค้าเล็ก · สถานที่พักผ่อน (ฟิตเนส พิลาทิส สระว่ายน้ำ สนามซ้อมกอล์ฟ ลานโบว์ลิ่ง)',
        'โรงพยาบาล/คลินิก (ทันตกรรม แพทย์แผนเกาหลี ฯลฯ) · ร้านสะดวกซื้อ · โรงเรียนกวดวิชา · สุขอนามัย (ร้านแว่น ร้านเสริมสวย ฯลฯ)',
        'สถานพยาบาลอื่น ๆ (โรงพยาบาลสัตว์ ฯลฯ)',
      ],
    },
  },
  ru: {
    title: 'Местная валюта',
    tabs: ['Осэк-чон', 'Ваучер Onnuri'],
    onnuri: {
      title: 'Подарочный ваучер Onnuri',
      introH: 'Что такое ваучер Onnuri?',
      introBody: 'Ваучер для поддержки традиционных рынков и торговых улиц, который можно использовать в магазинах-участниках ваучера Onnuri по всей стране для покупки самых разных товаров и услуг. Покупки на традиционных рынках и местных торговых улицах дают скидки и помогают местной экономике.',
      paperH: 'Номиналы бумажных ваучеров',
      digitalH: 'Что такое цифровой ваучер Onnuri?',
      digitalBefore: [
        'Цифровая форма ваучера Onnuri, которой удобнее пользоваться на смартфоне. Пополняйте её через мобильное приложение и расплачивайтесь в магазинах-участниках по QR-коду или картой.',
      ],
      digitalAfter: 'Пополнение со **скидкой 10%** от суммы ваучера! **Максимальный остаток** — **2 000 000 вон**.',
      digitalNote: '※ Размер скидки и условия могут меняться в зависимости от политики и условий продаж.',
      usageH: 'Где использовать ваучер Onnuri',
      usageBody: 'Можно использовать в местах с **наклейкой магазина-участника ваучера Onnuri**.',
      benefits: [
        '· Скидка: около 10% при пополнении',
        '· Налоговый вычет: до 40% при покупках на традиционных рынках',
        '· Больше мест: традиционные рынки, малый бизнес, интернет-магазины и приложения доставки',
        '· Удобная оплата (картой или QR-кодом)',
      ],
    },
    osaek: {
      title: 'Валюта Осана «Осэк-чон»',
      introH: 'Что такое валюта Осана Осэк-чон?',
      introBody: [
        '**Местная валюта в виде карты, которую можно использовать только в городе Осан.**',
        'Её можно использовать в **любом магазине города с терминалом для IC-карт**, кроме крупных гипермаркетов, корпоративных супермаркетов, развлекательных и азартных заведений и фирменных магазинов сетей, не зарегистрированных в Осане. Связана с приложением местной валюты Кёнги, поэтому баланс можно пополнять и контролировать в любое время и в любом месте.',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: 'Может ли подать заявку кто угодно?',
      applyBody: [
        '**Подать заявку могут лица от 14 лет, имеющие банковский счёт на своё имя.**',
        'Это местная валюта города Осан, призванная предотвратить отток капитала из Осана, оживить местную экономику и укрепить сообщество, **и подать заявку может любой, кто хочет тратить деньги в Осане и получать дополнительные бонусные баллы, независимо от места проживания.**',
        'Способ подачи заявки: через **мобильное приложение (приложение местной валюты Кёнги)** или в **местных отделениях банка NH Nonghyup, Osan Nonghyup, Saemaeul Geumgo, Sae-Osan Sinhyup**.',
      ],
      usageH: 'Где использовать местную валюту',
      usageBody: 'Использование ограничено в универмагах, крупных гипермаркетах, корпоративных супермаркетах (SSM), фирменных франчайзинговых магазинах и развлекательных/азартных заведениях; **использовать можно только в магазинах малого бизнеса с годовым оборотом не более 1 млрд вон.**',
      usageList: [
        'АЗС · традиционные рынки · местные торговые районы · досуговые заведения (фитнес-клуб, пилатес, бассейн, гольф-площадка, боулинг)',
        'Больницы и клиники (стоматология, восточная медицина и т. д.) · мини-маркеты · учебные центры · санитария и красота (оптика, салоны и т. д.)',
        'Прочие медицинские учреждения (ветклиники и т. д.)',
      ],
    },
  },
  id: {
    title: 'Mata Uang Lokal',
    tabs: ['Osaek-jeon', 'Voucher Onnuri'],
    onnuri: {
      title: 'Voucher Hadiah Onnuri',
      introH: 'Apa itu voucher Onnuri?',
      introBody: 'Voucher untuk mendukung pasar tradisional dan kawasan pertokoan, yang dapat digunakan di toko mitra voucher Onnuri di seluruh negeri untuk berbagai produk dan layanan. Berbelanja di pasar tradisional dan kawasan pertokoan lokal memberi potongan harga sekaligus membantu ekonomi lokal.',
      paperH: 'Pecahan voucher kertas',
      digitalH: 'Apa itu voucher Onnuri digital?',
      digitalBefore: [
        'Bentuk digital voucher Onnuri yang lebih praktis digunakan di ponsel pintar. Isi saldo melalui aplikasi seluler, lalu bayar di toko mitra dengan kode QR atau kartu.',
      ],
      digitalAfter: 'Isi saldo dengan **diskon 10%** dari nilai voucher! **Batas saldo maksimum** adalah **2.000.000 won**.',
      digitalNote: '※ Besaran diskon dan manfaat dapat berubah sesuai kebijakan dan kondisi penjualan.',
      usageH: 'Tempat penggunaan voucher Onnuri',
      usageBody: 'Dapat digunakan di tempat yang memiliki **stiker toko mitra voucher Onnuri**.',
      benefits: [
        '· Diskon: sekitar 10% saat mengisi saldo',
        '· Pengurangan pajak penghasilan: hingga 40% saat digunakan di pasar tradisional',
        '· Tempat penggunaan diperluas: pasar tradisional, toko usaha kecil, serta mal daring dan aplikasi antar',
        '· Mudah digunakan (pembayaran kartu atau kode QR)',
      ],
    },
    osaek: {
      title: 'Mata Uang Osan「Osaek-jeon」',
      introH: 'Apa itu mata uang Osan Osaek-jeon?',
      introBody: [
        '**Mata uang lokal berbentuk kartu yang hanya dapat digunakan di Kota Osan.**',
        'Dapat digunakan di **toko mana pun di kota yang memiliki terminal kartu IC**, kecuali hipermarket besar, supermarket korporat, tempat hiburan dan perjudian, serta gerai waralaba langsung yang tidak beralamat di Osan. Terhubung dengan aplikasi Mata Uang Lokal Gyeonggi sehingga saldo dapat diisi dan dikelola kapan saja, di mana saja.',
      ],
      iosLabel: 'iOS',
      androidLabel: 'Android',
      applyH: 'Apakah semua orang bisa mendaftar?',
      applyBody: [
        '**Siapa pun yang berusia 14 tahun ke atas dan memiliki rekening bank atas nama sendiri dapat mendaftar.**',
        'Sebagai mata uang lokal Kota Osan yang mencegah arus keluar dana Osan serta mendorong perekonomian lokal dan penguatan komunitas, **siapa pun yang ingin berbelanja di Osan dan mendapatkan bonus poin tambahan dapat mendaftar, tanpa memandang tempat tinggal.**',
        'Cara mendaftar: melalui **aplikasi ponsel (Aplikasi Mata Uang Lokal Gyeonggi)** atau di **Bank NH Nonghyup setempat, Osan Nonghyup, Saemaeul Geumgo, Sae-Osan Sinhyup**.',
      ],
      usageH: 'Tempat penggunaan mata uang lokal',
      usageBody: 'Penggunaan dibatasi di department store, hipermarket besar, supermarket korporat (SSM), gerai waralaba langsung, serta tempat hiburan dan perjudian; **hanya dapat digunakan di toko usaha kecil dengan omzet tahunan 1 miliar won atau kurang.**',
      usageList: [
        'SPBU · pasar tradisional · kawasan pertokoan kecil · tempat rekreasi (pusat kebugaran, pilates, kolam renang, lapangan latihan golf, arena boling)',
        'Rumah sakit/klinik (gigi, pengobatan oriental, dll.) · minimarket · lembaga bimbingan belajar · kesehatan & kecantikan (optik, salon, dll.)',
        'Fasilitas medis lainnya (rumah sakit hewan, dll.)',
      ],
    },
  },
};

/** A heading ending in 이란? shows that suffix in black, the rest navy (Figma). */
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

interface OsanLocalpayProps {
  controller: KioskController;
}

/** 시장화폐 — 오색전 (local card currency) and 온누리상품권 (Figma 7878:42763 / 7878:42732). */
export function OsanLocalpay({ controller }: OsanLocalpayProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  /* Korean tab names fit the tab on one line; the other languages do not.
     See "Other languages" in the CSS. */
  const wide = lang !== 'ko';
  const tabsRef = useRef<HTMLDivElement>(null);
  const c = pick(CONTENT, lang);
  const [tab, setTab] = useState(0);

  useFitText(tabsRef, styles.tab, wide, 0.72, lang);
  /* ♿ (지역화폐 오색전 7894:56717, 온누리상품권 7894:56838): the page keeps
     OsanKiosk's shift, the card starts at 944, the tabs drop to 3438 and the
     promo goes. */
  const low = useAccessibilityStore((s) => s.lowReach);

  return (
    <div className={low ? styles.low : undefined} style={{ display: 'contents' }}>
      {osanIconUrl('page-bg') && <img className={styles.bg} src={osanIconUrl('page-bg')} alt="" draggable={false} />}

      {/* Localization_Osaek's MarketPaper_SubHeader ("오산시장에서 사용할 수 있는 시장화폐
          입니다."). Passed here rather than through the shared 지역화폐 header id,
          which 화성 and 제주 resolve against their own rows. */}
      <OsanHeader title={c.title} subtitle={sheetText('MarketPaper_SubHeader', lang) || undefined} onHome={goHome} />

      <div className={styles.page}>
        <div ref={tabsRef} className={styles.tabs}>
          {c.tabs.map((label, i) => (
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
          /* ── 오색전 — Figma 7878:42763: title, intro, card images + QR, apply, usage ── */
          <div className={styles.cardOsaek}>
            <p className={styles.heading}>{renderHeading(c.osaek.title)}</p>

            <div className={styles.introBlock}>
              {c.osaek.introBody.map((line, i) => (
                <p key={i} className={styles.body}>
                  {renderRich(line)}
                </p>
              ))}
            </div>

            <div className={styles.imageBox}>
              <img className={styles.cardA2} src={card2} alt="" draggable={false} />
              <img className={styles.cardA1} src={card1} alt="" draggable={false} />
              <div className={styles.qrAndroid}>
                <img src={androidQr} alt="" draggable={false} />
                <span className={styles.qrLabel}>{c.osaek.androidLabel}</span>
              </div>
              <div className={styles.qrIos}>
                <img src={iosQr} alt="" draggable={false} />
                <span className={styles.qrLabel}>{c.osaek.iosLabel}</span>
              </div>
            </div>

            <section className={styles.sectionBlock}>
              <p className={styles.h}>{c.osaek.applyH}</p>
              {c.osaek.applyBody.map((line, i) => (
                <p key={i} className={styles.body}>
                  {renderRich(line)}
                </p>
              ))}
            </section>

            <section className={styles.sectionBlock}>
              <p className={styles.h}>{c.osaek.usageH}</p>
              <p className={styles.body}>{renderRich(c.osaek.usageBody)}</p>
              <div className={styles.note}>
                {c.osaek.usageList.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          </div>
        ) : (
          /* ── 온누리상품권 — Figma 7878:42732: two cards (paper vouchers; digital) ── */
          <>
            <div className={styles.cardOnnuriTop}>
              <div className={styles.topText}>
                <p className={styles.heading}>{renderHeading(c.onnuri.introH)}</p>
                <p className={styles.body}>{c.onnuri.introBody}</p>
              </div>
              <div className={styles.paperBox}>
                <p className={styles.paperLabel}>{c.onnuri.paperH}</p>
                <img className={styles.paperImg} src={onnuriPaper} alt="" draggable={false} />
              </div>
            </div>

            <div className={styles.cardOnnuriBottom}>
              <div className={styles.bottomText}>
                <p className={styles.heading}>{renderHeading(c.onnuri.digitalH)}</p>
                {c.onnuri.digitalBefore.map((line, i) => (
                  <p key={i} className={styles.body}>
                    {line}
                  </p>
                ))}
                <p className={styles.body}>{renderRich(c.onnuri.digitalAfter)}</p>
              </div>

              <img className={styles.mascot} src={onnuriDigital} alt="" draggable={false} />

              <div className={styles.usageSection}>
                <p className={styles.usageH}>{c.onnuri.usageH}</p>
                <p className={styles.body}>{renderRich(c.onnuri.usageBody)}</p>
              </div>

              <div className={styles.lightBox}>
                <p className={styles.lightNote}>{c.onnuri.digitalNote}</p>
                {(c.onnuri.benefits ?? []).length > 0 && (
                  <div className={styles.benefits}>
                    {(c.onnuri.benefits ?? []).map((line, i) => (
                      <p key={i}>{line}</p>
                    ))}
                  </div>
                )}
                <img className={styles.lightBi} src={onnuriBi} alt="" draggable={false} />
                <div className={styles.lightQr}>
                  <img src={appQr} alt="" draggable={false} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {!low && (
        <>
          <img className={styles.banner} src={bannerImg} alt="" draggable={false} />
          <div className={styles.bannerBar} />
          <div className={styles.bannerCream} />
        </>
      )}

      <OsanLeftNav onHome={goHome} />
    </div>
  );
}
