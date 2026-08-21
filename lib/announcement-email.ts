import { prisma } from "@/lib/db";
import { partnerLogosEmailHtml, type PartnerBrandEmail } from "@/lib/partner-logos-email";
import { sendEmailDetailed } from "@/lib/send-email";
import {
  buildMorningFuturesBriefEmailHtml,
} from "@/lib/futures-daily-wrap-email";
import type { FuturesWrapItem } from "@/lib/futures-daily-wrap";

export type AnnouncementAudience = "newsletter" | "all";

export type AnnouncementEmailTemplate =
  | "default"
  | "forex-rebate"
  | "affiliate"
  | "welcome"
  | "nova-branded"
  | "why-traders"
  | "futures-morning-brief";

export type RecentRegistrant = {
  email: string;
  name: string | null;
  createdAt: string;
  newsletterOptIn: boolean;
};

export type AnnouncementEmailStats = {
  newsletterCount: number;
  allEmailCount: number;
  newsletterEmails: string[];
  allEmails: string[];
  /** Users with email registered in the last 30 days (newest first). */
  recentRegistrants: RecentRegistrant[];
  freeEmails: string[];
  vipEmails: string[];
  inactive7dEmails: string[];
  /** Active VIP trial (isTrial + not expired). */
  trialEmails: string[];
  /** Trial ending within ~36h (or already past reminder window). */
  trialExpiringEmails: string[];
  freeCount: number;
  vipCount: number;
  inactive7dCount: number;
  trialCount: number;
  trialExpiringCount: number;
};

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const FOREX_BOTS_URL = `${APP_ORIGIN}/?tab=nova-forex-bot#forex-partner-rebate`;
const AFFILIATE_URL = `${APP_ORIGIN}/affiliate`;
const START_HERE_URL = `${APP_ORIGIN}/start-here`;
const ENTER_URL = `${APP_ORIGIN}/enter`;

/** NovaStaris-only email header (no partner logo). Premium dark standard. */
function novaBrandHeaderEmailHtml(eyebrow: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;">
  <tr>
    <td align="center" style="background:#0a0a0b;background-image:linear-gradient(160deg,#0a0a0b 0%,#18181b 55%,#134e4a 140%);padding:32px 24px 28px 24px;">
      <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#5eead4;">
        ${escapeHtml(eyebrow)}
      </p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">NovaStaris</p>
    </td>
  </tr>
</table>`.trim();
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Turn plain admin body into readable HTML (paragraphs + lists). */
export function announcementBodyToHtml(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").trim().split("\n");
  const parts: string[] = [];
  let listType: "ul" | "ol" | null = null;
  let listItems: string[] = [];

  const flushList = () => {
    if (!listType || listItems.length === 0) {
      listType = null;
      listItems = [];
      return;
    }
    const tag = listType;
    parts.push(
      `<${tag} style="margin:0 0 16px 0;padding-left:20px;color:#d4d4d8;">${listItems
        .map((li) => `<li style="margin:0 0 6px 0;">${li}</li>`)
        .join("")}</${tag}>`
    );
    listType = null;
    listItems = [];
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      flushList();
      continue;
    }

    const bullet = line.match(/^([•\-\*])\s+(.*)$/);
    const numbered = line.match(/^(\d+)[.)]\s+(.*)$/);

    if (bullet) {
      if (listType && listType !== "ul") flushList();
      listType = "ul";
      listItems.push(escapeHtml(bullet[2]));
      continue;
    }
    if (numbered) {
      if (listType && listType !== "ol") flushList();
      listType = "ol";
      listItems.push(escapeHtml(numbered[2]));
      continue;
    }

    flushList();

    // Short title-like lines become section headings
    const isHeading =
      line.length <= 40 &&
      !line.endsWith(".") &&
      !line.endsWith("?") &&
      !line.includes("http") &&
      /^[A-Za-z0-9$]/.test(line);

    if (isHeading && !line.toLowerCase().startsWith("hi ")) {
      parts.push(
        `<p style="margin:20px 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5eead4;">${escapeHtml(line)}</p>`
      );
    } else {
      parts.push(`<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">${escapeHtml(line)}</p>`);
    }
  }
  flushList();
  return parts.join("");
}

function ctaButtonHtml(label: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 8px auto;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="#14b8a6" style="border-radius:10px;background:#14b8a6;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#042f2e;text-decoration:none;border-radius:10px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`.trim();
}

/** Premium dark shell — shared standard for all rich NovaStaris emails. */
function emailShell(inner: string): string {
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
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#71717a;">
                You received this from NovaStaris. Manage preferences in your
                <a href="${APP_ORIGIN}/account" style="color:#5eead4;text-decoration:underline;">account settings</a>.
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

/** Polished $2/lot rebate marketing email (structured layout + CTA). */
export function buildForexRebateEmailHtml(args: {
  partnerBrand?: PartnerBrandEmail;
  body?: string;
}): string {
  const partner = args.partnerBrand ?? "tiomarkets";
  const customBody = (args.body ?? "").trim();
  const introHtml = customBody
    ? announcementBodyToHtml(customBody)
    : `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">Hi there,</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
        We’re sharing a simple rebate with NovaStaris members who trade forex through our TIOmarkets partnership.
      </p>`;

  const inner = `
    <tr>
      <td style="padding:0;">
        ${partnerLogosEmailHtml(partner)}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5eead4;font-weight:700;">Partner rebate</p>
        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:#fafafa;font-weight:700;">Earn $2 USDC per lot</h1>
        ${introHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#134e4a;border:1px solid #0f766e;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.06em;">The offer</p>
              <p style="margin:0 0 6px 0;font-size:15px;color:#ccfbf1;"><strong>$2 USDC</strong> for every standard lot you trade</p>
              <p style="margin:0;font-size:15px;color:#ccfbf1;">Paid to your <strong>Solana USDC wallet</strong></p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5eead4;">How to join</p>
        <ol style="margin:0 0 20px 0;padding-left:20px;color:#d4d4d8;font-size:15px;line-height:1.55;">
          <li style="margin:0 0 8px 0;">Sign in to NovaStaris → Focus → Bots → Nova Forex Bots</li>
          <li style="margin:0 0 8px 0;">Tap “Register on TIOmarkets” and open your Unlimited Leverage account through our link</li>
          <li style="margin:0 0 8px 0;">Connect your MT4/MT5 login in NovaStaris</li>
          <li style="margin:0 0 8px 0;">Tap “Submit rebate details” and enter your name, MT login, and Solana USDC wallet</li>
        </ol>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
          Once your details are on file and your trading volume is confirmed, we’ll send your rebate in USDC.
        </p>
        ${ctaButtonHtml("Open Nova Forex Bots", FOREX_BOTS_URL)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Or open <a href="${FOREX_BOTS_URL}" style="color:#5eead4;">novastaris.ai → Nova Forex Bots</a>
        </p>
      </td>
    </tr>`;

  return emailShell(inner);
}

/** Generic NovaStaris-branded email: dark banner + body + optional CTA. */
export function buildNovaBrandedEmailHtml(args: {
  body: string;
  eyebrow?: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const cta =
    args.ctaLabel && args.ctaUrl
      ? `<div style="margin:8px 0 8px 0;text-align:center;">${ctaButtonHtml(args.ctaLabel, args.ctaUrl)}</div>`
      : "";

  const inner = `
    <tr>
      <td style="padding:0;">
        ${novaBrandHeaderEmailHtml(args.eyebrow ?? "NovaStaris")}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        ${announcementBodyToHtml(args.body)}
        ${cta}
      </td>
    </tr>`;

  return emailShell(inner);
}

/** Dark campaign shell: blue frame + charcoal card. */
function whyTradersEmailShell(inner: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#2563eb;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#2563eb" style="background:#2563eb;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#18181b" style="max-width:560px;background:#18181b;border-radius:16px;overflow:hidden;">
          ${inner}
          <tr>
            <td bgcolor="#18181b" style="padding:20px 28px 28px 28px;border-top:1px solid #27272a;">
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#a1a1aa;">
                You received this from NovaStaris. Manage preferences in your
                <a href="${APP_ORIGIN}/account" style="color:#5eead4;text-decoration:underline;">account settings</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#71717a;">
                <a href="${APP_ORIGIN}" style="color:#71717a;text-decoration:none;">novastaris.ai</a>
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

function whyTradersCtaButtonHtml(label: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 8px auto;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="#14b8a6" style="border-radius:10px;background:#14b8a6;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#042f2e;text-decoration:none;border-radius:10px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`.trim();
}

/** Brand blast: punchy hero + “on NovaStaris you can” list. */
export function buildWhyTradersEmailHtml(args?: {
  body?: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
}): string {
  const customBody = (args?.body ?? "").trim();
  const ctaLabel = args?.ctaLabel?.trim() || "Choose your desk";
  const ctaUrl = args?.ctaUrl?.trim() || ENTER_URL;
  const introHtml = customBody
    ? `<td bgcolor="#0a0a0b" style="padding:28px 28px 8px 28px;background:#0a0a0b;">
        ${announcementBodyToHtml(customBody)}
        <div style="margin:8px 0 8px 0;text-align:center;">${ctaButtonHtml(ctaLabel, ctaUrl)}</div>
      </td>`
    : `<td bgcolor="#18181b" style="padding:28px 28px 8px 28px;background:#18181b;">
        <p style="margin:0 0 18px 0;font-size:16px;line-height:1.55;color:#e4e4e7;font-style:italic;">
          The best traders don&apos;t wait for a signal — they trade where it starts.
        </p>
        <p style="margin:0 0 12px 0;font-size:15px;color:#fafafa;">On NovaStaris you can:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#27272a;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.45;color:#f4f4f5;">Hunt new Solana and BSC pairs as they appear</p>
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.45;color:#f4f4f5;">Follow wallets that already moved</p>
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.45;color:#f4f4f5;">Run AI on a contract — buy zone, take profit &amp; stop loss</p>
              <p style="margin:0 0 10px 0;font-size:15px;line-height:1.45;color:#f4f4f5;">Read crypto futures and forex from one desk</p>
              <p style="margin:0;font-size:15px;line-height:1.45;color:#f4f4f5;">Learn the playbook free in Trading University</p>
            </td>
          </tr>
        </table>
        ${whyTradersCtaButtonHtml(ctaLabel, ctaUrl)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#a1a1aa;text-align:center;">
          Questions? Use Chat or Support in the app — this inbox is not monitored.<br />
          Or open <a href="${ENTER_URL}" style="color:#5eead4;">novastaris.ai/enter</a>
        </p>
      </td>`;

  const inner = `
    <tr>
      <td align="center" bgcolor="#1e1b4b" style="background:#1e1b4b;background-image:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 52%,#7c3aed 100%);padding:36px 28px 32px 28px;">
        <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#c7d2fe;">
          NovaStaris
        </p>
        <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:26px;line-height:1.25;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">
          Where top traders make their first move
        </p>
      </td>
    </tr>
    <tr>
      ${introHtml}
    </tr>`;

  return whyTradersEmailShell(inner);
}

/** Polished welcome / Start here email with NovaStaris brand banner. */
export function buildWelcomeEmailHtml(args?: { body?: string }): string {
  const customBody = (args?.body ?? "").trim();
  const introHtml = customBody
    ? announcementBodyToHtml(customBody)
    : `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">Hi there,</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
        Welcome to NovaStaris. You&apos;re in — the dashboard has many tabs, so don&apos;t open everything on day one.
        Pick one path below and start there.
      </p>`;

  const pathsBlock = customBody
    ? ""
    : `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#134e4a;border:1px solid #0f766e;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 10px 0;font-size:13px;font-weight:700;color:#5eead4;text-transform:uppercase;letter-spacing:0.06em;">Pick your path</p>
              <p style="margin:0 0 8px 0;font-size:15px;color:#ccfbf1;"><strong>1. Meme coin hunter</strong> — Go Hunting, Trending, Surge, then AI Agent</p>
              <p style="margin:0 0 8px 0;font-size:15px;color:#ccfbf1;"><strong>2. Crypto futures</strong> — Crypto Futures. VIP: NovaForecast</p>
              <p style="margin:0 0 8px 0;font-size:15px;color:#ccfbf1;"><strong>3. Forex trading</strong> — Nova Forex Agent (XAUUSD, FX, indices)</p>
              <p style="margin:0 0 8px 0;font-size:15px;color:#ccfbf1;"><strong>4. Wallet tracking</strong> — Wallet Tracker, Coach Calls</p>
              <p style="margin:0;font-size:15px;color:#ccfbf1;"><strong>5. Prediction markets</strong> — Nova Polymarket</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
          Need the full map of every major tab? Open <strong>Start here</strong>.
        </p>`;

  const inner = `
    <tr>
      <td style="padding:0;">
        ${novaBrandHeaderEmailHtml("Welcome")}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#5eead4;font-weight:700;">Welcome to NovaStaris</p>
        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:#fafafa;font-weight:700;">Start here — pick one path</h1>
        ${introHtml}
        ${pathsBlock}
        ${ctaButtonHtml("Open Start here", START_HERE_URL)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Stuck? Use Chat or Support in the app at novastaris.ai — this inbox is not monitored.<br />
          Or open <a href="${START_HERE_URL}" style="color:#5eead4;">novastaris.ai/start-here</a>
        </p>
      </td>
    </tr>`;

  return emailShell(inner);
}

/** Polished affiliate program marketing email. */
export function buildAffiliateEmailHtml(args?: { body?: string }): string {
  const customBody = (args?.body ?? "").trim();
  const introHtml = customBody
    ? announcementBodyToHtml(customBody)
    : `
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">Hi there,</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
        You can now earn with the NovaStaris Affiliate Program — share your link and get paid when friends go VIP.
      </p>`;

  const inner = `
    <tr>
      <td style="padding:0;">
        ${novaBrandHeaderEmailHtml("Affiliate program")}
      </td>
    </tr>
    <tr>
      <td style="padding:28px 28px 8px 28px;">
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#a5b4fc;font-weight:700;">Earn with NovaStaris</p>
        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:#fafafa;font-weight:700;">Earn 10% on VIP referrals</h1>
        ${introHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#1e1b4b;border:1px solid #4338ca;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#a5b4fc;text-transform:uppercase;letter-spacing:0.06em;">The offer</p>
              <p style="margin:0 0 6px 0;font-size:15px;color:#e0e7ff;"><strong>10%</strong> of the VIP subscription fee when someone you refer subscribes</p>
              <p style="margin:0;font-size:15px;color:#e0e7ff;">Payouts every <strong>Friday</strong> after verification</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#5eead4;">How to join</p>
        <ol style="margin:0 0 20px 0;padding-left:20px;color:#d4d4d8;font-size:15px;line-height:1.55;">
          <li style="margin:0 0 8px 0;">Sign in to NovaStaris</li>
          <li style="margin:0 0 8px 0;">Open Affiliate (or go to novastaris.ai/affiliate)</li>
          <li style="margin:0 0 8px 0;">Copy your unique referral link</li>
          <li style="margin:0 0 8px 0;">Share it with friends</li>
        </ol>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#e4e4e7;">
          When they subscribe to VIP through your link, you earn 10%. Commissions start as Pending verification, then get marked Paid.
        </p>
        ${ctaButtonHtml("Get your referral link", AFFILIATE_URL)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Or open <a href="${AFFILIATE_URL}" style="color:#a5b4fc;">novastaris.ai/affiliate</a>
        </p>
      </td>
    </tr>`;

  return emailShell(inner);
}

/** Original-style plain email: escaped text + line breaks (easy to match WhatsApp copy). */
export function buildPlainAnnouncementEmailHtml(args: {
  body: string;
  includePartnerLogos?: boolean;
  partnerBrand?: PartnerBrandEmail;
}): string {
  const header = args.includePartnerLogos ? partnerLogosEmailHtml(args.partnerBrand ?? "blofin") : "";
  const bodyHtml = escapeHtml(args.body.trim()).replace(/\n/g, "<br />");
  const parts = [
    header,
    `<p style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.55;color:#18181b;">${bodyHtml}</p>`,
    `<p style="margin-top:24px;font-size:12px;color:#666;">You received this from NovaStaris. Manage newsletter preferences in your account settings.</p>`,
    `<p style="font-size:12px;color:#666;"><a href="${APP_ORIGIN}/account">novastaris.ai/account</a></p>`,
  ];
  return parts.filter(Boolean).join("");
}

export function buildAnnouncementEmailHtml(args: {
  body: string;
  includePartnerLogos?: boolean;
  partnerBrand?: PartnerBrandEmail;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  template?: AnnouncementEmailTemplate;
  /** rich = polished card/CTA; plain = original text + optional logos */
  format?: "rich" | "plain";
}): string {
  if (args.format === "plain") {
    return buildPlainAnnouncementEmailHtml({
      body: args.body,
      includePartnerLogos: args.includePartnerLogos,
      partnerBrand: args.partnerBrand,
    });
  }

  if (args.template === "forex-rebate") {
    return buildForexRebateEmailHtml({
      partnerBrand: args.partnerBrand ?? "tiomarkets",
      // If body is the default loaded template, use structured HTML instead of dumping it twice
      body: shouldUseCustomRebateIntro(args.body) ? args.body : undefined,
    });
  }

  if (args.template === "affiliate") {
    return buildAffiliateEmailHtml({
      body: shouldUseCustomAffiliateIntro(args.body) ? args.body : undefined,
    });
  }

  if (args.template === "welcome") {
    return buildWelcomeEmailHtml({
      body: shouldUseCustomWelcomeIntro(args.body) ? args.body : undefined,
    });
  }

  if (args.template === "why-traders") {
    return buildWhyTradersEmailHtml({
      body: shouldUseCustomWhyTradersIntro(args.body) ? args.body : undefined,
      ctaLabel: args.ctaLabel,
      ctaUrl: args.ctaUrl,
    });
  }

  if (args.template === "nova-branded") {
    return buildNovaBrandedEmailHtml({
      body: args.body,
      eyebrow: "Next step",
      ctaLabel: args.ctaLabel,
      ctaUrl: args.ctaUrl,
    });
  }

  if (args.template === "futures-morning-brief") {
    // Prefer structured body from admin; otherwise treat lines as teaser bullets
    const lines = args.body
      .split(/\n/)
      .map((l) => l.replace(/^([•\-\*]|\d+[.)])\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    const teaser: FuturesWrapItem[] = lines.map((text, i) => ({
      id: `manual-${i}`,
      text,
      highlights: [],
    }));
    if (teaser.length === 0) {
      teaser.push({
        id: "fallback",
        text: "Your Daily Market Wrap is ready in Crypto Futures — open the app for Hot Topics and Market Updates.",
        highlights: ["Daily Market Wrap", "Crypto Futures"],
      });
    }
    return buildMorningFuturesBriefEmailHtml({
      title: "Daily Market Wrap",
      publishedAt: new Date(),
      teaser,
      full: false,
    });
  }

  const header = args.includePartnerLogos ? partnerLogosEmailHtml(args.partnerBrand ?? "blofin") : "";
  const cta =
    args.ctaLabel && args.ctaUrl
      ? `<div style="margin:20px 0;text-align:center;">${ctaButtonHtml(args.ctaLabel, args.ctaUrl)}</div>`
      : "";

  const inner = `
    ${header ? `<tr><td style="padding:0;">${header}</td></tr>` : ""}
    <tr>
      <td style="padding:28px;">
        ${!header ? novaBrandHeaderEmailHtml("NovaStaris") : ""}
        ${announcementBodyToHtml(args.body)}
        ${cta}
      </td>
    </tr>`;

  return emailShell(inner);
}

/** Detect if admin left the stock rebate body (avoid duplicating the structured template). */
function shouldUseCustomRebateIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  // Stock template contains these section headers — treat as default and use structured HTML only
  if (t.includes("The offer") && t.includes("How to join") && t.includes("$2 USDC")) return false;
  return true;
}

function shouldUseCustomAffiliateIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (t.includes("The offer") && t.includes("How to join") && t.includes("10%")) return false;
  return true;
}

function shouldUseCustomWelcomeIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  // Stock welcome template — use structured HTML (banner + path card + CTA)
  if (t.includes("Pick your path") && t.includes("Meme coin hunter") && t.includes("start-here")) return false;
  return true;
}

function shouldUseCustomWhyTradersIntro(body: string): boolean {
  const t = body.trim();
  if (!t) return false;
  if (
    t.includes("On NovaStaris you can") &&
    t.includes("trade where it starts") &&
    t.includes("/enter")
  ) {
    return false;
  }
  return true;
}

function normalizeEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

type UserEmailRow = {
  id: string;
  email: string | null;
  name: string | null;
  newsletterOptIn: boolean;
  createdAt: Date;
};

async function fetchUserEmails(): Promise<UserEmailRow[]> {
  return (
    prisma as unknown as {
      user: {
        findMany: (args: {
          where: { email: { not: null } };
          select: { id: true; email: true; name: true; newsletterOptIn: true; createdAt: true };
          orderBy: { createdAt: "desc" };
        }) => Promise<UserEmailRow[]>;
      };
    }
  ).user.findMany({
    where: { email: { not: null } },
    select: { id: true, email: true, name: true, newsletterOptIn: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAnnouncementEmailStats(): Promise<AnnouncementEmailStats> {
  const users = await fetchUserEmails();
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const inactiveCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const now = new Date();

  const allEmails: string[] = [];
  const newsletterEmails: string[] = [];
  const recentRegistrants: RecentRegistrant[] = [];
  const freeEmails: string[] = [];
  const vipEmails: string[] = [];
  const inactive7dEmails: string[] = [];
  const trialEmails: string[] = [];
  const trialExpiringEmails: string[] = [];
  const allSet = new Set<string>();
  const newsletterSet = new Set<string>();
  const recentSet = new Set<string>();
  const freeSet = new Set<string>();
  const vipSet = new Set<string>();
  const inactiveSet = new Set<string>();
  const trialSet = new Set<string>();
  const trialExpiringSet = new Set<string>();

  const userIdByEmail = new Map<string, string>();
  for (const u of users) {
    const email = normalizeEmail(u.email ?? "");
    if (!email) continue;
    userIdByEmail.set(email, u.id);
    if (!allSet.has(email)) {
      allSet.add(email);
      allEmails.push(email);
    }
    if (u.newsletterOptIn && !newsletterSet.has(email)) {
      newsletterSet.add(email);
      newsletterEmails.push(email);
    }
    const createdMs = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
    if (createdMs >= cutoff && !recentSet.has(email)) {
      recentSet.add(email);
      recentRegistrants.push({
        email,
        name: u.name ?? null,
        createdAt: u.createdAt instanceof Date ? u.createdAt.toISOString() : String(u.createdAt),
        newsletterOptIn: !!u.newsletterOptIn,
      });
    }
  }

  // Active VIP: subscription with expiresAt > now (or no expires if present as legacy active)
  let vipUserIds = new Set<string>();
  const trialUserIds = new Set<string>();
  const trialExpiringUserIds = new Set<string>();
  try {
    const subs = await (
      prisma as unknown as {
        subscription: {
          findMany: (args: unknown) => Promise<
            Array<{
              userId: string;
              expiresAt: Date | null;
              isTrial?: boolean;
              trialEndsAt?: Date | null;
            }>
          >;
        };
      }
    ).subscription.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { userId: true, expiresAt: true, isTrial: true, trialEndsAt: true },
    });
    vipUserIds = new Set(subs.map((s) => s.userId));
    const expireSoon = now.getTime() + 36 * 60 * 60 * 1000;
    for (const s of subs) {
      if (!s.isTrial) continue;
      trialUserIds.add(s.userId);
      const end = s.trialEndsAt ?? s.expiresAt;
      if (end && end.getTime() <= expireSoon) {
        trialExpiringUserIds.add(s.userId);
      }
    }
  } catch {
    /* optional */
  }

  // Last login per user
  const lastLoginByUser = new Map<string, number>();
  try {
    const logins = await (
      prisma as unknown as {
        loginEvent: {
          findMany: (args: unknown) => Promise<Array<{ userId: string; createdAt: Date }>>;
        };
      }
    ).loginEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 5000,
      select: { userId: true, createdAt: true },
    });
    for (const row of logins) {
      if (lastLoginByUser.has(row.userId)) continue;
      lastLoginByUser.set(
        row.userId,
        row.createdAt instanceof Date ? row.createdAt.getTime() : new Date(row.createdAt).getTime()
      );
    }
  } catch {
    /* optional */
  }

  for (const u of users) {
    const email = normalizeEmail(u.email ?? "");
    if (!email) continue;
    const isVip = vipUserIds.has(u.id);
    if (isVip) {
      if (!vipSet.has(email)) {
        vipSet.add(email);
        vipEmails.push(email);
      }
    } else if (!freeSet.has(email)) {
      freeSet.add(email);
      freeEmails.push(email);
    }

    if (trialUserIds.has(u.id) && !trialSet.has(email)) {
      trialSet.add(email);
      trialEmails.push(email);
    }
    if (trialExpiringUserIds.has(u.id) && !trialExpiringSet.has(email)) {
      trialExpiringSet.add(email);
      trialExpiringEmails.push(email);
    }

    const lastLogin = lastLoginByUser.get(u.id);
    const createdMs = u.createdAt instanceof Date ? u.createdAt.getTime() : new Date(u.createdAt).getTime();
    const lastActive = lastLogin ?? createdMs;
    if (lastActive < inactiveCutoff && !inactiveSet.has(email)) {
      inactiveSet.add(email);
      inactive7dEmails.push(email);
    }
  }

  allEmails.sort();
  newsletterEmails.sort();
  freeEmails.sort();
  vipEmails.sort();
  inactive7dEmails.sort();
  trialEmails.sort();
  trialExpiringEmails.sort();

  return {
    newsletterCount: newsletterEmails.length,
    allEmailCount: allEmails.length,
    newsletterEmails,
    allEmails,
    recentRegistrants,
    freeEmails,
    vipEmails,
    inactive7dEmails,
    trialEmails,
    trialExpiringEmails,
    freeCount: freeEmails.length,
    vipCount: vipEmails.length,
    inactive7dCount: inactive7dEmails.length,
    trialCount: trialEmails.length,
    trialExpiringCount: trialExpiringEmails.length,
  };
}

export function getRecipientsForAudience(
  stats: AnnouncementEmailStats,
  audience: AnnouncementAudience
): string[] {
  return audience === "newsletter" ? [...stats.newsletterEmails] : [...stats.allEmails];
}

export type AnnouncementEmailCampaignRow = {
  id: string;
  subject: string;
  template: string;
  format: string;
  audience: string;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  partnerBrand: string | null;
  createdByUserId: string | null;
  createdAt: string;
};

function campaignDb() {
  return prisma as unknown as {
    announcementEmailCampaign: {
      create: (args: { data: Record<string, unknown> }) => Promise<Record<string, unknown>>;
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };
}

export async function listRecentAnnouncementCampaigns(limit = 20): Promise<AnnouncementEmailCampaignRow[]> {
  try {
    const rows = await campaignDb().announcementEmailCampaign.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(50, Math.max(1, limit)),
    });
    return rows.map((r) => ({
      id: String(r.id),
      subject: String(r.subject ?? ""),
      template: String(r.template ?? "default"),
      format: String(r.format ?? "rich"),
      audience: String(r.audience ?? ""),
      recipientCount: Number(r.recipientCount) || 0,
      sentCount: Number(r.sentCount) || 0,
      failedCount: Number(r.failedCount) || 0,
      partnerBrand: r.partnerBrand != null ? String(r.partnerBrand) : null,
      createdByUserId: r.createdByUserId != null ? String(r.createdByUserId) : null,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt ?? ""),
    }));
  } catch (e) {
    console.warn("listRecentAnnouncementCampaigns:", e);
    return [];
  }
}

export async function sendAnnouncementEmails(args: {
  subject: string;
  body: string;
  audience?: AnnouncementAudience;
  recipients?: string[];
  includePartnerLogos?: boolean;
  partnerBrand?: PartnerBrandEmail;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  template?: AnnouncementEmailTemplate;
  format?: "rich" | "plain";
  createdByUserId?: string | null;
}): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
  const subject = args.subject.trim();
  const body = args.body.trim();
  const format = args.format === "plain" ? "plain" : "rich";
  const template = args.template ?? "default";
  const audience = args.audience ?? "newsletter";
  if (!subject) throw new Error("Subject is required.");
  if (
    !body &&
    !(
      format === "rich" &&
      (template === "forex-rebate" ||
        template === "affiliate" ||
        template === "welcome" ||
        template === "why-traders" ||
        template === "nova-branded" ||
        template === "futures-morning-brief")
    )
  ) {
    throw new Error("Message body is required.");
  }

  let recipients: string[];
  if (args.recipients && args.recipients.length > 0) {
    recipients = [...new Set(args.recipients.map((e) => normalizeEmail(e)).filter(Boolean) as string[])];
  } else {
    const stats = await getAnnouncementEmailStats();
    recipients = getRecipientsForAudience(stats, audience);
  }

  if (recipients.length === 0) throw new Error("No valid recipient emails.");

  const html = buildAnnouncementEmailHtml({
    body: body || " ",
    includePartnerLogos: !!args.includePartnerLogos,
    partnerBrand: args.partnerBrand ?? "blofin",
    ctaLabel: args.ctaLabel,
    ctaUrl: args.ctaUrl,
    template,
    format,
  });

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const to of recipients) {
    const result = await sendEmailDetailed(to, subject, html);
    if (result.ok) {
      sent += 1;
    } else {
      failed += 1;
      if (errors.length < 5) errors.push(`${to}: ${result.error}`);
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  try {
    await campaignDb().announcementEmailCampaign.create({
      data: {
        subject,
        template,
        format,
        audience: args.recipients?.length ? "custom" : audience,
        recipientCount: recipients.length,
        sentCount: sent,
        failedCount: failed,
        partnerBrand: args.includePartnerLogos ? (args.partnerBrand ?? "blofin") : null,
        createdByUserId: args.createdByUserId ?? null,
      },
    });
  } catch (e) {
    console.warn("AnnouncementEmailCampaign create failed:", e);
  }

  if (failed > 0) {
    try {
      const { logSystemError } = await import("@/lib/system-error-log");
      await logSystemError({
        source: "email.announcement",
        message: `Announcement email: ${failed}/${recipients.length} failed`,
        detail: errors.slice(0, 5).join("\n") || null,
        meta: { subject, sent, failed, total: recipients.length },
      });
    } catch {
      /* ignore */
    }
  }

  return { sent, failed, total: recipients.length, errors };
}
