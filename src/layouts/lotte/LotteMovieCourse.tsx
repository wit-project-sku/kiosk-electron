/**
 * '롯데' 뭐하지 — 영화 전후 코스. Figma C-01 (입력, 8768:567) and C-02 (결과, 8768:663).
 *
 * The home card keeps its '롯데' 뭐하지 look; behind it is now only the movie course: pick a
 * session, before / after / both, and party size, then get places on nearby floors that are open
 * at that time (lotteCoursePlan.ts). There is deliberately no "browse without a movie" path.
 */
import { useMemo, useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useShopStore } from '@renderer/store/shopStore';
import { LottePageFrame } from './LottePageFrame';
import { LotteQr } from './LotteQr';
import { LOTTE_LINKS } from './lotteLinks';
import { lotteCourseUrl } from './lotteCourseLink';
import {
  PARTY_OPTIONS,
  WHEN_OPTIONS,
  COURSE_KO,
  planCourse,
  toHm,
  type CourseStop,
  type CourseWhen,
  type CourseWords,
} from './lotteCoursePlan';
import { hallName, minutes, spanText, tc, tcRow } from './lotteCopy';
import { shopName, shopSecondCategory } from '@renderer/lib/shops';
import type { Lang } from '@renderer/lib/i18n';
import { useCinemaMovies } from './lotteLive';
import type { CinemaMovie } from './lotteSample';
import { lt } from './lotteText';
import { useLanguageStore } from '@renderer/store/languageStore';
import { useVoiceIntro } from '../jeju/voice/intro';
import ui from './lotteUi.module.css';
import s from './LotteMovieCourse.module.css';

const TITLE = "'롯데' 뭐하지";
/** Sessions per poster — two chips fit the 402 column. */
const SESSIONS_SHOWN = 2;
/** Posters in the card — the frame's one row of four. */
const MOVIES_SHOWN = 4;
/** The shortest stop (a 25-minute browse) plus the walks either side of it. */
const SHORTEST_BEFORE_MIN = 30;

/** By name, not index: the showtimes refresh each minute and a list position can move. */
interface Choice {
  title: string;
  start: string;
}

const nowHm = (d: Date): string =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

const VOICE_INPUT = ['lotte.course.input'] as const;
const VOICE_RESULT = ['lotte.course.result'] as const;

export function LotteMovieCourse({ controller }: { controller: KioskController }): JSX.Element {
  const shops = useShopStore((st) => st.shops);
  const lang = useLanguageStore((st) => st.currentLanguage);
  /** Course_When_* rows, by WHEN_OPTIONS id. */
  const whenLabel = (id: CourseWhen, authored: string): string =>
    lt(`Course_When_${id === 'both' ? 'Both' : id === 'before' ? 'Before' : 'After'}`, lang, authored);
  const [now] = useState(() => new Date());
  /* The planner's words in the visitor's language (Korean = COURSE_KO, unchanged). */
  const words = useMemo<CourseWords>(
    () =>
      lang === 'ko'
        ? COURSE_KO
        : {
            here: tc('Course_Here', lang),
            kiosk: tc('Course_Kiosk', lang),
            enter: tc('Course_EnterName', lang),
            arriveEarly: (n) => tc('Course_ArriveEarly', lang, { n }),
            minutes: (n) => minutes(n, lang),
            meal: tc('Course_Meal', lang),
            dinner: tc('Course_Dinner', lang),
            openUntil: (hm) => tc('Course_OpenUntil', lang, { t: hm }),
            openAfterUntil: (hm) => tc('Course_OpenAfterUntil', lang, { t: hm }),
            shopName: (s) => shopName(s, lang),
            category: (s) => shopSecondCategory(s, lang).replace(/^\d+-/, ''),
            hall: (screen) => hallName(screen, lang),
          },
    [lang],
  );
  const { movies: feed } = useCinemaMovies();
  /* Today's films with the sessions still to start — the course is planned around one of them. */
  const movies = useMemo<CinemaMovie[]>(
    () =>
      feed
        .map((m) => ({
          ...m,
          sessions: m.sessions.filter((x) => x.start > nowHm(now)).slice(0, SESSIONS_SHOWN),
        }))
        .filter((m) => m.sessions.length > 0)
        .slice(0, MOVIES_SHOWN),
    [feed, now],
  );
  const [choice, setChoice] = useState<Choice | null>(null);
  const [when, setWhen] = useState<CourseWhen>('both');
  const [party, setParty] = useState(1);
  const [result, setResult] = useState(false);
  useVoiceIntro(result ? VOICE_RESULT : VOICE_INPUT);

  const movie = choice ? movies.find((m) => m.title === choice.title) : undefined;
  const session = movie && choice ? movie.sessions.find((x) => x.start === choice.start) : undefined;
  const course = useMemo(
    () =>
      movie && session
        ? planCourse({ shops, kioskId: controller.kioskId, movie, session, when, party, now, words })
        : null,
    [movie, session, shops, controller.kioskId, when, party, now, words],
  );

  if (result && movie && session && course) {
    const span = [
      when !== 'after' ? tc('Course_Span_Before', lang, { t: spanText(course.beforeMinutes, lang) }) : null,
      when !== 'before' && course.afterMinutes > 0
        ? tc('Course_Span_After', lang, { t: spanText(course.afterMinutes, lang) })
        : null,
      tc('Course_OpenOnly', lang),
    ]
      .filter(Boolean)
      .join(' · ');
    const kind = tc(when === 'both' ? 'Course_Kind_Both' : when === 'before' ? 'Course_Kind_Before' : 'Course_Kind_After', lang);
    const qr = lotteCourseUrl(LOTTE_LINKS.course, {
      kioskId: controller.kioskId,
      lang,
      when,
      party,
      movie,
      session,
      course,
    });
    return (
      <LottePageFrame
        controller={controller}
        title={TITLE}
        subtitle={tcRow('SubHeader_AICourse', 'Course_Subtitle_Result', lang)}
        showBanner={false}
        onBack={() => setResult(false)}
      >
        <div className={ui.column}>
          <div className={ui.hero}>
            <span className={ui.heroTitle}>
              {movie.title} {session.start} · {lang === 'ko' ? PARTY_OPTIONS[party] : lt(`Visitor_${party + 1}`, lang, PARTY_OPTIONS[party]!)} · {kind}
            </span>
            <span className={ui.heroSub}>{span}</span>
          </div>

          <div className={s.timeline}>
            {course.stops.map((stop, i) => (
              <Row
                key={`${stop.kind}-${stop.at}-${stop.name}`}
                stop={stop}
                lang={lang}
                last={i === course.stops.length - 1}
                emptyAfter={
                  stop.kind === 'here' && course.emptyBefore && when !== 'after'
                    ? course.beforeMinutes < SHORTEST_BEFORE_MIN
                      ? tc('Course_NoTimeBefore', lang)
                      : tcRow('Course_None', 'Course_NoneOpenBefore', lang)
                    : null
                }
              />
            ))}
            {course.emptyAfter && when !== 'before' && (
              <div className={s.empty}>{tcRow('Course_None', 'Course_NoneOpenAfter', lang)}</div>
            )}
          </div>

          <div className={ui.qrCard}>
            <LotteQr value={qr} />
            <div className={ui.qrText}>
              <span className={ui.qrTitle}>{tc('Course_QR_Title', lang)}</span>
              <span className={ui.qrSub}>{tcRow('Course_QR', 'Course_QR_Sub', lang)}</span>
            </div>
          </div>

          <button type="button" className={ui.ctaOutline} onClick={() => setResult(false)}>
            {lt('Course_Retry', lang, '다시 고르기')}
          </button>
        </div>
      </LottePageFrame>
    );
  }

  return (
    <LottePageFrame
      controller={controller}
      title={TITLE}
      subtitle={tcRow('Course_Title', 'Course_Subtitle_Pick', lang)}
      showBanner={false}
    >
      <div className={ui.column}>
        <p className={ui.note}>
          *{lt('Cinema_Course_Guide', lang, '고른 상영 시각에 맞춰 앞뒤로 들를 곳을 짜 드립니다.')}
        </p>

        <div className={ui.card}>
          <h2 className={ui.heading}>{tc('Course_PickMovie', lang)}</h2>
          {movies.length === 0 ? (
            <span className={ui.muted}>{lt('Cinema_NoShow', lang, '오늘 남은 상영이 없습니다.')}</span>
          ) : (
            <div className={s.movies}>
              {movies.map((m) => (
                <div key={m.title} className={s.movie}>
                  {m.posterUrl ? (
                    <img src={m.posterUrl} alt="" className={s.poster} draggable={false} />
                  ) : (
                    <div className={s.poster}>{m.title}</div>
                  )}
                  <div className={s.sessions}>
                    {m.sessions.map((x) => {
                      const on = choice?.title === m.title && choice.start === x.start;
                      return (
                        <button
                          key={x.start}
                          type="button"
                          className={`${s.session} ${on ? s.sessionOn : ''}`}
                          onClick={() => setChoice({ title: m.title, start: x.start })}
                        >
                          {x.start}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={ui.card}>
          <h2 className={ui.heading}>{lt('Course_When', lang, '언제 둘러볼까요?')}</h2>
          <div className={ui.choices}>
            {WHEN_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={`${ui.choice} ${o.id === when ? ui.choiceOn : ''}`}
                onClick={() => setWhen(o.id)}
              >
                {whenLabel(o.id, o.label)}
              </button>
            ))}
          </div>
        </div>

        <div className={ui.card}>
          <h2 className={ui.heading}>{lt('Course_People', lang, '함께하는 인원')}</h2>
          <div className={ui.choices}>
            {PARTY_OPTIONS.map((o, i) => (
              <button
                key={o}
                type="button"
                className={`${ui.choice} ${i === party ? ui.choiceOn : ''}`}
                onClick={() => setParty(i)}
              >
                {lt(`Visitor_${i + 1}`, lang, o)}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className={ui.cta} disabled={!session} onClick={() => setResult(true)}>
          {lt('Course_Go', lang, '코스 추천받기')}
        </button>
      </div>
    </LottePageFrame>
  );
}

function Row({
  stop,
  lang,
  last,
  emptyAfter,
}: {
  stop: CourseStop;
  lang: Lang;
  last: boolean;
  /** Line under '지금 여기' when the before-half found nothing, saying why. */
  emptyAfter: string | null;
}): JSX.Element {
  const place = stop.kind === 'place';
  const badge =
    stop.kind === 'here' ? '★' : stop.kind === 'movie' ? '▶' : (stop.floor ?? tc('Course_EnterShort', lang));
  return (
    <>
      <div className={s.row}>
        <span className={`${s.time} ${place ? s.timeRed : ''}`}>{toHm(stop.at)}</span>
        <span className={`${s.badge} ${place ? s.badgeRose : ''}`}>{badge}</span>
        <div className={s.body}>
          <span className={s.name}>{stop.name}</span>
          <span className={s.detail}>{stop.detail}</span>
          {stop.open && <span className={s.open}>{stop.open}</span>}
        </div>
        {stop.walk != null && <span className={ui.chipGrey}>{tcRow('Course_Walk', 'Course_Walk_Short', lang, { n: stop.walk })}</span>}
        {!last && <span className={s.line} />}
      </div>
      {emptyAfter && <div className={s.empty}>{emptyAfter}</div>}
    </>
  );
}
