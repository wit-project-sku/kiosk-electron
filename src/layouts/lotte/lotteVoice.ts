/**
 * 롯데 voice guidance (음성 안내) — what differs from 제주. The engine is 제주's
 * (layouts/jeju/voice: speechSynthesis, the three layers, keys 1 2 3 7 8 9, idle
 * reset); LotteKiosk mounts it, and lines.ts reads this file on the LOTTE layout.
 *
 * Lines come from the 롯데 sheet's own Text-to-speech_Script tab: bundled as
 * VOICE_LOTTE (npm run sync:sheet -- --only=lotte) and re-read on every launch
 * and at 00:00, like 제주's. Shared keys (global.*, focus.*, state.*, shoot.*,
 * num.*) have the same names in both sheets.
 */
import type { KioskScreenId } from '@shared/types/kiosk';

/** The route's default intro. A screen with tabs or steps declares its own (useVoiceIntro). */
export const LOTTE_SCREEN_INTROS: Partial<Record<KioskScreenId, string>> = {
  home: 'lotte.home',
  language: 'lotte.language',
  search: 'lotte.search',
  cinema: 'lotte.cinema.schedule',
  ai_search: 'lotte.course.input',
  movie_share: 'lotte.film',
  eat: 'lotte.food.list',
  shop: 'lotte.shop.list',
  detail: 'lotte.spot.detail',
  about: 'lotte.about.list',
  hello: 'lotte.hello',
  restroom: 'lotte.restroom',
  building: 'lotte.building.hotspot',
  events: 'lotte.event.list',
  stories: 'lotte.story.list',
  market: 'lotte.witstore',
  fillme: 'lotte.fillme.start',
};

/**
 * 제주 keys used by the flows both layouts share (PhotoWorkflow, JejuHanbokSelect,
 * the photo voice in useJejuVoice) → the 롯데 sheet's line for the same moment.
 * 한복 배경 테마 has no 롯데 row: the 의상 선택 line covers it.
 */
export const LOTTE_KEY_ALIASES: Readonly<Record<string, string>> = {
  'hanbok.select': 'lotte.photo.select',
  'hanbok.background': 'lotte.photo.select',
  'hanbok.info': 'lotte.photo.hanbok',
  'hanbok.privacy': 'lotte.photo.privacy',
  'hanbok.capture': 'lotte.photo.capture',
  'hanbok.waiting': 'lotte.photo.waiting',
  'hanbok.result': 'lotte.photo.result',
  'hanbok.result@W008': 'lotte.photo.result',
};

/** The site a test rig previewing 롯데 hears when its kiosk id has no site row. */
export const LOTTE_FALLBACK_SITE = 'W012';
