import { prisma } from "@/lib/db";
import { sendEmailDetailed } from "@/lib/send-email";

export type AnnouncementAudience = "newsletter" | "all";

export type AnnouncementEmailStats = {
  newsletterCount: number;
  allEmailCount: number;
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function announcementBodyToHtml(body: string): string {
  return escapeHtml(body.trim()).replace(/\n/g, "<br />");
}

export async function getAnnouncementEmailStats(): Promise<AnnouncementEmailStats> {
  const users = await (prisma as unknown as {
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

  const emails = new Set<string>();
  const newsletterEmails = new Set<string>();
  for (const u of users) {
    const email = u.email?.trim().toLowerCase();
    if (!email) continue;
    emails.add(email);
    if (u.newsletterOptIn) newsletterEmails.add(email);
  }

  return {
    newsletterCount: newsletterEmails.size,
    allEmailCount: emails.size,
  };
}

export async function sendAnnouncementEmails(args: {
  subject: string;
  body: string;
  audience: AnnouncementAudience;
}): Promise<{ sent: number; failed: number; total: number; errors: string[] }> {
  const subject = args.subject.trim();
  const body = args.body.trim();
  if (!subject) throw new Error("Subject is required.");
  if (!body) throw new Error("Message body is required.");

  const users = await (prisma as unknown as {
    user: {
      findMany: (args: {
        where: { email: { not: null }; newsletterOptIn?: boolean };
        select: { email: true };
      }) => Promise<Array<{ email: string | null }>>;
    };
  }).user.findMany({
    where:
      args.audience === "newsletter"
        ? { email: { not: null }, newsletterOptIn: true }
        : { email: { not: null } },
    select: { email: true },
  });

  const recipients = [...new Set(users.map((u) => u.email?.trim().toLowerCase()).filter(Boolean) as string[])];
  const html = [
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
