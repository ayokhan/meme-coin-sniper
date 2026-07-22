import { prisma } from "@/lib/db";
import { partnerLogosEmailHtml } from "@/lib/partner-logos-email";
import { sendEmailDetailed } from "@/lib/send-email";

export type AnnouncementAudience = "newsletter" | "all";

export type AnnouncementEmailStats = {
  newsletterCount: number;
  allEmailCount: number;
  newsletterEmails: string[];
  allEmails: string[];
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function announcementBodyToHtml(body: string): string {
  return escapeHtml(body.trim()).replace(/\n/g, "<br />");
}

function normalizeEmail(email: string): string | null {
  const v = email.trim().toLowerCase();
  if (!v || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return null;
  return v;
}

async function fetchUserEmails(): Promise<Array<{ email: string | null; newsletterOptIn: boolean }>> {
  return (prisma as unknown as {
    user: {
      findMany: (args: {
        where: { email: { not: null } };
        select: { email: true; newsletterOptIn: true };
      }) => Promise<Array<{ email: string | null; newsletterOptIn: boolean }>>;
    };
  }).user.findMany({
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
  /** When includePartnerLogos: which logo (default Blofin). */
  partnerBrand?: "blofin" | "vantage" | "tiomarkets";
}): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
  const subject = args.subject.trim();
  const body = args.body.trim();
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message body is required.");

  let recipients: string[];
  if (args.recipients && args.recipients.length > 0) {
    recipients = [...new Set(args.recipients.map((e) => normalizeEmail(e)).filter(Boolean) as string[])];
  } else {
    const stats = await getAnnouncementEmailStats();
    recipients = getRecipientsForAudience(stats, args.audience ?? "newsletter");
  }

  if (recipients.length === 0) throw new Error("No valid recipient emails.");

  const html = [
    args.includePartnerLogos ? partnerLogosEmailHtml(args.partnerBrand ?? "blofin") : "",
    `<p>${announcementBodyToHtml(body)}</p>`,
    `<p style="margin-top:24px;font-size:12px;color:#666;">You received this from NovaStaris. Manage newsletter preferences in your account settings.</p>`,
    `<p style="font-size:12px;color:#666;"><a href="https://novastaris.ai/account">novastaris.ai/account</a></p>`,
  ].join("");

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
