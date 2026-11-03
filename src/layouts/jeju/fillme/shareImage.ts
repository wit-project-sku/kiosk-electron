/**
 * 휴대폰으로 보낼 결과 이미지(JPEG, 폭 1080) — 캔버스로 직접 그린다.
 * 키오스크 화면을 그대로 캡처하지 않는 이유: 결과 화면은 스크롤 영역·키오스크 버튼·QR 이 섞여 있고 2160 폭이라
 * 휴대폰에서 글자가 작다. 같은 색·글꼴로 휴대폰 세로 비율에 맞춘 카드를 따로 그린다.
 * 외부 라이브러리 없이 캔버스만 쓰므로 electron 렌더러에서도 그대로 돈다.
 *
 * 휴대폰 페이지(admin-be `FillmeShareController`)는 이 그림 한 장만 보여 준다 —
 * 결과 화면이 바뀌면 여기도 같이 바꿔야 휴대폰에 보인다.
 *
 * 내용은 결과 화면(FillmeResult, 2026-10-26 시안 8240:45310 · 8240:43467)을 따른다:
 * 건강 점수 → 손톱 분석(종합 막대 + 항목별 평균 + 설명) → 건강 상태 → 맞춤 솔루션 →
 * AI 분석 결과. 화면과 같이 값이 없는 칸은 그리지 않고, 솔루션이 없으면(지금 API)
 * 예전처럼 추천 영양제 성분을 그린다. 그림은 위에서 아래로 쌓는 블록들 —
 * 블록마다 높이를 먼저 재고(measure) 다 더한 높이의 캔버스에 그린다(draw).
 */
import { formatDate, type AnalysisResult, type Ingredient } from './api';
import type { Lang } from '@renderer/lib/i18n';
import { BREAKS, tx } from './text';
import { copy, type COPY } from './resultCopy';
import { withSample } from './sampleResult';
import {
  FINGER_BAR_COLORS,
  toResultView,
  type NailCategory,
  type Solution,
  type SolutionLevel,
} from './resultView';
import { fillmeArtUrl, fillmeDiagnosisIconUrl } from '@renderer/assets/fillme';
import { ingredientIconSources } from './ingredients';

const W = 1080;
const PAD = 60;
const INNER = W - PAD * 2;
const CARD_PAD = 52;
/** 카드 안쪽 폭. */
const IW = INNER - CARD_PAD * 2;
const GAP = 36;
/*
 * 앱이 실제로 싣는 글꼴 — themes/jeju-airport.json 의 스택과 같다. 시안은
 * 동적 서브셋 'Pretendard Variable' 을 썼지만 앱은 @fontsource/pretendard 의
 * 400~900 정적 파일을 main.tsx 에서 싣는다. 캔버스는 CSS 를 거치지 않으므로
 * 이름을 여기 한 번 더 적는다.
 */
const FONT = "Pretendard, 'Noto Sans KR', 'Apple SD Gothic Neo', sans-serif";
const C = {
  ground: '#F5F1EF',
  card: '#FFFFFF',
  primary: '#FF7F0F',
  tint: '#FFF1E4',
  ink: '#1A1A1A',
  body: '#2B2B2B',
  ink2: '#5E5E5E',
  muted: '#999999',
  axis: '#A8A8A8',
  track: '#DDDDDD',
  line: '#EFF0F3',
  detail: '#424650',
  sub: '#656971',
  aiLabel: '#8F8F8F',
  box: '#F5F5F5',
};
/** 등급 점 · 그림 바탕 — FillmeResult.module.css 의 levelDot / artDisc 와 같다. */
const LEVEL_DOT: Record<SolutionLevel, string> = { care: '#FF3737', watch: '#FF9600', good: '#2E7D32' };
const LEVEL_TILE: Record<SolutionLevel, string> = { care: '#FFD1D2', watch: '#FFF5EA', good: '#F0FAF1' };
const LEVELS: SolutionLevel[] = ['care', 'watch', 'good'];
/** 항목별 평균 줄 — 종합은 막대로 그리므로 뺀다. */
const SUB_CATEGORIES: NailCategory[] = ['color', 'pattern', 'damage', 'tool', 'skin'];
/** 이 그림이 쓰는 결과 화면 문구 — 글꼴을 미리 싣는 데 쓴다. */
const IMAGE_COPY: (keyof typeof COPY)[] = [
  'score',
  'scoreUnit',
  'nail',
  'chartNote',
  'status',
  'solutions',
  'aiResult',
  'aiNutrients',
  'overall',
  ...LEVELS,
  ...SUB_CATEGORIES,
];
const PLATES = ['#FFE7D3', '#FFF3C4', '#E2F3D6', '#DCEEFB', '#FBE1EA'];

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT}`;

type Ctx = CanvasRenderingContext2D;

/** 위에서 아래로 쌓이는 한 덩어리 — 높이를 먼저 알고, y 를 받아 그린다. */
interface Block {
  h: number;
  draw: (ctx: Ctx, y: number) => void;
}

/** 한국어 어절 단위 줄바꿈(keep-all). 한 어절이 너무 길면 글자 단위로 자른다. */
function wrap(ctx: Ctx, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(BREAKS)) {
    let line = '';
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (ctx.measureText(candidate).width <= max) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      if (ctx.measureText(word).width <= max) {
        line = word;
        continue;
      }
      line = '';
      for (const ch of word) {
        if (line && ctx.measureText(line + ch).width > max) {
          lines.push(line);
          line = ch;
        } else {
          line += ch;
        }
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function card(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.save();
  ctx.shadowColor = 'rgba(143, 147, 157, 0.16)';
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = C.card;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.restore();
}

function dot(ctx: Ctx, cx: number, cy: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

/** 줄들을 lineH 간격으로 — y 는 첫 줄 상자의 윗변, 글자는 상자 안 아래쪽에 앉힌다. */
function lines(ctx: Ctx, ls: string[], x: number, y: number, lineH: number, size: number): void {
  const base = (lineH + size * 0.72) / 2;
  ls.forEach((l, i) => ctx.fillText(l, x, y + base + i * lineH));
}

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // 다른 오리진 아이콘은 CORS 로만 받는다 — 허용 안 되면 실패로 보고 대신 그림을 쓴다(캔버스 오염 방지).
    if (crossOrigin) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** 결과 화면과 같은 규칙: 번들 복사본 → 서버 주소 → 없음(알약 그림). */
async function ingredientIcon(ing: Ingredient): Promise<HTMLImageElement | null> {
  const { local, server } = ingredientIconSources(ing);
  if (local) {
    const img = await loadImage(local, false);
    if (img) return img;
  }
  if (server) return loadImage(server, /^https?:/i.test(server));
  return null;
}

/** 진단 그림 — 결과 화면의 SolutionTile 과 같은 순서: 번들 `{id}.svg` → 서버 iconUrl. */
async function diagnosisIcon(s: Solution): Promise<HTMLImageElement | null> {
  const local = fillmeDiagnosisIconUrl(s.id);
  if (local) {
    const img = await loadImage(local, false);
    if (img) return img;
  }
  return s.iconUrl ? loadImage(s.iconUrl, /^https?:/i.test(s.iconUrl)) : null;
}

function drawPill(ctx: Ctx, cx: number, cy: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-Math.PI / 4);
  ctx.fillStyle = C.primary;
  roundRect(ctx, -54, -24, 108, 48, 24);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillRect(-1.5, -24, 3, 48);
  ctx.restore();
}

const average = (vs: (number | null)[]): number | null => {
  const ok = vs.filter((v): v is number => v != null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
};
const clamp = (n: number): number => Math.max(0, Math.min(100, n));

/** 흰 카드 하나 — 제목(Bold 44) 아래에 body 를 그린다. */
function cardBlock(title: string, bodyH: number, drawBody: (ctx: Ctx, x: number, y: number) => void): Block {
  const head = 44 + 32;
  const h = CARD_PAD + head + bodyH + CARD_PAD;
  return {
    h,
    draw: (ctx, y) => {
      card(ctx, PAD, y, INNER, h, 40);
      ctx.font = font(700, 44);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'left';
      lines(ctx, [title], PAD + CARD_PAD, y + CARD_PAD, 44, 44);
      drawBody(ctx, PAD + CARD_PAD, y + CARD_PAD + head);
    },
  };
}

/*
 * `lang` 은 부르는 쪽이 넘긴다 — 이 파일은 React 밖(캔버스)이라 useLang 을 쓸 수
 * 없고, 저장된 결과 이미지는 손님이 보던 화면과 같은 언어여야 한다.
 */
export async function renderResultImage(raw: AnalysisResult, lang: Lang): Promise<Blob> {
  // 결과 화면과 같은 값 — 개발 빌드는 시안 값으로 빈 칸을 채우고, 운영 빌드는 그대로다.
  const result = withSample(raw);
  const view = toResultView(result);
  const rs = view.supplement;
  const solutions = view.solutions;
  const history = view.fingerScores;
  const overall = history.overall ?? [];
  const fingerCount = view.fingerCount;
  const hasChart = overall.some((v) => v != null);
  const subAverages = SUB_CATEGORIES.map((c) => ({ c, v: average(history[c] ?? []) })).filter(
    (x): x is { c: NailCategory; v: number } => x.v != null,
  );
  const productName = rs.name && rs.solution ? `${rs.name}(${rs.solution})` : rs.name || rs.solution || '';
  const ingredients = solutions.length ? [] : rs.ingredients.slice(0, 9);
  const disclaimer = tx('Fillme_text053', lang);
  const date = formatDate(result.checkDate);
  const pageTitle = 'AI 손톱 건강 분석';

  // 캔버스는 글꼴이 준비되기 전에 그리면 조용히 대체 글꼴로 그려진다 — 결과 이미지가
  // 화면과 다른 글꼴로 나가지 않도록, 쓸 글자를 모두 적재한 뒤에 그린다.
  const allText = [
    pageTitle,
    disclaimer,
    date,
    view.comment,
    productName,
    rs.title,
    rs.description,
    'JEJU Powered by 0123456789',
    ...IMAGE_COPY.map((k) => copy(k, lang)),
    ...solutions.flatMap((s) => [s.name, s.description, s.detail, ...s.nutrients.map((n) => n.name)]),
    ...ingredients.map((i) => i.name),
  ]
    .filter(Boolean)
    .join(' ');
  await Promise.all([400, 500, 600, 700, 800, 900].map((w) => document.fonts.load(font(w, 40), allText)));

  const [ingIcons, solIcons, logo, info] = await Promise.all([
    Promise.all(ingredients.map(ingredientIcon)),
    Promise.all(solutions.map(diagnosisIcon)),
    loadImage(fillmeArtUrl('fillme-logo') ?? '', false),
    loadImage(fillmeArtUrl('ico-info') ?? '', false),
  ]);

  const m = document.createElement('canvas').getContext('2d') as Ctx;
  const blocks: Block[] = [];

  // ── 머리: JEJU · 날짜 / 제목 / 안내
  m.font = font(500, 28);
  const noteLines = wrap(m, disclaimer, INNER - 44);
  blocks.push({
    h: 34 + 28 + 64 + 28 + noteLines.length * 40,
    draw: (ctx, y) => {
      ctx.font = font(700, 34);
      ctx.fillStyle = C.primary;
      ctx.textAlign = 'left';
      lines(ctx, ['JEJU'], PAD, y, 34, 34);
      ctx.font = font(600, 30);
      ctx.fillStyle = C.ink;
      ctx.textAlign = 'right';
      lines(ctx, [date], W - PAD, y, 34, 30);
      ctx.textAlign = 'left';
      ctx.font = font(800, 60);
      ctx.fillStyle = C.ink;
      lines(ctx, [pageTitle], PAD, y + 34 + 28, 64, 60);
      const ny = y + 34 + 28 + 64 + 28;
      if (info) ctx.drawImage(info, PAD, ny + 6, 30, 30);
      ctx.font = font(500, 28);
      ctx.fillStyle = C.muted;
      lines(ctx, noteLines, PAD + 44, ny, 40, 28);
    },
  });

  // ── 건강 점수 (8240:45349) — 반원 게이지
  if (view.healthScore != null) {
    const score = clamp(view.healthScore);
    const R = 210;
    const STROKE = 28;
    const bodyH = STROKE / 2 + R + 16;
    blocks.push(
      cardBlock(copy('score', lang), bodyH, (ctx, x, y) => {
        const cx = x + IW / 2;
        const cy = y + STROKE / 2 + R;
        ctx.lineCap = 'round';
        ctx.lineWidth = STROKE;
        ctx.strokeStyle = C.track;
        ctx.beginPath();
        ctx.arc(cx, cy, R, Math.PI, Math.PI * 2);
        ctx.stroke();
        if (score > 0) {
          ctx.strokeStyle = C.primary;
          ctx.beginPath();
          ctx.arc(cx, cy, R, Math.PI, Math.PI + (Math.PI * score) / 100);
          ctx.stroke();
        }
        const value = String(Math.round(score));
        const unit = copy('scoreUnit', lang);
        ctx.font = font(900, 112);
        const vw = ctx.measureText(value).width;
        ctx.font = font(700, 48);
        const uw = ctx.measureText(unit).width;
        const sx = cx - (vw + 14 + uw) / 2;
        ctx.font = font(900, 112);
        ctx.fillStyle = C.primary;
        ctx.fillText(value, sx, cy - 6);
        ctx.font = font(700, 48);
        ctx.fillStyle = C.muted;
        ctx.fillText(unit, sx + vw + 14, cy - 6);
      }),
    );
  }

  // ── 손톱 분석 (8240:45423) — 이미지는 탭을 누를 수 없어 종합을 막대로, 나머지는 평균으로.
  //    막대 칸은 API 가 보낸 손가락 수만큼(fingerCount).
  if (hasChart || subAverages.length || view.comment) {
    const AXIS_W = 60;
    const PLOT_H = 260;
    const TAB_H = 56;
    const XL_H = 44;
    const SUB_H = 104;
    m.font = font(400, 26);
    const chartNoteLines = hasChart ? wrap(m, copy('chartNote', lang), IW) : [];
    m.font = font(400, 34);
    const commentLines = view.comment ? wrap(m, view.comment, IW) : [];

    let bodyH = 0;
    if (hasChart) bodyH += TAB_H + 28 + PLOT_H + 16 + XL_H + 12 + chartNoteLines.length * 38;
    if (subAverages.length) bodyH += (bodyH ? 32 : 0) + SUB_H;
    if (commentLines.length) bodyH += (bodyH ? 36 + 3 + 32 : 0) + commentLines.length * 50;

    blocks.push(
      cardBlock(copy('nail', lang), bodyH, (ctx, x, y) => {
        let cy = y;
        if (hasChart) {
          // 종합 탭 표시 — 화면에서 고른 탭의 모양(주황 글씨 + 6px 밑줄).
          const tab = copy('overall', lang);
          ctx.font = font(700, 36);
          const tw = Math.max(160, ctx.measureText(tab).width + 48);
          ctx.fillStyle = C.primary;
          ctx.textAlign = 'center';
          lines(ctx, [tab], x + tw / 2, cy, TAB_H - 10, 36);
          ctx.fillRect(x, cy + TAB_H - 5, tw, 5);
          ctx.fillStyle = '#E8E8E8';
          ctx.fillRect(x + tw, cy + TAB_H - 2, IW - tw, 2);
          cy += TAB_H + 28;

          const plotX = x + AXIS_W;
          const slotW = (IW - AXIS_W) / fingerCount;
          ctx.font = font(400, 26);
          ctx.fillStyle = C.axis;
          ctx.textAlign = 'left';
          [100, 80, 60, 40, 20, 0].forEach((v, i) => {
            const ty = cy + (PLOT_H * i) / 5;
            ctx.fillText(String(v), x, ty + 9);
          });
          for (let i = 0; i < fingerCount; i++) {
            const v = overall[i];
            const bx = plotX + slotW * i + (slotW - 44) / 2;
            if (v != null) {
              const bh = (PLOT_H * clamp(v)) / 100;
              ctx.fillStyle = FINGER_BAR_COLORS[i % FINGER_BAR_COLORS.length] ?? C.tint;
              roundRect(ctx, bx, cy + PLOT_H - bh, 44, bh, 6);
              ctx.fill();
            }
            ctx.font = font(400, 26);
            ctx.fillStyle = C.axis;
            ctx.textAlign = 'center';
            ctx.fillText(String(i + 1), plotX + slotW * i + slotW / 2, cy + PLOT_H + 16 + 30);
          }
          cy += PLOT_H + 16 + XL_H + 12;
          ctx.textAlign = 'left';
          ctx.font = font(400, 26);
          ctx.fillStyle = C.ink2;
          lines(ctx, chartNoteLines, x, cy, 38, 26);
          cy += chartNoteLines.length * 38;
        }
        if (subAverages.length) {
          if (cy > y) cy += 32;
          // 항목별 평균 — 회색 칸 안에 이름(26)과 점수(Bold 40).
          ctx.fillStyle = C.box;
          roundRect(ctx, x, cy, IW, SUB_H, 24);
          ctx.fill();
          const colW = IW / subAverages.length;
          ctx.textAlign = 'center';
          subAverages.forEach(({ c, v }, i) => {
            const mx = x + colW * i + colW / 2;
            ctx.font = font(500, 26);
            ctx.fillStyle = C.aiLabel;
            ctx.fillText(copy(c, lang), mx, cy + 38);
            ctx.font = font(800, 38);
            ctx.fillStyle = C.ink;
            ctx.fillText(String(Math.round(v)), mx, cy + 84);
          });
          ctx.textAlign = 'left';
          cy += SUB_H;
        }
        if (commentLines.length) {
          if (cy > y) {
            cy += 36;
            ctx.fillStyle = C.line;
            ctx.fillRect(x, cy, IW, 3);
            cy += 3 + 32;
          }
          ctx.font = font(400, 34);
          ctx.fillStyle = C.body;
          lines(ctx, commentLines, x, cy, 50, 34);
        }
      }),
    );
  }

  // ── 건강 상태 (8240:43899) — 관리 · 관심 · 권장 줄마다 그 등급의 항목 이름
  if (solutions.length) {
    const LABEL_W = 170;
    const ROW_PAD = 26;
    m.font = font(700, 36);
    const rows = LEVELS.map((level) => {
      const names = solutions.filter((s) => s.level === level).map((s) => s.name);
      return { level, lines: names.length ? wrap(m, names.join('  ·  '), IW - LABEL_W) : ['–'], empty: !names.length };
    });
    const rowH = rows.map((r) => ROW_PAD * 2 + r.lines.length * 48);
    const bodyH = rowH.reduce((a, b) => a + b, 0) + 3 * (rows.length - 1);
    blocks.push(
      cardBlock(copy('status', lang), bodyH, (ctx, x, y) => {
        let cy = y;
        rows.forEach((r, i) => {
          if (i) {
            ctx.fillStyle = C.line;
            ctx.fillRect(x, cy, IW, 3);
            cy += 3;
          }
          dot(ctx, x + 12, cy + ROW_PAD + 24, 12, LEVEL_DOT[r.level]);
          ctx.font = font(500, 32);
          ctx.fillStyle = C.ink2;
          ctx.textAlign = 'left';
          lines(ctx, [copy(r.level, lang)], x + 36, cy + ROW_PAD, 48, 32);
          ctx.font = font(700, 36);
          ctx.fillStyle = r.empty ? C.axis : C.ink;
          lines(ctx, r.lines, x + LABEL_W, cy + ROW_PAD, 48, 36);
          cy += rowH[i] ?? 0;
        });
      }),
    );
  }

  // ── 맞춤 솔루션 (8246:139395) — 솔루션마다 카드 한 장: 그림 · 이름 · 한 줄 · 설명 · AI 추천영양제
  if (solutions.length) {
    blocks.push({
      h: 48,
      draw: (ctx, y) => {
        ctx.font = font(700, 48);
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        lines(ctx, [copy('solutions', lang)], PAD, y, 48, 48);
      },
    });
    const TILE = 104;
    const TEXT_X = TILE + 28;
    const nutrientLabel = copy('aiNutrients', lang);
    solutions.forEach((s, si) => {
      m.font = font(500, 30);
      const descLines = s.description ? wrap(m, s.description, IW - TEXT_X) : [];
      m.font = font(500, 30);
      const detailLines = s.detail ? wrap(m, s.detail, IW) : [];
      const names = s.nutrients.map((n) => n.name).join(', ');
      m.font = font(600, 28);
      const nutrientLines = names ? wrap(m, names, IW) : [];
      const headH = Math.max(TILE, 48 + (descLines.length ? 8 + descLines.length * 42 : 0));
      let h = CARD_PAD + headH;
      if (detailLines.length) h += 28 + detailLines.length * 48;
      if (nutrientLines.length) h += 24 + 40 + nutrientLines.length * 42;
      h += CARD_PAD;
      blocks.push({
        h,
        draw: (ctx, y) => {
          card(ctx, PAD, y, INNER, h, 36);
          const x = PAD + CARD_PAD;
          let cy = y + CARD_PAD;
          const icon = solIcons[si];
          if (icon) {
            ctx.save();
            roundRect(ctx, x, cy, TILE, TILE, 34);
            ctx.clip();
            ctx.drawImage(icon, x, cy, TILE, TILE);
            ctx.restore();
          } else {
            ctx.fillStyle = LEVEL_TILE[s.level];
            roundRect(ctx, x, cy, TILE, TILE, 34);
            ctx.fill();
            dot(ctx, x + TILE / 2, cy + TILE / 2, 20, LEVEL_DOT[s.level]);
          }
          const textTop = cy + (headH - (48 + (descLines.length ? 8 + descLines.length * 42 : 0))) / 2;
          dot(ctx, x + TEXT_X + 11, textTop + 24, 11, LEVEL_DOT[s.level]);
          ctx.font = font(700, 40);
          ctx.fillStyle = C.ink;
          ctx.textAlign = 'left';
          lines(ctx, [s.name], x + TEXT_X + 34, textTop, 48, 40);
          ctx.font = font(500, 30);
          ctx.fillStyle = C.sub;
          lines(ctx, descLines, x + TEXT_X, textTop + 48 + 8, 42, 30);
          cy += headH;
          if (detailLines.length) {
            cy += 28;
            ctx.font = font(500, 30);
            ctx.fillStyle = C.detail;
            lines(ctx, detailLines, x, cy, 48, 30);
            cy += detailLines.length * 48;
          }
          if (nutrientLines.length) {
            cy += 24;
            ctx.font = font(800, 28);
            ctx.fillStyle = C.detail;
            lines(ctx, [nutrientLabel], x, cy, 40, 28);
            cy += 40;
            ctx.font = font(600, 28);
            lines(ctx, nutrientLines, x, cy, 42, 28);
          }
        },
      });
    });
  }

  // ── AI 분석 결과 (8240:45546) — 추천 제품 · 인용 · 설명
  if (productName || rs.title || rs.description) {
    m.font = font(900, 50);
    const productLines = productName ? wrap(m, productName, IW) : [];
    const BOX_PAD = 40;
    m.font = font(700, 34);
    const quoteLines = rs.title ? wrap(m, `“${rs.title}”`, IW - BOX_PAD * 2) : [];
    m.font = font(500, 30);
    const bodyLines = rs.description ? wrap(m, rs.description, IW - BOX_PAD * 2) : [];
    const boxH =
      quoteLines.length || bodyLines.length
        ? BOX_PAD * 2 +
          quoteLines.length * 48 +
          (quoteLines.length && bodyLines.length ? 16 : 0) +
          bodyLines.length * 46
        : 0;
    const bodyH = productLines.length * 64 + (boxH ? (productLines.length ? 28 : 0) + boxH : 0);
    blocks.push({
      h: CARD_PAD + 40 + 20 + bodyH + CARD_PAD,
      draw: (ctx, y) => {
        const h = CARD_PAD + 40 + 20 + bodyH + CARD_PAD;
        card(ctx, PAD, y, INNER, h, 40);
        const x = PAD + CARD_PAD;
        let cy = y + CARD_PAD;
        ctx.textAlign = 'left';
        ctx.font = font(700, 34);
        ctx.fillStyle = C.aiLabel;
        lines(ctx, [copy('aiResult', lang)], x, cy, 40, 34);
        cy += 40 + 20;
        ctx.font = font(900, 50);
        ctx.fillStyle = C.primary;
        lines(ctx, productLines, x, cy, 64, 50);
        cy += productLines.length * 64;
        if (boxH) {
          if (productLines.length) cy += 28;
          ctx.fillStyle = C.box;
          roundRect(ctx, x, cy, IW, boxH, 24);
          ctx.fill();
          let by = cy + BOX_PAD;
          ctx.font = font(700, 34);
          ctx.fillStyle = C.ink;
          lines(ctx, quoteLines, x + BOX_PAD, by, 48, 34);
          by += quoteLines.length * 48 + (quoteLines.length && bodyLines.length ? 16 : 0);
          ctx.font = font(500, 30);
          ctx.fillStyle = C.ink2;
          lines(ctx, bodyLines, x + BOX_PAD, by, 46, 30);
        }
      },
    });
  }

  // ── 솔루션이 없을 때(지금 API) — 예전 결과의 추천 영양제 성분 (7334:84995)
  if (ingredients.length) {
    const COLS = 3;
    const CELL_GAP = 24;
    const CELL_W = (INNER - CELL_GAP * (COLS - 1)) / COLS;
    m.font = font(700, 34);
    const nameLines = ingredients.map((i) => wrap(m, i.name, CELL_W - 32).slice(0, 2));
    const rows = Math.ceil(ingredients.length / COLS);
    const rowHeights = Array.from({ length: rows }, (_, r) =>
      Math.max(...nameLines.slice(r * COLS, r * COLS + COLS).map((l) => 300 + (l.length - 1) * 44)),
    );
    const label = tx('Fillme_text052', lang).replace(/\d+/, String(ingredients.length));
    blocks.push({
      h: 48 + 32 + rowHeights.reduce((a, b) => a + b, 0) + CELL_GAP * (rows - 1),
      draw: (ctx, y) => {
        ctx.font = font(700, 48);
        ctx.fillStyle = C.ink;
        ctx.textAlign = 'left';
        lines(ctx, [label], PAD, y, 48, 48);
        let rowY = y + 48 + 32;
        for (let r = 0; r < rows; r++) {
          const items = ingredients.slice(r * COLS, r * COLS + COLS);
          // 덜 찬 마지막 줄은 가운데로 모은다(키오스크 결과 화면과 같은 규칙)
          const rowW = items.length * CELL_W + (items.length - 1) * CELL_GAP;
          let x = PAD + (INNER - rowW) / 2;
          items.forEach((_ing, k) => {
            const i = r * COLS + k;
            const h = rowHeights[r] ?? 0;
            card(ctx, x, rowY, CELL_W, h, 36);
            const pcx = x + CELL_W / 2;
            const pcy = rowY + 36 + 75;
            dot(ctx, pcx, pcy, 75, PLATES[i % PLATES.length] ?? C.tint);
            const icon = ingIcons[i];
            if (icon) {
              const s = 104;
              const ratio = icon.naturalWidth && icon.naturalHeight ? icon.naturalWidth / icon.naturalHeight : 1;
              const iw = ratio >= 1 ? s : s * ratio;
              const ih = ratio >= 1 ? s / ratio : s;
              ctx.drawImage(icon, pcx - iw / 2, pcy - ih / 2, iw, ih);
            } else {
              drawPill(ctx, pcx, pcy);
            }
            ctx.font = font(700, 34);
            ctx.fillStyle = C.ink;
            ctx.textAlign = 'center';
            (nameLines[i] ?? []).forEach((line, j) => ctx.fillText(line, pcx, rowY + 252 + j * 44));
            ctx.textAlign = 'left';
            x += CELL_W + CELL_GAP;
          });
          rowY += (rowHeights[r] ?? 0) + CELL_GAP;
        }
      },
    });
  }

  // ── 바닥글
  blocks.push({
    h: 44,
    draw: (ctx, y) => {
      ctx.font = font(600, 28);
      ctx.fillStyle = C.muted;
      ctx.textAlign = 'left';
      const powered = 'Powered by';
      const pw = ctx.measureText(powered).width;
      const logoH = 34;
      const logoW = logo ? (logo.naturalWidth / logo.naturalHeight) * logoH : 0;
      const startX = (W - (pw + (logo ? 14 + logoW : 0))) / 2;
      ctx.fillText(powered, startX, y + 34);
      if (logo) ctx.drawImage(logo, startX + pw + 14, y + 34 - logoH + 5, logoW, logoH);
    },
  });

  // ── 그리기
  const TOP = 88;
  const BOTTOM = 88;
  const H = Math.ceil(TOP + blocks.reduce((a, b) => a + b.h, 0) + GAP * (blocks.length - 1) + BOTTOM);
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, W, H);
  let y = TOP;
  for (const b of blocks) {
    b.draw(ctx, y);
    y += b.h + GAP;
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  );
}
