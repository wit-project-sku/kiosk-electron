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
import { LOTTE_LINKS, withQuery } from './lotteLinks';
import {
  PARTY_OPTIONS,
  WHEN_OPTIONS,
  planCourse,
  spanLabel,
  toHm,
  type CourseStop,
  type CourseWhen,
} from './lotteCoursePlan';
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
        ? planCourse({ shops, kioskId: controller.kioskId, movie, session, when, party, now })
        : null,
    [movie, session, shops, controller.kioskId, when, party, now],
  );

  if (result && movie && session && course) {
    const span = [
      when !== 'after' ? `상영 전 ${spanLabel(course.beforeMinutes)}` : null,
      when !== 'before' && course.afterMinutes > 0 ? `상영 후 ${spanLabel(course.afterMinutes)}` : null,
      '그 시각에 열려 있는 곳만 골랐어요',
    ]
      .filter(Boolean)
      .join(' · ');
    const kind = when === 'both' ? '앞뒤 코스' : when === 'before' ? '상영 전 코스' : '상영 후 코스';
    const qr = withQuery(
      LOTTE_LINKS.course,
      'course',
      course.stops.map((x) => `${toHm(x.at)}|${x.name}`).join(';'),
    );
    return (
      <LottePageFrame
        controller={controller}
        title={TITLE}
        subtitle="영화 전후 코스 · 상영 시각에 맞춘 추천 코스입니다"
        showBanner={false}
        onBack={() => setResult(false)}
      >
        <div className={ui.column}>
          <div className={ui.hero}>
            <span className={ui.heroTitle}>
              {movie.title} {session.start} · {PARTY_OPTIONS[party]} · {kind}
            </span>
            <span className={ui.heroSub}>{span}</span>
          </div>

          <div className={s.timeline}>
            {course.stops.map((stop, i) => (
              <Row
                key={`${stop.kind}-${stop.at}-${stop.name}`}
                stop={stop}
                last={i === course.stops.length - 1}
                emptyAfter={
                  stop.kind === 'here' && course.emptyBefore && when !== 'after'
                    ? course.beforeMinutes < SHORTEST_BEFORE_MIN
                      ? '상영 전에는 들를 시간이 부족해요'
                      : '상영 전에는 지금 문을 연 곳이 없어요'
                    : null
                }
              />
            ))}
            {course.emptyAfter && when !== 'before' && (
              <div className={s.empty}>상영 후에는 지금 문을 연 곳이 없어요</div>
            )}
          </div>

          <div className={ui.qrCard}>
            <LotteQr value={qr} />
            <div className={ui.qrText}>
              <span className={ui.qrTitle}>코스를 휴대폰으로 가져가기</span>
              <span className={ui.qrSub}>QR 을 찍으면 이 코스와 매장 위치가 열립니다.</span>
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
      subtitle="영화 전후 코스 · 영화 앞뒤 시간을 알차게 보내 보세요"
      showBanner={false}
    >
      <div className={ui.column}>
        <p className={ui.note}>
          *{lt('Cinema_Course_Guide', lang, '고른 상영 시각에 맞춰 앞뒤로 들를 곳을 짜 드립니다.')}
        </p>

        <div className={ui.card}>
          <h2 className={ui.heading}>보실 영화와 시간</h2>
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
  last,
  emptyAfter,
}: {
  stop: CourseStop;
  last: boolean;
  /** Line under '지금 여기' when the before-half found nothing, saying why. */
  emptyAfter: string | null;
}): JSX.Element {
  const place = stop.kind === 'place';
  const badge =
    stop.kind === 'here' ? '★' : stop.kind === 'movie' ? '▶' : (stop.floor ?? '입장');
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
        {stop.walk != null && <span className={ui.chipGrey}>도보 {stop.walk}분</span>}
        {!last && <span className={s.line} />}
      </div>
      {emptyAfter && <div className={s.empty}>{emptyAfter}</div>}
    </>
  );
}
