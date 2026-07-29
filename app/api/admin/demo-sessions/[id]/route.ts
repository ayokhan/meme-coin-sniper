import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

function demoDb() {
  return prisma as unknown as {
    demoSession: {
      findUnique: (args: unknown) => Promise<Record<string, unknown> | null>;
      update: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
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

function serialize(row: Record<string, unknown>) {
  const regs = Array.isArray(row.registrations)
    ? (row.registrations as Array<Record<string, unknown>>).map((r) => ({
        ...r,
        createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      }))
    : undefined;
  return {
    ...row,
    sessionAt: row.sessionAt instanceof Date ? (row.sessionAt as Date).toISOString() : row.sessionAt,
    createdAt: row.createdAt instanceof Date ? (row.createdAt as Date).toISOString() : row.createdAt,
    updatedAt: row.updatedAt instanceof Date ? (row.updatedAt as Date).toISOString() : row.updatedAt,
    registrations: regs,
    registrationCount: regs?.length ?? (row._count as { registrations?: number } | undefined)?.registrations,
    publicUrl: `https://novastaris.ai/demo/${row.slug}`,
  };
}

/** GET — session + all registrations. */
export async function GET(_req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;

  const row = await demoDb().demoSession.findUnique({
    where: { id },
    include: {
      registrations: { orderBy: { createdAt: "desc" } },
      _count: { select: { registrations: true } },
    },
  });
  if (!row) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }
  return NextResponse.json({ success: true, session: serialize(row) });
}

/** PATCH — update session fields. */
export async function PATCH(request: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const existing = await demoDb().demoSession.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string") data.title = body.title.trim().slice(0, 200);
  if (typeof body.description === "string") data.description = body.description.trim().slice(0, 8000) || null;
  if (typeof body.timezone === "string") data.timezone = body.timezone.trim().slice(0, 80) || "America/Toronto";
  if (typeof body.meetingUrl === "string") data.meetingUrl = body.meetingUrl.trim().slice(0, 500) || null;
  if (typeof body.meetingPlatform === "string")
    data.meetingPlatform = body.meetingPlatform.trim().slice(0, 40) || null;
  if (typeof body.locationNote === "string") data.locationNote = body.locationNote.trim().slice(0, 200) || null;
  if (typeof body.isPublished === "boolean") data.isPublished = body.isPublished;
  if (typeof body.registrationOpen === "boolean") data.registrationOpen = body.registrationOpen;
  if ("sessionAt" in body) {
    if (body.sessionAt == null || body.sessionAt === "") data.sessionAt = null;
    else {
      const d = new Date(String(body.sessionAt));
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid session date." }, { status: 400 });
      }
      data.sessionAt = d;
    }
  }
  if ("maxAttendees" in body) {
    data.maxAttendees =
      body.maxAttendees == null || body.maxAttendees === ""
        ? null
        : Math.max(1, Math.min(5000, Number(body.maxAttendees) || 0)) || null;
  }
  if (typeof body.slug === "string") {
    const slug = body.slug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (slug && slug !== existing.slug) {
      const clash = await demoDb().demoSession.findUnique({ where: { slug } });
      if (clash) {
        return NextResponse.json({ success: false, error: "Slug already in use." }, { status: 400 });
      }
      data.slug = slug;
    }
  }
  if (typeof body.pageEyebrow === "string") {
    data.pageEyebrow = body.pageEyebrow.trim().slice(0, 80) || "Session registration";
  }
  if (typeof body.submitLabel === "string") {
    data.submitLabel = body.submitLabel.trim().slice(0, 60) || "Complete registration";
  }
  if ("priceUsd" in body || "priceUsdCents" in body) {
    let cents: number | null = null;
    if (body.priceUsdCents != null && body.priceUsdCents !== "") {
      const n = Math.round(Number(body.priceUsdCents));
      cents = Number.isFinite(n) && n > 0 ? Math.min(500000, n) : null;
    } else if (body.priceUsd != null && body.priceUsd !== "") {
      const dollars = Number(body.priceUsd);
      if (!Number.isFinite(dollars) || dollars < 0) {
        return NextResponse.json({ success: false, error: "Invalid price." }, { status: 400 });
      }
      const n = Math.round(dollars * 100);
      if (n > 0 && n < 50) {
        return NextResponse.json({ success: false, error: "Paid sessions must be at least $0.50." }, { status: 400 });
      }
      cents = n > 0 ? Math.min(500000, n) : null;
    }
    data.priceUsdCents = cents;
  }

  const row = await demoDb().demoSession.update({ where: { id }, data });
  return NextResponse.json({ success: true, session: serialize(row) });
}

/** DELETE — remove session and registrations. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const gate = await requireOwner();
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  await demoDb().demoSession.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
