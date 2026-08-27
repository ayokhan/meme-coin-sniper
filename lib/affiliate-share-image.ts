/**
 * Affiliate / invite share postcards — 1080×1080 for WhatsApp / IG status.
 * Browser-only (canvas).
 *
 * - ad: owner marketing for the Affiliate Program (mentions 10%)
 * - invite: user personal invite (code + link, no commission mention)
 */
import { downloadBlob } from "@/lib/pnl-share";
import { REFERRAL_COMMISSION_RATE_PCT } from "@/lib/referral-program";

const W = 1080;
const H = 1080;
const CYAN = "#14b8a6";
const CYAN_BRIGHT = "#5eead4";
const WHITE = "#fafafa";
const MUTED = "#a1a1aa";

export type AffiliatePostcardVariant = "ad" | "invite";

export type AffiliatePostcardOptions = {
  /** "ad" = program marketing (owner). "invite" = personal invite (no commission %). */
  variant?: AffiliatePostcardVariant;
  referralCode?: string | null;
  referralLink?: string | null;
  commissionRatePct?: number;
};

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

function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
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
  bg.addColorStop(0.45, "#0a1220");
  bg.addColorStop(1, "#042f2e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.2, H * 0.15, 0, W * 0.25, H * 0.2, W * 0.55);
  glow.addColorStop(0, "rgba(20,184,166,0.28)");
  glow.addColorStop(1, "rgba(20,184,166,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
}

/** Owner marketing postcard — Affiliate Program / 10%. */
function drawAdPostcard(
  ctx: CanvasRenderingContext2D,
  rate: number
) {
  const pad = 72;
  drawBackground(ctx);

  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("AFFILIATE PROGRAM", pad, pad + 12);

  ctx.fillStyle = WHITE;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText("NovaStaris", pad, pad + 78);

  const cardY = pad + 130;
  const cardH = 460;
  roundRect(ctx, pad, cardY, W - 2 * pad, cardH, 28);
  ctx.fillStyle = "rgba(10,10,11,0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20,184,166,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = pad + 40;
  let y = cardY + 56;

  ctx.fillStyle = "#a5b4fc";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("EARN WITH NOVASTARIS", innerX, y);
  y += 52;

  ctx.fillStyle = WHITE;
  ctx.font = "700 52px system-ui, sans-serif";
  for (const line of wrapLines(ctx, `Earn ${rate}% on VIP referrals`, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 60;
  }
  y += 16;

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const body =
    "Join the NovaStaris Affiliate Program. Share your link — when friends go VIP, you earn commission. Payouts every Friday after verification.";
  for (const line of wrapLines(ctx, body, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 36;
  }

  y += 28;
  const bullets = [`${rate}% of VIP subscription fee`, "Track referrals in-app", "Weekly Friday payouts"];
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
  ctx.fillText("Get your referral link", pad + 40, stripY + 42);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText("novastaris.ai/affiliate", pad + 40, stripY + 74);

  ctx.fillStyle = MUTED;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("novastaris.ai", pad, H - 36);
}

/**
 * Personal invite postcard — join with my code/link.
 * Does NOT mention affiliate commission % (friends shouldn't see you earn 10%).
 */
function drawInvitePostcard(ctx: CanvasRenderingContext2D, code: string) {
  const pad = 72;
  drawBackground(ctx);

  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = "700 22px system-ui, sans-serif";
  ctx.fillText("PERSONAL INVITE", pad, pad + 12);

  ctx.fillStyle = WHITE;
  ctx.font = "700 56px system-ui, sans-serif";
  ctx.fillText("NovaStaris", pad, pad + 78);

  const cardY = pad + 130;
  const cardH = 500;
  roundRect(ctx, pad, cardY, W - 2 * pad, cardH, 28);
  ctx.fillStyle = "rgba(10,10,11,0.78)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20,184,166,0.35)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const innerX = pad + 40;
  let y = cardY + 56;

  ctx.fillStyle = "#a5b4fc";
  ctx.font = "700 18px system-ui, sans-serif";
  ctx.fillText("JOIN ME ON NOVASTARIS", innerX, y);
  y += 52;

  ctx.fillStyle = WHITE;
  ctx.font = "700 48px system-ui, sans-serif";
  for (const line of wrapLines(ctx, "Trade smarter with my invite", W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 56;
  }
  y += 12;

  ctx.fillStyle = MUTED;
  ctx.font = "500 26px system-ui, sans-serif";
  const body =
    "AI trading desk for memes, crypto futures, and forex — start with my personal invite code.";
  for (const line of wrapLines(ctx, body, W - 2 * pad - 80)) {
    ctx.fillText(line, innerX, y);
    y += 36;
  }

  y += 32;
  roundRect(ctx, innerX, y, W - 2 * pad - 80, 100, 16);
  ctx.fillStyle = "rgba(20,184,166,0.15)";
  ctx.fill();
  ctx.strokeStyle = "rgba(20,184,166,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = CYAN_BRIGHT;
  ctx.font = "700 16px system-ui, sans-serif";
  ctx.fillText("INVITE CODE", innerX + 28, y + 36);
  ctx.fillStyle = WHITE;
  ctx.font = "700 40px ui-monospace, SFMono-Regular, Menlo, monospace";
  ctx.fillText(code, innerX + 28, y + 78);

  const stripY = H - pad - 120;
  roundRect(ctx, pad, stripY, W - 2 * pad, 100, 20);
  ctx.fillStyle = CYAN;
  ctx.fill();
  ctx.fillStyle = "#042f2e";
  ctx.font = "700 28px system-ui, sans-serif";
  ctx.fillText("Sign up with my invite", pad + 40, stripY + 42);
  ctx.font = "600 22px system-ui, sans-serif";
  ctx.fillText(`novastaris.ai/register?ref=${code}`, pad + 40, stripY + 74);

  ctx.fillStyle = MUTED;
  ctx.font = "500 18px system-ui, sans-serif";
  ctx.fillText("novastaris.ai", pad, H - 36);
}

/** Draw postcard JPEG. Prefer variant; invite requires referralCode. */
export function drawAffiliatePostcard(options?: AffiliatePostcardOptions): Promise<Blob> {
  const rate = options?.commissionRatePct ?? REFERRAL_COMMISSION_RATE_PCT;
  const code = options?.referralCode?.trim() || null;
  const variant: AffiliatePostcardVariant =
    options?.variant ?? (code ? "invite" : "ad");

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.reject(new Error("Canvas not supported"));

  if (variant === "invite") {
    if (!code) return Promise.reject(new Error("Invite postcard needs a referral code."));
    drawInvitePostcard(ctx, code);
  } else {
    drawAdPostcard(ctx, rate);
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Failed"))), "image/jpeg", 0.94);
  });
}

export async function downloadAffiliatePostcard(
  options?: AffiliatePostcardOptions,
  filename?: string
) {
  const blob = await drawAffiliatePostcard(options);
  const code = options?.referralCode?.trim();
  const variant = options?.variant ?? (code ? "invite" : "ad");
  downloadBlob(
    blob,
    filename ??
      `NovaStaris_${variant === "invite" && code ? `Invite_${code}` : "Affiliate_Ad"}_${new Date()
        .toISOString()
        .slice(0, 10)}.jpg`
  );
}

/** Caption for sharing an invite postcard (no commission mention). */
export function buildInviteShareCaption(referralCode: string, referralLink: string): string {
  return [
    "Join me on NovaStaris — AI trading for memes, futures & forex.",
    `Invite code: ${referralCode}`,
    referralLink,
  ].join("\n");
}

/** Caption for owner affiliate ad postcard. */
export function buildAffiliateAdShareCaption(rate = REFERRAL_COMMISSION_RATE_PCT): string {
  return [
    `Earn ${rate}% on VIP referrals with the NovaStaris Affiliate Program.`,
    "Get your link: https://novastaris.ai/affiliate",
  ].join("\n");
}
