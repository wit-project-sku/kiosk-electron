/**
 * The 제주 mascots — 하영 (W006 제주공항 / W007 제주국제여객터미널) and 유산
 * (W008 세계자연유산본부). One 제주 design family, two characters: every 제주
 * screen that writes the mascot's NAME or biography resolves it through here
 * instead of hardcoding 하영, so a JEJU_HERITAGE machine reads '유산' everywhere
 * without per-screen forks.
 *
 * The mascot ART is NOT here — image imports belong to the screen that draws
 * them (see JejuHello's PHOTOS_BY_MASCOT). This module is pure data so it can be
 * imported from anywhere without pulling assets into the bundle.
 */
import { getKioskLocation } from '@shared/config/kioskLocations';
import { useKioskStore } from '@renderer/store/kioskStore';

/**
 * The mascot's own biography — the VALUES on 안녕's 소개 tab.
 *
 * Every field has a `Greeting_*Content` row in Localization_Jeju, but those rows
 * exist ONCE and describe 하영, so they cannot be split per venue the way the
 * seven duplicated keys are (see LocalizationSyncParser.VENUE_MASCOTS). That is
 * what {@link fromSheet} is for.
 */
export interface JejuMascotBio {
  /**
   * Whether Localization_Jeju's `Greeting_*` rows describe THIS mascot.
   *
   * `true` for 하영: the sheet is authoritative and the literals below are only
   * the fallback — exactly the behaviour W006/W007 have always had.
   *
   * `false` for 유산: the sheet's Greeting_* rows are 하영's data, so reading
   * them on a W008 machine is not a fallback, it is the WRONG mascot's
   * biography (하영's birthday, hobbies and 자기소개 under the 유산 portrait).
   * The authored copy below — transcribed from the 유산 frames — wins instead.
   * Flip this to `true` the moment the operators add 유산 rows to the sheet and
   * the tie-break can pick them; nothing else needs to change.
   */
  fromSheet: boolean;
  /** Greeting_NameContent — the value on the [제주] main 02 plate. */
  name: string;
  /** Greeting_BirthDayContent */
  born: string;
  /** Greeting_HomeTownContent */
  from: string;
  /** Greeting_NationalityContent */
  nationality: string;
  /** Greeting_BloodTypeContent */
  blood: string;
  /** Greeting_MBTIContent */
  mbti: string;
  /** Greeting_SpecialtyContent */
  talent: string;
  /** Greeting_HobbyContent */
  hobby: string;
  /** Greeting_FutureHopeContent — `\n` is drawn, `.detailValue` is pre-line. */
  dream: string;
  /** Greeting_IntrodutionContent — same, the frame breaks after the first line. */
  about: string;
}

export interface JejuMascot {
  /** Stable key for per-mascot lookups (art, geometry variants). */
  id: 'hayoung' | 'yusan';
  /** Korean name — 하영 / 유산. */
  ko: string;
  /** Romanization as the Figma caps it — HAYOUNG / YUSAN. */
  roman: string;
  /** Mixed-case romanization for running English copy — Hayoung / Yusan. */
  mixed: string;
  /** Katakana, as the ja sheet cells write it — ハヨン / ユサン. */
  ja: string;
  /** Cyrillic transliteration for the ru fallbacks — Хаён / Юсан. */
  ru: string;
  /**
   * 안녕 page title — ASCII apostrophes, byte-identical to the CMS
   * `button_type` ("안녕 '하영'" / "안녕 '유산'"). i18n's TITLE_KEYS carries an
   * entry per mascot so the header still localizes it through the sheet.
   */
  helloTitle: string;
  /**
   * 도와줘 page title — CURLY quotes, as the Figma frames write it
   * (6219:98770). The straight-quote form is the CMS/home-tile string; the two
   * are allowed to differ, and TITLE_KEYS maps each of these separately.
   */
  helpTitle: string;
  /**
   * 안녕's page subtitle, passed to JejuHeader only when {@link JejuMascotBio.fromSheet}
   * is false. `Greeting_Introduce` is another single 하영 row, so without this a
   * W008 kiosk would head the 유산 page with "마스코트 '하영'를 소개할게요".
   * The 유산 frames draw the Figma placeholder here, so this is the sheet's own
   * sentence with the mascot swapped rather than supplied copy.
   */
  introLine: string;
  /** Hashtag pills under the 안녕 profile card. */
  hashtags: readonly string[];
  bio: JejuMascotBio;
}

/** 하영 — W006 제주공항 / W007 제주국제여객터미널. Figma 6217:94591 and siblings. */
const HAYOUNG: JejuMascot = {
  id: 'hayoung',
  ko: '하영',
  roman: 'HAYOUNG',
  mixed: 'Hayoung',
  ja: 'ハヨン',
  ru: 'Хаён',
  helloTitle: "안녕 '하영'",
  helpTitle: '도와줘 ‘하영’',
  introLine: "안녕하세요! 마스코트 '하영'를 소개할게요!",
  hashtags: ['#HAYOUNG', '#하영', '#안녕하영'],
  bio: {
    // The sheet is authoritative for 하영 — these are the fallbacks the page has
    // always carried, verbatim from the frame's text nodes (6217:94601–94633).
    // One known disagreement: Greeting_MBTIContent says ENTP where the frame
    // said ENFP, and the kiosk correctly shows the sheet's ENTP.
    fromSheet: true,
    name: '하영(Hayoung)',
    born: '2006년 3월 19일',
    from: '제주특별자치도 제주시',
    nationality: '대한민국',
    blood: 'O형',
    mbti: 'ENFP',
    talent: '다국어 회화 능력, 여행 코스 추천, 노래 등',
    hobby: 'K-POP 댄스, 감성 카페 방문, 요가, 러닝',
    dream: 'K-컬처와 로컬 전통을 결합해 새로운 관광·라이프스타일 콘텐츠를 만드는 크리에이터',
    about:
      '저는 현재 제주도 홍보모델로 활동하고 있어요!\nK-콘텐츠와 제주 문화에 관심을 가지고, 제주를 방문하는 여행객들에게 유용한 정보와 특별한 경험을 전달하고 있어요. 제주 주요 관광 거점에서 여행 안내부터 지역 콘텐츠 소개까지, 제주 여행의 즐거움을 함께 만들어갑니다.',
  },
};

/** 유산 — W008 세계자연유산본부. Figma 6432:46475 ('유산'소개). */
const YUSAN: JejuMascot = {
  id: 'yusan',
  ko: '유산',
  roman: 'YUSAN',
  mixed: 'Yusan',
  ja: 'ユサン',
  ru: 'Юсан',
  helloTitle: "안녕 '유산'",
  helpTitle: '도와줘 ‘유산’',
  introLine: "안녕하세요! 마스코트 '유산'를 소개할게요!",
  hashtags: ['#YUSAN', '#유산', '#안녕유산'],
  bio: {
    // Transcribed from 6432:46475's text nodes (6432:47438–47470). 유산 shares
    // 하영's 출신 / 국적 / 혈액형 / 특기 and differs on the rest — note 취미 adds
    // 맛집 탐방 and 골프, which is why its 취미생활 tab has a 맛집탐방 sub-tab
    // where 하영's has 런닝.
    fromSheet: false,
    name: '유산(Yusan)',
    born: '2006년 7월 3일',
    from: '제주특별자치도 제주시',
    nationality: '대한민국',
    blood: 'O형',
    mbti: 'ENFJ',
    talent: '다국어 회화 능력, 여행 코스 추천, 노래 등',
    hobby: 'K-POP 댄스, 맛집 탐방, 디저트 카페 방문, 테니스, 골프',
    dream: '제주와 트렌드를 융합해 세계 관광객에게 제주를 새로운 방식으로\n경험하게 하는 콘텐츠 디렉터',
    about:
      '저는 제주 콘텐츠 크리에이터입니다.\n제주를 알리는 관광·라이프스타일 콘텐츠를 만드는 크리에이터로서, 제주를 중심으로 다양한 정보와 콘텐츠를 새로운 형태로 재해석하고 알려요. 제주 코스 추천해드릴게요~',
  },
};

/**
 * The running kiosk's mascot. Reads the kiosk id the same non-reactive way
 * loc.ts's bundledTable does — it is provisioned per machine and never changes
 * at runtime. A non-제주 layout answers 하영 so callers need no guard, but only
 * 제주 screens should be asking.
 */
export function jejuMascot(): JejuMascot {
  const layout = getKioskLocation(useKioskStore.getState().config.kioskId).layout;
  return layout === 'JEJU_HERITAGE' ? YUSAN : HAYOUNG;
}
