import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { generateStudioDraft } from "@/lib/email-studio-ai";
import {
  getStudioSegmentCounts,
  listStudioCampaigns,
  parsePickedEmails,
  parseStudioSegment,
  previewStudioAudience,
  sendStudioCampaign,
  sendStudioTest,
} from "@/lib/email-studio-send";
import { STUDIO_DISCLAIMER, checkStudioCopy, type StudioAngle, type StudioDraft } from "@/lib/email-studio-types";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function parseAngle(raw: unknown): StudioAngle | null {
  return raw === "levels" || raw === "scanner" || raw === "memes" ? raw : null;
}

function str(v: unknown, max: number): string {
  return typeof v === "string" ? v.slice(0, max) : "";
}

/** Rebuilds the draft from the client payload so only known fields reach the renderer. */
function parseDraft(raw: unknown): StudioDraft | null {
  if (!raw || typeof raw !== "object") return null;
  const d = raw as Partial<StudioDraft>;
  const angle = parseAngle(d.angle);
  if (!angle || !Array.isArray(d.sections)) return null;
  return {
    angle,
    generatedAt: str(d.generatedAt, 40),
    aiUsed: !!d.aiUsed,
    subjects: Array.isArray(d.subjects) ? d.subjects.map((s) => str(s, 120)).filter(Boolean).slice(0, 6) : [],
    subject: str(d.subject, 150).trim(),
    preheader: str(d.preheader, 200),
    eyebrow: str(d.eyebrow, 60),
    headline: str(d.headline, 150),
    hook: str(d.hook, 1500),
    sections: d.sections.slice(0, 6).map((s) => ({
      key: str(s?.key, 40),
      title: str(s?.title, 100),
      note: str(s?.note, 800),
      table:
        s?.table && Array.isArray(s.table.columns) && Array.isArray(s.table.rows)
          ? {
              columns: s.table.columns.map((c) => str(c, 40)).slice(0, 6),
              rows: s.table.rows.slice(0, 20).map((r) =>
                (Array.isArray(r) ? r : []).slice(0, 6).map((c) => ({
                  text: str(c?.text, 80),
                  tone: c?.tone === "good" || c?.tone === "bad" || c?.tone === "muted" || c?.tone === "accent" ? c.tone : undefined,
                }))
              ),
              footnote: s.table.footnote ? str(s.table.footnote, 300) : undefined,
            }
          : null,
    })),
    lesson: d.lesson ? { title: str(d.lesson.title, 100), body: str(d.lesson.body, 1000) } : null,
    cta: { label: str(d.cta?.label, 50) || "Open NovaStaris", url: str(d.cta?.url, 500) },
    disclaimer: STUDIO_DISCLAIMER,
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const [campaigns, segmentCounts] = await Promise.all([listStudioCampaigns(25), getStudioSegmentCounts()]);
    return NextResponse.json({ success: true, campaigns, segmentCounts });
  } catch (e) {
    console.error("admin email-studio GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load Email Studio." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  let body: { action?: string; angle?: unknown; draft?: unknown; segment?: unknown; recipients?: unknown; confirm?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.action === "generate") {
      const angle = parseAngle(body.angle);
      if (!angle) return NextResponse.json({ success: false, error: "Pick an email type." }, { status: 400 });
      const draft = await generateStudioDraft(angle);
      return NextResponse.json({ success: true, draft });
    }

    if (body.action === "audience") {
      const a = await previewStudioAudience(parseStudioSegment(body.segment));
      return NextResponse.json({
        success: true,
        emails: a.recipients,
        suppressed: a.suppressed,
        capped: a.capped,
        segmentCount: a.segmentCount,
      });
    }

    const draft = parseDraft(body.draft);
    if (!draft) return NextResponse.json({ success: false, error: "Generate an email first." }, { status: 400 });
    const blocking = checkStudioCopy(draft).filter((i) => i.level === "block");
    if (blocking.length) {
      return NextResponse.json({ success: false, error: blocking.map((b) => b.message).join(" ") }, { status: 400 });
    }

    if (body.action === "test") {
      const to = session?.user?.email;
      if (!to) return NextResponse.json({ success: false, error: "Your account has no email address." }, { status: 400 });
      const result = await sendStudioTest(draft, to);
      return result.ok
        ? NextResponse.json({ success: true, to })
        : NextResponse.json({ success: false, error: result.error }, { status: 502 });
    }

    if (body.action === "send") {
      if (body.confirm !== true) {
        return NextResponse.json({ success: false, error: "Confirm the send first." }, { status: 400 });
      }
      const picked = parsePickedEmails(body.recipients);
      if (picked && picked.length === 0) {
        return NextResponse.json({ success: false, error: "Select at least one recipient." }, { status: 400 });
      }
      const result = await sendStudioCampaign({
        draft,
        segment: parseStudioSegment(body.segment),
        picked,
        createdByUserId: session?.user?.id ?? null,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ success: false, error: "Unknown action." }, { status: 400 });
  } catch (e) {
    console.error("admin email-studio POST:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Email Studio request failed." },
      { status: 500 }
    );
  }
}
