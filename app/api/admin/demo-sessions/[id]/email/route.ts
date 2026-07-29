import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAnnouncementEmails } from "@/lib/announcement-email";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type Ctx = { params: Promise<{ id: string }> };

/** POST — email all registrants (or newsletter-opted subset). Body: { subject, body, onlyNewsletterOptIn? } */
export async function POST(request: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: { subject?: string; body?: string; onlyNewsletterOptIn?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const subject = String(body.subject ?? "").trim();
  const message = String(body.body ?? "").trim();
  if (!subject || !message) {
    return NextResponse.json({ success: false, error: "Subject and body are required." }, { status: 400 });
  }

  const demo = await (
    prisma as unknown as {
      demoSession: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          title: string;
          meetingUrl: string | null;
          sessionAt: Date | null;
          registrations: Array<{ email: string; newsletterOptIn: boolean; name: string }>;
        } | null>;
      };
    }
  ).demoSession.findUnique({
    where: { id },
    include: { registrations: { select: { email: true, newsletterOptIn: true, name: true } } },
  });

  if (!demo) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
  }

  let recipients = demo.registrations.map((r) => r.email);
  if (body.onlyNewsletterOptIn) {
    recipients = demo.registrations.filter((r) => r.newsletterOptIn).map((r) => r.email);
  }

  if (recipients.length === 0) {
    return NextResponse.json({ success: false, error: "No registrant emails to send." }, { status: 400 });
  }

  const meetingLine = demo.meetingUrl
    ? `\n\nJoin link: ${demo.meetingUrl}`
    : "\n\n(Join link will follow closer to the session.)";
  const whenLine = demo.sessionAt
    ? `\nWhen: ${demo.sessionAt.toLocaleString(undefined, { dateStyle: "full", timeStyle: "short" })}`
    : "";

  const fullBody = `${message}${whenLine}${meetingLine}\n\n— NovaStaris · ${demo.title}`;

  try {
    const result = await sendAnnouncementEmails({
      subject,
      body: fullBody,
      recipients,
    });
    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Email send failed." },
      { status: 500 }
    );
  }
}
