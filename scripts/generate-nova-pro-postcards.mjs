/**
 * Renders the Nova Pro launch postcards (text drawn in code, not AI image text).
 *   node scripts/generate-nova-pro-postcards.mjs
 * Outputs public/marketing/novastaris-nova-pro-postcard-premium.png (1080×1080)
 *     and public/marketing/novastaris-nova-pro-story-premium.png (1080×1920).
 */
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = (name) => path.join(root, "public", "marketing", name);

const FONT = '"Segoe UI", "Helvetica Neue", Arial, sans-serif';
const PRICE = { usdc: 50, card: 58, fee: 8 };
const LIMITS = { ai: 7, pulse: 5, seats: 100 };

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, cx, cy, r, color, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const rr = i % 2 === 0 ? r : r * 0.22;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function background(ctx, w, h) {
  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#07060f");
  bg.addColorStop(0.55, "#0d0a1f");
  bg.addColorStop(1, "#05070d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const glow = (x, y, r, c) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, c);
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  };
  glow(w * 0.85, h * 0.12, w * 0.7, "rgba(139,92,246,0.38)");
  glow(w * 0.05, h * 0.75, w * 0.6, "rgba(34,211,238,0.16)");
  glow(w * 0.5, h * 1.05, w * 0.6, "rgba(245,180,60,0.14)");

  // subtle grid
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let x = 0; x < w; x += 54) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y < h; y += 54) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  ctx.restore();

  // sparkles (deterministic)
  let seed = 7;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) {
    star(ctx, rnd() * w, rnd() * h, 2 + rnd() * 6, i % 3 === 0 ? "#f5c451" : "#c4b5fd", 0.25 + rnd() * 0.5);
  }
  star(ctx, w * 0.9, h * 0.06, 34, "#c4b5fd", 0.55);
}

async function header(ctx, x, y, w) {
  const logo = await loadImage(path.join(root, "public", "novastaris-logo.png"));
  ctx.save();
  roundRect(ctx, x, y, 88, 88, 20);
  ctx.clip();
  ctx.drawImage(logo, x, y, 88, 88);
  ctx.restore();
  ctx.strokeStyle = "rgba(196,181,253,0.55)";
  ctx.lineWidth = 2;
  roundRect(ctx, x, y, 88, 88, 20);
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  ctx.font = `600 50px ${FONT}`;
  ctx.textBaseline = "middle";
  ctx.fillText("NovaStaris", x + 108, y + 46);

  const pill = "FOUNDING EDITION";
  ctx.font = `700 22px ${FONT}`;
  const pw = ctx.measureText(pill).width + 74;
  const px = x + w - pw;
  const g = ctx.createLinearGradient(px, 0, px + pw, 0);
  g.addColorStop(0, "#f9d97a");
  g.addColorStop(1, "#d99a2b");
  roundRect(ctx, px, y + 22, pw, 46, 23);
  ctx.fillStyle = g;
  ctx.fill();
  star(ctx, px + 30, y + 45, 13, "#1a1203", 1);
  ctx.fillStyle = "#1a1203";
  ctx.fillText(pill, px + 52, y + 46);
}

function headline(ctx, x, y, size) {
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c4b5fd";
  ctx.font = `600 ${Math.round(size * 0.3)}px ${FONT}`;
  ctx.fillText("INTRODUCING", x, y);
  const g = ctx.createLinearGradient(x, 0, x + size * 4.6, 0);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.45, "#c4b5fd");
  g.addColorStop(1, "#67e8f9");
  ctx.fillStyle = g;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.fillText("NOVA PRO", x - 4, y + size * 0.98);
  ctx.fillStyle = "#d4d4d8";
  ctx.font = `400 ${Math.round(size * 0.27)}px ${FONT}`;
  ctx.fillText("VIP-level AI desks. Built for focused traders.", x, y + size * 1.42);
}

function priceCard(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 28);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "rgba(139,92,246,0.30)");
  g.addColorStop(1, "rgba(30,27,75,0.55)");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = "rgba(196,181,253,0.6)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `600 22px ${FONT}`;
  ctx.fillText("NOVA PRO MONTHLY", x + 32, y + 52);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 112px ${FONT}`;
  ctx.fillText(`$${PRICE.card}`, x + 26, y + 162);
  const pw = ctx.measureText(`$${PRICE.card}`).width;
  ctx.font = `600 28px ${FONT}`;
  ctx.fillStyle = "#e4e4e7";
  ctx.fillText("/month", x + 40 + pw, y + 120);
  ctx.fillStyle = "#a1a1aa";
  ctx.fillText("by card", x + 40 + pw, y + 158);
  ctx.fillStyle = "#67e8f9";
  ctx.font = `600 25px ${FONT}`;
  ctx.fillText(`or $${PRICE.usdc}/month with USDC — save $${PRICE.fee}`, x + 32, y + 210);
  ctx.fillStyle = "#f5c451";
  ctx.font = `600 24px ${FONT}`;
  ctx.fillText("6 months: 1 free   ·   12 months: 2 free", x + 32, y + 250);
}

function check(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(52,211,153,0.18)";
  ctx.fill();
  ctx.strokeStyle = "#34d399";
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.42, y + r * 0.02);
  ctx.lineTo(x - r * 0.1, y + r * 0.34);
  ctx.lineTo(x + r * 0.46, y - r * 0.32);
  ctx.stroke();
}

function features(ctx, x, y, gap, size) {
  const items = [
    "Every VIP AI desk — AI Agent, NovaForecast, NovaQ, Nova+",
    `${LIMITS.ai} AI runs per day, shared across desks`,
    `${LIMITS.pulse} Nova Pulse runs per day`,
    "Upgrade to VIP anytime — unused days credited",
  ];
  ctx.textBaseline = "middle";
  items.forEach((t, i) => {
    const cy = y + i * gap;
    check(ctx, x + 18, cy, 18);
    ctx.fillStyle = "#f4f4f5";
    ctx.font = `500 ${size}px ${FONT}`;
    ctx.fillText(t, x + 52, cy);
  });
}

function foundingCard(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, 24);
  ctx.fillStyle = "rgba(245,196,81,0.10)";
  ctx.fill();
  ctx.strokeStyle = "rgba(245,196,81,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  star(ctx, x + 50, y + h / 2, 26, "#f5c451", 1);
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f9d97a";
  ctx.font = `700 28px ${FONT}`;
  ctx.fillText(`Limited: first ${LIMITS.seats} subscribers`, x + 96, y + h / 2 - 20);
  ctx.fillStyle = "#e4e4e7";
  ctx.font = `500 23px ${FONT}`;
  ctx.fillText("Founding badge + today's price locked while you renew", x + 96, y + h / 2 + 20);
}

function ctaBar(ctx, x, y, w, h) {
  roundRect(ctx, x, y, w, h, h / 2);
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#f9d97a");
  g.addColorStop(0.5, "#f0b93f");
  g.addColorStop(1, "#c98a1e");
  ctx.fillStyle = g;
  ctx.fill();
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#1a1203";
  ctx.font = `800 36px ${FONT}`;
  ctx.fillText("Claim your seat", x + 44, y + h / 2);
  ctx.font = `600 30px ${FONT}`;
  const url = "novastaris.ai/subscribe";
  const uw = ctx.measureText(url).width;
  ctx.fillText(url, x + w - 44 - uw, y + h / 2);
  ctx.fillStyle = "rgba(26,18,3,0.35)";
  ctx.fillRect(x + w - 70 - uw, y + 22, 2, h - 44);
}

function footer(ctx, w, y) {
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `500 22px ${FONT}`;
  ctx.fillText("Educational only · Not financial advice · Refund within 24h if ≤2 runs used", w / 2, y);
  ctx.textAlign = "left";
}

async function square() {
  const W = 1080;
  const c = createCanvas(W, W);
  const ctx = c.getContext("2d");
  background(ctx, W, W);
  await header(ctx, 56, 48, W - 112);
  headline(ctx, 60, 228, 118);
  priceCard(ctx, 56, 430, 560, 280);
  // right column: comparison chip
  roundRect(ctx, 640, 430, 384, 280, 28);
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.14)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#c4b5fd";
  ctx.font = `700 24px ${FONT}`;
  ctx.fillText("PER DAY", 672, 476);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(String(LIMITS.ai), 668, 572);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "#e4e4e7";
  ctx.fillText("AI runs", 672, 610);
  ctx.fillStyle = "#ffffff";
  ctx.font = `800 84px ${FONT}`;
  ctx.fillText(String(LIMITS.pulse), 852, 572);
  ctx.font = `600 24px ${FONT}`;
  ctx.fillStyle = "#e4e4e7";
  ctx.fillText("Nova Pulse", 856, 610);
  ctx.fillStyle = "#a1a1aa";
  ctx.font = `500 20px ${FONT}`;
  ctx.fillText("VIP = unlimited + bots + Coach Calls", 672, 672);

  foundingCard(ctx, 56, 740, W - 112, 120);
  ctaBar(ctx, 56, 892, W - 112, 100);
  footer(ctx, W, 1040);
  writeFileSync(out("novastaris-nova-pro-postcard-premium.png"), c.toBuffer("image/png"));
}

async function story() {
  const W = 1080;
  const H = 1920;
  const c = createCanvas(W, H);
  const ctx = c.getContext("2d");
  background(ctx, W, H);
  await header(ctx, 60, 140, W - 120);
  headline(ctx, 64, 420, 150);
  priceCard(ctx, 60, 700, W - 120, 290);
  ctx.fillStyle = "#ffffff";
  ctx.textBaseline = "alphabetic";
  ctx.font = `700 34px ${FONT}`;
  ctx.fillText("What's included", 64, 1060);
  features(ctx, 64, 1125, 78, 28);
  foundingCard(ctx, 60, 1440, W - 120, 130);
  ctaBar(ctx, 60, 1620, W - 120, 110);
  footer(ctx, W, 1800);
  writeFileSync(out("novastaris-nova-pro-story-premium.png"), c.toBuffer("image/png"));
}

await square();
await story();
console.log("Nova Pro postcards written to public/marketing/");
