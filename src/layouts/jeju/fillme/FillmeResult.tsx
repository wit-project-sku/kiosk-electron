import { useMemo, useState, type JSX } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import type { AnalysisResult, Ingredient } from './api';
import { ingredientIconSources } from './ingredients';
import type { ShareState } from './share';
import { withSample } from './sampleResult';
import { toResultView, type NailCategory, type Solution, type SolutionLevel } from './resultView';
import { fillmeArtUrl, fillmeDiagnosisIconUrl } from '@renderer/assets/fillme';
import { Icon } from './Icon';
import { useLang, type Lang } from '@renderer/lib/i18n';
import { sheetText } from '@renderer/lib/loc';
import { tx } from './text';
import styles from './FillmeResult.module.css';

interface Props {
  result: AnalysisResult;
  /** 촬영한 손 사진(왼손 · 오른손) — API 가 손톱 사진을 주지 않을 때 캐러셀에 쓴다. */
  photos: string[];
  /** 결과 QR — 결과 이미지를 서버에 올리는 중 / 주소 받음 / 실패. off 면 QR·저장하기 없이 처음으로만. */
  share: ShareState;
  onRetryShare: () => void;
  onHome: () => void;
}

type Tab = 'health' | 'summary';

/* 시트에 아직 줄이 없는 문구 — sheetText 가 키가 생기는 순간 시트를 따른다. */
const COPY = {
  tabHealth: ['Fillme_result_tab1', '건강 분석'],
  tabSummary: ['Fillme_result_tab2', '종합분석 결과'],
  photos: ['Fillme_result_photos', '건강 분석'],
  score: ['Fillme_result_score', '건강 점수'],
  scoreUnit: ['Fillme_result_scoreUnit', '점'],
  toSummary: ['Fillme_result_toSummary', '종합분석 결과보기'],
  nail: ['Fillme_result_nail', '손톱 분석'],
  /* 시안 문구는 '최근 10회의 기기사용' 이지만 API 의 fingerScores 는 손가락 10개다. */
  chartNote: ['Fillme_result_chartNote', '그래프: 손가락 10개의 손톱 분석 점수를 표시합니다.'],
  solutions: ['Fillme_result_solutions', '맞춤 솔루션'],
  solutionHint: ['Fillme_result_solutionHint', '원하는 솔루션을 2개이상을 선택해주세요.\nⓘ 눌러 솔루션 상세정보를 확인해보세요.'],
  aiResult: ['Fillme_result_ai', 'AI 분석 결과'],
  status: ['Fillme_result_status', '건강 상태'],
  aiNutrients: ['Fillme_result_aiNutrients', 'AI 추천영양제'],
  /** {list} 자리에 영양소 이름들이 들어간다 — 낱말 순서는 언어마다 시트가 정한다. */
  deficient: ['Fillme_result_deficient', '{list} 부족'],
  close: ['Fillme_result_close', '닫기'],
  care: ['Fillme_result_care', '관리'],
  watch: ['Fillme_result_watch', '관심'],
  good: ['Fillme_result_good', '권장'],
  overall: ['Fillme_result_overall', '종합'],
  color: ['Fillme_result_color', '색깔'],
  pattern: ['Fillme_result_pattern', '패턴'],
  damage: ['Fillme_result_damage', '손상'],
  tool: ['Fillme_result_tool', '툴'],
  skin: ['Fillme_result_skin', '주변 피부'],
} as const;

function copy(id: keyof typeof COPY, lang: Lang): string {
  const [key, ko] = COPY[id];
  return sheetText(key, lang, { ko });
}

const CATEGORIES: NailCategory[] = ['overall', 'color', 'pattern', 'damage', 'tool', 'skin'];
const LEVELS: SolutionLevel[] = ['care', 'watch', 'good'];
const clampScore = (n: number): number => Math.max(0, Math.min(100, n));
const nutrientNames = (s: Solution): string =>
  (s.nutrients ?? [])
    .map((n) => n?.name)
    .filter(Boolean)
    .join(', ');

/** 성분 아이콘: 번들 복사본 우선 → 서버 주소 → 알약 아이콘. */
function IngredientIcon({ ingredient }: { ingredient: Ingredient }): JSX.Element {
  const { local, server } = ingredientIconSources(ingredient);
  const [src, setSrc] = useState<string | null>(local ?? server);
  if (!src) return <Icon name="pill" size={120} strokeWidth={1.6} className={styles.pill} />;
  return (
    <img
      src={src}
      alt=""
      className={styles.ingredientIcon}
      onError={() => setSrc(src === local && server ? server : null)}
    />
  );
}

/** 손톱 사진 — 가운데 한 장을 크게, 앞뒤 사진을 양옆에 깔고 점으로 위치를 보인다 (8240:45340). */
function PhotoCarousel({ images }: { images: string[] }): JSX.Element {
  const [index, setIndex] = useState(0);
  const n = images.length;
  const at = (i: number): string | undefined => images[((i % n) + n) % n];
  // 두 장이면 옆자리는 하나뿐 — 같은 사진을 양옆에 두 번 깔지 않는다.
  const prev = n > 2 || (n === 2 && index === 1) ? at(index - 1) : undefined;
  const next = n > 2 || (n === 2 && index === 0) ? at(index + 1) : undefined;
  return (
    <>
      <div className={styles.photos}>
        {prev && (
          <button type="button" className={`${styles.photo} ${styles.photoPrev}`} onClick={() => setIndex((i) => (i - 1 + n) % n)}>
            <img src={prev} alt="" draggable={false} />
          </button>
        )}
        {next && (
          <button type="button" className={`${styles.photo} ${styles.photoNext}`} onClick={() => setIndex((i) => (i + 1) % n)}>
            <img src={next} alt="" draggable={false} />
          </button>
        )}
        <div className={`${styles.photo} ${styles.photoMain}`}>
          <img src={at(index)} alt="" draggable={false} />
        </div>
      </div>
      {n > 1 && (
        <div className={styles.dots}>
          {images.map((src, i) => (
            <span key={`${src}-${i}`} className={i === index ? `${styles.dot} ${styles.dotActive}` : styles.dot} />
          ))}
        </div>
      )}
    </>
  );
}

/** 반원 게이지 (8240:45352) — 회색 바탕 반원 위에 점수만큼 주황 호. */
function ScoreGauge({ score, unit, cta, onCta }: { score: number; unit: string; cta: string; onCta: () => void }): JSX.Element {
  const value = clampScore(score);
  const arc = 'M15 294C15 139.913 139.913 15 294 15C448.087 15 573 139.913 573 294';
  return (
    <div className={styles.gauge}>
      <svg className={styles.gaugeArc} width="588" height="309" viewBox="0 0 588 309" fill="none" aria-hidden="true">
        <path d={arc} stroke="#ddd" strokeWidth="30" strokeLinecap="round" />
        {value > 0 && (
          <path
            d={arc}
            className={styles.gaugeFill}
            strokeWidth="30"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${value} 100`}
          />
        )}
      </svg>
      <p className={styles.score}>
        <span className={styles.scoreValue}>{Math.round(value)}</span>
        <span className={styles.scoreUnit}>{unit}</span>
      </p>
      <button type="button" className={styles.gaugeCta} onClick={onCta}>
        {cta}
      </button>
    </div>
  );
}

/**
 * 막대 색 — 종합분석 결과 시안(8240:44779…44797)의 손가락 1…10 파스텔, 순서대로.
 * 진단 아이콘 바탕색(#FFCFCF · #D6E2F3 · #F1FBF2 · #FFF4EE)과는 다른 묶음이고,
 * 막대는 손가락이라 아이콘과 이어지지도 않는다 — 시안의 색을 그대로 쓴다.
 */
const BAR_COLORS = ['#dcf6f7', '#dcf6f7', '#e6e4f9', '#fbe6d9', '#eeeef0', '#e6e4f9', '#dcf6f7', '#f3e2ed', '#dcf3f7', '#f1fad9'];

/**
 * 손톱 분석 그래프 (8240:45423) — 탭마다 손가락 10개의 점수.
 * 시안의 다른 판(8240:45454…)은 #ffeac7 에 마지막 막대만 주황이었는데, 그건
 * '이번 회차' 였을 때의 뜻이라 손가락 그래프에는 맞지 않는다.
 */
function NailChart({ history, lang }: { history: Partial<Record<NailCategory, number[]>>; lang: Lang }): JSX.Element {
  const tabs = CATEGORIES.filter((c) => history[c]?.length);
  const [tab, setTab] = useState<NailCategory>(tabs[0] ?? 'overall');
  const values = (history[tab] ?? []).slice(-10);
  return (
    <div className={styles.chartCard}>
      <div className={styles.chartTabs} role="tablist">
        {tabs.map((c) => (
          <button
            key={c}
            type="button"
            role="tab"
            aria-selected={c === tab}
            className={c === tab ? `${styles.chartTab} ${styles.chartTabActive}` : styles.chartTab}
            data-cat={c}
            onClick={() => setTab(c)}
          >
            {copy(c, lang)}
          </button>
        ))}
      </div>
      <div className={styles.chart}>
        <div className={styles.axis} aria-hidden="true">
          {[100, 80, 60, 40, 20, 0].map((v) => (
            <span key={v}>{v}</span>
          ))}
        </div>
        <div className={styles.bars}>
          {values.map((v, i) => (
            <div key={i} className={styles.barCol}>
              <span
                className={styles.bar}
                style={{ height: `${clampScore(v)}%`, background: BAR_COLORS[i % BAR_COLORS.length] }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className={styles.xLabels} aria-hidden="true">
        {values.map((_, i) => (
          <span key={i}>{i + 1}</span>
        ))}
      </div>
      <p className={styles.chartNote}>{copy('chartNote', lang)}</p>
    </div>
  );
}

/**
 * 증상 아이콘 — FillMe 아이콘 매칭표(2026-10-23) 2절: healthStatusDetails[].id 로
 * 1:1 매칭(`{id}.svg`, 28종). 이름(issue)은 번역되고 302·306 · 501·502 처럼 겹치기도
 * 해서 쓰지 않는다. 둥근 바탕까지 그려진 완성 타일이라 원을 통째로 채운다 —
 * 번들 복사본 → 서버 iconUrl 순. 둘 다 없으면(매칭표 밖의 새 id 를 iconUrl 없이)
 * 매칭표의 "기본 아이콘을 준비해 두세요" 대로 등급 색 원에 손 아이콘을 그린다.
 */
function SolutionTile({
  solution,
  className,
  fallbackSize,
}: {
  solution: Solution;
  className: string | undefined;
  fallbackSize: number;
}): JSX.Element {
  const tiles = [fillmeDiagnosisIconUrl(solution.id), solution.iconUrl].filter((u): u is string => !!u);
  const [at, setAt] = useState(0);
  const tile = tiles[at];
  return (
    <span className={className} data-level={solution.level} data-remote={tile ? true : undefined}>
      {tile ? (
        <img src={tile} alt="" className={styles.tileImg} draggable={false} onError={() => setAt((i) => i + 1)} />
      ) : (
        <Icon name="hand" size={fallbackSize} strokeWidth={1.8} className={styles.tileFallback} />
      )}
    </span>
  );
}

/** 맞춤 솔루션 카드와 건강 상태 표의 원 (120). */
function LineIcon({ solution }: { solution: Solution }): JSX.Element {
  return <SolutionTile solution={solution} className={styles.solutionDisc} fallbackSize={60} />;
}

/** 솔루션 패널(105)과 팝업(164)의 원. */
function ArtIcon({ solution, large }: { solution: Solution; large?: boolean }): JSX.Element {
  return (
    <SolutionTile
      solution={solution}
      className={large ? `${styles.artDisc} ${styles.artDiscLarge}` : styles.artDisc}
      fallbackSize={large ? 84 : 54}
    />
  );
}

/** 맞춤 솔루션 카드 (8240:45502) — 카드 어디를 눌러도 그 항목의 상세 팝업(8248:139377). */
function SolutionCard({ solution, onOpen }: { solution: Solution; onOpen: () => void }): JSX.Element {
  const chevron = fillmeArtUrl('result-chevron');
  return (
    <button type="button" className={styles.solution} aria-haspopup="dialog" onClick={onOpen}>
      <LineIcon solution={solution} />
      <span className={styles.solutionText}>
        <span className={styles.solutionName}>
          <span className={styles.levelDot} data-level={solution.level} />
          {solution.name}
        </span>
        {solution.description && <span className={styles.solutionDesc}>{solution.description}</span>}
      </span>
      {chevron && <img src={chevron} alt="" className={styles.chevron} draggable={false} />}
    </button>
  );
}

/** 건강 상태 (8240:43899) — 관리 · 관심 · 권장 줄마다 그 등급의 솔루션. 보기만 한다. */
function StatusGrid({ solutions, lang }: { solutions: Solution[]; lang: Lang }): JSX.Element {
  return (
    <div className={styles.status}>
      {LEVELS.map((level) => (
        <div key={level} className={styles.statusRow}>
          <span className={styles.statusLabel}>
            <span className={styles.levelDot} data-level={level} />
            {copy(level, lang)}
          </span>
          <div className={styles.statusItems}>
            {solutions
              .filter((s) => s.level === level)
              .map((s) => (
                <span key={s.id} className={styles.statusItem}>
                  <LineIcon solution={s} />
                  <span>{s.name}</span>
                </span>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 솔루션 패널 (8246:139395) — 솔루션마다 긴 설명과 AI 추천영양제. */
function SolutionDetails({ solutions, lang }: { solutions: Solution[]; lang: Lang }): JSX.Element {
  return (
    <div className={styles.details}>
      {solutions.map((s) => {
        const names = nutrientNames(s);
        return (
          <section key={s.id} className={styles.detail}>
            <div className={styles.detailHead}>
              <ArtIcon solution={s} />
              <div className={styles.detailInfo}>
                <p className={styles.detailName}>
                  <span className={styles.levelDot} data-level={s.level} />
                  {s.name}
                </p>
                {s.description && <p className={styles.detailDesc}>{s.description}</p>}
              </div>
            </div>
            {s.detail && <p className={styles.detailBody}>{s.detail}</p>}
            {names && (
              <p className={styles.detailNutrients}>
                <strong>{copy('aiNutrients', lang)} : </strong>
                {names}
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** 솔루션 상세 팝업 (8248:139377). 바깥을 누르거나 닫기로 닫는다. */
function SolutionPopup({ solution, lang, onClose }: { solution: Solution; lang: Lang; onClose: () => void }): JSX.Element {
  const names = nutrientNames(solution);
  const nutrients = (solution.nutrients ?? []).filter((n) => n?.name);
  return (
    <div className={styles.scrim} onClick={onClose}>
      <div
        className={styles.popup}
        role="dialog"
        aria-modal="true"
        aria-label={solution.name}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.popupHead}>
          <ArtIcon solution={solution} large />
          <div className={styles.popupInfo}>
            <p className={styles.popupName}>
              <span className={`${styles.levelDot} ${styles.popupDot}`} data-level={solution.level} />
              {solution.name}
            </p>
            {names && <p className={styles.popupDeficient}>{copy('deficient', lang).replace('{list}', names)}</p>}
          </div>
        </div>
        {solution.description && <p className={styles.popupDesc}>{solution.description}</p>}
        {nutrients.length > 0 && (
          <div className={styles.popupList}>
            {nutrients.map((n, i) => (
              <div key={`${n.name}-${i}`} className={styles.nutrient}>
                <p className={styles.nutrientName}>{n.name}</p>
                {n.benefit && <p className={styles.nutrientBenefit}>{n.benefit}</p>}
              </div>
            ))}
          </div>
        )}
        <button type="button" className={styles.popupClose} onClick={onClose}>
          {copy('close', lang)}
        </button>
      </div>
    </div>
  );
}

/**
 * 분석 결과 — Figma 8240:45310 (건강 분석) · 8240:43467 (종합분석 결과) ·
 * 8240:44486 (솔루션 팝업), 2026-10-23 개편. 좌표는 스타일시트 머리말 참고.
 *
 * 점수 · 그래프 · 솔루션은 게스트 분석 API 가 아직 주지 않는 값이다 (api.ts 의
 * healthScore … solutions). 값이 없는 칸은 그리지 않는다 — 건강 결과에 지어낸
 * 점수를 보여 줄 수는 없다. 개발 빌드만 시안 값으로 채워 본다(sampleResult.ts).
 * 솔루션이 없으면 종합분석 결과 탭은 예전 결과 화면(7334:83586)의 요약 카드와
 * 필요 영양 성분으로 돌아간다 — 지금 API 가 주는 것이 그것뿐이다.
 */
export function FillmeResult({ result: raw, photos, share, onRetryShare, onHome }: Props): JSX.Element {
  const lang = useLang();
  // JSON 문자열 셋을 푸는 일 — 결과가 바뀔 때만.
  const view = useMemo(() => toResultView(withSample(raw)), [raw]);
  const [tab, setTab] = useState<Tab>('health');
  const [popup, setPopup] = useState<Solution | null>(null);
  const rs = view.supplement;
  const title = rs.title;
  const description = rs.description;
  /** 'Fatigue Off(Fatigue Care)' — 시안의 '퍼티그 오프(피로 관리)'. */
  const productName = rs.name && rs.solution ? `${rs.name}(${rs.solution})` : rs.name || rs.solution;
  const ingredients = rs.ingredients;
  const images = view.nailImages.length ? view.nailImages : photos;
  const history = view.fingerScores;
  const hasHistory = CATEGORIES.some((c) => history[c]?.length);
  const solutions = view.solutions;
  const result = { healthScore: view.healthScore, comment: view.comment };
  /**
   * 저장하기를 누를 때마다 바뀌는 값 — QR 테두리의 깜빡임을 처음부터 다시 틀게 한다.
   * 저장은 QR 을 휴대폰으로 찍어서 하는 것이라(화살표가 QR 을 가리킨다), 버튼은 눈을
   * QR 로 보내고, QR 을 못 만들었으면 다시 만든다.
   */
  const [nudge, setNudge] = useState(0);
  const arrow = fillmeArtUrl('qr-arrow');
  const info = fillmeArtUrl('ico-info');

  const save = (): void => {
    if (share.status === 'error') onRetryShare();
    else setNudge((n) => n + 1);
  };

  return (
    <div className={styles.root}>
      {/* ── 건강 분석 / 종합분석 결과 (8240:45552) ── */}
      <div className={styles.tabs} role="tablist">
        {(['health', 'summary'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? `${styles.tab} ${styles.tabActive}` : styles.tab}
            onClick={() => setTab(id)}
          >
            {copy(id === 'health' ? 'tabHealth' : 'tabSummary', lang)}
          </button>
        ))}
      </div>

      {/* ── 흰 판 (8240:45331) — 탭을 바꾸면 맨 위부터 ── */}
      <div key={tab} className={styles.panel}>
        <div className={styles.column}>
          <p className={styles.disclaimer}>
            {info && <img src={info} alt="" className={styles.infoIcon} draggable={false} />}
            {tx('Fillme_text053', lang)}
          </p>

          {tab === 'health' && (
            <>
              {images.length > 0 && (
                <>
                  <h3 className={styles.heading}>{copy('photos', lang)}</h3>
                  <PhotoCarousel images={images} />
                </>
              )}

              {result.healthScore != null && (
                <>
                  <h3 className={styles.heading}>{copy('score', lang)}</h3>
                  <ScoreGauge
                    score={result.healthScore}
                    unit={copy('scoreUnit', lang)}
                    cta={copy('toSummary', lang)}
                    onCta={() => setTab('summary')}
                  />
                </>
              )}

              {(hasHistory || result.comment) && <h3 className={styles.heading}>{copy('nail', lang)}</h3>}
              {hasHistory && <NailChart history={history} lang={lang} />}
              {result.comment && <p className={styles.comment}>{result.comment}</p>}

              {(solutions.length > 0 || productName || title || description) && (
                <>
                  <h3 className={styles.heading}>{copy('solutions', lang)}</h3>
                  {solutions.length > 0 && (
                    <>
                      <p className={styles.solutionHint}>{copy('solutionHint', lang)}</p>
                      <div className={styles.legend}>
                        {LEVELS.map((level) => (
                          <span key={level} className={styles.legendItem}>
                            <span className={styles.levelDot} data-level={level} />
                            {copy(level, lang)}
                          </span>
                        ))}
                      </div>
                      <div className={styles.solutions}>
                        {solutions.map((s) => (
                          <SolutionCard key={s.id} solution={s} onOpen={() => setPopup(s)} />
                        ))}
                      </div>
                    </>
                  )}
                  {(productName || title || description) && (
                    <div className={styles.ai}>
                      <p className={styles.aiLabel}>{copy('aiResult', lang)}</p>
                      {productName && <p className={styles.aiName}>{productName}</p>}
                      <div className={styles.aiBox}>
                        {title && <p className={styles.aiQuote}>“{title}”</p>}
                        {description && <p className={styles.aiBody}>{description}</p>}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {/* ── 종합분석 결과 (8240:43467) ── */}
          {tab === 'summary' && solutions.length > 0 && (
            <>
              {hasHistory && (
                <>
                  <h3 className={styles.heading}>{copy('nail', lang)}</h3>
                  <NailChart history={history} lang={lang} />
                </>
              )}
              <h3 className={styles.heading}>{copy('status', lang)}</h3>
              <StatusGrid solutions={solutions} lang={lang} />
              <SolutionDetails solutions={solutions} lang={lang} />
            </>
          )}

          {tab === 'summary' && solutions.length === 0 && (
            <>
              {/* ── 분석 요약 (7360:154990) ── */}
              <section className={styles.card}>
                <span className={styles.badge}>◇ {tx('Fillme_text051', lang)}</span>
                {title && <p className={styles.title}>“{title}”</p>}
                {(title || description || result.comment) && <hr className={styles.rule} />}
                {(description || result.comment) && <p className={styles.desc}>{description || result.comment}</p>}
                {!title && !description && !result.comment && ingredients.length === 0 && (
                  <p className={styles.desc}>분석 결과를 표시할 수 없어요.</p>
                )}
              </section>

              {/* ── 필요 영양 성분 (7334:84995) ── */}
              {ingredients.length > 0 && (
                <>
                  {/* 시트 문장은 '필요 영양 성분 (5가지)'처럼 개수가 박혀 있다 — 실제
                      개수로 바꿔 끼운다. */}
                  <h3 className={styles.heading}>
                    {tx('Fillme_text052', lang).replace(/\d+/, String(ingredients.length))}
                  </h3>
                  <ul className={styles.grid}>
                    {ingredients.map((ing, i) => (
                      <li key={`${ing.name}-${i}`} className={styles.item}>
                        <span className={styles.disc}>
                          <IngredientIcon ingredient={ing} />
                        </span>
                        <span className={styles.name}>{ing.name}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── QR · 저장하기 · 처음으로 (8240:45316) ── */}
      <div className={share.status === 'off' ? `${styles.actions} ${styles.actionsHomeOnly}` : styles.actions}>
        {share.status !== 'off' && (
          <>
            <div
              key={nudge}
              className={nudge > 0 ? `${styles.qr} ${styles.qrNudge}` : styles.qr}
              aria-live="polite"
              aria-label={
                share.status === 'ready'
                  ? '휴대폰 카메라로 QR을 찍으면 결과를 저장할 수 있어요'
                  : share.status === 'loading'
                    ? 'QR을 만들고 있어요'
                    : 'QR을 만들지 못했어요'
              }
            >
              {share.status === 'ready' && (
                <QRCodeSVG value={share.link.shareUrl} size={142} marginSize={0} fgColor="#000000" />
              )}
              {share.status === 'loading' && <span className={styles.spinner} aria-hidden="true" />}
              {share.status === 'error' && <Icon name="alert" size={90} strokeWidth={2} className={styles.qrError} />}
            </div>
            {arrow && <img src={arrow} alt="" className={styles.arrow} draggable={false} />}
            <button type="button" className={styles.save} onClick={save}>
              {tx('Fillme_text054', lang)}
            </button>
          </>
        )}
        <button type="button" className={styles.home} onClick={onHome}>
          {tx('Fillme_text055', lang)}
        </button>
      </div>

      {popup && <SolutionPopup solution={popup} lang={lang} onClose={() => setPopup(null)} />}
    </div>
  );
}
