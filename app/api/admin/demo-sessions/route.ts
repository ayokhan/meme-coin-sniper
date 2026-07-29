import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  DEFAULT_DEMO_PAGE_EYEBROW,
  DEFAULT_DEMO_SUBMIT_LABEL,
  slugifyDemoTitle,
} from "@/lib/demo-sessions";

export const dynamic = "force-dynamic";

function demoDb() {
  return prisma as unknown as {
    demoSession: {
      findMany: (args: unknown) => Promise<unknown[]>;
      findUnique: (args: unknown) => Promise<{ id: string; slug: string } | null>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
    };
  };
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return { ok: false as const, res: NextResponse.json({ success: false, error: "Owner only." }, { status: 403 }) };
  }
  return { ok: true as const };
}

function parsePriceUsdCents(body: Record<string, unknown>): number | null | undefined {
  if (!("priceUsd" in body) && !("priceUsdCents" in body)) return undefined;
  if (body.priceUsdCents != null && body.priceUsdCents !== "") {
    const n = Math.round(Number(body.priceUsdCents));
    if (!Number.isFinite(n) || n < 0) return null;
    return n === 0 ? null : Math.min(500000, n);
  }
  if (body.priceUsd == null || body.priceUsd === "") return null;
  const dollars = Number(body.priceUsd);
  if (!Number.isFinite(dollars) || dollars < 0) return null;
  if (dollars === 0) return null;
  const cents = Math.round(dollars * 100);
  if (cents > 0 && cents < 50) return -1;
  return Math.min(500000, cents);
}

/** GET — list all demo sessions with registration counts. */
export async function GET() {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  const rows = await demoDb().demoSession.findMany({
    orderBy: [{ sessionAt: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { registrations: true } } },
  });

  return NextResponse.json({
    success: true,
    sessions: (rows as Array<Record<string, unknown>>).map((s) => ({
      ...s,
      sessionAt: s.sessionAt instanceof Date ? s.sessionAt.toISOString() : s.sessionAt,
      createdAt: s.createdAt instanceof Date ? (s.createdAt as Date).toISOString() : s.createdAt,
      updatedAt: s.updatedAt instanceof Date ? (s.updatedAt as Date).toISOString() : s.updatedAt,
      registrationCount: (s._count as { registrations: number } | undefined)?.registrations ?? 0,
    })),
  });
}

/** POST — create a demo session. */
export async function POST(request: Request) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const title = String(body.title ?? "").trim().slice(0, 200);
  if (!title) {
    return NextResponse.json({ success: false, error: "Title is required." }, { status: 400 });
  }

  let slug = String(body.slug ?? "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!slug) slug = slugifyDemoTitle(title);

  const existing = await demoDb().demoSession.findUnique({ where: { slug } });
  if (existing) {
    return NextResponse.json({ success: false, error: "That slug is already used. Pick another." }, { status: 400 });
  }

  const sessionAtRaw = body.sessionAt;
  const sessionAt =
    typeof sessionAtRaw === "string" && sessionAtRaw.trim()
      ? new Date(sessionAtRaw)
      : null;
  if (sessionAt && Number.isNaN(sessionAt.getTime())) {
    return NextResponse.json({ success: false, error: "Invalid session date." }, { status: 400 });
  }

  const maxAttendees =
    body.maxAttendees == null || body.maxAttendees === ""
      ? null
      : Math.max(1, Math.min(5000, Number(body.maxAttendees) || 0)) || null;

  const priceUsdCents = parsePriceUsdCents(body);
  if (priceUsdCents === -1) {
    return NextResponse.json({ success: false, error: "Paid sessions must be at least $0.50." }, { status: 400 });
  }

  const row = await demoDb().demoSession.create({
    data: {
      slug,
      title,
      description: String(body.description ?? "").trim().slice(0, 8000) || null,
      pageEyebrow:
        String(body.pageEyebrow ?? DEFAULT_DEMO_PAGE_EYEBROW).trim().slice(0, 80) ||
        DEFAULT_DEMO_PAGE_EYEBROW,
      submitLabel:
        String(body.submitLabel ?? DEFAULT_DEMO_SUBMIT_LABEL).trim().slice(0, 60) ||
        DEFAULT_DEMO_SUBMIT_LABEL,
      sessionAt,
      timezone: String(body.timezone ?? "America/Toronto").trim().slice(0, 80) || "America/Toronto",
      meetingUrl: String(body.meetingUrl ?? "").trim().slice(0, 500) || null,
      meetingPlatform: String(body.meetingPlatform ?? "").trim().slice(0, 40) || null,
      locationNote: String(body.locationNote ?? "").trim().slice(0, 200) || null,
      priceUsdCents: priceUsdCents === undefined ? null : priceUsdCents,
      isPublished: body.isPublished === true,
      registrationOpen: body.registrationOpen !== false,
      maxAttendees,
    },
  });

  return NextResponse.json({
    success: true,
    session: {
      ...row,
      sessionAt: row.sessionAt instanceof Date ? row.sessionAt.toISOString() : row.sessionAt,
      publicUrl: `https://novastaris.ai/demo/${slug}`,
    },
  });
}
