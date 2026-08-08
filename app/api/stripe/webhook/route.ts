import { NextResponse } from "next/server";
import Stripe from "stripe";
import { prisma } from "@/lib/db";
import {
  periodEndFromStripeSubscription,
  setStripeCustomerId,
  trialEndFromStripeSubscription,
  upsertSubscriptionFromStripePeriod,
  vipAccessEndFromStripeSubscription,
} from "@/lib/stripe-billing";
import { VIP_PLANS, findPlanByListOrCardAmount } from "@/lib/subscription";
import { recordReferralCommissionForSubscription } from "@/lib/referral-commission";
import {
  findUserIdByStripeCustomerId,
  recordBillingInvoiceFromStripeInvoice,
  recordBillingInvoiceFromCheckout,
  recordBillingInvoiceFromSubscriptionRow,
} from "@/lib/billing-invoices";
import { logVipTrialEmail } from "@/lib/vip-trial";

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export const dynamic = "force-dynamic";

function resolvePlan(planId: string, amountUsd: number, totalPaidUsd: number) {
  let plan = VIP_PLANS.find((p) => p.id === planId);
  if (!plan && amountUsd > 0) {
    plan = findPlanByListOrCardAmount(amountUsd);
  }
  if (!plan && totalPaidUsd > 0) {
    plan = findPlanByListOrCardAmount(totalPaidUsd);
  }
  return plan;
}

async function handleDemoSessionCheckout(session: Stripe.Checkout.Session) {
  const registrationId =
    (session.metadata?.registrationId ?? session.client_reference_id ?? "").toString().trim();
  if (!registrationId || !session.id) {
    console.error("Stripe webhook: demo registration missing id");
    return NextResponse.json({ error: "Missing demo registration id." }, { status: 400 });
  }

  const amountCents =
    session.amount_total != null
      ? session.amount_total
      : Math.round(parseFloat(session.metadata?.amountUsd ?? "0") * 100) || null;

  try {
    const db = prisma as unknown as {
      demoRegistration: {
        findUnique: (args: unknown) => Promise<{
          id: string;
          name: string;
          email: string;
          paymentStatus: string;
          confirmationSentAt: Date | null;
          session: {
            title: string;
            slug: string;
            sessionAt: Date | null;
            timezone: string | null;
            locationNote: string | null;
            meetingUrl: string | null;
            pageEyebrow: string | null;
          };
        } | null>;
        update: (args: unknown) => Promise<unknown>;
      };
    };

    const reg = await db.demoRegistration.findUnique({
      where: { id: registrationId },
      include: {
        session: {
          select: {
            title: true,
            slug: true,
            sessionAt: true,
            timezone: true,
            locationNote: true,
            meetingUrl: true,
            pageEyebrow: true,
          },
        },
      },
    });
    if (!reg) {
      console.error("Stripe webhook: demo registration not found", registrationId);
      return NextResponse.json({ error: "Demo registration not found." }, { status: 404 });
    }

    const alreadyPaid = reg.paymentStatus === "paid";
    if (!alreadyPaid) {
      await db.demoRegistration.update({
        where: { id: reg.id },
        data: {
          paymentStatus: "paid",
          paidAt: new Date(),
          amountPaidCents: amountCents,
          stripeCheckoutSessionId: session.id,
        },
      });
    }

    if (!reg.confirmationSentAt) {
      const { sendDemoRegistrationConfirmation } = await import("@/lib/demo-confirmation-email");
      const emailResult = await sendDemoRegistrationConfirmation({
        to: reg.email,
        name: reg.name,
        sessionTitle: reg.session.title,
        slug: reg.session.slug,
        sessionAt: reg.session.sessionAt,
        timezone: reg.session.timezone,
        locationNote: reg.session.locationNote,
        meetingUrl: reg.session.meetingUrl,
        includeMeetingLink: Boolean(reg.session.meetingUrl),
        paid: true,
        amountUsd: amountCents != null ? amountCents / 100 : null,
        pageEyebrow: reg.session.pageEyebrow,
      });
      if (emailResult.ok) {
        await db.demoRegistration.update({
          where: { id: reg.id },
          data: { confirmationSentAt: new Date() },
        });
      } else {
        console.warn("Stripe webhook: demo confirmation email failed", emailResult.error);
      }
    }

    return NextResponse.json({ received: true, demoRegistration: true });
  } catch (e) {
    console.error("Stripe webhook: demo session payment handler failed", e);
    return NextResponse.json({ error: "Demo payment handler failed." }, { status: 500 });
  }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  /** Guest demo/info session registration — no NovaStaris user required. */
  if ((session.metadata?.purpose ?? "").toString() === "demo_session_registration") {
    return handleDemoSessionCheckout(session);
  }

  const userId = session.client_reference_id ?? session.metadata?.userId ?? null;
  if (!userId || !session.id) {
    console.error("Stripe webhook: missing client_reference_id or session id");
    return NextResponse.json({ error: "Missing user or session id." }, { status: 400 });
  }

  const billingTest = (session.metadata?.billingTest ?? "").toString();
  const customerId =
    typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (customerId) await setStripeCustomerId(userId, customerId);

  if (billingTest === "receipt") {
    console.info("Stripe webhook: receipt billing test completed (no VIP grant)", {
      userId,
      sessionId: session.id,
      customerId,
    });
    return NextResponse.json({ received: true, billingTest: "receipt" });
  }

  /** Voluntary Trading University donations — record receipt, never grant VIP. */
  if ((session.metadata?.purpose ?? "").toString() === "trading_university_donation") {
    const amountUsd =
      session.amount_total != null
        ? session.amount_total / 100
        : parseFloat(session.metadata?.amountUsd ?? "0") || 0;
    const monthly = session.metadata?.monthly === "true" || session.mode === "subscription";
    const planId = monthly ? "donation_monthly" : "donation_once";
    try {
      await recordBillingInvoiceFromCheckout({
        userId,
        amountUsd,
        planId,
        stripeSessionId: session.id,
        paymentMethod: "card",
        periodEnd: monthly
          ? (() => {
              const d = new Date();
              d.setMonth(d.getMonth() + 1);
              return d;
            })()
          : undefined,
      });
    } catch (e) {
      console.error("Stripe webhook: donation invoice record failed", e);
    }
    console.info("Stripe webhook: trading university donation received", {
      userId,
      sessionId: session.id,
      amountUsd,
      monthly,
    });
    return NextResponse.json({ received: true, donation: true });
  }

  /** Paid Strategy call — record receipt + confirmation email, never grant VIP. */
  if ((session.metadata?.purpose ?? "").toString() === "paid_strategy_call") {
    const amountUsd =
      session.amount_total != null
        ? session.amount_total / 100
        : parseFloat(session.metadata?.amountUsd ?? "0") || 0;
    try {
      const { fulfillPaidStrategyCallOrder } = await import("@/lib/paid-strategy-call");
      await fulfillPaidStrategyCallOrder({
        orderId: session.metadata?.orderId ?? null,
        stripeSessionId: session.id,
        amountUsd,
        userId,
      });
      await recordBillingInvoiceFromCheckout({
        userId,
        amountUsd,
        planId: "strategy_call",
        stripeSessionId: session.id,
        paymentMethod: "card",
      });
    } catch (e) {
      console.error("Stripe webhook: paid strategy call fulfill failed", e);
    }
    console.info("Stripe webhook: paid strategy call received", {
      userId,
      sessionId: session.id,
      amountUsd,
    });
    return NextResponse.json({ received: true, strategyCall: true });
  }

  /** Nova Store merch — mark order paid + capture shipping address. Never grant VIP. */
  if ((session.metadata?.purpose ?? "").toString() === "nova_store_order") {
    const orderId = (session.metadata?.orderId ?? "").toString();
    const amountUsd =
      session.amount_total != null
        ? session.amount_total / 100
        : 0;
    const details = session.customer_details;
    const collectedShip = session.collected_information?.shipping_details;
    const ship = collectedShip?.address ?? null;
    const shipName = collectedShip?.name ?? details?.name ?? null;

    try {
      const { storeDb } = await import("@/lib/nova-store/db");
      let newlyPaid = 0;
      if (orderId) {
        const updated = await storeDb.storeOrder.updateMany({
          where: {
            OR: [{ id: orderId }, { stripeSessionId: session.id }],
            status: { in: ["pending", "cancelled"] },
          },
          data: {
            status: "paid",
            stripeSessionId: session.id,
            paidAt: new Date(),
            email: details?.email ?? undefined,
            shipName: shipName ?? undefined,
            shipLine1: ship?.line1 ?? undefined,
            shipLine2: ship?.line2 ?? undefined,
            shipCity: ship?.city ?? undefined,
            shipState: ship?.state ?? undefined,
            shipPostal: ship?.postal_code ?? undefined,
            shipCountry: ship?.country ?? undefined,
            shipPhone: details?.phone ?? undefined,
            totalCents: session.amount_total ?? undefined,
          },
        });
        newlyPaid = updated.count;
      } else {
        const updated = await storeDb.storeOrder.updateMany({
          where: {
            stripeSessionId: session.id,
            status: { in: ["pending", "cancelled"] },
          },
          data: {
            status: "paid",
            paidAt: new Date(),
            shipName: shipName ?? undefined,
            shipLine1: ship?.line1 ?? undefined,
            shipLine2: ship?.line2 ?? undefined,
            shipCity: ship?.city ?? undefined,
            shipState: ship?.state ?? undefined,
            shipPostal: ship?.postal_code ?? undefined,
            shipCountry: ship?.country ?? undefined,
            shipPhone: details?.phone ?? undefined,
          },
        });
        newlyPaid = updated.count;
      }

      await recordBillingInvoiceFromCheckout({
        userId,
        amountUsd,
        planId: "nova_store",
        stripeSessionId: session.id,
        paymentMethod: "card",
      });

      /** Alert owner once per pending → paid transition (skip Stripe retries). */
      if (newlyPaid > 0) {
        const order = await storeDb.storeOrder.findFirst({
          where: orderId
            ? { OR: [{ id: orderId }, { stripeSessionId: session.id }] }
            : { stripeSessionId: session.id },
        });
        if (order) {
          const { sendStoreOrderOwnerAlert } = await import("@/lib/nova-store/owner-alert-email");
          const alert = await sendStoreOrderOwnerAlert(order);
          if (!alert.ok) {
            console.warn("Stripe webhook: nova store owner alert failed", alert.error);
          }
        }
      }
    } catch (e) {
      console.error("Stripe webhook: nova store order failed", e);
    }
    console.info("Stripe webhook: nova store order paid", {
      userId,
      sessionId: session.id,
      orderId,
      amountUsd,
    });
    return NextResponse.json({ received: true, novaStore: true });
  }

  const planId = (session.metadata?.planId ?? session.metadata?.plan ?? "").toString();
  const amountUsd = parseInt(session.metadata?.amountUsd ?? "0", 10) || 0;
  const autoRenew = session.metadata?.autoRenew === "true" || session.mode === "subscription";
  const totalPaid = session.amount_total != null ? session.amount_total / 100 : 0;
  const plan = resolvePlan(planId, amountUsd, totalPaid);

  if (!plan) {
    console.error("Stripe webhook: invalid plan", { planId, amountUsd, totalPaid });
    return NextResponse.json({ error: "Invalid plan." }, { status: 400 });
  }

  const existing = await prisma.subscription.findFirst({
    where: { stripeSessionId: session.id } as Record<string, unknown>,
  });
  if (existing) {
    return NextResponse.json({ received: true, message: "Already processed." });
  }

  if (session.mode === "subscription" && session.subscription && stripe) {
    const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
    const customerId = typeof stripeSub.customer === "string" ? stripeSub.customer : stripeSub.customer?.id;
    if (customerId) await setStripeCustomerId(userId, customerId);

    const isTrial =
      stripeSub.status === "trialing" ||
      session.metadata?.vipTrial === "true" ||
      stripeSub.metadata?.vipTrial === "true";
    const trialEndsAt = trialEndFromStripeSubscription(stripeSub);
    const periodEnd = vipAccessEndFromStripeSubscription(stripeSub);

    await upsertSubscriptionFromStripePeriod({
      userId,
      planId: plan.id,
      amountUsd: amountUsd || plan.priceUsd,
      periodEnd,
      stripeSessionId: session.id,
      stripeSubscriptionId: stripeSub.id,
      autoRenew: true,
      isTrial,
      trialEndsAt,
    });

    if (isTrial) {
      try {
        await prisma.user.update({
          where: { id: userId },
          data: { vipTrialUsedAt: new Date() } as Record<string, unknown>,
        });
      } catch (e) {
        console.warn("Stripe webhook: could not set vipTrialUsedAt", e);
      }
      const userEmail = (
        await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
      )?.email;
      if (userEmail) {
        await logVipTrialEmail({
          userId,
          email: userEmail,
          kind: "trial_started",
          success: true,
          meta: {
            planId: plan.id,
            trialEndsAt: trialEndsAt?.toISOString() ?? null,
            stripeSubscriptionId: stripeSub.id,
          },
        });
      }
    }
  } else {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + plan.months);

    const created = await prisma.subscription.create({
      data: {
        userId,
        tier: "vip",
        plan: plan.id,
        amountUsd: amountUsd || plan.priceUsd,
        expiresAt,
        stripeSessionId: session.id,
        autoRenew: false,
      } as Record<string, unknown>,
    });
    await recordReferralCommissionForSubscription(created.id);
    await recordBillingInvoiceFromSubscriptionRow({
      userId,
      subscriptionId: created.id,
      amountUsd: amountUsd || plan.priceUsd,
      planId: plan.id,
      paidAt: new Date(),
      periodEnd: expiresAt,
      stripeSessionId: session.id,
      paymentMethod: "card",
    });
  }

  const invoiceId =
    typeof session.invoice === "string" ? session.invoice : (session.invoice as { id?: string } | null)?.id;
  let hostedInvoiceUrl: string | null = null;
  let invoicePdfUrl: string | null = null;
  if (invoiceId && stripe) {
    try {
      const inv = await stripe.invoices.retrieve(invoiceId);
      hostedInvoiceUrl = inv.hosted_invoice_url ?? null;
      invoicePdfUrl = inv.invoice_pdf ?? null;
      await recordBillingInvoiceFromStripeInvoice(inv, userId);
    } catch {
      /* fall through to session-based record */
    }
  }
  if (!invoiceId) {
    const periodEnd =
      session.mode === "subscription" && session.subscription && stripe
        ? periodEndFromStripeSubscription(
            await stripe.subscriptions.retrieve(session.subscription as string)
          )
        : (() => {
            const d = new Date();
            d.setMonth(d.getMonth() + plan.months);
            return d;
          })();
    await recordBillingInvoiceFromCheckout({
      userId,
      amountUsd: amountUsd || plan.priceUsd,
      planId: plan.id,
      stripeSessionId: session.id,
      hostedInvoiceUrl,
      invoicePdfUrl,
      periodEnd,
      paymentMethod: "card",
    });
  }

  console.info("Stripe webhook: subscription created", {
    userId,
    tier: "vip",
    planId: plan.id,
    sessionId: session.id,
    autoRenew,
  });
  return NextResponse.json({ received: true });
}

async function syncStripeSubscription(stripeSub: Stripe.Subscription) {
  const db = prisma as unknown as {
    subscription: {
      findFirst: (args: unknown) => Promise<{
        id: string;
        userId: string;
      } | null>;
      update: (args: unknown) => Promise<unknown>;
    };
  };

  let subRow = await db.subscription.findFirst({
    where: { stripeSubscriptionId: stripeSub.id },
  });

  const userId = stripeSub.metadata?.userId;
  const planId = stripeSub.metadata?.planId ?? "";

  if ((stripeSub.metadata?.purpose ?? "").toString() === "trading_university_donation") {
    console.info("Stripe webhook: donation subscription sync (no VIP)", {
      subscriptionId: stripeSub.id,
      userId,
      status: stripeSub.status,
    });
    return;
  }

  const plan = resolvePlan(planId, 0, 0);

  if (!subRow && userId && plan) {
    const isTrial =
      stripeSub.status === "trialing" || stripeSub.metadata?.vipTrial === "true";
    await upsertSubscriptionFromStripePeriod({
      userId,
      planId: plan.id,
      amountUsd: plan.priceUsd,
      periodEnd: vipAccessEndFromStripeSubscription(stripeSub),
      stripeSubscriptionId: stripeSub.id,
      autoRenew: stripeSub.status === "active" || stripeSub.status === "trialing",
      isTrial,
      trialEndsAt: trialEndFromStripeSubscription(stripeSub),
    });
    subRow = await db.subscription.findFirst({ where: { stripeSubscriptionId: stripeSub.id } });
  }

  if (!subRow) return;

  const stillTrial = stripeSub.status === "trialing";
  await db.subscription.update({
    where: { id: subRow.id },
    data: {
      expiresAt: vipAccessEndFromStripeSubscription(stripeSub),
      autoRenew: stripeSub.status === "active" || stripeSub.status === "trialing",
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
      isTrial: stillTrial,
      trialEndsAt: stillTrial ? trialEndFromStripeSubscription(stripeSub) : null,
    },
  });

  // First paid invoice after trial — create referral commission if missing.
  if (!stillTrial && stripeSub.status === "active") {
    try {
      await recordReferralCommissionForSubscription(subRow.id);
    } catch {
      /* already exists or not eligible */
    }
  }
}

/** POST - Stripe webhook: checkout, renewals, subscription lifecycle. */
export async function POST(request: Request) {
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const body = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature." }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid signature";
    console.error("Stripe webhook signature error:", msg);
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        return await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice & {
          subscription?: string | Stripe.Subscription | null;
        };
        const customerId =
          typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id ?? null;
        const userId = customerId ? await findUserIdByStripeCustomerId(customerId) : null;
        if (userId) {
          await recordBillingInvoiceFromStripeInvoice(invoice, userId);
        }
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id ?? null;
        if (subId) {
          const stripeSub = await stripe!.subscriptions.retrieve(subId);
          await syncStripeSubscription(stripeSub);
        }
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const stripeSub = event.data.object as Stripe.Subscription;
        await syncStripeSubscription(stripeSub);
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (e) {
    console.error("Stripe webhook handler error:", e);
    return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
  }
}
