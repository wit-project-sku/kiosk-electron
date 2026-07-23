import { useState, type ReactNode } from 'react';
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
import { OsanBanner } from './OsanBanner';
import styles from './OsanLocalpay.module.css';

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
    tabs: ['온누리상품권', '오색전'],
    onnuri: {
      title: '온누리상품권',
      introH: '온누리상품권이란?',
      introBody: '전국 16개 금융기관에서 5천원, 1만원, 3만원권 단위로 구매하여 사용하는 온누리상품권',
      paperH: '지류상품권 권종',
      digitalH: '디지털 온누리상품권이란?',
      digitalBefore: [
        '디지털 온누리상품권 앱 설치 후 기존 갖고 있는 카드를 등록하고 금액 충전 후,',
        '실물카드 또는 QR코드 결제 방식으로 이용 가능한 온누리상품권',
      ],
      digitalAfter: '상품권 금액의 10% 할인가로 충전 가능! 최대 보유한도금액은 200만원입니다.',
      digitalNote: '※ 단, 예산소진 상황에 따라 특별판매 내용 및 기간이 변경될 수 있습니다.',
      usageH: '온누리상품권 사용처',
      usageBody: '온누리상품권 가맹점 스티커가 있는 곳에서 사용이 가능합니다.',
    },
    osaek: {
      title: '오산화폐「오색전」',
      introH: '오산화폐 오색전이란?',
      introBody: [
        '오산시 내에서만 사용할 수 있는 카드형 지역화폐 입니다.',
        '대형마트, 기업형 슈퍼마켓, 유흥업소, 사행성 업소, 오산에 주소지를 두고 있지 않은 프랜차이즈 직영점을 제외한 관내 IC 카드 단말기를 사용하는 업소 어디에서나 사용 가능합니다. 또한 경기지역화폐 APP과 연동하여 언제, 어디서나 편리하게 충전하고 잔액을 관리 할 수 있습니다.',
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
    tabs: ['Onnuri Voucher', 'Osaek-jeon'],
    onnuri: {
      title: 'Onnuri Gift Voucher',
      introH: 'What is the Onnuri voucher?',
      introBody: 'An Onnuri gift voucher purchased at 16 financial institutions nationwide in denominations of ₩5,000, ₩10,000 and ₩30,000.',
      paperH: 'Paper voucher denominations',
      digitalH: 'What is the digital Onnuri voucher?',
      digitalBefore: [
        'After installing the Digital Onnuri Voucher app, register your existing card and top it up,',
        'then use it as an Onnuri voucher via physical card or QR-code payment.',
      ],
      digitalAfter: 'Top up at a 10% discount on the voucher amount! The maximum balance is ₩2,000,000.',
      digitalNote: '※ Special-sale terms and periods may change depending on budget availability.',
      usageH: 'Where to use',
      usageBody: 'Can be used at places displaying the Onnuri voucher member-store sticker.',
    },
    osaek: {
      title: 'Osan Currency “Osaek-jeon”',
      introH: 'What is Osan currency Osaek-jeon?',
      introBody: [
        'A card-type local currency usable only within Osan City.',
        'It can be used at any store with an in-city IC card terminal, except department/large marts, corporate supermarkets, entertainment/gambling venues and franchise direct stores not based in Osan. It also links with the Gyeonggi Local Currency app so you can top up and manage your balance anytime, anywhere.',
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
    tabs: ['オンヌリ商品券', '五色銭'],
    onnuri: {
      title: 'オンヌリ商品券',
      introH: 'オンヌリ商品券とは？',
      introBody: '全国16の金融機関で5千ウォン・1万ウォン・3万ウォン券単位で購入して使えるオンヌリ商品券。',
      paperH: '紙商品券の券種',
      digitalH: 'デジタルオンヌリ商品券とは？',
      digitalBefore: [
        'デジタルオンヌリ商品券アプリをインストールし、お持ちのカードを登録してチャージ後、',
        '実物カードまたはQRコード決済で利用できるオンヌリ商品券。',
      ],
      digitalAfter: '商品券金額の10%割引でチャージ可能！最大保有限度額は200万ウォンです。',
      digitalNote: '※ ただし、予算消尽の状況により特別販売の内容・期間が変更される場合があります。',
      usageH: 'オンヌリ商品券の使用先',
      usageBody: 'オンヌリ商品券加盟店ステッカーのある場所で使用できます。',
    },
    osaek: {
      title: '烏山貨幣「五色銭」',
      introH: '烏山貨幣 五色銭とは？',
      introBody: [
        '烏山市内でのみ使えるカード型地域通貨です。',
        '大型マート、企業型スーパー、遊興業所、射幸業所、烏山に住所のないフランチャイズ直営店を除く、市内のICカード端末を使う店舗ならどこでも使用可能。京畿地域通貨アプリと連動し、いつでもどこでも便利にチャージ・残高管理ができます。',
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
    tabs: ['온누리商品券', '五色钱'],
    onnuri: {
      title: 'Onnuri商品券',
      introH: '什么是Onnuri商品券？',
      introBody: '在全国16家金融机构以5千、1万、3万韩元面额购买使用的Onnuri商品券。',
      paperH: '纸质商品券面额',
      digitalH: '什么是数字Onnuri商品券？',
      digitalBefore: [
        '安装数字Onnuri商品券App后，注册已有的卡并充值，',
        '即可通过实体卡或二维码支付方式使用的Onnuri商品券。',
      ],
      digitalAfter: '可按商品券金额的9折充值！最高持有额度为200万韩元。',
      digitalNote: '※ 但根据预算消耗情况，特别销售内容及期间可能变更。',
      usageH: 'Onnuri商品券使用处',
      usageBody: '可在贴有Onnuri商品券加盟店贴纸的地方使用。',
    },
    osaek: {
      title: '乌山货币「五色钱」',
      introH: '什么是乌山货币五色钱？',
      introBody: [
        '仅可在乌山市内使用的卡片型地区货币。',
        '除百货店、大型超市、企业型超市、娱乐场所、博彩场所及非乌山注册的连锁直营店外，凡使用市内IC卡终端的店铺均可使用。还可与京畿地区货币App联动，随时随地便捷充值与管理余额。',
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
    tabs: ['Phiếu quà tặng Onnuri', 'Osaek-jeon'],
    onnuri: {
      title: 'Phiếu quà tặng Onnuri',
      introH: 'Phiếu Onnuri là gì?',
      introBody: 'Phiếu quà tặng Onnuri được mua tại 16 tổ chức tài chính trên toàn quốc theo các mệnh giá 5.000 won, 10.000 won và 30.000 won.',
      paperH: 'Các mệnh giá phiếu giấy',
      digitalH: 'Phiếu Onnuri kỹ thuật số là gì?',
      digitalBefore: [
        'Sau khi cài ứng dụng Phiếu Onnuri kỹ thuật số, đăng ký thẻ hiện có và nạp tiền,',
        'bạn có thể dùng như phiếu Onnuri qua thẻ vật lý hoặc thanh toán bằng mã QR.',
      ],
      digitalAfter: 'Nạp tiền với mức giảm 10% trên giá trị phiếu! Hạn mức số dư tối đa là 2.000.000 won.',
      digitalNote: '※ Tuy nhiên, nội dung và thời gian bán ưu đãi đặc biệt có thể thay đổi tùy theo tình hình sử dụng ngân sách.',
      usageH: 'Nơi sử dụng phiếu Onnuri',
      usageBody: 'Có thể sử dụng tại những nơi có dán nhãn cửa hàng liên kết phiếu Onnuri.',
    },
    osaek: {
      title: 'Tiền Osan「Osaek-jeon」',
      introH: 'Tiền Osan Osaek-jeon là gì?',
      introBody: [
        'Đây là loại tiền tệ địa phương dạng thẻ chỉ dùng được trong thành phố Osan.',
        'Có thể sử dụng ở bất kỳ cửa hàng nào trong thành phố dùng máy đọc thẻ IC, ngoại trừ đại siêu thị, siêu thị doanh nghiệp, quán giải trí, cơ sở cờ bạc và cửa hàng trực thuộc chuỗi nhượng quyền không có địa chỉ tại Osan. Ngoài ra, liên kết với ứng dụng Tiền tệ địa phương Gyeonggi để nạp tiền và quản lý số dư tiện lợi mọi lúc, mọi nơi.',
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
    tabs: ['บัตรกำนัล Onnuri', 'Osaek-jeon'],
    onnuri: {
      title: 'บัตรกำนัล Onnuri',
      introH: 'บัตรกำนัล Onnuri คืออะไร?',
      introBody: 'บัตรกำนัล Onnuri ที่ซื้อได้จากสถาบันการเงิน 16 แห่งทั่วประเทศ ในมูลค่า 5,000 วอน 10,000 วอน และ 30,000 วอน',
      paperH: 'มูลค่าบัตรกำนัลแบบกระดาษ',
      digitalH: 'บัตรกำนัล Onnuri แบบดิจิทัลคืออะไร?',
      digitalBefore: [
        'หลังติดตั้งแอปบัตรกำนัล Onnuri แบบดิจิทัล ให้ลงทะเบียนบัตรที่มีอยู่และเติมเงิน',
        'จากนั้นสามารถใช้เป็นบัตรกำนัล Onnuri ผ่านบัตรจริงหรือชำระด้วยคิวอาร์โค้ดได้',
      ],
      digitalAfter: 'เติมเงินได้ในราคาลด 10% จากมูลค่าบัตรกำนัล! วงเงินถือครองสูงสุดคือ 2,000,000 วอน',
      digitalNote: '※ อย่างไรก็ตาม เนื้อหาและระยะเวลาการขายพิเศษอาจเปลี่ยนแปลงได้ตามสถานการณ์การใช้งบประมาณ',
      usageH: 'สถานที่ใช้บัตรกำนัล Onnuri',
      usageBody: 'สามารถใช้ได้ในสถานที่ที่มีสติกเกอร์ร้านค้าสมาชิกบัตรกำนัล Onnuri',
    },
    osaek: {
      title: 'สกุลเงินโอซาน「Osaek-jeon」',
      introH: 'สกุลเงินโอซาน Osaek-jeon คืออะไร?',
      introBody: [
        'เป็นสกุลเงินท้องถิ่นแบบบัตรที่ใช้ได้เฉพาะภายในเมืองโอซานเท่านั้น',
        'สามารถใช้ได้ที่ร้านค้าใดก็ได้ในเมืองที่ใช้เครื่องอ่านบัตร IC ยกเว้นห้างค้าปลีกขนาดใหญ่ ซูเปอร์มาร์เก็ตแบบองค์กร สถานบันเทิง สถานพนัน และร้านสาขาแฟรนไชส์ที่ไม่มีที่อยู่ในโอซาน อีกทั้งเชื่อมต่อกับแอปสกุลเงินท้องถิ่นคยองกี ทำให้เติมเงินและจัดการยอดคงเหลือได้สะดวกทุกที่ทุกเวลา',
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
    tabs: ['Ваучер Onnuri', 'Осэк-чон'],
    onnuri: {
      title: 'Подарочный ваучер Onnuri',
      introH: 'Что такое ваучер Onnuri?',
      introBody: 'Подарочный ваучер Onnuri, который можно приобрести в 16 финансовых учреждениях по всей стране номиналом 5 000, 10 000 и 30 000 вон.',
      paperH: 'Номиналы бумажных ваучеров',
      digitalH: 'Что такое цифровой ваучер Onnuri?',
      digitalBefore: [
        'После установки приложения «Цифровой ваучер Onnuri» зарегистрируйте имеющуюся карту и пополните счёт,',
        'после чего используйте как ваучер Onnuri через физическую карту или оплату по QR-коду.',
      ],
      digitalAfter: 'Пополнение со скидкой 10% от суммы ваучера! Максимальный остаток на счёте — 2 000 000 вон.',
      digitalNote: '※ Однако условия и сроки специальной продажи могут измениться в зависимости от расходования бюджета.',
      usageH: 'Где использовать ваучер Onnuri',
      usageBody: 'Можно использовать в местах со стикером магазина-участника ваучера Onnuri.',
    },
    osaek: {
      title: 'Валюта Осана «Осэк-чон»',
      introH: 'Что такое валюта Осана Осэк-чон?',
      introBody: [
        'Это местная валюта в виде карты, которую можно использовать только в пределах города Осан.',
        'Ею можно расплатиться в любом магазине города, использующем терминал для IC-карт, кроме крупных гипермаркетов, корпоративных супермаркетов, развлекательных заведений, азартных заведений и фирменных франчайзинговых магазинов, не зарегистрированных в Осане. Кроме того, она связана с приложением местной валюты Кёнги, что позволяет удобно пополнять счёт и управлять балансом в любое время и в любом месте.',
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
    tabs: ['Voucher Onnuri', 'Osaek-jeon'],
    onnuri: {
      title: 'Voucher Hadiah Onnuri',
      introH: 'Apa itu voucher Onnuri?',
      introBody: 'Voucher hadiah Onnuri yang dibeli di 16 lembaga keuangan di seluruh negeri dalam pecahan 5.000 won, 10.000 won, dan 30.000 won.',
      paperH: 'Pecahan voucher kertas',
      digitalH: 'Apa itu voucher Onnuri digital?',
      digitalBefore: [
        'Setelah memasang aplikasi Voucher Onnuri Digital, daftarkan kartu yang sudah Anda miliki dan isi saldo,',
        'lalu gunakan sebagai voucher Onnuri melalui kartu fisik atau pembayaran kode QR.',
      ],
      digitalAfter: 'Isi saldo dengan diskon 10% dari nilai voucher! Batas saldo maksimum adalah 2.000.000 won.',
      digitalNote: '※ Namun, isi dan periode penjualan khusus dapat berubah sesuai kondisi penggunaan anggaran.',
      usageH: 'Tempat penggunaan voucher Onnuri',
      usageBody: 'Dapat digunakan di tempat yang memiliki stiker toko mitra voucher Onnuri.',
    },
    osaek: {
      title: 'Mata Uang Osan「Osaek-jeon」',
      introH: 'Apa itu mata uang Osan Osaek-jeon?',
      introBody: [
        'Ini adalah mata uang lokal berbentuk kartu yang hanya dapat digunakan di dalam Kota Osan.',
        'Dapat digunakan di toko mana pun di dalam kota yang memakai terminal kartu IC, kecuali hipermarket besar, supermarket korporat, tempat hiburan, tempat perjudian, dan gerai waralaba langsung yang tidak beralamat di Osan. Selain itu, terhubung dengan aplikasi Mata Uang Lokal Gyeonggi sehingga Anda dapat mengisi saldo dan mengelola sisa saldo dengan mudah kapan saja, di mana saja.',
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

interface OsanLocalpayProps {
  controller: KioskController;
}

/** 지역화폐 — Onnuri voucher + Osaek-jeon local currency (Figma 오산>지역화폐). */
export function OsanLocalpay({ controller }: OsanLocalpayProps): JSX.Element {
  const goHome = (): void => controller.navigate('home', 'Back');
  const lang = useLanguageStore((s) => s.currentLanguage);
  const c = pick(CONTENT, lang);
  const [tab, setTab] = useState(0);

  return (
    <>
      {osanIconUrl('bg') && <img className={styles.bg} src={osanIconUrl('bg')} alt="" draggable={false} />}

      <OsanHeader title={c.title} onHome={goHome} />

      <div className={styles.results}>
        <div className={styles.tabs}>
          {c.tabs.map((label, i) => (
            <button
              key={i}
              type="button"
              className={`${styles.tab} ${tab === i ? styles.tabSelected : ''}`}
              onClick={() => setTab(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 0 ? (
          <div className={`${styles.card} ${styles.cardCentered}`}>
            <p className={styles.bigTitle}>{c.onnuri.title}</p>

            <section className={styles.block}>
              <p className={styles.h}>{c.onnuri.introH}</p>
              <p className={styles.body}>{c.onnuri.introBody}</p>
            </section>

            <section className={styles.block}>
              <p className={styles.h}>{c.onnuri.paperH}</p>
              <div className={styles.imageWide}>
                <img src={onnuriPaper} alt="" draggable={false} />
              </div>
            </section>

            <section className={styles.block}>
              <p className={styles.h}>{c.onnuri.digitalH}</p>
              {c.onnuri.digitalBefore.map((line, i) => (
                <p key={i} className={styles.body}>{line}</p>
              ))}
              <div className={styles.imageWide}>
                <img src={onnuriDigital} alt="" draggable={false} />
              </div>
              <p className={styles.body}>{c.onnuri.digitalAfter}</p>
              <p className={styles.note}>{c.onnuri.digitalNote}</p>
            </section>

            <section className={styles.usageRow}>
              <div className={styles.usageText}>
                <p className={styles.h}>{c.onnuri.usageH}</p>
                <p className={styles.body}>{c.onnuri.usageBody}</p>
              </div>
              <div className={styles.usageMedia}>
                <img className={styles.biLogo} src={onnuriBi} alt="" draggable={false} />
                <div className={styles.usageQr}>
                  <img
                    src={appQr}
                    alt=""
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                  />
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className={`${styles.card} ${styles.cardCentered}`}>
            <p className={styles.bigTitle}>{c.osaek.title}</p>

            <section className={styles.block}>
              <p className={styles.h}>{c.osaek.introH}</p>
              {c.osaek.introBody.map((line, i) => (
                <p key={i} className={styles.body}>{line}</p>
              ))}
            </section>

            <div className={styles.cardsRow}>
              <img className={styles.payCard} src={card2} alt="" draggable={false} />
              <img className={styles.payCard} src={card1} alt="" draggable={false} />
              <div className={styles.qrCol}>
                <div className={styles.qrBox}>
                  <img src={androidQr} alt="" draggable={false} />
                  <span className={styles.qrLabel}>{c.osaek.androidLabel}</span>
                </div>
                <div className={styles.qrBox}>
                  <img src={iosQr} alt="" draggable={false} />
                  <span className={styles.qrLabel}>{c.osaek.iosLabel}</span>
                </div>
              </div>
            </div>

            <section className={styles.block}>
              <p className={styles.h}>{c.osaek.applyH}</p>
              {c.osaek.applyBody.map((line, i) => (
                <p key={i} className={styles.body}>{renderRich(line)}</p>
              ))}
            </section>

            <section className={styles.block}>
              <p className={styles.h}>{c.osaek.usageH}</p>
              <p className={styles.body}>{renderRich(c.osaek.usageBody)}</p>
              <div className={styles.note}>
                {c.osaek.usageList.map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>

      <div className={styles.leftNav}>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="홈으로">
          {osanIconUrl('home-btn') && <img src={osanIconUrl('home-btn')} alt="" draggable={false} />}
        </button>
        <button type="button" className={styles.leftNavBtn} onClick={goHome} aria-label="뒤로">
          {osanIconUrl('back-arrow') && <img src={osanIconUrl('back-arrow')} alt="" draggable={false} />}
        </button>
      </div>

      <OsanBanner onClick={() => controller.startPhoto()} />
    </>
  );
}
