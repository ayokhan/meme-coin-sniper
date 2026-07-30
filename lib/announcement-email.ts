import { prisma } from "@/lib/db";
import { partnerLogosEmailHtml, type PartnerBrandEmail } from "@/lib/partner-logos-email";
import { sendEmailDetailed } from "@/lib/send-email";

export type AnnouncementAudience = "newsletter" | "all";

export type AnnouncementEmailTemplate = "default" | "forex-rebate" | "affiliate";

export type AnnouncementEmailStats = {
  newsletterCount: number;
  allEmailCount: number;
  newsletterEmails: string[];
  allEmails: string[];
};

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const FOREX_BOTS_URL = `${APP_ORIGIN}/?tab=nova-forex-bot#forex-partner-rebate`;
const AFFILIATE_URL = `${APP_ORIGIN}/affiliate`;

/** NovaStaris-only email header (no partner logo). */
function novaBrandHeaderEmailHtml(eyebrow: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0;border-collapse:collapse;">
  <tr>
    <td align="center" style="background:#0a0a0b;background-image:linear-gradient(135deg,#0a0a0b 0%,#18181b 50%,#1e1b4b 100%);padding:28px 24px 24px 24px;">
      <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a1a1aa;">
        ${escapeHtml(eyebrow)}
      </p>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:22px;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">NovaStaris</p>
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
      `<${tag} style="margin:0 0 16px 0;padding-left:20px;color:#3f3f46;">${listItems
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
        `<p style="margin:20px 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#18181b;">${escapeHtml(line)}</p>`
      );
    } else {
      parts.push(`<p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3f3f46;">${escapeHtml(line)}</p>`);
    }
  }
  flushList();
  return parts.join("");
}

function ctaButtonHtml(label: string, url: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px auto 8px auto;border-collapse:collapse;">
  <tr>
    <td align="center" bgcolor="#0d9488" style="border-radius:10px;background:#0d9488;">
      <a href="${escapeHtml(url)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">
        ${escapeHtml(label)}
      </a>
    </td>
  </tr>
</table>`.trim();
}

function emailShell(inner: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
<body style="margin:0;padding:0;background:#e4e4e7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#e4e4e7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #d4d4d8;">
          ${inner}
          <tr>
            <td style="padding:20px 28px 28px 28px;border-top:1px solid #f4f4f5;">
              <p style="margin:0 0 6px 0;font-size:12px;line-height:1.5;color:#71717a;">
                You received this from NovaStaris. Manage preferences in your
                <a href="${APP_ORIGIN}/account" style="color:#0d9488;text-decoration:underline;">account settings</a>.
              </p>
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                <a href="${APP_ORIGIN}" style="color:#a1a1aa;text-decoration:none;">novastaris.ai</a>
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
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3f3f46;">Hi there,</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3f3f46;">
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
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#0d9488;font-weight:700;">Partner rebate</p>
        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:#18181b;font-weight:700;">Earn $2 USDC per lot</h1>
        ${introHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#f0fdfa;border:1px solid #99f6e4;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#0f766e;text-transform:uppercase;letter-spacing:0.06em;">The offer</p>
              <p style="margin:0 0 6px 0;font-size:15px;color:#134e4a;"><strong>$2 USDC</strong> for every standard lot you trade</p>
              <p style="margin:0;font-size:15px;color:#134e4a;">Paid to your <strong>Solana USDC wallet</strong></p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#18181b;">How to join</p>
        <ol style="margin:0 0 20px 0;padding-left:20px;color:#3f3f46;font-size:15px;line-height:1.55;">
          <li style="margin:0 0 8px 0;">Sign in to NovaStaris → Focus → Bots → Nova Forex Bots</li>
          <li style="margin:0 0 8px 0;">Tap “Register on TIOmarkets” and open your Unlimited Leverage account through our link</li>
          <li style="margin:0 0 8px 0;">Connect your MT4/MT5 login in NovaStaris</li>
          <li style="margin:0 0 8px 0;">Tap “Submit rebate details” and enter your name, MT login, and Solana USDC wallet</li>
        </ol>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#3f3f46;">
          Once your details are on file and your trading volume is confirmed, we’ll send your rebate in USDC.
        </p>
        ${ctaButtonHtml("Open Nova Forex Bots", FOREX_BOTS_URL)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Or open <a href="${FOREX_BOTS_URL}" style="color:#0d9488;">novastaris.ai → Nova Forex Bots</a>
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
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3f3f46;">Hi there,</p>
      <p style="margin:0 0 14px 0;font-size:15px;line-height:1.55;color:#3f3f46;">
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
        <p style="margin:0 0 6px 0;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#6366f1;font-weight:700;">Earn with NovaStaris</p>
        <h1 style="margin:0 0 16px 0;font-size:24px;line-height:1.25;color:#18181b;font-weight:700;">Earn 10% on VIP referrals</h1>
        ${introHtml}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 20px 0;border-collapse:collapse;">
          <tr>
            <td style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:12px;padding:16px 18px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#4338ca;text-transform:uppercase;letter-spacing:0.06em;">The offer</p>
              <p style="margin:0 0 6px 0;font-size:15px;color:#312e81;"><strong>10%</strong> of the VIP subscription fee when someone you refer subscribes</p>
              <p style="margin:0;font-size:15px;color:#312e81;">Payouts every <strong>Friday</strong> after verification</p>
            </td>
          </tr>
        </table>
        <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:#18181b;">How to join</p>
        <ol style="margin:0 0 20px 0;padding-left:20px;color:#3f3f46;font-size:15px;line-height:1.55;">
          <li style="margin:0 0 8px 0;">Sign in to NovaStaris</li>
          <li style="margin:0 0 8px 0;">Open Affiliate (or go to novastaris.ai/affiliate)</li>
          <li style="margin:0 0 8px 0;">Copy your unique referral link</li>
          <li style="margin:0 0 8px 0;">Share it with friends</li>
        </ol>
        <p style="margin:0 0 20px 0;font-size:15px;line-height:1.55;color:#3f3f46;">
          When they subscribe to VIP through your link, you earn 10%. Commissions start as Pending verification, then get marked Paid.
        </p>
        ${ctaButtonHtml("Get your referral link", AFFILIATE_URL)}
        <p style="margin:20px 0 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">
          Or open <a href="${AFFILIATE_URL}" style="color:#6366f1;">novastaris.ai/affiliate</a>
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

  const header = args.includePartnerLogos ? partnerLogosEmailHtml(args.partnerBrand ?? "blofin") : "";
  const cta =
    args.ctaLabel && args.ctaUrl
      ? `<div style="margin:20px 0;text-align:center;">${ctaButtonHtml(args.ctaLabel, args.ctaUrl)}</div>`
      : "";

  const inner = `
    ${header ? `<tr><td style="padding:0;">${header}</td></tr>` : ""}
    <tr>
      <td style="padding:28px;">
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

function normalizeEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

async function fetchUserEmails(): Promise<Array<{ email: string | null; newsletterOptIn: boolean }>> {
  return (
    prisma as unknown as {
      user: {
        findMany: (args: {
          where: { email: { not: null } };
          select: { email: true; newsletterOptIn: true };
        }) => Promise<Array<{ email: string | null; newsletterOptIn: boolean }>>;
      };
    }
  ).user.findMany({
    where: { email: { not: null } },
    select: { email: true, newsletterOptIn: true },
  });
}

export async function getAnnouncementEmailStats(): Promise<AnnouncementEmailStats> {
  const users = await fetchUserEmails();

  const allEmails: string[] = [];
  const newsletterEmails: string[] = [];
  const allSet = new Set<string>();
  const newsletterSet = new Set<string>();

  for (const u of users) {
    const email = normalizeEmail(u.email ?? "");
    if (!email) continue;
    if (!allSet.has(email)) {
      allSet.add(email);
      allEmails.push(email);
    }
    if (u.newsletterOptIn && !newsletterSet.has(email)) {
      newsletterSet.add(email);
      newsletterEmails.push(email);
    }
  }

  allEmails.sort();
  newsletterEmails.sort();

  return {
    newsletterCount: newsletterEmails.length,
    allEmailCount: allEmails.length,
    newsletterEmails,
    allEmails,
  };
}

export function getRecipientsForAudience(
  stats: AnnouncementEmailStats,
  audience: AnnouncementAudience
): string[] {
  return audience === "newsletter" ? [...stats.newsletterEmails] : [...stats.allEmails];
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
}): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
  const subject = args.subject.trim();
  const body = args.body.trim();
  const format = args.format === "plain" ? "plain" : "rich";
  if (!subject) throw new Error("Subject is required.");
  if (!body && !(format === "rich" && (args.template === "forex-rebate" || args.template === "affiliate"))) {
    throw new Error("Message body is required.");
  }

  let recipients: string[];
  if (args.recipients && args.recipients.length > 0) {
    recipients = [...new Set(args.recipients.map((e) => normalizeEmail(e)).filter(Boolean) as string[])];
  } else {
    const stats = await getAnnouncementEmailStats();
    recipients = getRecipientsForAudience(stats, args.audience ?? "newsletter");
  }

  if (recipients.length === 0) throw new Error("No valid recipient emails.");

  const html = buildAnnouncementEmailHtml({
    body: body || " ",
    includePartnerLogos: !!args.includePartnerLogos,
    partnerBrand: args.partnerBrand ?? "blofin",
    ctaLabel: args.ctaLabel,
    ctaUrl: args.ctaUrl,
    template: args.template ?? "default",
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

  return { sent, failed, total: recipients.length, errors };
}
