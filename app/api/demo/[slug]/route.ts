import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import { FEATURE_FLAG_KEYS, getFeatureFlag } from "@/lib/feature-flags";
import {
  DEFAULT_DEMO_PAGE_EYEBROW,
  DEFAULT_DEMO_SUBMIT_LABEL,
  formatDemoPriceUsd,
  isPaidDemoSession,
  isValidDemoExperience,
  publicDemoUrl,
} from "@/lib/demo-sessions";
import { isValidDemoCountry, isValidDemoRegion } from "@/lib/demo-geo";
import { sendDemoRegistrationConfirmation } from "@/lib/demo-confirmation-email";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ slug: string }> };

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

type DemoSessionRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  pageEyebrow: string | null;
  submitLabel: string | null;
  sessionAt: Date | null;
  timezone: string | null;
  locationNote: string | null;
  meetingUrl: string | null;
  meetingPlatform: string | null;
  priceUsdCents: number | null;
  isPublished: boolean;
  registrationOpen: boolean;
  maxAttendees: number | null;
  _count?: { registrations: number };
};

type DemoRegistrationRow = {
  id: string;
  paymentStatus: string;
  stripeCheckoutSessionId: string | null;
  confirmationSentAt: Date | null;
};

function demoDb() {
  return prisma as unknown as {
    demoSession: {
      findUnique: (args: unknown) => Promise<DemoSessionRow | null>;
    };
    demoRegistration: {
      count: (args: unknown) => Promise<number>;
      create: (args: unknown) => Promise<DemoRegistrationRow>;
      findUnique: (args: unknown) => Promise<DemoRegistrationRow | null>;
      update: (args: unknown) => Promise<DemoRegistrationRow>;
    };
    user: {
      updateMany: (args: unknown) => Promise<unknown>;
    };
  };
}

function siteOrigin(request: Request): string {
  const env = (process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  if (env) return env;
  try {
    return new URL(request.url).origin;
  } catch {
    return "https://novastaris.ai";
  }
}

async function createStripeCheckout(opts: {
  request: Request;
  session: DemoSessionRow;
  registrationId: string;
  email: string;
  name: string;
}): Promise<{ url: string; checkoutSessionId: string } | { error: string; status: number }> {
  if (!stripe) {
    return { error: "Card payment is not configured.", status: 503 };
  }
  const cents = opts.session.priceUsdCents ?? 0;
  if (cents < 50) {
    return { error: "Minimum paid session price is $0.50.", status: 400 };
  }
  const origin = siteOrigin(opts.request);
  const successUrl = `${origin}/demo/${encodeURIComponent(opts.session.slug)}?paid=1`;
  const cancelUrl = `${origin}/demo/${encodeURIComponent(opts.session.slug)}?canceled=1`;

  try {
    const checkout = await stripe.checkout.sessions.create({
      mode: "payment",
      customer_email: opts.email,
      client_reference_id: opts.registrationId,
      metadata: {
        purpose: "demo_session_registration",
        registrationId: opts.registrationId,
        demoSessionId: opts.session.id,
        demoSlug: opts.session.slug,
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: cents,
            product_data: {
              name: opts.session.title,
              description: `Registration for ${opts.session.title}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
    if (!checkout.url) {
      return { error: "Stripe did not return a checkout URL.", status: 500 };
    }
    return { url: checkout.url, checkoutSessionId: checkout.id };
  } catch (e) {
    console.error("Demo Stripe checkout error:", e);
    return {
      error: e instanceof Error ? e.message : "Failed to start payment.",
      status: 500,
    };
  }
}

async function confirmedRegistrationCount(sessionId: string, isPaid: boolean): Promise<number> {
  if (!isPaid) {
    return demoDb().demoRegistration.count({ where: { sessionId } });
  }
  return demoDb().demoRegistration.count({
    where: { sessionId, paymentStatus: { in: ["paid", "waived"] } },
  });
}

/** GET — public session details for registration page (no meeting URL). */
export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_DEMO_SESSIONS);
  if (!enabled) {
    return NextResponse.json(
      { success: false, error: "Registration is not open right now.", closed: true },
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

  const paid = isPaidDemoSession(session.priceUsdCents);
  const count = await confirmedRegistrationCount(session.id, paid);
  const spotsLeft =
    session.maxAttendees != null ? Math.max(0, session.maxAttendees - count) : null;

  return NextResponse.json({
    success: true,
    session: {
      slug: session.slug,
      title: session.title,
      description: session.description,
      pageEyebrow: session.pageEyebrow || DEFAULT_DEMO_PAGE_EYEBROW,
      submitLabel: session.submitLabel || DEFAULT_DEMO_SUBMIT_LABEL,
      sessionAt: session.sessionAt?.toISOString() ?? null,
      timezone: session.timezone,
      locationNote: session.locationNote,
      meetingPlatform: session.meetingPlatform,
      priceUsdCents: session.priceUsdCents ?? null,
      isPaid: paid,
      priceLabel: paid && session.priceUsdCents != null ? formatDemoPriceUsd(session.priceUsdCents) : null,
      registrationOpen: session.registrationOpen && (spotsLeft == null || spotsLeft > 0),
      spotsLeft,
      registeredCount: count,
    },
  });
}

/** POST — register (free) or start Stripe checkout (paid). */
export async function POST(request: Request, ctx: Ctx) {
  const { slug } = await ctx.params;
  const enabled = await getFeatureFlag(FEATURE_FLAG_KEYS.PAGE_TAB_DEMO_SESSIONS);
  if (!enabled) {
    return NextResponse.json(
      { success: false, error: "Registration is not open right now." },
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
  const city = String(body.city ?? "").trim().slice(0, 80) || null;
  const country = String(body.country ?? "").trim().slice(0, 80);
  const region = String(body.region ?? body.province ?? body.state ?? "").trim().slice(0, 80);
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
  if (!country || !isValidDemoCountry(country)) {
    return NextResponse.json({ success: false, error: "Please select a country from the list." }, { status: 400 });
  }
  if (!region || !isValidDemoRegion(country, region)) {
    return NextResponse.json(
      { success: false, error: "Province / state is required." },
      { status: 400 }
    );
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

  const paid = isPaidDemoSession(session.priceUsdCents);
  const count = await confirmedRegistrationCount(session.id, paid);
  if (session.maxAttendees != null && count >= session.maxAttendees) {
    return NextResponse.json({ success: false, error: "This session is full." }, { status: 400 });
  }

  const existing = await demoDb().demoRegistration.findUnique({
    where: { sessionId_email: { sessionId: session.id, email } },
  });

  if (existing && (existing.paymentStatus === "paid" || existing.paymentStatus === "free" || existing.paymentStatus === "waived")) {
    return NextResponse.json({
      success: true,
      alreadyRegistered: true,
      message: "You are already registered for this session. Check your email for details.",
    });
  }

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

  if (paid) {
    let registration = existing;
    if (!registration) {
      registration = await demoDb().demoRegistration.create({
        data: {
          sessionId: session.id,
          name,
          email,
          phone,
          city,
          country,
          region,
          cryptoExperience,
          forexExperience,
          newsletterOptIn,
          promoOptIn,
          source,
          paymentStatus: "pending",
        },
      });
    } else {
      registration = await demoDb().demoRegistration.update({
        where: { id: registration.id },
        data: {
          name,
          phone,
          city,
          country,
          region,
          cryptoExperience,
          forexExperience,
          newsletterOptIn,
          promoOptIn,
          source,
          paymentStatus: "pending",
        },
      });
    }

    const checkout = await createStripeCheckout({
      request,
      session,
      registrationId: registration.id,
      email,
      name,
    });
    if ("error" in checkout) {
      return NextResponse.json({ success: false, error: checkout.error }, { status: checkout.status });
    }

    await demoDb().demoRegistration.update({
      where: { id: registration.id },
      data: { stripeCheckoutSessionId: checkout.checkoutSessionId },
    });

    return NextResponse.json({
      success: true,
      requiresPayment: true,
      checkoutUrl: checkout.url,
      message: `Continue to Stripe to pay ${formatDemoPriceUsd(session.priceUsdCents!)}.`,
    });
  }

  const row = await demoDb().demoRegistration.create({
    data: {
      sessionId: session.id,
      name,
      email,
      phone,
      city,
      country,
      region,
      cryptoExperience,
      forexExperience,
      newsletterOptIn,
      promoOptIn,
      source,
      paymentStatus: "free",
    },
  });

  const emailResult = await sendDemoRegistrationConfirmation({
    to: email,
    name,
    sessionTitle: session.title,
    slug: session.slug,
    sessionAt: session.sessionAt,
    timezone: session.timezone,
    locationNote: session.locationNote,
    meetingUrl: session.meetingUrl,
    includeMeetingLink: Boolean(session.meetingUrl),
    paid: false,
    pageEyebrow: session.pageEyebrow,
  });
  if (emailResult.ok) {
    await demoDb()
      .demoRegistration.update({
        where: { id: row.id },
        data: { confirmationSentAt: new Date() },
      })
      .catch(() => null);
  } else {
    console.warn("Demo confirmation email failed:", emailResult.error);
  }

  return NextResponse.json({
    success: true,
    message:
      "You're registered. A confirmation email is on the way — check spam if you don't see it shortly.",
    registrationUrl: publicDemoUrl(session.slug),
  });
}
