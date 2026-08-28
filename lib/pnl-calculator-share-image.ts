/**
 * PnL Calculator marketing postcard — 1080×1080 for X, IG, WhatsApp, Telegram.
 */
import { downloadBlob } from "@/lib/pnl-share";

const W = 1080;
const H = 1080;
const AMBER = "#f59e0b";
const AMBER_BRIGHT = "#fcd34d";
const WHITE = "#fafafa";
const MUTED = "#a1a1aa";
const LINK = "novastaris.ai/?tab=pnl-calculator";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapLines(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
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

function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#0a0a0b");
  bg.addColorStop(0.5, "#18181b");
  bg.addColorStop(1, "#422006");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.75, H * 0.2, 0, W * 0.7, H * 0.25, W * 0.5);
  glow.addColorStop(0, "rgba(245,158,11,0.22)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawPostcard(ctx: CanvasRenderingContext2D) {
  const pad = 72;
  drawBackground(ctx);

  roundRect(ctx, pad - 8, pad - 8, 148, 44, 22);
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.fillStyle = "#422006";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("NEW", pad + 28, pad + 22);

  ctx.fillStyle = AMBER_BRIGHT;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("PNL CALCULATOR", pad + 160, pad + 12);

  ctx.fillStyle = WHITE;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText("NovaStaris", pad, pad + 78);

  const cardY = pad + 130;
  const cardH = 520;
  roundRect(ctx, pad, cardY, W - 2 * pad, cardH, 28);
  ctx.fillStyle = "rgba(10,10,11,0.82)";
  ctx.fill();
  ctx.strokeStyle = "rgba(245,158,11,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = pad + 40;
  let y = cardY + 56;

  ctx.fillStyle = "#fde68a";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("CRYPTO FUTURES + FOREX", innerX, y);
  y += 52;

  ctx.fillStyle = WHITE;
  ctx.font = "700 46px system-ui, sans-serif";
  for (const line of wrapLines(ctx, "Size the trade before you send it", W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 54;
  }
  y += 8;

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const body =
    "Position size, TP/SL in price, % or pips, account risk, reward-to-risk, and live pivot levels — one professional desk for futures and forex.";
  for (const line of wrapLines(ctx, body, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 36;
  }

  y += 20;
  const bullets = [
    "Crypto futures: margin & leverage sizing",
    "Forex: lots, pips & risk-on/off context",
    "Free to try · VIP unlimited",
  ];
  ctx.font = "600 24px system-ui, sans-serif";
  for (const b of bullets) {
    ctx.fillStyle = AMBER;
    ctx.fillText("▸", innerX, y);
    ctx.fillStyle = WHITE;
    ctx.fillText(b, innerX + 36, y);
    y += 40;
  }

  const stripY = H - pad - 120;
  roundRect(ctx, pad, stripY, W - 2 * pad, 100, 20);
  ctx.fillStyle = AMBER;
  ctx.fill();
  ctx.fillStyle = "#422006";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("Try it free on NovaStaris", pad + 40, stripY + 42);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText(LINK, pad + 40, stripY + 74);

  ctx.fillStyle = MUTED;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("Educational only · Not financial advice", pad, H - 36);
}

export function drawPnlCalculatorPostcard(): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));
  drawPostcard(ctx);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

export async function downloadPnlCalculatorPostcard(filename?: string) {
  const blob = await drawPnlCalculatorPostcard();
  downloadBlob(
    blob,
    filename ?? `NovaStaris_PnL_Calculator_${new Date().toISOString().slice(0, 10)}.jpg`
  );
}

export function buildPnlCalculatorShareCaption(): string {
  return [
    "New on NovaStaris: PnL Calculator for crypto futures & forex.",
    "Size your trade — margin, lots, TP/SL, risk/reward & pivots in one desk.",
    "Try free: https://novastaris.ai/?tab=pnl-calculator",
    "Educational only — not financial advice.",
  ].join("\n");
}

export async function sharePnlCalculatorPostcard(): Promise<"native" | "download" | "cancelled" | "unsupported"> {
  const blob = await drawPnlCalculatorPostcard();
  const caption = buildPnlCalculatorShareCaption();
  const file = new File([blob], "NovaStaris-PnL-Calculator.jpg", { type: "image/jpeg" });
  if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({
        title: "NovaStaris PnL Calculator",
        text: caption,
        files: [file],
      });
      return "native";
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return "cancelled";
    }
  }
  downloadBlob(blob, `NovaStaris_PnL_Calculator_${new Date().toISOString().slice(0, 10)}.jpg`);
  return "download";
}
