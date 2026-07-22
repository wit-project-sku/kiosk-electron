import type { Lang } from '@renderer/lib/i18n';

export interface ResultCopy {
  subtitle: string;
  step: string;
  /** Save hint, split so the "scan the QR" clause can be accent-coloured. */
  saveHint: { lead: string; accent: string };
  note: string[];
  save: string;
  goods: string;
  retake: string;
}

/** 저장하기 result screen copy (Figma 사진촬영후 / no-payment kiosks). */
export const RESULT: Partial<Record<Lang, ResultCopy>> = {
  ko: {
    subtitle: '사진 촬영 결과물을 통해 나만의 굿즈를 만들어 보세요',
    step: '저장하기',
    saveHint: { lead: '사진을 저장하려면 ', accent: 'QR를 카메라로 찍어주세요!' },
    note: ['QR을 통해서 내 핸드폰에 저장하고 다양한 SNS에 올려보세요', '한복 착장에 관한 이벤트가 준비중이나 많은 참여 바랍니다.'],
    save: '저장하기',
    goods: '굿즈제작',
    retake: '다시찍기',
  },
  en: {
    subtitle: 'Create your own goods from your photo result',
    step: 'Save',
    saveHint: { lead: 'To save the photo, ', accent: 'scan the QR with your camera!' },
    note: ['Save it to your phone via QR and share it on social media.', 'A hanbok dress-up event is coming soon — please join us!'],
    save: 'Save',
    goods: 'Make goods',
    retake: 'Retake',
  },
  ja: {
    subtitle: '撮影した写真でオリジナルグッズを作ってみましょう',
    step: '保存する',
    saveHint: { lead: '写真を保存するには', accent: 'QRをカメラで読み取ってください！' },
    note: ['QRからスマホに保存してSNSにアップしてみてください。', '韓服着付けに関するイベントを準備中です。ぜひご参加ください。'],
    save: '保存',
    goods: 'グッズ製作',
    retake: '撮り直し',
  },
  zh: {
    subtitle: '通过拍照结果制作专属周边吧',
    step: '保存',
    saveHint: { lead: '要保存照片，', accent: '请用相机扫描二维码！' },
    note: ['通过二维码保存到手机并分享到各社交平台吧。', '韩服着装相关活动正在筹备中，欢迎积极参与。'],
    save: '保存',
    goods: '制作周边',
    retake: '重拍',
  },
};

export interface GenerationErrorCopy {
  title: string;
  body: string;
  home: string;
}

/** AI 합성 실패 화면 copy — 에러 안내 문구 + 홈 버튼 (최소 구성). */
export const GENERATION_ERROR: Partial<Record<Lang, GenerationErrorCopy>> = {
  ko: {
    title: '사진 생성에 실패했어요',
    body: '잠시 후 처음 화면에서 다시 시도해 주세요.',
    home: '처음으로',
  },
  en: {
    title: 'Photo generation failed',
    body: 'Please try again from the home screen in a moment.',
    home: 'Home',
  },
  ja: {
    title: '写真の生成に失敗しました',
    body: 'しばらくしてからホーム画面でもう一度お試しください。',
    home: 'ホームへ',
  },
  zh: {
    title: '照片生成失败',
    body: '请稍后返回首页重试。',
    home: '返回首页',
  },
};

export interface HanbokInfo {
  heading: string;
  paragraphs: string[];
}

/** 한복 설명 page copy (Figma 한복체험_한복설명). */
export const HANBOK_INFO: Partial<Record<Lang, HanbokInfo>> = {
  ko: {
    heading: '한복설명',
    paragraphs: [
      '한복은 한국 전통 의복으로, 오랜 역사와 전통을 가진 옷입니다. 한복은 고유의 아름다움과 독특한 디자인으로 한국 문화를 대표하는 상징 중 하나로 여겨지며, 특별한 행사나 명절 때 주로 착용됩니다. 직선적인 서양 복식과 달리, 한복은 부드럽게 흐르는 선과 넉넉한 옷자락이 특징입니다.',
      '전통적으로, 한복의 색은 사회적 지위, 연령, 계절 등에 따라 다르게 선택되었으며, 색상의 조합은 옷을 입는 사람의 개성과 상황을 반영합니다. 한복은 단순한 의복을 넘어 한국의 전통과 문화를 상징하는 중요한 문화유산으로, 세계적으로도 그 아름다움을 인정받고 있습니다.',
      '바로 지금, 저 인사가 한복을 입은 여러분들의 예쁜 모습을 화면속에 담아드릴게요! 한복 착장서비스를 시작해보세요~~',
    ],
  },
  en: {
    heading: 'About Hanbok',
    paragraphs: [
      'Hanbok is Korea’s traditional attire, with a long history and heritage. With its unique beauty and distinctive design, it is considered one of the symbols of Korean culture and is mainly worn on special occasions and holidays. Unlike the straight lines of Western clothing, hanbok is characterized by softly flowing lines and generous, draping fabric.',
      'Traditionally, hanbok colors were chosen according to social status, age, and season, and the color combinations reflect the wearer’s personality and situation. More than just clothing, hanbok is an important cultural heritage symbolizing Korean tradition and culture, and its beauty is recognized worldwide.',
      'Right now, let me — INSA — capture your lovely moments in hanbok on screen! Start the hanbok dress-up service~~',
    ],
  },
  ja: {
    heading: '韓服の説明',
    paragraphs: [
      '韓服は韓国の伝統衣装で、長い歴史と伝統を持つ装いです。独自の美しさと特徴的なデザインで韓国文化を代表する象徴の一つとされ、特別な行事や名節の際に主に着用されます。直線的な西洋の衣装と異なり、韓服は柔らかく流れる線とゆったりとした裾が特徴です。',
      '伝統的に、韓服の色は社会的地位・年齢・季節などによって選ばれ、その配色は着る人の個性や状況を表します。韓服は単なる衣服を超え、韓国の伝統と文化を象徴する重要な文化遺産であり、世界的にもその美しさが認められています。',
      '今ここで、私インサが韓服を着た皆さんの素敵な姿を画面に収めます！韓服着付けサービスを始めてみましょう〜〜',
    ],
  },
  zh: {
    heading: '韩服说明',
    paragraphs: [
      '韩服是韩国的传统服饰，拥有悠久的历史与传统。它以独特的美感和别致的设计被视为代表韩国文化的象征之一，主要在特别的活动或节日时穿着。与线条笔直的西式服装不同，韩服以柔和流畅的线条和宽松飘逸的衣摆为特点。',
      '传统上，韩服的颜色会依社会地位、年龄、季节等来选择，配色也反映了穿着者的个性与场合。韩服不仅是一件衣服，更是象征韩国传统与文化的重要文化遗产，其美感在世界范围内也广受认可。',
      '现在就让我——INSA，把各位穿上韩服的美丽身影留在屏幕里吧！快来开始韩服试穿服务吧～～',
    ],
  },
};

export interface PrivacySection {
  title: string;
  lines: string[];
}
export interface PrivacyPolicy {
  title: string;
  sections: PrivacySection[];
}

/** 개인정보 처리방침 popup copy (Figma 한복체험_개인정보처리). */
export const PRIVACY: Partial<Record<Lang, PrivacyPolicy>> = {
  ko: {
    title: '개인정보 처리방침',
    sections: [
      { title: '1. 개인정보의 수집 항목 및 방법', lines: ['당사는 서비스 제공을 위해 아래와 같은 개인정보를 수집합니다:', '필수항목: 사진 파일 및 관련 메타데이터', '수집 방법: 사용자가 키오스크에서 의상을 선택후 사진촬영 통해 생성되는 합성 사진 정보'] },
      { title: '2. 개인정보의 수집 및 이용 목적', lines: ['당사는 수집한 개인정보를 다음과 같은 목적을 위해 이용합니다:', '서비스 제공: 사용자에게 사진 합성 사진 데이터 제공', '알림 및 마케팅: 이벤트, 프로모션, 광고 등 사용자 맞춤형 정보를 제공하기 위한 활용'] },
      { title: '3. 개인정보의 보유 및 이용 기간', lines: ['당사는 사용자의 개인정보를 수집한 목적을 달성할 때까지 보유하며, 이용 목적이 달성된 후에는 즉시 안전하게 파기됩니다. 사용자가 탈퇴를 요청하거나 이용을 중단할 경우에도 개인정보는 관련 법령에 따라 일정 기간 보유한 후 파기됩니다.'] },
      { title: '4. 개인정보의 제3자 제공', lines: ['당사는 사용자의 개인정보를 원칙적으로 제3자에게 제공하지 않습니다. 다만, 다음과 같은 경우에 한해 개인정보를 제공할 수 있습니다:', '법적 의무: 법령에 의한 요구나 법적 절차에 따르는 경우', '서비스 제공을 위한 제휴사: 기능 및 프로모션 제공을 위해 필요한 외부 업체와의 협력 시, 최소한의 개인정보를 공유할 수 있습니다.', '사용자의 사전 동의: 사용자가 동의한 경우에 한해 개인정보를 제공할 수 있습니다.'] },
      { title: '5. 개인정보의 안전성 확보 조치', lines: ['당사는 사용자의 개인정보를 보호하기 위해 다음과 같은 조치를 취하고 있습니다:', '데이터 암호화: 개인정보를 암호화하여 저장하고 전송합니다.', '접근 제한: 개인정보에 대한 접근을 필요한 직원 및 제휴사로 제한합니다.', '보안 업데이트: 정기적인 보안 점검 및 업데이트를 통해 시스템의 취약점을 방지합니다.'] },
      { title: '6. 개인정보 처리방침의 변경', lines: ['본 개인정보 처리방침은 법적 요구사항이나 서비스 변경에 따라 수정될 수 있습니다. 변경 사항이 있을 경우, 변경된 사항을 앱 또는 웹사이트를 통해 고지합니다.'] },
      { title: '7. 개인정보 보호 담당자', lines: ['담당자: 인다라', '연락처: company @witworldwide.com'] },
    ],
  },
  en: {
    title: 'Privacy Policy',
    sections: [
      { title: '1. Items and method of collection', lines: ['We collect the following personal data to provide the service:', 'Required: photo files and related metadata', 'Method: composite photo data generated when a user selects an outfit and takes a photo at the kiosk'] },
      { title: '2. Purpose of collection and use', lines: ['We use the collected personal data for the following purposes:', 'Service: providing composite photo data to the user', 'Notices & marketing: providing tailored information such as events, promotions, and ads'] },
      { title: '3. Retention and use period', lines: ['We retain personal data until the purpose of collection is achieved, after which it is securely destroyed immediately. Even if a user requests withdrawal or stops using the service, data is kept for a period required by law and then destroyed.'] },
      { title: '4. Provision to third parties', lines: ['In principle we do not provide personal data to third parties. However, it may be provided in the following cases:', 'Legal obligation: when required by law or legal procedure', 'Service partners: minimal data may be shared with external partners needed to provide features and promotions', 'Prior consent: data may be provided only when the user consents'] },
      { title: '5. Security measures', lines: ['We take the following measures to protect personal data:', 'Encryption: personal data is stored and transmitted encrypted', 'Access control: access is limited to necessary staff and partners', 'Security updates: regular checks and updates prevent system vulnerabilities'] },
      { title: '6. Changes to this policy', lines: ['This policy may be revised in line with legal requirements or service changes. Any changes will be announced via the app or website.'] },
      { title: '7. Data protection officer', lines: ['Officer: Indara', 'Contact: company @witworldwide.com'] },
    ],
  },
  ja: {
    title: 'プライバシーポリシー',
    sections: [
      { title: '1. 個人情報の収集項目および方法', lines: ['当社はサービス提供のため以下の個人情報を収集します:', '必須項目: 写真ファイルおよび関連メタデータ', '収集方法: 利用者がキオスクで衣装を選び撮影することで生成される合成写真情報'] },
      { title: '2. 個人情報の収集および利用目的', lines: ['当社は収集した個人情報を次の目的で利用します:', 'サービス提供: 利用者への合成写真データの提供', '通知およびマーケティング: イベント・プロモーション・広告など利用者向け情報の提供'] },
      { title: '3. 個人情報の保有および利用期間', lines: ['当社は収集目的を達成するまで個人情報を保有し、目的達成後は速やかに安全に破棄します。利用者が退会を要請したり利用を中止した場合も、関連法令に従い一定期間保有した後に破棄します。'] },
      { title: '4. 個人情報の第三者提供', lines: ['当社は原則として個人情報を第三者に提供しません。ただし、次の場合に限り提供することがあります:', '法的義務: 法令による要求や法的手続きに従う場合', 'サービス提供のための提携先: 機能やプロモーション提供に必要な外部業者との協力時に、最小限の個人情報を共有することがあります。', '利用者の事前同意: 利用者が同意した場合に限り提供できます。'] },
      { title: '5. 個人情報の安全性確保措置', lines: ['当社は個人情報を保護するため次の措置を講じています:', 'データ暗号化: 個人情報を暗号化して保存・送信します。', 'アクセス制限: 個人情報へのアクセスを必要な職員および提携先に限定します。', 'セキュリティ更新: 定期的な点検と更新でシステムの脆弱性を防ぎます。'] },
      { title: '6. プライバシーポリシーの変更', lines: ['本ポリシーは法的要件やサービス変更により改定されることがあります。変更がある場合はアプリまたはウェブサイトで告知します。'] },
      { title: '7. 個人情報保護責任者', lines: ['責任者: インダラ', '連絡先: company @witworldwide.com'] },
    ],
  },
  zh: {
    title: '隐私政策',
    sections: [
      { title: '1. 个人信息的收集项目及方法', lines: ['为提供服务，我们收集以下个人信息：', '必填项：照片文件及相关元数据', '收集方法：用户在自助机上选择服装并拍照后生成的合成照片信息'] },
      { title: '2. 收集及使用目的', lines: ['我们将收集的个人信息用于以下目的：', '提供服务：向用户提供合成照片数据', '通知与营销：用于提供活动、促销、广告等个性化信息'] },
      { title: '3. 保存及使用期限', lines: ['我们在达到收集目的之前保存个人信息，目的达成后将立即安全销毁。即使用户申请退出或停止使用，个人信息也将依相关法规保存一定期限后销毁。'] },
      { title: '4. 向第三方提供', lines: ['原则上我们不向第三方提供个人信息。但在以下情况下可提供：', '法律义务：依法律要求或法律程序时', '服务合作方：为提供功能及促销，与必要的外部公司合作时，可共享最少限度的个人信息。', '用户事先同意：仅在用户同意的情况下提供。'] },
      { title: '5. 安全保障措施', lines: ['为保护个人信息，我们采取以下措施：', '数据加密：个人信息加密存储与传输。', '访问限制：将访问权限限于必要的员工及合作方。', '安全更新：通过定期检查与更新防止系统漏洞。'] },
      { title: '6. 政策的变更', lines: ['本隐私政策可能依法律要求或服务变更而修订。如有变更，将通过应用或网站予以公告。'] },
      { title: '7. 个人信息保护负责人', lines: ['负责人：因陀罗', '联系方式：company @witworldwide.com'] },
    ],
  },
};
