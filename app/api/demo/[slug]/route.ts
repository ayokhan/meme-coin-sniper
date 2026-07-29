import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import { isValidDemoExperience } from "@/lib/demo-sessions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

function demoDb() {
  return prisma as unknown as {
    demoSession: {
      findUnique: (args: unknown) => Promise<{
        id: string;
        slug: string;
        title: string;
        description: string | null;
        sessionAt: Date | null;
        timezone: string | null;
        locationNote: string | null;
        isPublished: boolean;
        registrationOpen: boolean;
        maxAttendees: number | null;
        meetingPlatform: string | null;
        _count?: { registrations: number };
      } | null>;
    };
    demoRegistration: {
      count: (args: unknown) => Promise<number>;
      create: (args: unknown) => Promise<{ id: string }>;
      findUnique: (args: unknown) => Promise<{ id: string } | null>;
    };
    user: {
      updateMany: (args: unknown) => Promise<unknown>;
    };
  };
}

/** GET — public session details for registration page (no meeting URL). */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_DEMO_SESSIONS);
  if (!enabled) {
    return NextResponse.json(
      { success: false, error: "Demo registration is not open right now.", closed: true },
      { status: 403 }
    );
  }

  const session = await demoDb().demoSession.findUnique({
    where: { slug: slug.trim().toLowerCase() },
    include: { _count: { select: { registrations: true } } },
  });
  if (!session || !session.isPublished) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
  }

  const count = session._count?.registrations ?? 0;
  const spotsLeft =
    session.maxAttendees != null ? Math.max(0, session.maxAttendees - count) : null;

  return NextResponse.json({
    success: true,
    session: {
      slug: session.slug,
      title: session.title,
      description: session.description,
      sessionAt: session.sessionAt?.toISOString() ?? null,
      timezone: session.timezone,
      locationNote: session.locationNote,
      meetingPlatform: session.meetingPlatform,
      registrationOpen: session.registrationOpen && (spotsLeft == null || spotsLeft > 0),
      spotsLeft,
      registeredCount: count,
    },
  });
}

/** POST — register for a demo session. */
export async function POST(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_DEMO_SESSIONS);
  if (!enabled) {
    return NextResponse.json(
      { success: false, error: "Demo registration is not open right now." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  const email = String(body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone ?? "").trim().slice(0, 40) || null;
  const city = String(body.city ?? "").trim().slice(0, 80);
  const country = String(body.country ?? "").trim().slice(0, 80);
  const cryptoExperience = isValidDemoExperience(body.cryptoExperience)
    ? body.cryptoExperience
    : String(body.cryptoExperience ?? "").trim().slice(0, 40) || null;
  const forexExperience = isValidDemoExperience(body.forexExperience)
    ? body.forexExperience
    : String(body.forexExperience ?? "").trim().slice(0, 40) || null;
  const newsletterOptIn = body.newsletterOptIn === true;
  const promoOptIn = body.promoOptIn === true;
  const source = String(body.source ?? "direct").trim().slice(0, 40) || "direct";

  if (!name) {
    return NextResponse.json({ success: false, error: "Name is required." }, { status: 400 });
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ success: false, error: "A valid email is required." }, { status: 400 });
  }
  if (!city) {
    return NextResponse.json({ success: false, error: "City is required." }, { status: 400 });
  }
  if (!country) {
    return NextResponse.json({ success: false, error: "Country is required." }, { status: 400 });
  }

  const session = await demoDb().demoSession.findUnique({
    where: { slug: slug.trim().toLowerCase() },
  });
  if (!session || !session.isPublished) {
    return NextResponse.json({ success: false, error: "Session not found." }, { status: 404 });
  }
  if (!session.registrationOpen) {
    return NextResponse.json({ success: false, error: "Registration is closed for this session." }, { status: 400 });
  }

  const count = await demoDb().demoRegistration.count({ where: { sessionId: session.id } });
  if (session.maxAttendees != null && count >= session.maxAttendees) {
    return NextResponse.json({ success: false, error: "This session is full." }, { status: 400 });
  }

  const existing = await demoDb().demoRegistration.findUnique({
    where: { sessionId_email: { sessionId: session.id, email } },
  });
  if (existing) {
    return NextResponse.json({
      success: true,
      alreadyRegistered: true,
      message: "You are already registered for this session. We will email details soon.",
    });
  }

  await demoDb().demoRegistration.create({
    data: {
      sessionId: session.id,
      name,
      email,
      phone,
      city,
      country,
      cryptoExperience,
      forexExperience,
      newsletterOptIn,
      promoOptIn,
      source,
    },
  });

  if (newsletterOptIn || promoOptIn) {
    await demoDb()
      .user.updateMany({
        where: { email },
        data: {
          ...(newsletterOptIn ? { newsletterOptIn: true } : {}),
        },
      })
      .catch(() => null);
  }

  return NextResponse.json({
    success: true,
    message: "You're registered. Check your email for session details before the demo.",
  });
}
