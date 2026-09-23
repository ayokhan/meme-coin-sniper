/**
 * Daily Market Brief + Daily Market Wrap email HTML (NovaStaris dark digest).
 */
import type { FuturesWrapItem } from "@/lib/futures-daily-wrap";
import { FUTURES_WRAP_APP_URL } from "@/lib/futures-daily-wrap";
import {
  NOVASTARIS_SOCIAL,
  PLAY_STORE_BADGE_IMG,
  PLAY_STORE_URL,
} from "@/lib/app-distribution";

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const ACCENT = "#14b8a6"; // NovaStaris teal

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Highlight known keywords in orange (case-sensitive match against highlights list). */
export function highlightWrapText(text: string, highlights: string[]): string {
  if (!highlights.length) return escapeHtml(text);
  const sorted = [...highlights].filter(Boolean).sort((a, b) => b.length - a.length);
  const escaped = sorted.map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!escaped.length) return escapeHtml(text);
  const re = new RegExp(`(${escaped.join("|")})`, "g");
  const parts = text.split(re);
  return parts
    .map((part) => {
      if (sorted.some((h) => h === part)) {
        return `<span style="color:${ACCENT};font-weight:700;">${escapeHtml(part)}</span>`;
      }
      return escapeHtml(part);
    })
    .join("");
}

function itemRows(items: FuturesWrapItem[]): string {
  return items
    .map(
      (item, i) => `
      <tr>
        <td style="padding:0 0 14px 0;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#18181b;border:1px solid #27272a;border-radius:12px;">
            <tr>
              <td style="padding:14px 16px;">
                <p style="margin:0 0 6px 0;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#71717a;">${i + 1}</p>
                <p style="margin:0;font-size:15px;line-height:1.55;color:#e4e4e7;">
                  ${highlightWrapText(item.text, item.highlights)}
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>`
    )
    .join("");
}

function sectionHeading(label: string): string {
  return `
    <tr>
      <td style="padding:8px 0 12px 0;">
        <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};">
          ${escapeHtml(label)}
        </p>
      </td>
    </tr>`;
}

function ctaButton(label: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px auto 8px auto;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="${ACCENT}" style="border-radius:10px;background:${ACCENT};">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#0a0a0b;text-decoration:none;border-radius:10px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`;
}

function howToUseBlock(): string {
  return `
    <tr>
      <td style="padding:8px 0 4px 0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;">
          <tr>
            <td style="padding:16px 18px;">
              <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};">How to use this brief</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:#cbd5e1;">1. Skim Hot Topics for the day’s narrative.</p>
              <p style="margin:0 0 8px 0;font-size:14px;line-height:1.55;color:#cbd5e1;">2. Open Daily Wrap in-app for mark prices, funding, and movers.</p>
              <p style="margin:0;font-size:14px;line-height:1.55;color:#cbd5e1;">3. Use Chart AI / Liquidation Map before you size a trade.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function playStoreFooterBlock(): string {
  const ig = NOVASTARIS_SOCIAL.instagram;
  const tt = NOVASTARIS_SOCIAL.tiktok;
  const x = NOVASTARIS_SOCIAL.x;
  return `
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px 0;">
                <tr>
                  <td align="center" style="padding:0 0 12px 0;">
                    <p style="margin:0 0 10px 0;font-size:12px;color:#a1a1aa;">Trade on the go — NovaStaris is on Google Play</p>
                    <a href="${PLAY_STORE_URL}" style="display:inline-block;text-decoration:none;" target="_blank" rel="noopener noreferrer">
                      <img src="${PLAY_STORE_BADGE_IMG}" alt="Get it on Google Play" width="155" height="60" style="display:block;width:155px;max-width:155px;height:auto;border:0;" />
                    </a>
                  </td>
                </tr>
                <tr>
                  <td align="center">
                    <p style="margin:0;font-size:12px;line-height:1.7;color:#71717a;">
                      <a href="${ig.url}" target="_blank" rel="noopener noreferrer" style="color:#5eead4;text-decoration:underline;">Instagram @${ig.handle}</a>
                      &nbsp;·&nbsp;
                      <a href="${tt.url}" target="_blank" rel="noopener noreferrer" style="color:#5eead4;text-decoration:underline;">TikTok @${tt.handle}</a>
                      &nbsp;·&nbsp;
                      <a href="${x.url}" target="_blank" rel="noopener noreferrer" style="color:#5eead4;text-decoration:underline;">X @${x.handle}</a>
                    </p>
                  </td>
                </tr>
              </table>`;
}

function wrapShell(inner: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0a0a0b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
          ${inner}
          <tr>
            <td style="padding:20px 28px 28px 28px;border-top:1px solid #27272a;">
              ${playStoreFooterBlock()}
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#71717a;">
                Manage preferences in your
                <a href="${APP_ORIGIN}/account" style="color:${ACCENT};text-decoration:underline;">account settings</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#52525b;">
                <a href="${APP_ORIGIN}" style="color:#52525b;text-decoration:none;">novastaris.ai</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

export type MorningBriefEmailArgs = {
  title: string;
  publishedAt: Date | string;
  teaser: FuturesWrapItem[];
  /** When true, include full Hot Topics + Market Updates (full wrap email). */
  full?: boolean;
  hotTopics?: FuturesWrapItem[];
  marketUpdates?: FuturesWrapItem[];
};

/** Short morning teaser → login CTA (default for newsletter). */
export function buildMorningFuturesBriefEmailHtml(args: MorningBriefEmailArgs): string {
  const published =
    typeof args.publishedAt === "string" ? new Date(args.publishedAt) : args.publishedAt;
  const when = published.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  const teaserItems = args.teaser.slice(0, 5);
  const bodyItems = args.full ? null : itemRows(teaserItems);

  const fullBody = args.full
    ? `
      ${sectionHeading("Hot Topics")}
      ${itemRows(args.hotTopics ?? args.teaser)}
      ${sectionHeading("Market Updates")}
      ${itemRows(args.marketUpdates ?? [])}
      ${howToUseBlock()}
    `
    : `
      ${sectionHeading("Today’s Hot Topics")}
      ${bodyItems}
      ${howToUseBlock()}
    `;

  const inner = `
    <tr>
      <td align="center" style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a1a1aa;">NovaStaris · Daily Market Brief</p>
        <p style="margin:0 0 8px 0;font-size:24px;line-height:1.25;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">
          ${escapeHtml(args.title)}
        </p>
        <p style="margin:0 0 8px 0;font-size:12px;color:#71717a;">${escapeHtml(when)} UTC</p>
        <p style="margin:0 0 20px 0;font-size:14px;line-height:1.5;color:#a1a1aa;max-width:440px;">
          A quick read on perp narratives and market structure — then open the full Daily Wrap for prices, funding, and movers.
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 28px 8px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${fullBody}
        </table>
        ${ctaButton(args.full ? "Open Daily Wrap in app" : "Read full Market Wrap in app", FUTURES_WRAP_APP_URL)}
        <p style="margin:12px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Or open <a href="${FUTURES_WRAP_APP_URL}" style="color:${ACCENT};">Daily Wrap</a> · Chart AI · Liquidation Map
        </p>
      </td>
    </tr>`;

  return wrapShell(inner);
}

export function morningFuturesBriefSubject(title: string): string {
  // "Daily Market Wrap | Aug 21" → "Daily Market Brief | Aug 21"
  const datePart = title.includes("|") ? title.split("|").slice(1).join("|").trim() : title;
  return `Daily Market Brief | ${datePart}`;
}

/** Plain-text fallback body for admin presets / logs. */
export function morningFuturesBriefPlainBody(teaser: FuturesWrapItem[]): string {
  const lines = teaser.map((t) => `• ${t.text}`);
  return [
    "Your Daily Market Brief is ready.",
    "",
    "Today’s Hot Topics",
    ...lines,
    "",
    "How to use this brief",
    "1. Skim Hot Topics for the day’s narrative.",
    "2. Open Daily Wrap in-app for mark prices, funding, and movers.",
    "3. Use Chart AI / Liquidation Map before you size a trade.",
    "",
    `Open the full Daily Market Wrap: ${FUTURES_WRAP_APP_URL}`,
    "",
    `Get it on Google Play: ${PLAY_STORE_URL}`,
    `Instagram @${NOVASTARIS_SOCIAL.instagram.handle}: ${NOVASTARIS_SOCIAL.instagram.url}`,
    `TikTok @${NOVASTARIS_SOCIAL.tiktok.handle}: ${NOVASTARIS_SOCIAL.tiktok.url}`,
    `X @${NOVASTARIS_SOCIAL.x.handle}: ${NOVASTARIS_SOCIAL.x.url}`,
  ].join("\n");
}
