/**
 * 휴대폰으로 보낼 결과 이미지(JPEG, 폭 1080) — 캔버스로 직접 그린다.
 * 키오스크 화면을 그대로 캡처하지 않는 이유: 결과 화면은 스크롤 영역·키오스크 버튼·QR 이 섞여 있고 2160 폭이라
 * 휴대폰에서 글자가 작다. 같은 색·글꼴로 휴대폰 세로 비율에 맞춘 카드를 따로 그린다.
 * 외부 라이브러리 없이 캔버스만 쓰므로 electron 렌더러에서도 그대로 돈다.
 */
import { formatDate, type AnalysisResult, type Ingredient } from './api';
import { DISCLAIMER } from './copy';
import { fillmeArtUrl } from '@renderer/assets/fillme';
import { ingredientIconSources } from './ingredients';

const W = 1080;
const PAD = 72;
const INNER = W - PAD * 2;
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
  ink: '#232323',
  ink2: '#555555',
  muted: '#909090',
  line: '#ECE5E0',
  note: '#6F6A66',
  noteBg: '#EDE6E1',
};
const PLATES = ['#FFE7D3', '#FFF3C4', '#E2F3D6', '#DCEEFB', '#FBE1EA'];

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT}`;

type Ctx = CanvasRenderingContext2D;

/** 한국어 어절 단위 줄바꿈(keep-all). 한 어절이 너무 길면 글자 단위로 자른다. */
function wrap(ctx: Ctx, text: string, max: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
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
    lines.push(line);
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

function loadImage(src: string, crossOrigin: boolean): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    // 다른 오리진 아이콘은 CORS 로만 받는다 — 허용 안 되면 실패로 보고 알약 그림으로 대신한다(캔버스 오염 방지).
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

export async function renderResultImage(result: AnalysisResult): Promise<Blob> {
  const rs = result.recommendedSupplement ?? {};
  const title = rs.title ? `“${rs.title}”` : '';
  const description = rs.description || result.content || '';
  const ingredients = (rs.ingredients ?? []).filter((x) => x?.name).slice(0, 9);
  const date = formatDate(result.checkDate);

  // 캔버스는 글꼴이 준비되기 전에 그리면 조용히 대체 글꼴로 그려진다 — 결과 이미지가
  // 화면과 다른 글꼴로 나가지 않도록, 쓸 글자를 모두 적재한 뒤에 그린다.
  const allText = [title, description, DISCLAIMER, date, 'JEJUDO ISLAND AI 손톱 건강분석 결과 건강분석 추천 영양제 가지 Powered by', ...ingredients.map((i) => i.name)].join(' ');
  await Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(font(w, 40), allText)));

  const [icons, logo] = await Promise.all([
    Promise.all(ingredients.map(ingredientIcon)),
    loadImage(fillmeArtUrl('fillme-logo') ?? '', false),
  ]);

  const measure = document.createElement('canvas').getContext('2d') as Ctx;

  // ── 1) 배치 계산
  const CARD_PAD = 64;
  const textW = INNER - CARD_PAD * 2;
  measure.font = font(800, 58);
  const titleLines = title ? wrap(measure, title, textW) : [];
  measure.font = font(500, 38);
  const descLines = description ? wrap(measure, description, textW) : [];
  measure.font = font(500, 30);
  const noteLines = wrap(measure, DISCLAIMER, INNER - 72);

  const COLS = 3;
  const GAP = 24;
  const CELL_W = (INNER - GAP * (COLS - 1)) / COLS;
  measure.font = font(700, 34);
  const nameLines = ingredients.map((i) => wrap(measure, i.name, CELL_W - 32).slice(0, 2));
  const rows = Math.ceil(ingredients.length / COLS);
  const rowHeights = Array.from({ length: rows }, (_, r) =>
    Math.max(...nameLines.slice(r * COLS, r * COLS + COLS).map((l) => 300 + (l.length - 1) * 44)),
  );

  let y = 96;
  const headerY = y;
  y += 44 + 20;
  const pageTitleY = y;
  y += 72 + 44;

  const cardY = y;
  let inner = CARD_PAD + 64; // 배지
  if (titleLines.length) inner += 44 + titleLines.length * 78;
  if (descLines.length) inner += 44 + 2 + 44 + descLines.length * 62;
  inner += CARD_PAD;
  const cardH = inner;
  y += cardH;

  let gridY = 0;
  if (ingredients.length) {
    y += 84 + 50 + 36; // 섹션 라벨
    gridY = y;
    y += rowHeights.reduce((a, b) => a + b, 0) + GAP * (rows - 1);
  }

  y += 64;
  const noteY = y;
  const noteH = 40 * 2 + noteLines.length * 46;
  y += noteH;
  y += 64;
  const footerY = y;
  y += 44 + 88;
  const H = Math.ceil(y);

  // ── 2) 그리기
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d') as Ctx;
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.ground;
  ctx.fillRect(0, 0, W, H);

  // 머리
  ctx.font = font(700, 34);
  ctx.fillStyle = C.primary;
  ctx.textAlign = 'left';
  ctx.fillText('JEJUDO ISLAND', PAD, headerY + 34);
  ctx.font = font(500, 30);
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'right';
  ctx.fillText(date, W - PAD, headerY + 34);
  ctx.textAlign = 'left';
  ctx.font = font(800, 64);
  ctx.fillStyle = C.ink;
  ctx.fillText('AI 손톱 건강분석 결과', PAD, pageTitleY + 62);

  // 요약 카드
  card(ctx, PAD, cardY, INNER, cardH, 48);
  let cy = cardY + CARD_PAD;
  ctx.font = font(700, 30);
  const badgeW = ctx.measureText('건강분석').width + 44 * 2;
  ctx.fillStyle = C.tint;
  roundRect(ctx, PAD + CARD_PAD, cy, badgeW, 64, 32);
  ctx.fill();
  ctx.fillStyle = C.primary;
  ctx.fillText('건강분석', PAD + CARD_PAD + 44, cy + 43);
  cy += 64;
  if (titleLines.length) {
    cy += 44;
    ctx.font = font(800, 58);
    ctx.fillStyle = C.ink;
    titleLines.forEach((line, i) => ctx.fillText(line, PAD + CARD_PAD, cy + 62 + i * 78));
    cy += titleLines.length * 78;
  }
  if (descLines.length) {
    cy += 44;
    ctx.fillStyle = C.line;
    ctx.fillRect(PAD + CARD_PAD, cy, textW, 2);
    cy += 2 + 44;
    ctx.font = font(500, 38);
    ctx.fillStyle = C.ink2;
    descLines.forEach((line, i) => ctx.fillText(line, PAD + CARD_PAD, cy + 44 + i * 62));
  }

  // 추천 영양제
  if (ingredients.length) {
    const labelY = gridY - 50 - 36;
    ctx.fillStyle = '#000';
    roundRect(ctx, PAD, labelY + 4, 8, 44, 4);
    ctx.fill();
    ctx.font = font(600, 46);
    ctx.fillText('추천 영양제', PAD + 26, labelY + 44);
    const labelW = ctx.measureText('추천 영양제').width;
    ctx.font = font(500, 30);
    ctx.fillStyle = C.muted;
    ctx.fillText(`${ingredients.length}가지`, PAD + 26 + labelW + 16, labelY + 44);

    let rowY = gridY;
    for (let r = 0; r < rows; r++) {
      const items = ingredients.slice(r * COLS, r * COLS + COLS);
      // 덜 찬 마지막 줄은 가운데로 모은다(키오스크 결과 화면과 같은 규칙)
      const rowW = items.length * CELL_W + (items.length - 1) * GAP;
      let x = PAD + (INNER - rowW) / 2;
      items.forEach((_ing, k) => {
        const i = r * COLS + k;
        const h = rowHeights[r] ?? 0;
        card(ctx, x, rowY, CELL_W, h, 36);
        const pcx = x + CELL_W / 2;
        const pcy = rowY + 36 + 75;
        ctx.fillStyle = PLATES[i % PLATES.length] ?? C.tint;
        ctx.beginPath();
        ctx.arc(pcx, pcy, 75, 0, Math.PI * 2);
        ctx.fill();
        const icon = icons[i];
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
        x += CELL_W + GAP;
      });
      rowY += (rowHeights[r] ?? 0) + GAP;
    }
  }

  // 안내
  ctx.fillStyle = C.noteBg;
  roundRect(ctx, PAD, noteY, INNER, noteH, 28);
  ctx.fill();
  ctx.font = font(500, 30);
  ctx.fillStyle = C.note;
  noteLines.forEach((line, i) => ctx.fillText(line, PAD + 36, noteY + 40 + 34 + i * 46));

  // 바닥글
  ctx.font = font(600, 28);
  ctx.fillStyle = C.muted;
  const powered = 'Powered by';
  const pw = ctx.measureText(powered).width;
  const logoH = 34;
  const logoW = logo ? (logo.naturalWidth / logo.naturalHeight) * logoH : 0;
  const startX = (W - (pw + (logo ? 14 + logoW : 0))) / 2;
  ctx.fillText(powered, startX, footerY + 34);
  if (logo) ctx.drawImage(logo, startX + pw + 14, footerY + 34 - logoH + 5, logoW, logoH);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', 0.92),
  );
}
