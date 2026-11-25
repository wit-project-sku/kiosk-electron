/**
 * The 영화 전후 코스 QR: the course as the phone page (direction-fe `/lotte`,
 * src/lotte/lotteCourse.ts there — keep the two in step) reads it.
 *
 *   /lotte?k=11&w=x&p=1&m=<movie>&r=122&s=1915&h=6&t=1730&f=1F.5F&ew=4
 *         &x=5665.1735.40.3.B1.2200_5702.1820.25.2.2F.2130  [&l=en] [&n1=<name>]
 *
 * Like the 제주 AI 코스 QR (aiCourseSave.ts), the plan rides as numbers: a place is
 * `shopId.arriveHHMM.stayMin.walkMin.floor.closeHHMM`, and the phone fetches its name, category
 * and photo from GET /api/shops/{id} in its own language. The movie title is the one text field
 * (there is nothing to look it up by). A shop from the kiosk's collected list (id ≥ 900000) is
 * not in the API, so its name rides along as `n<index>`.
 */
import type { KioskId } from '@shared/types/kiosk';
import type { Lang } from '@renderer/lib/i18n';
import type { CinemaMovie, CinemaSession } from './lotteSample';
import { shopHours, siteFloors, type Course, type CourseWhen } from './lotteCoursePlan';

const LOCAL_ID_FROM = 900_000;
const hhmm = (min: number): string =>
  `${String(Math.floor(min / 60) % 24).padStart(2, '0')}${String(min % 60).padStart(2, '0')}`;
const hhmmOf = (hm: string): string => hm.replace(':', '').padStart(4, '0');
/** The phone page knows these eight; 중국어 간체/번체 both read as zh. */
const PHONE_LANGS = new Set(['ko', 'en', 'ja', 'zh', 'vi', 'th', 'ru', 'id']);

export function lotteCourseUrl(
  base: string | null,
  args: {
    kioskId: KioskId;
    lang: Lang;
    when: CourseWhen;
    party: number;
    movie: Pick<CinemaMovie, 'title' | 'runtimeMin'>;
    session: CinemaSession;
    course: Course;
  },
): string | null {
  if (!base) return null;
  const { kioskId, lang, when, party, movie, session, course } = args;
  const floors = siteFloors(kioskId);
  const q = new URLSearchParams();
  q.set('k', kioskId.replace(/\D/g, '').replace(/^0+/, ''));
  const phoneLang = lang.startsWith('zh') ? 'zh' : lang;
  if (phoneLang !== 'ko' && PHONE_LANGS.has(phoneLang)) q.set('l', phoneLang);
  q.set('w', when === 'before' ? 'b' : when === 'after' ? 'a' : 'x');
  q.set('p', String(party));
  q.set('m', movie.title);
  q.set('r', String(movie.runtimeMin));
  q.set('s', hhmmOf(session.start));
  q.set('h', /^(\d+)관$/.exec(session.screen)?.[1] ?? session.screen);
  const here = course.stops.find((x) => x.kind === 'here');
  if (here) q.set('t', hhmm(here.at));
  q.set('f', `${floors.kiosk}.${floors.cinema ?? ''}`);
  const enter = course.stops.find((x) => x.kind === 'enter');
  if (enter?.walk != null) q.set('ew', String(enter.walk));

  const places = course.stops.filter((x) => x.kind === 'place' && x.shop);
  const names: Array<[string, string]> = [];
  const x = places.map((stop, i) => {
    const shop = stop.shop!;
    if (shop.id >= LOCAL_ID_FROM) names.push([`n${i}`, stop.name]);
    return [
      shop.id,
      hhmm(stop.at),
      stop.stay ?? 0,
      stop.walk ?? 0,
      stop.floor ?? '',
      hhmm(shopHours(shop, kioskId).close),
    ].join('.');
  });
  if (x.length > 0) q.set('x', x.join('_'));
  for (const [k, v] of names) q.set(k, v);
  return `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`;
}
