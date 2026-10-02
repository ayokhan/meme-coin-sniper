/**
 * Signed email links: one-click unsubscribe, open pixel and click tracking.
 * Uses global Web Crypto (no node: imports) because this module is reachable from client bundles
 * through lib/announcement-email; it only signs when called on the server.
 */

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");

let keyPromise: Promise<CryptoKey> | null = null;

function hmacKey(): Promise<CryptoKey> {
  if (!keyPromise) {
    const s = process.env.EMAIL_LINK_SECRET || process.env.NEXTAUTH_SECRET;
    if (!s) throw new Error("EMAIL_LINK_SECRET or NEXTAUTH_SECRET must be set to sign email links.");
    keyPromise = globalThis.crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(s),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
  }
  return keyPromise;
}

function base64Url(bytes: ArrayBuffer): string {
  let bin = "";
  for (const b of new Uint8Array(bytes)) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sign(value: string): Promise<string> {
  const sig = await globalThis.crypto.subtle.sign("HMAC", await hmacKey(), new TextEncoder().encode(value));
  return base64Url(sig).slice(0, 32);
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function normalizeEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function unsubscribeToken(email: string): Promise<string> {
  return sign(`unsub:${normalizeEmailAddress(email)}`);
}

export async function verifyUnsubscribeToken(email: string, token: string): Promise<boolean> {
  if (!email || !token) return false;
  return safeEqual(await unsubscribeToken(email), token);
}

/** Page with a confirm button (link scanners can't unsubscribe people by just opening it). */
export async function unsubscribePageUrl(email: string): Promise<string> {
  const e = normalizeEmailAddress(email);
  return `${APP_ORIGIN}/unsubscribe?e=${encodeURIComponent(e)}&t=${await unsubscribeToken(e)}`;
}

/** RFC 8058 one-click endpoint used by Gmail / Yahoo "Unsubscribe" buttons. */
export async function unsubscribeOneClickUrl(email: string): Promise<string> {
  const e = normalizeEmailAddress(email);
  return `${APP_ORIGIN}/api/email/unsubscribe?e=${encodeURIComponent(e)}&t=${await unsubscribeToken(e)}`;
}

export async function marketingHeaders(email: string): Promise<Record<string, string>> {
  return {
    "List-Unsubscribe": `<${await unsubscribeOneClickUrl(email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Adds a visible unsubscribe line to any marketing HTML (before </body> when present). */
export async function withUnsubscribeFooter(html: string, email: string): Promise<string> {
  const line = `<p style="margin:16px auto 24px auto;max-width:560px;text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#71717a;">Don't want these emails? <a href="${await unsubscribePageUrl(email)}" style="color:#71717a;text-decoration:underline;">Unsubscribe</a>.</p>`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${line}</body>`) : `${html}${line}`;
}

export function openPixelUrl(recipientId: string): string {
  return `${APP_ORIGIN}/api/email/o/${encodeURIComponent(recipientId)}`;
}

export async function trackedClickUrl(recipientId: string, url: string): Promise<string> {
  return `${APP_ORIGIN}/api/email/c/${encodeURIComponent(recipientId)}?u=${encodeURIComponent(url)}&s=${await sign(`click:${recipientId}:${url}`)}`;
}

export async function verifyClick(recipientId: string, url: string, sig: string): Promise<boolean> {
  if (!recipientId || !url || !sig) return false;
  return safeEqual(await sign(`click:${recipientId}:${url}`), sig);
}
