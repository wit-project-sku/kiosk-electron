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
import { useLanguageStore } from '@renderer/store/languageStore';
import { t } from '@renderer/lib/loc';
import { aiCatLabel } from '@renderer/lib/aiCategoryLabel';
import { AI_CATEGORIES_JEJU } from '@renderer/data/aiCategories-jeju.generated';
import { JejuPageFrame } from './JejuPageFrame';
import styles from './JejuAiSearch.module.css';

interface Props {
  controller: KioskController;
}

/** How many 즐길 거리 tiles a visitor may pick — matches the other kiosks. */
const MAX_INTERESTS = 3;

/**
 * Chip copy comes from Localization_Jeju (Visitor_* / StayTime_* /
 * Transportation_*), exactly as OsanAiSearch reads its own sheet. The Korean
 * here is the fallback shown only when the key is missing from the table, and
 * it is ALSO what travels to the AI store — the course summary and the shop
 * matching downstream are keyed on Korean, so a localized chip must not change
 * what gets sent.
 */
const VISITORS = [
  { key: 'Visitor_1', label: '1명', width: 268 },
  { key: 'Visitor_2', label: '2명', width: 269 },
  { key: 'Visitor_3', label: '3명', width: 268 },
  { key: 'Visitor_4', label: '4명', width: 268 },
  { key: 'Visitor_5', label: '5 ~ 9명', width: 311 },
  { key: 'Visitor_6', label: '10명~', width: 290 },
];

/** 체류 기간 and 이동수단 — four equal 412px chips each. */
const STAY = [
  { key: 'StayTime_1', label: '당일치기' },
  { key: 'StayTime_2', label: '1박 2일' },
  { key: 'StayTime_3', label: '2박 3일' },
  { key: 'StayTime_4', label: '3박 이상' },
];
const TRANSPORT = [
  { key: 'Transportation_1', label: '도보' },
  { key: 'Transportation_2', label: '자전거' },
  { key: 'Transportation_3', label: '대중교통' },
  { key: 'Transportation_4', label: '자동차' },
];

/**
 * Section headings. 방문 인원 / 체류 기간 / 즐길 거리 have sheet keys; 이동수단 does
 * NOT — Localization_Jeju carries Transportation_1..4 but no heading row for
 * them — so it keeps its authored label until one is added.
 */
const SECTION = {
  visitors: { key: 'VisitorCount', label: '방문 인원' },
  stay: { key: 'StayTime', label: '체류 기간' },
  transport: { key: null, label: '이동수단' },
  interests: { key: 'JoyContent', label: '즐길 거리' },
} as const;

/**
 * 즐길 거리 — 30 tiles in 5 rows × 6 columns, each carrying its own text colour.
 *
 * Colours are read per-tile from the Figma rather than derived from a palette
 * sequence (which is how Osan does it): here they group by theme — food #f59993,
 * 특산품 #ffa37e, 차/술 #82caa8, 체험 #a9a3d9, K-POP/사진 #6ea8eb, 자연 #6375bf,
 * 쇼핑 #c89b7b. `\n` marks the two-line labels drawn in the design.
 *
 * The LABELS now come from AICategory_Jeju via AI_CATEGORIES_JEJU (30 rows, all
 * 8 languages, in this exact order) — the same source OsanAiSearch reads. Only
 * the colours, the Figma's two-line Korean and the catalogue overrides stay
 * here, indexed 1:1 against that array.
 *
 * The catalogue match key is NOT the displayed label: JejuAiDetail matches the
 * shop's `aiCategoryKr` (prefix stripped), and the sheet does not always spell a
 * category the way the catalogue does. Verified 2026-08-13 against
 * `/api/shops?kioskId=7` (29 distinct categories over 310 rows):
 *   - the sheet writes 레저·'엑'티비티, the catalogue 레저·'액'티비티 (13 shops) —
 *     taking the sheet's spelling would silently empty that tile, so `cat` pins it;
 *   - the sheet's 제주 향토음식 and 오름·트래킹 now agree with the catalogue, so the
 *     overrides those two used to need are gone;
 *   - K-POP 체험 still has no rows at all, as before.
 */
interface Interest {
  color: string;
  /**
   * The Figma's exact Korean, when it differs from the sheet's. Two tiles are
   * drawn on two lines (`\n`) and the tile CSS is `white-space: pre`, so the
   * break has to be authored; the sheet stores every label on one line. Korean
   * uses this, every other language uses the sheet value.
   */
  ko?: string;
  /** Catalogue `aiCategoryKr` when the sheet spells it differently. */
  cat?: string;
}

/**
 * Per-tile colour / Korean line-break / catalogue override, positionally matched
 * to AI_CATEGORIES_JEJU. A row reordered in the sheet must be reordered here
 * too — the arrays are joined by index, which is what keeps the colour groups
 * (food → 특산품 → 차·술 → 체험 → K-POP·사진 → 자연 → 쇼핑) reading as bands.
 */
const INTERESTS: Interest[] = [
  { color: '#f59993' },                              // 흑돼지
  { color: '#f59993' },                              // 해산물·회
  { color: '#f59993' },                              // 갈치·고등어
  { color: '#f59993' },                              // 고기국수
  { color: '#f59993', ko: '제주\n향토음식' },
  { color: '#f59993' },                              // 한식

  { color: '#f59993' },                              // 한정식
  { color: '#f59993' },                              // 호텔뷔페
  { color: '#f59993' },                              // 카페
  { color: '#ffa37e' },                              // 제주특산품
  { color: '#82caa8' },                              // 전통차
  { color: '#82caa8' },                              // 막걸리

  // Figma has #81caa8 on this one and #82caa8 on its neighbours — normalised.
  { color: '#82caa8' },                              // 전통주
  { color: '#a9a3d9' },                              // 해녀 체험
  { color: '#a9a3d9' },                              // 감귤 체험
  { color: '#a9a3d9' },                              // 승마 체험
  { color: '#a9a3d9', ko: '레저·\n액티비티', cat: '레저·액티비티' },
  { color: '#6ea8eb' },                              // K-POP 체험

  { color: '#6ea8eb' },                              // 사진 촬영
  { color: '#6375bf' },                              // 자연명소
  { color: '#6375bf' },                              // 해변
  { color: '#6375bf' },                              // 섬 여행
  { color: '#6375bf' },                              // 오름·트래킹
  { color: '#6375bf' },                              // 역사유적지

  { color: '#c89b7b' },                              // 제주 기념품
  { color: '#c89b7b' },                              // 공예품
  { color: '#c89b7b' },                              // 전통시장
  { color: '#c89b7b', ko: '전시관·\n문화공간' },
  { color: '#c89b7b' },                              // 로컬샵
  { color: '#c89b7b' },                              // 기타
];

/** The catalogue category tile `i` matches — the override, else the sheet's ko. */
const interestCat = (i: number): string =>
  INTERESTS[i]?.cat ?? AI_CATEGORIES_JEJU[i]?.ko ?? '';

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
  const setAiAnswers = useAiStore((s) => s.setAnswers);
  const lang = useLanguageStore((s) => s.currentLanguage);

  /** Sheet string, falling back to the authored Korean when the key is absent. */
  const s = (key: string | null, authored: string): string => {
    if (!key) return authored;
    const value = t(key, lang);
    return value === key ? authored : value;
  };

  /** Tile label: Korean keeps the Figma's two-line form, others use the sheet. */
  const tileLabel = (i: number): string => {
    const meta = INTERESTS[i];
    if (lang === 'ko' && meta?.ko) return meta.ko;
    const cat = AI_CATEGORIES_JEJU[i];
    return cat ? aiCatLabel(cat, lang) : (meta?.ko ?? '');
  };

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

  const submit = (): void => {
    setAiInterests([...interests].map(interestCat));
    // The course detail's summary bar shows 이동수단, so every answer travels on
    // rather than only the interests. These stay KOREAN regardless of the UI
    // language — downstream matching is on the catalogue's Korean values.
    setAiAnswers({
      visitors: VISITORS[visitors]!.label,
      stay: STAY[stay]!.label,
      transport: TRANSPORT[transport]!.label,
    });
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
          <p className={styles.labelText}>{s(SECTION.visitors.key, SECTION.visitors.label)}</p>
        </div>
        <div className={styles.row} style={{ top: Y.visitorsRow }}>
          {VISITORS.map((v, i) => (
            <button
              key={v.key}
              type="button"
              style={{ width: v.width }}
              className={`${styles.chip} ${visitors === i ? styles.chipSelected : ''}`}
              onClick={() => setVisitors(i)}
            >
              {s(v.key, v.label)}
            </button>
          ))}
        </div>

        {/* ── 체류 기간 ── */}
        <div className={styles.label} style={{ top: Y.stayLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{s(SECTION.stay.key, SECTION.stay.label)}</p>
        </div>
        <div className={styles.row} style={{ top: Y.stayRow }}>
          {STAY.map((item, i) => (
            <button
              key={item.key}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${stay === i ? styles.chipSelected : ''}`}
              onClick={() => setStay(i)}
            >
              {s(item.key, item.label)}
            </button>
          ))}
        </div>

        {/* ── 이동수단 ── */}
        <div className={styles.label} style={{ top: Y.transportLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{s(SECTION.transport.key, SECTION.transport.label)}</p>
        </div>
        <div className={styles.row} style={{ top: Y.transportRow }}>
          {TRANSPORT.map((item, i) => (
            <button
              key={item.key}
              type="button"
              style={{ width: 412 }}
              className={`${styles.chip} ${transport === i ? styles.chipSelected : ''}`}
              onClick={() => setTransport(i)}
            >
              {s(item.key, item.label)}
            </button>
          ))}
        </div>

        {/* ── 즐길 거리 ── */}
        <div className={styles.label} style={{ top: Y.interestsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{s(SECTION.interests.key, SECTION.interests.label)}</p>
        </div>
        <div className={styles.grid}>
          {rows.map((row, r) => (
            <div key={r} className={styles.gridRow} style={{ top: r * GRID_ROW_STEP }}>
              {row.map((item, c) => {
                const i = r * COLS + c;
                const selected = interests.has(i);
                return (
                  <button
                    key={interestCat(i) || i}
                    type="button"
                    // Korean keeps the Figma's `white-space: pre` sizing; the other
                    // seven languages are longer than the 268px tile (e.g. ru
                    // "Опирающийся на опыт"), so they wrap instead of overflowing.
                    className={[
                      styles.tile,
                      selected ? styles.tileSelected : '',
                      lang === 'ko' ? '' : styles.tileWrap,
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={{ color: item.color }}
                    onClick={() => toggleInterest(i)}
                  >
                    {tileLabel(i)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <button type="button" className={styles.cta} onClick={submit}>
          {s('AI_SubmitButton', '‘유산’에게 추천받기')}
        </button>
      </div>
    </JejuPageFrame>
  );
}
