/**
 * 제주 '제주' 뭐하지 (AI 검색) questionnaire — Figma nodes 6336:67302 (resting)
 * and 6289:54956 (with picks), the 2026-08-24 redesign of 6050:142613.
 *
 * Four filters (방문 인원 · 체류 기간 · 이동수단 · 즐길 거리) and a CTA that hands
 * the picked interests to the shared aiStore and moves to the result screen —
 * the same flow OsanAiSearch uses.
 *
 * The redesign left every coordinate alone and changed only how a plate looks:
 * see the header of JejuAiSearch.module.css.
 */
import { useState } from 'react';
import type { KioskController } from '@renderer/hooks/useKioskController';
import { useAccessibilityStore } from '@renderer/store/accessibilityStore';
import { useAiStore } from '@renderer/store/aiStore';
import { useLanguageStore } from '@renderer/store/languageStore';
import { pick } from '@renderer/lib/i18n';
import type { Lang } from '@renderer/lib/i18n';
import { t } from '@renderer/lib/loc';
import { aiCatLabel } from '@renderer/lib/aiCategoryLabel';
import { AI_CATEGORIES_JEJU } from '@renderer/data/aiCategories-jeju.generated';
import { jejuMascot } from './jejuMascot';
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
 * Section headings.
 *
 * ★ NONE of these four keys is in Localization_Jeju — checked 2026-08-27:
 * VisitorCount, StayTime, JoyContent and the heading for 이동수단 are all
 * absent, so `s()` fell through to its authored string and every heading on this
 * page read KOREAN in all eight languages while the chips beneath them were
 * fully translated. (Only the CHIP rows exist — Visitor_*, StayTime_*,
 * Transportation_* — which is what made the gap easy to miss.)
 *
 * So the labels are authored here in all eight languages, the same way
 * NEXT_LABEL is. The sheet key stays on each one and still WINS when present:
 * add the row and the authored copy steps aside with no release.
 */
const SECTION = {
  visitors: {
    key: 'VisitorCount',
    label: {
      ko: '방문 인원', en: 'Group size', ja: '訪問人数', zh: '同行人数',
      vi: 'Số người', th: 'จำนวนผู้มา', ru: 'Количество гостей', id: 'Jumlah orang',
    },
  },
  stay: {
    key: 'StayTime',
    label: {
      ko: '체류 기간', en: 'Length of stay', ja: '滞在期間', zh: '停留时间',
      vi: 'Thời gian lưu trú', th: 'ระยะเวลาพำนัก', ru: 'Срок пребывания', id: 'Lama menginap',
    },
  },
  transport: {
    key: 'Transportation',
    label: {
      ko: '이동수단', en: 'Getting around', ja: '移動手段', zh: '交通方式',
      vi: 'Phương tiện di chuyển', th: 'การเดินทาง', ru: 'Транспорт', id: 'Transportasi',
    },
  },
  interests: {
    key: 'JoyContent',
    label: {
      ko: '즐길 거리', en: 'What to enjoy', ja: '楽しみ方', zh: '体验项目',
      vi: 'Hoạt động yêu thích', th: 'กิจกรรมที่สนใจ', ru: 'Что интересно', id: 'Aktivitas',
    },
  },
} as const satisfies Record<string, { key: string; label: Partial<Record<Lang, string>> }>;

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

/**
 * Low-reach coordinates — Figma 6336:67216 / 6326:81769 (step 1) and
 * 6336:99702 / 6326:81686 (step 2).
 *
 * The hero banner eats the top 1181px and the header runs to y1906, which
 * leaves about 1700px of reachable page — enough for THREE chip groups or the
 * 즐길 거리 grid, but not both. So the low-reach layout splits the questionnaire
 * into two steps; see `step`. Both steps start their content at y1906 and put
 * the CTA at y3432.
 *
 * Step 1 stacks [label 76 · gap 60 · row 193] = 329 with a 100 gap:
 *   1906 label  2042 row   ·   2335 label  2471 row   ·   2764 label  2900 row
 * ending at 3093, which is the 1187 the frame's 선택영역 box states.
 */
const Y_LOW = {
  visitorsLabel: 1906,
  visitorsRow: 2042,
  stayLabel: 2335,
  stayRow: 2471,
  transportLabel: 2764,
  transportRow: 2900,
  interestsLabel: 1906,
} as const;

/** Grid top, measured off each frame: 2122 standard, 2042 low-reach. */
const GRID_TOP = 2122;
const GRID_TOP_LOW = 2042;

const GRID_ROW_STEP = 244;

/** CTA top: 3413 on the standard frame, 3432 on both low-reach ones. */
const CTA_TOP_LOW = 3432;

/**
 * Step-1 CTA. Authored rather than fetched: Localization_Jeju has no row for it
 * (the low-reach split is new and the sheet only knows the single-page flow),
 * which is the same reason JejuAiDetail authors its 모바일에서 확인하기 label.
 */
const NEXT_LABEL = {
  ko: '다음으로',
  en: 'Next',
  ja: '次へ',
  zh: '下一步',
  vi: 'Tiếp theo',
  th: 'ถัดไป',
  ru: 'Далее',
  id: 'Berikutnya',
};

export function JejuAiSearch({ controller }: Props): JSX.Element {
  const setAiInterests = useAiStore((s) => s.setInterests);
  const setAiAnswers = useAiStore((s) => s.setAnswers);
  const lang = useLanguageStore((s) => s.currentLanguage);

  /** Sheet string, falling back to the authored copy when the key is absent. */
  const s = (key: string | null, authored: string): string => {
    if (!key) return authored;
    const value = t(key, lang);
    return value === key ? authored : value;
  };

  /** A section heading: the sheet's row if it has one, else our own translation. */
  const heading = (sec: (typeof SECTION)[keyof typeof SECTION]): string =>
    s(sec.key, pick(sec.label, lang));

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

  const lowReach = useAccessibilityStore((s) => s.lowReach);
  /** Low-reach only: 1 = the three chip groups, 2 = 즐길 거리. See Y_LOW. */
  const [step, setStep] = useState<1 | 2>(1);
  const y = lowReach ? Y_LOW : Y;
  // Standard shows everything at once; low-reach shows one step at a time.
  const showChips = !lowReach || step === 1;
  const showInterests = !lowReach || step === 2;

  /* Step 1 advances; every other case submits. The three chip groups are
     single-select and always hold a value, so only the 즐길 거리 step can be
     empty — which is the grey CTA both "nothing picked" frames draw. */
  const onFirstStep = lowReach && step === 1;
  const ctaDisabled = !onFirstStep && interests.size === 0;

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

  /** Step 1 advances to 즐길 거리; every other case submits. */
  const onCta = onFirstStep ? (): void => setStep(2) : submit;

  /**
   * On the low-reach 즐길 거리 step, 뒤로 means "back to the questions", not
   * "leave the page" — the split is an artefact of the accessible layout, so
   * stepping out of it one screen at a time is what a visitor expects. Drives
   * BOTH back affordances (the header arrow and the left rail's), since
   * JejuPageFrame feeds this one callback to each. `undefined` anywhere else
   * keeps the frame's own default of returning home.
   */
  const onBack = lowReach && step === 2 ? (): void => setStep(1) : undefined;

  const rows = Array.from({ length: Math.ceil(INTERESTS.length / COLS) }, (_, r) =>
    INTERESTS.slice(r * COLS, r * COLS + COLS),
  );

  return (
    /* lowReachShift 1072: the mode-bar revision (6336:67216 et al.) drops the
       hero to y113–1072 and the header lands flush under it. Body stays
       self-positioned (Y_LOW / CTA_TOP_LOW are unchanged in the revision). */
    <JejuPageFrame
      controller={controller}
      title="'제주' 뭐하지 (AI 검색)"
      showBanner={false}
      lowReachHero="banner-ai-hero"
      lowReachModeBar
      lowReachShift={1072}
      onBack={onBack}
    >
      <div className={styles.root}>
        {showChips && (
          <>
        {/* ── 방문 인원 ── */}
        <div className={styles.label} style={{ top: y.visitorsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.visitors)}</p>
        </div>
        <div className={styles.row} style={{ top: y.visitorsRow }}>
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
        <div className={styles.label} style={{ top: y.stayLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.stay)}</p>
        </div>
        <div className={styles.row} style={{ top: y.stayRow }}>
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
        <div className={styles.label} style={{ top: y.transportLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.transport)}</p>
        </div>
        <div className={styles.row} style={{ top: y.transportRow }}>
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
          </>
        )}

        {showInterests && (
          <>
        {/* ── 즐길 거리 ── */}
        <div className={styles.label} style={{ top: y.interestsLabel }}>
          <span className={styles.labelBar} />
          <p className={styles.labelText}>{heading(SECTION.interests)}</p>
        </div>
        <div className={styles.grid} style={{ top: lowReach ? GRID_TOP_LOW : GRID_TOP }}>
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
                    // The resting palette is per-tile, so it has to be inline —
                    // but a picked tile is white on the brand plate, and an
                    // inline colour would outrank .tileSelected. Dropping the
                    // style entirely lets the class win without !important.
                    style={selected ? undefined : { color: item.color }}
                    onClick={() => toggleInterest(i)}
                  >
                    {tileLabel(i)}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
          </>
        )}

        <button
          type="button"
          className={`${styles.cta} ${ctaDisabled ? styles.ctaDisabled : ''}`}
          style={lowReach ? { top: CTA_TOP_LOW } : undefined}
          disabled={ctaDisabled}
          onClick={onCta}
        >
          {/* THIS venue's mascot — the sheet is a tab shared across the three
              제주 venues, so the LAST-RESORT fallback has to name the right one
              per kiosk (the synced value is already disambiguated by
              LocalizationSyncParser.VENUE_MASCOTS; jejuMascot answers 하영 on
              W006/W007 and 유산 on W008). */}
          {onFirstStep
            ? pick(NEXT_LABEL, lang as Lang)
            : s('AI_SubmitButton', `‘${jejuMascot().ko}’에게 추천받기`)}
        </button>
      </div>
    </JejuPageFrame>
  );
}
