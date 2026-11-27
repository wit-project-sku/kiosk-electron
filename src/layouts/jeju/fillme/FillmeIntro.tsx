import type { JSX, ReactNode } from 'react';
import { Icon } from './Icon';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { useLang } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { tx, tLines } from './text';
import ui from './fillmeUi.module.css';
import styles from './FillmeIntro.module.css';

/**
 * 단계 그림. 시안의 카메라(7377:155125)는 내보내면 렌즈 선이 빠진 몸통만 나와서,
 * 같은 모양(렌즈 있는 카메라)의 앱 선 아이콘을 시안 크기·굵기로 그린다 —
 * 130 에 획 11 은 24 격자로 2.03. 사람과 결과 그림은 시안에서 내보낸 파일 그대로다
 * (결과 그림은 연주황 원까지 한 장).
 */
const STEPS: { art: 'camera' | 'intro-user' | 'intro-result'; title: string; caption: string }[] = [
  /* title·caption 은 이제 시트 KEY 다 — 그림만 여기 남는다. */
  { art: 'camera', title: 'Fillme_text005', caption: 'Fillme_text006' },
  { art: 'intro-user', title: 'Fillme_text007', caption: 'Fillme_text008' },
  { art: 'intro-result', title: 'Fillme_text009', caption: 'Fillme_text010' },
];

interface Props {
  onStart: () => void;
}

/**
 * 제목에서 주황으로 칠할 말 — 시안(7377:155064)의 '영양 상태'. 여덟 언어 모두 시트
 * 문장(Fillme_text002) 안에 같은 뜻의 말이 그대로 들어 있어 그것을 찾아 칠한다.
 * 시트 문장이 바뀌어 말을 못 찾으면 칠하지 않고 그대로 둔다.
 */
const TITLE_EMPHASIS: Partial<Record<Lang, string>> = {
  ko: '영양 상태',
  en: 'nutritional status',
  ja: '栄養状態',
  zh: '营养状况',
  zh_cn: '营养状况',
  vi: 'tình trạng dinh dưỡng',
  th: 'ภาวะโภชนาการ',
  ru: 'статус питания',
  id: 'status nutrisi',
};

function emphasize(line: string, lang: Lang): ReactNode {
  const word = TITLE_EMPHASIS[lang];
  const at = word ? line.indexOf(word) : -1;
  if (!word || at < 0) return line;
  return (
    <>
      {line.slice(0, at)}
      <em>{word}</em>
      {line.slice(at + word.length)}
    </>
  );
}

/** 시작 화면 — Figma 7212:66398. 좌표와 시안과 다른 곳은 스타일시트 머리말 참고. */
export function FillmeIntro({ onStart }: Props): JSX.Element {
  const lang = useLang();
  const hand = fillmeArtUrl('hand-scan');
  return (
    <div className={styles.root}>
      {/* ── 히어로 카드 (7377:155057) ── */}
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <div className={styles.badges}>
            <span className={styles.badge}>{tx('Fillme_text001', lang)}</span>
            <span className={styles.with}>with</span>
            {/* 시안에서도 로고 그림이 아니라 글자다 (ExtraBold 50 #2644da). */}
            <span className={styles.brand}>Fillme</span>
          </div>
          {/* 줄바꿈 자리는 시트가 정한다(text.ts 참고). '영양 상태' 강조는
              TITLE_EMPHASIS 가 언어마다 찾아 칠한다. */}
          <h2 className={styles.title}>
            {tLines('Fillme_text002', lang).map((line, i) => (
              <span key={i} className={styles.line}>
                {emphasize(line, lang)}
              </span>
            ))}
          </h2>
          <p className={styles.desc}>
            {tLines('Fillme_text003', lang).map((line, i) => (
              <span key={i} className={styles.line}>
                {line}
              </span>
            ))}
          </p>
        </div>
        <div className={styles.art} aria-hidden="true">
          <span className={styles.artRing} />
          {hand && <img src={hand} alt="" className={styles.artHand} draggable={false} />}
        </div>
      </section>

      {/* ── 진행순서 (7334:85451) ── */}
      <p className={`${ui.sectionLabel} ${styles.stepsLabel}`}>{tx('Fillme_text004', lang)}</p>
      <ol className={styles.steps}>
        {STEPS.map((s, i) => {
          const art = s.art === 'camera' ? null : fillmeArtUrl(s.art);
          return (
            <li key={s.art} className={styles.step}>
              <span className={styles.stepNo}>{i + 1}</span>
              <div className={styles.stepCard}>
                {s.art === 'camera' ? (
                  <span className={styles.stepIcon}>
                    <Icon name="camera" size={130} strokeWidth={2.03} />
                  </span>
                ) : s.art === 'intro-result' ? (
                  art && <img src={art} alt="" className={styles.stepArt} draggable={false} />
                ) : (
                  <span className={styles.stepIcon}>
                    {art && <img src={art} alt="" className={styles.stepGlyph} draggable={false} />}
                  </span>
                )}
                <div className={styles.stepText}>
                  <p className={styles.stepTitle}>{tx(s.title, lang)}</p>
                  <p className={styles.stepCaption}>
                    {tLines(s.caption, lang).map((line, j) => (
                      <span key={j} className={styles.line}>
                        {line}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <button type="button" className={`${ui.cta} ${styles.cta}`} onClick={onStart}>
        {tx('Fillme_text011', lang)}
      </button>
    </div>
  );
}
