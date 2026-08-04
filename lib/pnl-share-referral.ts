/**
 * Personal affiliate code + QR on PNL share JPEGs (stamp footer after card draw).
 */

import QRCode from "qrcode";

export type PnlShareReferral = {
  code: string;
  link: string;
};

const OPT_IN_KEY = "novastaris-pnl-share-include-ref-v1";

export function readPnlShareReferralOptIn(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const v = localStorage.getItem(OPT_IN_KEY);
    if (v === "0" || v === "false") return false;
    if (v === "1" || v === "true") return true;
  } catch {
    /* ignore */
  }
  return true; // default on when known
}

export function writePnlShareReferralOptIn(on: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(OPT_IN_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}

/** Load signed-in user's affiliate code/link (null if guest or error). */
export async function fetchPnlShareReferral(): Promise<PnlShareReferral | null> {
  try {
    const res = await fetch("/api/affiliate", { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      success?: boolean;
      referralCode?: string;
      referralLink?: string;
    };
    const code = String(data.referralCode ?? "").trim();
    const link = String(data.referralLink ?? "").trim();
    if (!data.success || !code || !link) return null;
    return { code, link };
  } catch {
    return null;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/**
 * Overlay a referral strip (code + QR) on the bottom of an existing PNL JPEG.
 * Keeps the trade card as the hero; marketing lives in the footer band.
 */
export async function stampPnlReferralFooter(
  blob: Blob,
  referral: PnlShareReferral
): Promise<Blob> {
  if (typeof document === "undefined") return blob;

  const bitmap = await createImageBitmap(blob);
  const W = bitmap.width;
  const H = bitmap.height;
  const stripH = Math.max(112, Math.round(H * 0.12));
  const pad = Math.max(20, Math.round(W * 0.04));

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

  const y0 = H - stripH;
  const band = ctx.createLinearGradient(0, y0 - 24, 0, H);
  band.addColorStop(0, "rgba(5, 8, 15, 0)");
  band.addColorStop(0.28, "rgba(5, 8, 15, 0.88)");
  band.addColorStop(1, "#05080f");
  ctx.fillStyle = band;
  ctx.fillRect(0, y0 - 24, W, stripH + 24);

  const qrSize = Math.min(92, stripH - 28);
  const qrDataUrl = await QRCode.toDataURL(referral.link, {
    width: qrSize * 2,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0a0e17", light: "#ffffff" },
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error("QR load failed"));
    el.src = qrDataUrl;
  });

  const qrX = W - pad - qrSize;
  const qrY = H - pad - qrSize - 4;
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 10);
  ctx.fill();
  ctx.drawImage(img, qrX, qrY, qrSize, qrSize);

  const textMax = qrX - pad - 18;
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  const titleSize = Math.max(13, Math.round(H * 0.016));
  const codeSize = Math.max(18, Math.round(H * 0.024));
  const linkSize = Math.max(11, Math.round(H * 0.013));

  ctx.font = `600 ${titleSize}px system-ui, sans-serif`;
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Join NovaStaris with my code", pad, y0 + Math.round(stripH * 0.22));

  ctx.font = `700 ${codeSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.fillStyle = "#00d4ff";
  ctx.fillText(referral.code, pad, y0 + Math.round(stripH * 0.44));

  ctx.font = `500 ${linkSize}px system-ui, sans-serif`;
  ctx.fillStyle = "#64748b";
  let linkText = referral.link.replace(/^https?:\/\//i, "");
  while (linkText.length > 8 && ctx.measureText(linkText).width > textMax) {
    linkText = `${linkText.slice(0, -2)}…`;
  }
  ctx.fillText(linkText, pad, y0 + Math.round(stripH * 0.68));

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (out) => (out ? resolve(out) : reject(new Error("Failed to stamp referral footer"))),
      "image/jpeg",
      0.94
    );
  });
}
