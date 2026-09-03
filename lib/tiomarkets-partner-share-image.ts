/**
 * TIOmarkets × NovaStaris marketing postcards — 1080×1080 for X, IG, WhatsApp, Telegram.
 */
import { downloadBlob } from "@/lib/pnl-share";

const W = 1080;
const H = 1080;
const AMBER = "#f59e0b";
const AMBER_BRIGHT = "#fcd34d";
const WHITE = "#fafafa";
const MUTED = "#a1a1aa";
/** Live partner register URL (Admin → Banners → Forex Broker Partners). */
const JOIN_URL = "https://tiomarkets.com/register/?cmp=0t9g1l5b&refid=4050";
const APP_URL = "https://novastaris.ai/?tab=nova-forex-bot";
const PREMIUM_ASSET_PATH = "/marketing/novastaris-tiomarkets-postcard-premium.png";

export type TiomarketsPartnerPostcardVariant = "classic" | "premium";

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

  const glow = ctx.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.72, H * 0.22, W * 0.5);
  glow.addColorStop(0, "rgba(245,158,11,0.22)");
  glow.addColorStop(1, "rgba(245,158,11,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawClassicPostcard(ctx: CanvasRenderingContext2D) {
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
  ctx.fillText("TIOMARKETS FOREX", pad + 160, pad + 12);

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

  ctx.fillStyle = AMBER_BRIGHT;
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("NOVASTARIS × TIOMARKETS", innerX, y);
  y += 52;

  ctx.fillStyle = WHITE;
  ctx.font = "700 42px system-ui, sans-serif";
  for (const line of wrapLines(ctx, "Unlimited Leverage Forex with AI", W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 50;
  }
  y += 10;

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const body =
    "Open a TIOmarkets Unlimited Leverage account — Nova Forex Bot and Scalper on your MT4/MT5.";
  for (const line of wrapLines(ctx, body, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 36;
  }

  y += 24;
  const bullets = [
    "Unlimited leverage accounts",
    "$2 USDC per lot rebate offer",
    "Connect MT4/MT5 — your own account",
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
  ctx.fillText("Register on TIOmarkets", pad + 40, stripY + 42);
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("novastaris.ai/?tab=nova-forex-bot", pad + 40, stripY + 74);

  ctx.fillStyle = MUTED;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("Educational only · Not financial advice · Risk warning applies", pad, H - 36);
}

async function loadPremiumPostcardBlob(): Promise<Blob> {
  const res = await fetch(PREMIUM_ASSET_PATH);
  if (!res.ok) throw new Error("Premium postcard asset not found.");
  return res.blob();
}

function canvasToJpegBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

export function drawTiomarketsPartnerPostcard(
  variant: TiomarketsPartnerPostcardVariant = "premium"
): Promise<Blob> {
  if (variant === "premium") return loadPremiumPostcardBlob();

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));
  drawClassicPostcard(ctx);
  return canvasToJpegBlob(canvas);
}

export async function downloadTiomarketsPartnerPostcard(
  variant: TiomarketsPartnerPostcardVariant = "premium",
  filename?: string
) {
  const blob = await drawTiomarketsPartnerPostcard(variant);
  const suffix = variant === "premium" ? "Premium" : "Classic";
  const ext = blob.type.includes("png") ? "png" : "jpg";
  downloadBlob(
    blob,
    filename ?? `NovaStaris_TIOmarkets_${suffix}_${new Date().toISOString().slice(0, 10)}.${ext}`
  );
}

export function buildTiomarketsPartnerShareCaption(): string {
  return [
    "NovaStaris × TIOmarkets — Unlimited Leverage forex.",
    "Connect MT4/MT5 to Nova Forex Bot & Scalper. $2 USDC/lot rebate available.",
    "",
    "Register with our partner link:",
    JOIN_URL,
    "",
    `Open Nova Forex Bots: ${APP_URL}`,
    "Educational only — not financial advice. Trading involves risk.",
  ].join("\n");
}

export const TIOMARKETS_PARTNER_JOIN_URL = JOIN_URL;
