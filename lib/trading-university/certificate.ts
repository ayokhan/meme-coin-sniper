/** Client-side certificate PNG + share helpers (no server CPU / no paid API). */

import {
  TRADING_UNIVERSITY_PASS_CORRECT,
  TRADING_UNIVERSITY_QUIZ_SIZE,
} from "@/lib/trading-university/content";

export type CertificatePayload = {
  graduateName: string;
  scorePct: number;
  certificateCode: string;
  passedAtIso: string;
};

export const TRADING_UNIVERSITY_SHARE_URL = "https://novastaris.ai/?tab=trading-university";

export function certificateShareText(payload: CertificatePayload): string {
  const name = payload.graduateName.slice(0, 48) || "I";
  return `I completed NovaStaris Trading University and passed the final exam with ${payload.scorePct}% (Certificate ID: ${payload.certificateCode}). Free markets course: ${TRADING_UNIVERSITY_SHARE_URL}`;
}

export function buildCertificateCanvas(payload: CertificatePayload): HTMLCanvasElement {
  const w = 1200;
  const h = 850;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0c1222");
  grad.addColorStop(0.45, "#132038");
  grad.addColorStop(1, "#0a1628");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(34, 211, 238, 0.55)";
  ctx.lineWidth = 4;
  ctx.strokeRect(36, 36, w - 72, h - 72);
  ctx.strokeStyle = "rgba(250, 204, 21, 0.35)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(52, 52, w - 104, h - 104);

  ctx.fillStyle = "rgba(34, 211, 238, 0.9)";
  ctx.font = "600 22px Georgia, 'Times New Roman', serif";
  ctx.textAlign = "center";
  ctx.fillText("NOVASTARIS", w / 2, 120);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 48px Georgia, 'Times New Roman', serif";
  ctx.fillText("Trading University", w / 2, 185);

  ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
  ctx.font = "400 20px system-ui, sans-serif";
  ctx.fillText("Certificate of Completion", w / 2, 230);

  ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
  ctx.font = "400 18px system-ui, sans-serif";
  ctx.fillText("This certifies that", w / 2, 310);

  ctx.fillStyle = "#fde68a";
  ctx.font = "700 44px Georgia, 'Times New Roman', serif";
  const name = payload.graduateName.slice(0, 48) || "Graduate";
  ctx.fillText(name, w / 2, 375);

  ctx.fillStyle = "rgba(226, 232, 240, 0.92)";
  ctx.font = "400 18px system-ui, sans-serif";
  ctx.fillText(
    "has successfully completed the NovaStaris Trading University course",
    w / 2,
    440
  );
  ctx.fillText(
    `and passed the final examination with ${payload.scorePct}% (pass mark ${TRADING_UNIVERSITY_PASS_CORRECT}/${TRADING_UNIVERSITY_QUIZ_SIZE}).`,
    w / 2,
    470
  );

  const dateStr = new Date(payload.passedAtIso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText(`Awarded ${dateStr}`, w / 2, 545);
  ctx.fillText(`Certificate ID: ${payload.certificateCode}`, w / 2, 575);

  ctx.fillStyle = "rgba(34, 211, 238, 0.75)";
  ctx.font = "600 14px system-ui, sans-serif";
  ctx.fillText(
    "novastaris.ai  ·  Free course: foundations, memes, perps, FX & platform workflow",
    w / 2,
    720
  );

  ctx.fillStyle = "rgba(100, 116, 139, 0.9)";
  ctx.font = "400 12px system-ui, sans-serif";
  ctx.fillText("Educational credential · Not a financial license or investment advice", w / 2, 755);

  return canvas;
}

export async function certificateToBlob(payload: CertificatePayload): Promise<Blob> {
  const canvas = buildCertificateCanvas(payload);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("Could not build certificate image");
  return blob;
}

export async function downloadTradingUniversityCertificate(payload: CertificatePayload): Promise<void> {
  const blob = await certificateToBlob(payload);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `NovaStaris-Trading-University-${payload.certificateCode}.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function shareUrlLinkedIn(text: string): string {
  return `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(TRADING_UNIVERSITY_SHARE_URL)}`;
}

export function shareUrlX(text: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function shareUrlFacebook(): string {
  return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(TRADING_UNIVERSITY_SHARE_URL)}`;
}

export function shareUrlTelegram(text: string): string {
  return `https://t.me/share/url?url=${encodeURIComponent(TRADING_UNIVERSITY_SHARE_URL)}&text=${encodeURIComponent(text)}`;
}

export function shareUrlWhatsApp(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

/** Native share sheet when available (often best on mobile; may attach image). */
export async function nativeShareCertificate(
  payload: CertificatePayload,
  blob: Blob
): Promise<boolean> {
  const file = new File([blob], `NovaStaris-Trading-University-${payload.certificateCode}.png`, {
    type: "image/png",
  });
  const text = certificateShareText(payload);
  const nav = typeof navigator !== "undefined" ? navigator : null;
  if (!nav?.share) return false;
  try {
    if (nav.canShare?.({ files: [file] })) {
      await nav.share({
        title: "NovaStaris Trading University Certificate",
        text,
        url: TRADING_UNIVERSITY_SHARE_URL,
        files: [file],
      });
      return true;
    }
    await nav.share({ title: "NovaStaris Trading University Certificate", text, url: TRADING_UNIVERSITY_SHARE_URL });
    return true;
  } catch {
    return false;
  }
}
