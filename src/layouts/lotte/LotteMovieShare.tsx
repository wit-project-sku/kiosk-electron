/**
 * 영화 나눔 — 안내. Figma C-03 (8754:1419).
 *
 * Explains the scheme (5 films seen and verified → 1 film given to a neighbour) and hands off to
 * the WITS app by QR. Verification, the film strip and the giving all happen in the app; the kiosk
 * only explains (규칙 카드 5). The strip is an illustration, never the visitor's own progress.
 */
import type { KioskController } from '@renderer/hooks/useKioskController';
import { lotteIconUrl } from '@renderer/assets/icons/lotte';
import { LottePageFrame } from './LottePageFrame';
import { LotteQr } from './LotteQr';
import { LOTTE_LINKS } from './lotteLinks';
import { useLotteMovieShareSummary } from './lotteLive';
import { LotteSteps } from './LotteSteps';
import { lt } from './lotteText';
import { tc } from './lotteCopy';
import { useLanguageStore } from '@renderer/store/languageStore';
import ui from './lotteUi.module.css';
import s from './LotteMovieShare.module.css';

/** A sheet line used as a subtitle loses its closing full stop, as the frame writes it. */
const tPlainLine = (line: string): string => line.replace(/[.。]\s*$/, '');

/** Perforations along each edge of the strip. */
const HOLES = 13;
/** Films 1–3 drawn as verified in the illustration. */
const FILLED = 3;

export function LotteMovieShare({ controller }: { controller: KioskController }): JSX.Element {
  const check = lotteIconUrl('ico-film-check');
  const lang = useLanguageStore((st) => st.currentLanguage);
  // FilmShare_Total is '함께 나눈 영화 {n}편': the label before the number, the unit after it.
  const [totalLabel = '', totalUnit = ''] = lt('FilmShare_Total', lang, '지금까지 함께 나눈 영화 {n}편')
    .split('{n}')
    .map((part) => part.trim());
  /* 함께 나눈 영화 — GET /api/movie-share/summary, all three sites together. Hidden until it has
     answered (spec C-03: 못 받으면 숨김); 0 is a real answer and is shown. */
  const sharedTotal = useLotteMovieShareSummary()?.totalSharedCount ?? null;
  const holes = (
    <div className={s.holes}>
      {Array.from({ length: HOLES }, (_, i) => (
        <span key={i} className={s.hole} />
      ))}
    </div>
  );
  return (
    <LottePageFrame
      controller={controller}
      title={lt('FilmShare_Title', lang, '영화 나눔')}
      subtitle={tPlainLine(lt('FilmShare_AppLine', lang, '내가 본 영화 5편이 이웃의 영화 1편이 됩니다'))}
      showBanner={false}
    >
      <div className={ui.column}>
        <div className={`${ui.hero} ${s.hero}`}>
          <span className={s.heroTitle}>{lt('FilmShare_Title', lang, '영화 나눔')}</span>
          <span className={ui.heroSub}>
            {lt(
              'FilmShare_Desc',
              lang,
              '롯데시네마에서 영화를 보고 예매번호를 인증하면, 5편마다 이웃에게 영화 1편을 나눕니다.',
            )
              // The sheet writes it as one sentence; the frame breaks it after the comma.
              .split(/(?<=,)\s*/)
              .map((part, i) => (
                <span key={i} className={s.heroLine}>
                  {part}
                </span>
              ))}
          </span>
        </div>

        <div className={`${ui.card} ${s.stripCard}`}>
          <div className={s.strip} aria-hidden>
            {holes}
            <div className={s.frames}>
              {Array.from({ length: 5 }, (_, i) =>
                i < FILLED ? (
                  <span key={i} className={`${s.frame} ${s.frameOn}`}>
                    {check && <img src={check} alt="" draggable={false} />}
                  </span>
                ) : (
                  <span key={i} className={s.frame}>
                    {i + 1}
                  </span>
                ),
              )}
            </div>
            {holes}
          </div>
          <span className={s.caption}>{tc('FilmShare_Caption', lang)}</span>
        </div>

        <LotteSteps
          steps={[
            { title: lt('FilmShare_Step1', lang, '롯데시네마에서 영화 관람'), sub: tc('FilmShare_Cinemas', lang) },
            { title: lt('FilmShare_Step2', lang, 'WITS 앱에서 예매번호 인증'), sub: tc('FilmShare_Step2_Sub', lang) },
            { title: lt('FilmShare_Step3', lang, '필름 5칸 = 영화 1편 나눔'), sub: tc('FilmShare_Step3_Sub', lang) },
          ]}
        />

        <div className={ui.qrCard}>
          <LotteQr value={LOTTE_LINKS.movieShare} />
          <div className={ui.qrText}>
            <span className={ui.qrTitle}>{lt('FilmShare_QR', lang, '휴대폰으로 QR 을 찍어 인증해요')}</span>
            <span className={ui.qrSub}>
              {tc('FilmShare_QR_Sub', lang)}
            </span>
          </div>
        </div>

        {sharedTotal != null && (
          <div className={s.total}>
            <span className={s.totalLabel}>{totalLabel}</span>
            <span className={s.totalValue}>
              {sharedTotal.toLocaleString('ko-KR')}
              {totalUnit}
            </span>
          </div>
        )}
      </div>
    </LottePageFrame>
  );
}
