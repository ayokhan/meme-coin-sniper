/**
 * Renders the Session Sweep launch art (chart + text drawn in code, not AI image text).
 *   node scripts/generate-session-sweep-assets.mjs
 * Outputs public/marketing/novastaris-session-sweep-email-chart.png (1120×640),
 *         public/marketing/novastaris-session-sweep-postcard-premium.png (1080×1080)
 *     and public/marketing/novastaris-session-sweep-story-premium.png (1080×1920).
 *
 * The chart is an illustrative long setup that follows the engine's rules:
 * Asia range → London sweeps the Asia low and closes back inside → CHoCH (close above the
 * last lower high) → BOS (close above the CHoCH swing high) = entry, stop under the higher
 * low, target 3R.
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (name) => path.join(root, "public", "marketing", name);

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const TEAL = "#14b8a6";
const TEAL_LIGHT = "#5eead4";
const INDIGO = "#818cf8";
const AMBER = "#fbbf24";
const GREEN = "#10b981";
const RED = "#f43f5e";

/** [open, high, low, close] */
const CLOSES = [
  [56, 59, 55, 58],
  [58, 61, 57.5, 60],
  [60, 62, 58.5, 59],
  [59, 59.5, 56.5, 57],
  [57, 57.5, 54, 55],
  [55, 55.5, 50, 52],
  [52, 55, 51.5, 54],
  [54, 58, 53.5, 57],
  [57, 61, 56.5, 59.5],
  [59.5, 60, 57, 58],
  [58, 58.5, 55, 56],
  [56, 58, 55.5, 57],
  [57, 59.5, 56.5, 58],
  [58, 58.5, 55.5, 56],
  [56, 56.2, 53, 53.5],
  [53.5, 56, 53.2, 55.2],
  [55.2, 55.4, 52.6, 53],
  [53, 53.4, 51, 51.5],
  [51.5, 52.5, 45.5, 51],
  [51, 53.8, 50.5, 53],
  [53, 55.6, 52.6, 55],
  [55, 57.8, 54.6, 57],
  [57, 57.4, 55, 55.6],
  [55.6, 56, 53.4, 54],
  [54, 56.6, 53.8, 56],
  [56, 59.2, 55.6, 58.6],
  [58.6, 61, 58, 60],
  [60, 60.6, 58.2, 59],
  [59, 62.5, 58.6, 61.5],
  [61.5, 64.5, 61, 63.5],
  [63.5, 64, 61.8, 62.6],
  [62.6, 66, 62.2, 65],
  [65, 68.5, 64.6, 67.5],
  [67.5, 68, 65.8, 66.6],
  [66.6, 70, 66.2, 69],
  [69, 72.5, 68.6, 71.5],
  [71.5, 72, 70, 70.8],
  [70.8, 74.5, 70.4, 73.5],
  [73.5, 76, 73, 75],
];

const SETUP = {
  rangeStart: 0,
  rangeEnd: 11,
  rangeHigh: 62,
  rangeLow: 50,
  huntStart: 14,
  huntEnd: 26,
  sweepIdx: 18,
  chochFrom: 15,
  chochIdx: 21,
  chochLevel: 56,
  bosFrom: 21,
  bosIdx: 25,
  bosLevel: 57.8,
  entry: 58.6,
  stop: 53,
};
SETUP.target = SETUP.entry + 3 * (SETUP.entry - SETUP.stop);

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function badge(ctx, cx, cy, r, n, fill = TEAL) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = "#042f2e";
  ctx.font = `800 ${Math.round(r * 1.2)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx, cy + r * 0.05);
  ctx.textAlign = "left";
}

function dashedLine(ctx, x1, y1, x2, y2, color, width, dash) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function priceTag(ctx, x, y, text, color, s) {
  ctx.font = `700 ${Math.round(15 * s)}px ${FONT}`;
  const w = ctx.measureText(text).width + 18 * s;
  const h = 26 * s;
  roundRect(ctx, x, y - h / 2, w, h, 6 * s);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#0a0a0b";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + 9 * s, y + 1);
}

/** Labelled text with a dark halo so it stays readable over candles and lines. */
function haloText(ctx, text, x, y, color, font) {
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(9,9,11,0.92)";
  ctx.lineWidth = 6;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/**
 * Draws the illustrative sweep chart inside (x, y, w, h).
 * `s` scales fonts and strokes (1 = email size).
 */
function drawSweepChart(ctx, x, y, w, h, s = 1, opts = {}) {
  roundRect(ctx, x, y, w, h, 22 * s);
  ctx.fillStyle = "rgba(9,9,11,0.9)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20,184,166,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const padL = 22 * s;
  const padR = 128 * s;
  const padT = 54 * s;
  const padB = 40 * s;
  const plotX = x + padL;
  const plotW = w - padL - padR;
  const plotY = y + padT;
  const plotH = h - padT - padB;
  const pMin = 43.5;
  const pMax = 77.5;
  const n = CLOSES.length;
  const step = plotW / n;
  const cx = (i) => plotX + step * (i + 0.5);
  const left = (i) => plotX + step * i;
  const right = (i) => plotX + step * (i + 1);
  const py = (p) => plotY + ((pMax - p) / (pMax - pMin)) * plotH;

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 6; i++) {
    const gy = plotY + (plotH / 6) * i;
    ctx.beginPath();
    ctx.moveTo(plotX, gy);
    ctx.lineTo(x + w - 14 * s, gy);
    ctx.stroke();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 ${Math.round(64 * s)}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", plotX + plotW * 0.62, plotY + plotH * 0.78);
  ctx.restore();

  // London hunt window
  const hx1 = left(SETUP.huntStart);
  const hx2 = right(SETUP.huntEnd);
  ctx.fillStyle = "rgba(20,184,166,0.08)";
  ctx.fillRect(hx1, y + 12 * s, hx2 - hx1, h - 24 * s);
  ctx.fillStyle = TEAL_LIGHT;
  ctx.font = `700 ${Math.round(14 * s)}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillText("LONDON OPEN · HUNT WINDOW", (hx1 + hx2) / 2, y + 30 * s);
  ctx.textAlign = "left";

  // Asia range box
  const bx1 = left(SETUP.rangeStart);
  const bx2 = right(SETUP.rangeEnd);
  const byH = py(SETUP.rangeHigh);
  const byL = py(SETUP.rangeLow);
  ctx.fillStyle = "rgba(99,102,241,0.14)";
  ctx.fillRect(bx1, byH, bx2 - bx1, byL - byH);
  ctx.strokeStyle = "rgba(129,140,248,0.75)";
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(bx1, byH, bx2 - bx1, byL - byH);
  ctx.fillStyle = INDIGO;
  ctx.font = `700 ${Math.round(14 * s)}px ${FONT}`;
  ctx.fillText("ASIA RANGE", bx1 + 4 * s, y + 30 * s);
  dashedLine(ctx, bx2, byL, right(SETUP.sweepIdx + 4), byL, "rgba(129,140,248,0.8)", 2 * s, [6 * s, 6 * s]);

  // Trade plan zones (entry → end)
  const zx1 = left(SETUP.bosIdx) + step * 0.5;
  const zx2 = plotX + plotW + 6 * s;
  const yEntry = py(SETUP.entry);
  const yStop = py(SETUP.stop);
  const yTarget = py(SETUP.target);
  ctx.fillStyle = "rgba(16,185,129,0.13)";
  ctx.fillRect(zx1, yTarget, zx2 - zx1, yEntry - yTarget);
  ctx.fillStyle = "rgba(244,63,94,0.14)";
  ctx.fillRect(zx1, yEntry, zx2 - zx1, yStop - yEntry);
  dashedLine(ctx, zx1, yTarget, zx2, yTarget, GREEN, 2 * s, [8 * s, 5 * s]);
  dashedLine(ctx, zx1, yStop, zx2, yStop, RED, 2 * s, [8 * s, 5 * s]);
  dashedLine(ctx, zx1, yEntry, zx2, yEntry, "rgba(250,250,250,0.85)", 2 * s, []);

  // CHoCH + BOS levels
  const yChoch = py(SETUP.chochLevel);
  const yBos = py(SETUP.bosLevel);
  dashedLine(ctx, cx(SETUP.chochFrom), yChoch, cx(SETUP.chochIdx), yChoch, AMBER, 2 * s, [7 * s, 5 * s]);
  dashedLine(ctx, cx(SETUP.bosFrom), yBos, cx(SETUP.bosIdx), yBos, TEAL_LIGHT, 2 * s, [7 * s, 5 * s]);

  // Candles
  const bw = Math.max(3, step * 0.62);
  CLOSES.forEach(([o, hi, lo, c], i) => {
    const color = c >= o ? GREEN : RED;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, 1.6 * s);
    ctx.beginPath();
    ctx.moveTo(cx(i), py(hi));
    ctx.lineTo(cx(i), py(lo));
    ctx.stroke();
    const top = py(Math.max(o, c));
    const bh = Math.max(2, py(Math.min(o, c)) - top);
    ctx.fillStyle = color;
    ctx.fillRect(cx(i) - bw / 2, top, bw, bh);
  });

  // 1 · Sweep: ring around the wick tip + label in the empty space under the range low
  const sx = cx(SETUP.sweepIdx);
  const sy = py(CLOSES[SETUP.sweepIdx][2]);
  ctx.strokeStyle = TEAL_LIGHT;
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.arc(sx, sy, 13 * s, 0, Math.PI * 2);
  ctx.stroke();
  // Label group sits left of the wick, below the range low where no candles trade.
  const sweepFont = `700 ${Math.round(19 * s)}px ${FONT}`;
  const sweepSubFont = `500 ${Math.round(14 * s)}px ${FONT}`;
  ctx.font = sweepFont;
  const sweepW = ctx.measureText("Sweep").width;
  ctx.font = sweepSubFont;
  const sweepTextW = Math.max(sweepW, ctx.measureText("of the Asia low").width);
  const sly = sy - 10 * s;
  const sTextX = sx - 40 * s - sweepTextW;
  const slx = sTextX - 20 * s;
  ctx.strokeStyle = "rgba(94,234,212,0.7)";
  ctx.lineWidth = 1.5 * s;
  ctx.beginPath();
  ctx.moveTo(sTextX + sweepW + 8 * s, sly);
  ctx.lineTo(sx - 14 * s, sy);
  ctx.stroke();
  badge(ctx, slx, sly, 13 * s, 1);
  haloText(ctx, "Sweep", sTextX, sly, "#f4f4f5", sweepFont);
  haloText(ctx, "of the Asia low", sTextX, sly + 22 * s, "#a1a1aa", sweepSubFont);

  // 2 · CHoCH label above its line on the left (free space above the lower highs)
  const clx = cx(SETUP.chochFrom) - 2 * s;
  const cly = yChoch - 22 * s;
  badge(ctx, clx, cly, 12 * s, 2, AMBER);
  haloText(ctx, "CHoCH", clx + 18 * s, cly, AMBER, `700 ${Math.round(17 * s)}px ${FONT}`);

  // 3 · BOS label higher up, ending before the entry candle so it never touches the rally
  const bosFont = `700 ${Math.round(17 * s)}px ${FONT}`;
  ctx.font = bosFont;
  const bosW = ctx.measureText("BOS = entry").width;
  const bly = yBos - 52 * s;
  const bTextX = zx1 - 14 * s - bosW;
  badge(ctx, bTextX - 18 * s, bly, 12 * s, 3);
  haloText(ctx, "BOS = entry", bTextX, bly, TEAL_LIGHT, bosFont);
  dashedLine(ctx, zx1 - 4 * s, bly + 10 * s, zx1 - 4 * s, yBos - 6 * s, "rgba(94,234,212,0.6)", 1.5 * s, [3 * s, 3 * s]);

  // Right-side price tags
  const tagX = plotX + plotW + 14 * s;
  priceTag(ctx, tagX, yTarget, "Target 3R", GREEN, s);
  priceTag(ctx, tagX, yEntry, "Entry", "#fafafa", s);
  priceTag(ctx, tagX, yStop, "Stop", RED, s);

  // Target reached marker
  const last = CLOSES.length - 1;
  const tx = cx(last);
  const ty = py(CLOSES[last][1]) - 16 * s;
  ctx.fillStyle = GREEN;
  ctx.beginPath();
  ctx.arc(tx, ty, 10 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#04130d";
  ctx.lineWidth = 2.5 * s;
  ctx.beginPath();
  ctx.moveTo(tx - 4.5 * s, ty);
  ctx.lineTo(tx - 1 * s, ty + 3.5 * s);
  ctx.lineTo(tx + 5 * s, ty - 3.5 * s);
  ctx.stroke();

  if (opts.footnote !== false) {
    ctx.fillStyle = "#71717a";
    ctx.font = `500 ${Math.round(13 * s)}px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText("Illustrative example · not a live trade", plotX, y + h - 18 * s);
  }
}

function background(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#050608");
  bg.addColorStop(0.55, "#0b1214");
  bg.addColorStop(1, "#04201d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  const glow = (gx, gy, r, c) => {
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.88, h * 0.1, w * 0.7, "rgba(20,184,166,0.30)");
  glow(w * 0.05, h * 0.8, w * 0.6, "rgba(99,102,241,0.16)");
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.03)";
  ctx.lineWidth = 1;
  for (let gx = 0; gx < w; gx += 54) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
    ctx.stroke();
  }
  for (let gy = 0; gy < h; gy += 54) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
    ctx.stroke();
  }
  ctx.restore();
}

async function header(ctx, x, y, w, size = 80) {
  const logo = await loadImage(path.join(root, "public", "novastaris-logo.png"));
  ctx.save();
  roundRect(ctx, x, y, size, size, size * 0.22);
  ctx.clip();
  ctx.drawImage(logo, x, y, size, size);
  ctx.restore();
  ctx.strokeStyle = "rgba(94,234,212,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, size, size, size * 0.22);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 ${Math.round(size * 0.58)}px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", x + size + 20, y + size / 2 + 2);

  const pill = "NEW · VIP";
  ctx.font = `800 ${Math.round(size * 0.27)}px ${FONT}`;
  const pw = ctx.measureText(pill).width + 44;
  const ph = size * 0.56;
  const px = x + w - pw;
  const g = ctx.createLinearGradient(px, 0, px + pw, 0);
  g.addColorStop(0, "#5eead4");
  g.addColorStop(1, "#14b8a6");
  roundRect(ctx, px, y + (size - ph) / 2, pw, ph, ph / 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = "#042f2e";
  ctx.fillText(pill, px + 22, y + size / 2 + 1);
}

function headline(ctx, x, y, size, maxWidth) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = TEAL_LIGHT;
  ctx.font = `700 ${Math.round(size * 0.36)}px ${FONT}`;
  ctx.fillText("SESSION SWEEP", x, y);
  const g = ctx.createLinearGradient(x, 0, x + maxWidth, 0);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.6, "#ccfbf1");
  g.addColorStop(1, "#5eead4");
  ctx.fillStyle = g;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText("Spot the sweep.", x - 3, y + size * 1.08);
  ctx.fillText("Wait for the break.", x - 3, y + size * 2.12);
  return y + size * 2.12;
}

function subline(ctx, x, y, size, maxWidth) {
  ctx.fillStyle = "#d4d4d8";
  ctx.font = `400 ${size}px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  const lines = wrapLines(
    ctx,
    "Live Asia, London & New York session ranges on gold, silver, forex & crypto perps.",
    maxWidth
  );
  lines.forEach((line, i) => ctx.fillText(line, x, y + i * size * 1.35));
  return y + (lines.length - 1) * size * 1.35;
}

const STEPS = [
  { n: 1, title: "Sweep", text: "Price spikes past a session high or low, then snaps back inside.", color: TEAL },
  { n: 2, title: "CHoCH", text: "First close against the old trend: the character changes.", color: AMBER },
  { n: 3, title: "BOS", text: "Structure breaks. Entry, stop and 3R target are mapped for you.", color: TEAL },
];

function stepChips(ctx, x, y, w, h, gap) {
  const cw = (w - gap * 2) / 3;
  STEPS.forEach((st, i) => {
    const sx = x + i * (cw + gap);
    roundRect(ctx, sx, y, cw, h, 18);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    badge(ctx, sx + 30, y + 32, 15, st.n, st.color);
    ctx.fillStyle = "#fafafa";
    ctx.font = `700 24px ${FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(st.title, sx + 54, y + 33);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = `500 17px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    wrapLines(ctx, st.text, cw - 36).slice(0, 3).forEach((line, li) => {
      ctx.fillText(line, sx + 18, y + 72 + li * 22);
    });
  });
}

function stepRows(ctx, x, y, w, rowH, gap) {
  STEPS.forEach((st, i) => {
    const ry = y + i * (rowH + gap);
    roundRect(ctx, x, ry, w, rowH, 20);
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    badge(ctx, x + 50, ry + rowH / 2, 24, st.n, st.color);
    ctx.fillStyle = "#fafafa";
    ctx.font = `700 32px ${FONT}`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(st.title, x + 96, ry + 44);
    ctx.fillStyle = "#c4c4cc";
    ctx.font = `500 25px ${FONT}`;
    wrapLines(ctx, st.text, w - 130).slice(0, 2).forEach((line, li) => {
      ctx.fillText(line, x + 96, ry + 80 + li * 30);
    });
  });
}

function ctaBar(ctx, x, y, w, h, fontSize) {
  roundRect(ctx, x, y, w, h, h / 2);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#5eead4");
  g.addColorStop(1, "#0d9488");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#042f2e";
  ctx.font = `800 ${fontSize}px ${FONT}`;
  ctx.fillText("Open Session Sweep", x + h * 0.5, y + h / 2 + 1);
  ctx.font = `600 ${Math.round(fontSize * 0.8)}px ${FONT}`;
  const url = "novastaris.ai/?tab=session-sweep";
  const uw = ctx.measureText(url).width;
  ctx.fillText(url, x + w - h * 0.5 - uw, y + h / 2 + 1);
}

function footer(ctx, w, y, size) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `500 ${size}px ${FONT}`;
  ctx.fillText("Educational only · Not financial advice · Not every sweep reverses", w / 2, y);
  ctx.textAlign = "left";
}

function emailChart() {
  const W = 1120;
  const H = 640;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#18181b";
  ctx.fillRect(0, 0, W, H);
  drawSweepChart(ctx, 0, 0, W, H, 1.45);
  writeFileSync(out("novastaris-session-sweep-email-chart.png"), c.toBuffer("image/png"));
}

async function square() {
  const W = 1080;
  const c = createCanvas(W, W);
  const ctx = c.getContext("2d");
  background(ctx, W, W);
  await header(ctx, 56, 44, W - 112, 72);
  headline(ctx, 60, 178, 60, W - 120);
  subline(ctx, 60, 354, 25, W - 120);
  drawSweepChart(ctx, 56, 384, W - 112, 420, 1.05);
  stepChips(ctx, 56, 824, W - 112, 136, 16);
  ctaBar(ctx, 56, 976, W - 112, 64, 26);
  footer(ctx, W, 1060, 17);
  writeFileSync(out("novastaris-session-sweep-postcard-premium.png"), c.toBuffer("image/png"));
}

async function story() {
  const W = 1080;
  const H = 1920;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  background(ctx, W, H);
  await header(ctx, 60, 150, W - 120, 92);
  headline(ctx, 64, 370, 86, W - 128);
  subline(ctx, 64, 610, 31, W - 128);
  drawSweepChart(ctx, 48, 700, W - 96, 600, 1.4);
  stepRows(ctx, 48, 1330, W - 96, 126, 16);
  ctaBar(ctx, 48, 1766, W - 96, 88, 34);
  footer(ctx, W, 1884, 22);
  writeFileSync(out("novastaris-session-sweep-story-premium.png"), c.toBuffer("image/png"));
}

emailChart();
await square();
await story();
console.log("Session Sweep art written to public/marketing/");
