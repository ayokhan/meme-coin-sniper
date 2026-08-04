import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getAnnouncementEmailStats,
  listRecentAnnouncementCampaigns,
  sendAnnouncementEmails,
  type AnnouncementAudience,
  type AnnouncementEmailTemplate,
} from "@/lib/announcement-email";
import { listRecentWelcomeEmailLogs } from "@/lib/send-welcome-email";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const [stats, campaigns, welcomeLogs] = await Promise.all([
      getAnnouncementEmailStats(),
      listRecentAnnouncementCampaigns(20),
      listRecentWelcomeEmailLogs(40),
    ]);
    return NextResponse.json({ success: true, stats, campaigns, welcomeLogs });
  } catch (e) {
    console.error("admin announcement-email GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load email stats." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      subject?: string;
      body?: string;
      audience?: AnnouncementAudience;
      recipients?: string[];
      confirm?: boolean;
      includePartnerLogos?: boolean;
      partnerBrand?: "blofin" | "vantage" | "tiomarkets" | "assexmarkets";
      ctaLabel?: string;
      ctaUrl?: string;
      template?: AnnouncementEmailTemplate;
      format?: "rich" | "plain";
    };
    if (!body.confirm) {
      return NextResponse.json({ success: false, error: "Set confirm: true to send." }, { status: 400 });
    }
    const audience = body.audience === "all" ? "all" : "newsletter";
    const recipients = Array.isArray(body.recipients)
      ? body.recipients.filter((e): e is string => typeof e === "string")
      : undefined;
    const template: AnnouncementEmailTemplate =
      body.template === "forex-rebate"
        ? "forex-rebate"
        : body.template === "affiliate"
          ? "affiliate"
          : body.template === "welcome"
            ? "welcome"
            : body.template === "nova-branded"
              ? "nova-branded"
              : "default";
    const format = body.format === "plain" ? "plain" : "rich";
    const result = await sendAnnouncementEmails({
      subject: body.subject ?? "",
      body: body.body ?? "",
      audience,
      recipients,
      includePartnerLogos: !!body.includePartnerLogos,
      partnerBrand: body.partnerBrand ?? "blofin",
      ctaLabel: typeof body.ctaLabel === "string" ? body.ctaLabel : null,
      ctaUrl: typeof body.ctaUrl === "string" ? body.ctaUrl : null,
      template,
      format,
      createdByUserId: session?.user?.id ?? null,
    });
    return NextResponse.json({ success: true, result });
  } catch (e) {
    console.error("admin announcement-email POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to send announcement." },
      { status: 400 }
    );
  }
}
