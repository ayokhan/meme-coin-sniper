/**
 * Blofin × NovaStaris marketing postcards — 1080×1080 for X, IG, WhatsApp, Telegram.
 */
import { downloadBlob } from "@/lib/pnl-share";

const W = 1080;
const H = 1080;
const CYAN = "#14b8a6";
const CYAN_BRIGHT = "#5eead4";
const WHITE = "#fafafa";
const MUTED = "#a1a1aa";
const JOIN_URL = "https://blofin.com/register?referral_code=wAwpn7";
const APP_URL = "https://novastaris.ai/?tab=trading-bot";
const PREMIUM_ASSET_PATH = "/marketing/novastaris-blofin-postcard-premium.png";

export type BlofinPartnerPostcardVariant = "classic" | "premium";

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
  bg.addColorStop(0, "#05080f");
  bg.addColorStop(0.5, "#0a1220");
  bg.addColorStop(1, "#042f2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.78, H * 0.18, 0, W * 0.72, H * 0.22, W * 0.5);
  glow.addColorStop(0, "rgba(20,184,166,0.28)");
  glow.addColorStop(1, "rgba(20,184,166,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

function drawClassicPostcard(ctx: CanvasRenderingContext2D) {
  const pad = 72;
  drawBackground(ctx);

  roundRect(ctx, pad - 8, pad - 8, 148, 44, 22);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.fillStyle = "#042f2e";
  ctx.font = "800 22px system-ui, sans-serif";
  ctx.fillText("NEW", pad + 28, pad + 22);

  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("BLOFIN FUTURES + SPOT", pad + 160, pad + 12);

  ctx.fillStyle = WHITE;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText("NovaStaris", pad, pad + 78);

  const cardY = pad + 130;
  const cardH = 520;
  roundRect(ctx, pad, cardY, W - 2 * pad, cardH, 28);
  ctx.fillStyle = "rgba(5,8,15,0.88)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20,184,166,0.45)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = pad + 40;
  let y = cardY + 56;

  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("NOVASTARIS × BLOFIN", innerX, y);
  y += 52;

  ctx.fillStyle = WHITE;
  ctx.font = "700 42px system-ui, sans-serif";
  for (const line of wrapLines(ctx, "Trade Futures & Spot with 10% cashback", W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 50;
  }
  y += 10;

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const body =
    "Register through NovaStaris — VIP Trading Bot and NovaScalper on your Blofin account.";
  for (const line of wrapLines(ctx, body, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 36;
  }

  y += 24;
  const bullets = [
    "10% cashback on trading fees",
    "VIP: AI Trading Bot + NovaScalper",
    "Your keys, your funds — we never hold them",
  ];
  ctx.font = "600 24px system-ui, sans-serif";
  for (const b of bullets) {
    ctx.fillStyle = CYAN;
    ctx.fillText("▸", innerX, y);
    ctx.fillStyle = WHITE;
    ctx.fillText(b, innerX + 36, y);
    y += 40;
  }

  const stripY = H - pad - 120;
  roundRect(ctx, pad, stripY, W - 2 * pad, 100, 20);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.fillStyle = "#042f2e";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("Register on Blofin", pad + 40, stripY + 42);
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("novastaris.ai · referral code wAwpn7", pad + 40, stripY + 74);

  ctx.fillStyle = MUTED;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("Educational only · Not financial advice · VIP feature", pad, H - 36);
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

export function drawBlofinPartnerPostcard(
  variant: BlofinPartnerPostcardVariant = "premium"
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

export async function downloadBlofinPartnerPostcard(
  variant: BlofinPartnerPostcardVariant = "premium",
  filename?: string
) {
  const blob = await drawBlofinPartnerPostcard(variant);
  const suffix = variant === "premium" ? "Premium" : "Classic";
  const ext = blob.type.includes("png") ? "png" : "jpg";
  downloadBlob(
    blob,
    filename ?? `NovaStaris_Blofin_${suffix}_${new Date().toISOString().slice(0, 10)}.${ext}`
  );
}

export function buildBlofinPartnerShareCaption(): string {
  return [
    "NovaStaris × Blofin — 10% cashback on trading fees (Futures & Spot).",
    "VIP: run the AI Trading Bot & NovaScalper on your Blofin account.",
    "",
    "Register with our referral link:",
    JOIN_URL,
    "Code: wAwpn7",
    "",
    `Open Trading Bot: ${APP_URL}`,
    "Educational only — not financial advice.",
  ].join("\n");
}

export const BLOFIN_PARTNER_JOIN_URL = JOIN_URL;
