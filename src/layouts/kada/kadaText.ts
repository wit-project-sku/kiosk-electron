import type { SupportedLanguage } from '@shared/types/kiosk';

/**
 * KADA (W202) copy — English and Vietnamese, authored in-repo.
 *
 * Every OTHER location pulls its strings from a Google Sheets `Localization_*`
 * tab synced into SQLite (see LocalizationSyncParser). KADA deliberately does
 * not: the venue has no CMS rows, no sheet tab, and no one on site to maintain
 * one, so a sheet-backed KADA would render its fallback — Korean — to an
 * audience that reads neither Korean nor the sheet. Ten strings on one screen do
 * not justify that machinery. If KADA ever grows a real content set, move this
 * file to a sheet tab rather than extending it screen by screen.
 */

/**
 * The only two languages KADA offers. The rest of the fleet ships an
 * 8-language selector (see languageStore's ALLOWED); this venue's visitors are
 * Vietnamese hosts and Korean/English delegates, and the Figma header draws a
 * two-state EN/VN pill rather than a language screen.
 *
 * Order matters — it is the left-to-right order of the pill.
 */
export const KADA_LANGS = ['en', 'vi'] as const;

export type KadaLang = (typeof KADA_LANGS)[number];

/** Narrow any fleet-wide language down to one KADA actually renders. */
export function toKadaLang(lang: SupportedLanguage): KadaLang {
  return lang === 'vi' ? 'vi' : 'en';
}

type Copy = Record<KadaLang, string>;

/** Multi-line blocks are stored as arrays — the Figma frames set explicit line
 *  breaks, and letting them re-wrap changes the composition at 2160px wide. */
type Block = Record<KadaLang, readonly string[]>;

interface KadaCopy {
  /** Grey eyebrow above the title. */
  eyebrow: Copy;
  /** The academy's name. NOT translated: it is the institution's proper name,
   *  written in English on the venue's own signage and every partner logo. */
  title: readonly string[];
  /** Three-line gold strapline under the first divider. */
  strapline: Block;
  /** Two-line label under the camera button. */
  photoButton: Block;
  /** Accessible names for the header controls (never drawn on screen). */
  a11y: {
    home: Copy;
    back: Copy;
    language: Copy;
    photo: Copy;
  };
}

export const KADA: KadaCopy = {
  eyebrow: {
    en: 'Vietnam Chapter · Official Opening Ceremony',
    vi: 'Chi nhánh Việt Nam · Lễ Khai mạc Chính thức',
  },
  title: ['Korea-ASEAN', 'Digital Academy'],
  strapline: {
    en: ['Opening the path to', 'an AI Talent Powerhouse', 'Korea and Vietnam, Together'],
    vi: ['Mở lối trở thành', 'cường quốc nhân lực AI', 'Hàn Quốc và Việt Nam, cùng nhau'],
  },
  photoButton: {
    en: ['K-CULTURE', 'CHALLENGE'],
    vi: ['THỬ THÁCH', 'K-CULTURE'],
  },
  a11y: {
    home: { en: 'Home', vi: 'Trang chủ' },
    back: { en: 'Back', vi: 'Quay lại' },
    language: { en: 'Change language', vi: 'Đổi ngôn ngữ' },
    photo: { en: 'K-Culture Challenge photo', vi: 'Chụp ảnh Thử thách K-Culture' },
  },
};
