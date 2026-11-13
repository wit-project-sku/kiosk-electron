import type { Lang } from '@renderer/lib/i18n';
import { toLocalizedLang, type LocalizedLang } from '@shared/config/languages';
import { getKioskLocation } from '@shared/config/kioskLocations';

/**
 * A kiosk's place name in the visitor's language — for copy that names THIS
 * kiosk as the origin ("Start > …", "1.6 km from …", "*All courses start
 * from …").
 *
 * kioskLocations.ts carries one Korean `name` per kiosk, and those screens
 * printed it as-is, so an English visitor read "Start > 북인사마당". Places keep
 * their romanised Korean names where that is what the sign says (Bukinsa
 * Madang), and are translated where the Korean is a description (쉼터, 휴게소).
 * `Record<LocalizedLang, string>` makes a missing language a compile error.
 */
const KIOSK_NAMES: Record<string, Record<LocalizedLang, string>> = {
  W001: {
    ko: '북인사마당', en: 'Bukinsa Madang', ja: '北仁寺マダン', zh: '北仁寺广场',
    vi: 'Bukinsa Madang', th: 'บุกอินซามาดัง', ru: 'Пукинса-мадан', id: 'Bukinsa Madang',
  },
  W002: {
    ko: '인사동쉼터', en: 'Insadong Rest Area', ja: '仁寺洞休憩所', zh: '仁寺洞休息区',
    vi: 'Khu nghỉ chân Insadong', th: 'จุดพักอินซาดง', ru: 'Зона отдыха Инсадон', id: 'Tempat Istirahat Insadong',
  },
  W003: {
    ko: '남인사마당', en: 'Naminsa Madang', ja: '南仁寺マダン', zh: '南仁寺广场',
    vi: 'Naminsa Madang', th: 'นัมอินซามาดัง', ru: 'Наминса-мадан', id: 'Naminsa Madang',
  },
  W004: {
    ko: '오산시 오색시장', en: 'Osaek Market, Osan', ja: '烏山市 オセク市場', zh: '乌山市 五色市场',
    vi: 'Chợ Osaek, Osan', th: 'ตลาดโอแซก โอซาน', ru: 'Рынок Осэк, Осан', id: 'Pasar Osaek, Osan',
  },
  W005: {
    ko: '화성휴게소', en: 'Hwaseong Rest Area', ja: '華城休憩所', zh: '华城服务区',
    vi: 'Trạm dừng Hwaseong', th: 'จุดพักรถฮวาซอง', ru: 'Зона отдыха Хвасон', id: 'Rest Area Hwaseong',
  },
};

/** This kiosk's place name in `lang`; the Korean location name for a kiosk not listed. */
export function kioskPlaceName(kioskId: string, lang: Lang): string {
  return KIOSK_NAMES[kioskId]?.[toLocalizedLang(lang)] ?? getKioskLocation(kioskId).name;
}
