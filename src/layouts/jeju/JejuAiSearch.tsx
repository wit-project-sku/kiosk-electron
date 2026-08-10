/**
 * 제주 '제주' 뭐하지 (AI 검색) questionnaire — Figma node 6050:142613.
 *
 * Four filters (방문 인원 · 체류 기간 · 이동수단 · 즐길 거리) and a CTA that hands
 * the picked interests to the shared aiStore and moves to the result screen —
 * the same flow OsanAiSearch uses.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useAiStore } from '@renderer/store/aiStore';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuAiSearch.module.css';

interface Props {
  controller: KioskController;
}

/** How many 즐길 거리 tiles a visitor may pick — matches the other kiosks. */
const MAX_INTERESTS = 3;

/** 방문 인원 — six chips at six DIFFERENT widths (Figma justify-between). */
const VISITORS = [
  { label: '1명', width: 268 },
  { label: '2명', width: 269 },
  { label: '3명', width: 268 },
  { label: '4명', width: 268 },
  { label: '5 ~ 9명', width: 311 },
  { label: '10명~', width: 290 },
];

/** 체류 기간 and 이동수단 — four equal 412px chips each. */
const STAY = ['당일치기', '1박 2일', '2박 3일', '3박 이상'];
const TRANSPORT = ['도보', '자전거', '대중교통', '자동차'];

/**
 * 즐길 거리 — 30 tiles in 5 rows × 6 columns, each carrying its own text colour.
 *
 * Colours are read per-tile from the Figma rather than derived from a palette
 * sequence (which is how Osan does it): here they group by theme — food #f59993,
 * 특산품 #ffa37e, 차/술 #82caa8, 체험 #a9a3d9, K-POP/사진 #6ea8eb, 자연 #6375bf,
 * 쇼핑 #c89b7b. `\n` marks the two-line labels drawn in the design.
 *
 * TODO(제주 W006): these are authored here because no AICategory_Jeju sheet
 * exists. Once it does, source them the way Osan does (AI_CATEGORIES_OSAEK) so
 * they localize; the colours stay here either way.
 */
interface Interest {
  label: string;
  color: string;
}

const INTERESTS: Interest[] = [
  { label: '흑돼지',            color: '#f59993' },
  { label: '해산물·회',         color: '#f59993' },
  { label: '갈치·고등어',        color: '#f59993' },
  { label: '고기국수',          color: '#f59993' },
  { label: '제주\n향토음식',     color: '#f59993' },
  { label: '한식',              color: '#f59993' },

  { label: '한정식',            color: '#f59993' },
  { label: '호텔뷔페',          color: '#f59993' },
  { label: '카페',              color: '#f59993' },
  { label: '제주특산품',        color: '#ffa37e' },
  { label: '전통차',            color: '#82caa8' },
  { label: '막걸리',            color: '#82caa8' },

  // Figma has #81caa8 on this one and #82caa8 on its neighbours — normalised.
  { label: '전통주',            color: '#82caa8' },
  { label: '해녀 체험',         color: '#a9a3d9' },
  { label: '감귤 체험',         color: '#a9a3d9' },
  { label: '승마 체험',         color: '#a9a3d9' },
  { label: '레저·\n액티비티',    color: '#a9a3d9' },
  { label: 'K-POP 체험',        color: '#6ea8eb' },

  { label: '사진 촬영',         color: '#6ea8eb' },
  { label: '자연명소',          color: '#6375bf' },
  { label: '해변',              color: '#6375bf' },
  { label: '섬 여행',           color: '#6375bf' },
  { label: '오름·트레킹',        color: '#6375bf' },
  { label: '역사유적지',        color: '#6375bf' },

  { label: '제주 기념품',       color: '#c89b7b' },
  { label: '공예품',            color: '#c89b7b' },
  { label: '전통시장',          color: '#c89b7b' },
  { label: '전시관·\n문화공간',  color: '#c89b7b' },
  { label: '로컬샵',            color: '#c89b7b' },
  { label: '기타',              color: '#c89b7b' },
];

const COLS = 6;

/** Row `top` for each block, in artboard px (see the CSS header comment). */
const Y = {
  visitorsLabel: 699,
  visitorsRow: 835,
  stayLabel: 1128,
  stayRow: 1264,
  transportLabel: 1557,
  transportRow: 1693,
  interestsLabel: 1986,
} as const;

const GRID_ROW_STEP = 244;

export function JejuAiSearch({ controller }: Props): JSX.Element {
  const setAiInterests = useAiStore((s) => s.setInterests);

  const [visitors, setVisitors] = useState(1); // 2명, as in the design
  const [stay, setStay] = useState(0);
  const [transport, setTransport] = useState(0);
  const [interests, setInterests] = useState<Set<number>>(() => new Set([0]));

  const toggleInterest = (i: number): void =>
    setInterests((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else if (next.size < MAX_INTERESTS) next.add(i);
      return next;
    });

  /**
   * NOTE: only the interests travel onward — aiStore carries nothing else, so
   * 방문 인원 / 체류 기간 / 이동수단 are collected but not yet consumed. Osan has
   * the same gap (it drops visitors/duration too). Extend aiStore when the Jeju
   * result screen is built and can actually use them.
   */
  const submit = (): void => {
    setAiInterests([...interests].map((i) => INTERESTS[i]!.label.replace('\n', '')));
    controller.navigate('ai_result', 'AI 추천');
  };

  const rows = Array.from({ length: Math.ceil(INTERESTS.length / COLS) }, (_, r) =>
    INTERESTS.slice(r * COLS, r * COLS + COLS),
  );

  return (
    <JejuPageFrame controller={controller} title="'제주' 뭐하지 (AI 검색)" showBanner={false}>
      <div className={styles.root}>
        {/* ── 방문 인원 ── */}
        <div className={styles.label} style={{ top: Y.visitorsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>방문 인원</p>
        </div>
        <div className={styles.row} style={{ top: Y.visitorsRow }}>
          {VISITORS.map((v, i) => (
            <button
              key={v.label}
              type="button"
              style={{ width: v.width }}
              className={`${styles.chip} ${visitors === i ? styles.chipSelected : ''}`}
              onClick={() => setVisitors(i)}
            >
              {v.label}
            </button>
          ))}
        </div>

        {/* ── 체류 기간 ── */}
        <div className={styles.label} style={{ top: Y.stayLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>체류 기간</p>
        </div>
        <div className={styles.row} style={{ top: Y.stayRow }}>
          {STAY.map((label, i) => (
            <button
              key={label}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${stay === i ? styles.chipSelected : ''}`}
              onClick={() => setStay(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 이동수단 ── */}
        <div className={styles.label} style={{ top: Y.transportLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>이동수단</p>
        </div>
        <div className={styles.row} style={{ top: Y.transportRow }}>
          {TRANSPORT.map((label, i) => (
            <button
              key={label}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${transport === i ? styles.chipSelected : ''}`}
              onClick={() => setTransport(i)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── 즐길 거리 ── */}
        <div className={styles.label} style={{ top: Y.interestsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>즐길 거리</p>
        </div>
        <div className={styles.grid}>
          {rows.map((row, r) => (
            <div key={r} className={styles.gridRow} style={{ top: r * GRID_ROW_STEP }}>
              {row.map((item, c) => {
                const i = r * COLS + c;
                const selected = interests.has(i);
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`${styles.tile} ${selected ? styles.tileSelected : ''}`}
                    style={{ color: item.color }}
                    onClick={() => toggleInterest(i)}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <button type="button" className={styles.cta} onClick={submit}>
          ‘유산’에게 추천받기
        </button>
      </div>
    </JejuPageFrame>
  );
}
