import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { VIP_PLANS } from "@/lib/subscription";

export type BillingInvoiceRow = {
  id: string;
  amountUsd: number;
  currency: string;
  plan: string | null;
  description: string;
  status: string;
  paidAt: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  paymentMethod: string | null;
};

function planLabel(planId: string | null | undefined): string {
  if (!planId) return "NovaStaris VIP";
  if (planId === "donation_once") return "Trading University donation (one-time)";
  if (planId === "donation_monthly") return "Trading University donation (monthly)";
  if (planId === "strategy_call") return "Strategy call (1 hour)";
  return VIP_PLANS.find((p) => p.id === planId)?.label ?? `VIP (${planId})`;
}

function monthRange(monthKey: string): { start: Date; end: Date } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) return null;
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

type InvoiceDb = {
  findUnique: (args: { where: { stripeInvoiceId?: string; id?: string } }) => Promise<{ id: string } | null>;
  upsert: (args: { where: { stripeInvoiceId: string }; create: object; update: object }) => Promise<unknown>;
  create: (args: { data: object }) => Promise<unknown>;
  findMany: (args: {
    where: object;
    orderBy: { paidAt: "desc" };
    take?: number;
  }) => Promise<
    {
      id: string;
      amountUsd: number;
      currency: string;
      plan: string | null;
      description: string | null;
      status: string;
      paidAt: Date;
      periodStart: Date | null;
      periodEnd: Date | null;
      hostedInvoiceUrl: string | null;
      invoicePdfUrl: string | null;
      paymentMethod: string | null;
    }[]
  >;
};

function invoiceDb(): InvoiceDb {
  return (prisma as unknown as { billingInvoice: InvoiceDb }).billingInvoice;
}

export async function recordBillingInvoiceFromStripeInvoice(
  invoice: Stripe.Invoice,
  userId: string
): Promise<void> {
  if (!invoice.id) return;
  const amountUsd = Math.round((invoice.amount_paid ?? invoice.total ?? 0) / 100);
  if (amountUsd <= 0 && invoice.status !== "paid") return;

  const paidAtSec = invoice.status_transitions?.paid_at ?? invoice.created;
  const paidAt = new Date((paidAtSec ?? invoice.created) * 1000);
  const periodStart = invoice.period_start ? new Date(invoice.period_start * 1000) : paidAt;
  const periodEnd = invoice.period_end ? new Date(invoice.period_end * 1000) : null;
  const planId =
    (invoice.lines?.data?.[0]?.metadata?.planId as string | undefined) ??
    (invoice.metadata?.planId as string | undefined) ??
    null;

  await invoiceDb().upsert({
    where: { stripeInvoiceId: invoice.id },
    create: {
      userId,
      stripeInvoiceId: invoice.id,
      amountUsd,
      currency: (invoice.currency ?? "usd").toLowerCase(),
      plan: planId,
      description: invoice.description ?? planLabel(planId),
      status: invoice.status ?? "paid",
      paidAt,
      periodStart,
      periodEnd,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
      paymentMethod: "card",
    },
    update: {
      amountUsd,
      status: invoice.status ?? "paid",
      paidAt,
      periodStart,
      periodEnd,
      hostedInvoiceUrl: invoice.hosted_invoice_url ?? null,
      invoicePdfUrl: invoice.invoice_pdf ?? null,
    },
  });
}

export async function recordBillingInvoiceFromCheckout(input: {
  userId: string;
  amountUsd: number;
  planId: string;
  stripeSessionId: string;
  stripeInvoiceId?: string | null;
  hostedInvoiceUrl?: string | null;
  invoicePdfUrl?: string | null;
  paidAt?: Date;
  periodEnd?: Date;
  paymentMethod?: "card" | "usdc";
}): Promise<void> {
  const paidAt = input.paidAt ?? new Date();
  const data = {
    userId: input.userId,
    stripeInvoiceId: input.stripeInvoiceId ?? null,
    stripeSessionId: input.stripeSessionId,
    amountUsd: input.amountUsd,
    currency: "usd",
    plan: input.planId,
    description: planLabel(input.planId),
    status: "paid",
    paidAt,
    periodStart: paidAt,
    periodEnd: input.periodEnd ?? null,
    hostedInvoiceUrl: input.hostedInvoiceUrl ?? null,
    invoicePdfUrl: input.invoicePdfUrl ?? null,
    paymentMethod: input.paymentMethod ?? "card",
  };

  if (input.stripeInvoiceId) {
    await invoiceDb().upsert({
      where: { stripeInvoiceId: input.stripeInvoiceId },
      create: data,
      update: {
        amountUsd: data.amountUsd,
        paidAt: data.paidAt,
        periodEnd: data.periodEnd,
        hostedInvoiceUrl: data.hostedInvoiceUrl,
        invoicePdfUrl: data.invoicePdfUrl,
      },
    });
    return;
  }

  if (input.stripeSessionId) {
    const existing = await (
      prisma as unknown as {
        billingInvoice: { findUnique: (args: { where: { stripeSessionId: string } }) => Promise<{ id: string } | null> };
      }
    ).billingInvoice.findUnique({ where: { stripeSessionId: input.stripeSessionId } });
    if (existing) return;
  }

  await invoiceDb().create({ data });
}

export async function recordBillingInvoiceFromSubscriptionRow(input: {
  userId: string;
  subscriptionId: string;
  amountUsd: number;
  planId: string;
  paidAt: Date;
  periodEnd: Date;
  stripeSessionId?: string | null;
  paymentMethod?: "card" | "usdc";
}): Promise<void> {
  const id = `sub_${input.subscriptionId}`;
  const existing = await invoiceDb().findUnique({ where: { id } }).catch(() => null);
  if (existing) return;

  await invoiceDb().create({
    data: {
      id,
      userId: input.userId,
      stripeSessionId: input.stripeSessionId ?? null,
      amountUsd: input.amountUsd,
      currency: "usd",
      plan: input.planId,
      description: planLabel(input.planId),
      status: "paid",
      paidAt: input.paidAt,
      periodStart: input.paidAt,
      periodEnd: input.periodEnd,
      paymentMethod: input.paymentMethod ?? (input.stripeSessionId ? "card" : "usdc"),
    },
  });
}

/** Complimentary VIP from admin — recorded for audit; excluded from SickKids VIP tally. */
export async function recordBillingInvoiceFromAdminGrant(input: {
  userId: string;
  planId: string;
  grantLabel: string;
  adminTag: string;
  periodEnd: Date;
  paidAt?: Date;
}): Promise<void> {
  const paidAt = input.paidAt ?? new Date();
  const existing = await (
    prisma as unknown as {
      billingInvoice: {
        findUnique: (args: { where: { stripeSessionId: string } }) => Promise<{ id: string } | null>;
      };
    }
  ).billingInvoice.findUnique({ where: { stripeSessionId: input.adminTag } }).catch(() => null);
  if (existing) return;

  await invoiceDb().create({
    data: {
      userId: input.userId,
      stripeSessionId: input.adminTag,
      amountUsd: 0,
      currency: "usd",
      plan: input.planId,
      description: `Complimentary VIP — ${input.grantLabel} (admin grant)`,
      status: "paid",
      paidAt,
      periodStart: paidAt,
      periodEnd: input.periodEnd,
      paymentMethod: "admin_grant",
    },
  });
}

export async function listUserBillingInvoices(
  userId: string,
  opts?: { month?: string | null; limit?: number }
): Promise<BillingInvoiceRow[]> {
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));
  const where: { userId: string; paidAt?: { gte: Date; lt: Date } } = { userId };
  const range = opts?.month ? monthRange(opts.month) : null;
  if (range) {
    where.paidAt = { gte: range.start, lt: range.end };
  }

  const rows = await invoiceDb().findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    amountUsd: r.amountUsd,
    currency: r.currency,
    plan: r.plan,
    description: r.description ?? planLabel(r.plan),
    status: r.status,
    paidAt: r.paidAt.toISOString(),
    periodStart: r.periodStart?.toISOString() ?? null,
    periodEnd: r.periodEnd?.toISOString() ?? null,
    hostedInvoiceUrl: r.hostedInvoiceUrl,
    invoicePdfUrl: r.invoicePdfUrl,
    paymentMethod: r.paymentMethod,
  }));
}

export async function findUserIdByStripeCustomerId(customerId: string): Promise<string | null> {
  const user = await (
    prisma as unknown as {
      user: { findFirst: (args: { where: { stripeCustomerId: string }; select: { id: true } }) => Promise<{ id: string } | null> };
    }
  ).user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return user?.id ?? null;
}
