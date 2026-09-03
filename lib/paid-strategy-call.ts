/**
 * Paid Strategy call ($200 / 1 hour) — config, orders, confirmation emails.
 * Scheduling is manual after Stripe payment (Calendly Free — one Discovery event only).
 */

import { prisma } from "@/lib/db";
import { buildNovaBrandedEmailHtml } from "@/lib/announcement-email";
import { sendEmailDetailed } from "@/lib/send-email";

export const PAID_STRATEGY_CALL_CONFIG_ID = "default";
export const PAID_STRATEGY_CALL_PRICE_USD_DEFAULT = 200;
export const PAID_STRATEGY_CALL_PURPOSE = "paid_strategy_call";
export const PAID_STRATEGY_CALL_PAGE_PATH = "/strategy-call";
export const PAID_STRATEGY_CALL_PAGE_URL = "https://novastaris.ai/strategy-call";

export type PaidStrategyCallConfigAdmin = {
  enabled: boolean;
  showNavButton: boolean;
  priceUsd: number;
  confirmationSubject: string;
  confirmationBody: string;
  scheduleSubject: string;
  scheduleBody: string;
  updatedAt: string | null;
};

export type PaidStrategyCallPublicConfig = {
  enabled: boolean;
  showNavButton: boolean;
  priceUsd: number;
};

export type PaidStrategyCallOrderRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  amountUsd: number;
  status: string;
  stripeCheckoutSessionId: string | null;
  confirmationEmailSentAt: string | null;
  notes: string;
  paidAt: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type StrategyCallEmailVars = {
  name: string;
  firstName: string;
  phone: string;
  email: string;
  amountUsd: string;
};

export const DEFAULT_CONFIRMATION_SUBJECT =
  "Strategy call confirmed — we will contact you within 24 hours";

export const DEFAULT_CONFIRMATION_BODY = `Hi {{firstName}},

Thank you for purchasing a NovaStaris Strategy call.

Payment received: {{amountUsd}} USD for a 1-hour session with our experts.

What happens next:
• One of our experts will contact you within 24 hours by email and phone to schedule your call.
• We will use the phone number you provided: {{phone}}
• Please watch your inbox (and spam folder) for our message.

This is not a Calendly self-serve booking — we schedule personally to avoid conflicts and match you with the right expert.

Need help in the meantime? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai`;

export const DEFAULT_SCHEDULE_SUBJECT = "Let's schedule your NovaStaris Strategy call";

export const DEFAULT_SCHEDULE_BODY = `Hi {{firstName}},

Thank you again for your Strategy call purchase ({{amountUsd}} USD).

I'd like to book your 1-hour session. Please reply with 2–3 time windows that work for you over the next few days (include your timezone), or confirm a time if I propose one below.

We'll also reach you at {{phone}} if needed.

Looking forward to the session.

— The NovaStaris team
https://novastaris.ai`;

const DEFAULT_CONFIG: PaidStrategyCallConfigAdmin = {
  enabled: false,
  showNavButton: true,
  priceUsd: PAID_STRATEGY_CALL_PRICE_USD_DEFAULT,
  confirmationSubject: "",
  confirmationBody: "",
  scheduleSubject: "",
  scheduleBody: "",
  updatedAt: null,
};

type ConfigRow = {
  enabled: boolean;
  showNavButton?: boolean;
  priceUsd?: number;
  confirmationSubject?: string | null;
  confirmationBody?: string | null;
  scheduleSubject?: string | null;
  scheduleBody?: string | null;
  updatedAt?: Date;
};

type OrderRow = {
  id: string;
  userId: string | null;
  email: string;
  name: string;
  phone: string;
  amountUsd: number;
  status: string;
  stripeCheckoutSessionId: string | null;
  confirmationEmailSentAt: Date | null;
  ownerAlertSentAt?: Date | null;
  notes: string;
  paidAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

type ConfigDb = {
  findUnique: (args: { where: { id: string } }) => Promise<ConfigRow | null>;
  upsert: (args: {
    where: { id: string };
    create: {
      id: string;
      enabled: boolean;
      showNavButton: boolean;
      priceUsd: number;
      confirmationSubject: string;
      confirmationBody: string;
      scheduleSubject: string;
      scheduleBody: string;
    };
    update: {
      enabled: boolean;
      showNavButton: boolean;
      priceUsd: number;
      confirmationSubject: string;
      confirmationBody: string;
      scheduleSubject: string;
      scheduleBody: string;
    };
  }) => Promise<unknown>;
};

type OrderDb = {
  findUnique: (args: {
    where: { id?: string; stripeCheckoutSessionId?: string };
  }) => Promise<OrderRow | null>;
  findMany: (args: {
    orderBy: { createdAt: "desc" };
    take?: number;
  }) => Promise<OrderRow[]>;
  create: (args: { data: object }) => Promise<OrderRow>;
  update: (args: { where: { id: string }; data: object }) => Promise<OrderRow>;
};

function configStore(): ConfigDb | null {
  return (prisma as unknown as { paidStrategyCallConfig?: ConfigDb }).paidStrategyCallConfig ?? null;
}

function orderStore(): OrderDb | null {
  return (prisma as unknown as { paidStrategyCallOrder?: OrderDb }).paidStrategyCallOrder ?? null;
}

function normalizePhone(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export function isValidPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 8 && digits.length <= 15;
}

function toOrderRow(r: OrderRow): PaidStrategyCallOrderRow {
  return {
    id: r.id,
    userId: r.userId,
    email: r.email,
    name: r.name,
    phone: r.phone,
    amountUsd: r.amountUsd,
    status: r.status,
    stripeCheckoutSessionId: r.stripeCheckoutSessionId,
    confirmationEmailSentAt: r.confirmationEmailSentAt?.toISOString() ?? null,
    notes: r.notes ?? "",
    paidAt: r.paidAt?.toISOString() ?? null,
    completedAt: r.completedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  };
}

export const ADMIN_EMAIL_DRAFT_STORAGE_KEY = "novastaris_admin_email_draft";

export function fillStrategyCallEmailTemplate(
  template: string,
  vars: StrategyCallEmailVars
): string {
  return template
    .replace(/\{\{firstName\}\}/gi, vars.firstName)
    .replace(/\{\{name\}\}/gi, vars.name)
    .replace(/\{\{phone\}\}/gi, vars.phone)
    .replace(/\{\{email\}\}/gi, vars.email)
    .replace(/\{\{amountUsd\}\}/gi, vars.amountUsd);
}

export function strategyCallEmailVarsFrom(order: {
  name: string;
  phone: string;
  email: string;
  amountUsd: number;
}): StrategyCallEmailVars {
  const name = order.name.trim() || "there";
  return {
    name,
    firstName: name.split(/\s+/)[0] || "there",
    phone: order.phone,
    email: order.email,
    amountUsd: String(Math.round(order.amountUsd)),
  };
}

export function resolveConfirmationEmail(cfg: PaidStrategyCallConfigAdmin): { subject: string; body: string } {
  return {
    subject: cfg.confirmationSubject.trim() || DEFAULT_CONFIRMATION_SUBJECT,
    body: cfg.confirmationBody.trim() || DEFAULT_CONFIRMATION_BODY,
  };
}

export function resolveScheduleEmail(cfg: PaidStrategyCallConfigAdmin): { subject: string; body: string } {
  return {
    subject: cfg.scheduleSubject.trim() || DEFAULT_SCHEDULE_SUBJECT,
    body: cfg.scheduleBody.trim() || DEFAULT_SCHEDULE_BODY,
  };
}

export async function getPaidStrategyCallConfig(): Promise<PaidStrategyCallConfigAdmin> {
  const db = configStore();
  if (!db) return { ...DEFAULT_CONFIG };
  try {
    const row = await db.findUnique({ where: { id: PAID_STRATEGY_CALL_CONFIG_ID } });
    if (!row) return { ...DEFAULT_CONFIG };
    const price = typeof row.priceUsd === "number" && row.priceUsd > 0 ? row.priceUsd : PAID_STRATEGY_CALL_PRICE_USD_DEFAULT;
    return {
      enabled: row.enabled === true,
      showNavButton: row.showNavButton !== false,
      priceUsd: price,
      confirmationSubject: (row.confirmationSubject ?? "").trim(),
      confirmationBody: (row.confirmationBody ?? "").trim(),
      scheduleSubject: (row.scheduleSubject ?? "").trim(),
      scheduleBody: (row.scheduleBody ?? "").trim(),
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export async function setPaidStrategyCallConfig(patch: {
  enabled?: boolean;
  showNavButton?: boolean;
  priceUsd?: number;
  confirmationSubject?: string;
  confirmationBody?: string;
  scheduleSubject?: string;
  scheduleBody?: string;
}): Promise<PaidStrategyCallConfigAdmin> {
  const db = configStore();
  if (!db) throw new Error("Paid Strategy call config unavailable.");
  const current = await getPaidStrategyCallConfig();
  let priceUsd = current.priceUsd;
  if (typeof patch.priceUsd === "number") {
    const n = Math.round(patch.priceUsd);
    if (!Number.isFinite(n) || n < 1 || n > 10_000) throw new Error("Price must be between $1 and $10,000.");
    priceUsd = n;
  }
  const next = {
    enabled: patch.enabled ?? current.enabled,
    showNavButton: patch.showNavButton ?? current.showNavButton,
    priceUsd,
    confirmationSubject:
      patch.confirmationSubject !== undefined ? patch.confirmationSubject : current.confirmationSubject,
    confirmationBody: patch.confirmationBody !== undefined ? patch.confirmationBody : current.confirmationBody,
    scheduleSubject: patch.scheduleSubject !== undefined ? patch.scheduleSubject : current.scheduleSubject,
    scheduleBody: patch.scheduleBody !== undefined ? patch.scheduleBody : current.scheduleBody,
  };
  await db.upsert({
    where: { id: PAID_STRATEGY_CALL_CONFIG_ID },
    create: { id: PAID_STRATEGY_CALL_CONFIG_ID, ...next },
    update: next,
  });
  return getPaidStrategyCallConfig();
}

export function toPaidStrategyCallPublic(cfg: PaidStrategyCallConfigAdmin): PaidStrategyCallPublicConfig {
  return {
    enabled: cfg.enabled,
    showNavButton: cfg.enabled && cfg.showNavButton,
    priceUsd: cfg.priceUsd,
  };
}

export async function createPendingPaidStrategyCallOrder(input: {
  userId: string;
  email: string;
  name: string;
  phone: string;
  amountUsd: number;
}): Promise<PaidStrategyCallOrderRow> {
  const db = orderStore();
  if (!db) throw new Error("Paid Strategy call orders unavailable.");
  const phone = normalizePhone(input.phone);
  if (!isValidPhone(phone)) throw new Error("Enter a valid phone number (include country code).");
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) throw new Error("Valid email is required.");
  const row = await db.create({
    data: {
      userId: input.userId,
      email,
      name,
      phone,
      amountUsd: input.amountUsd,
      status: "pending",
    },
  });
  return toOrderRow(row);
}

export async function attachStripeSessionToOrder(orderId: string, stripeSessionId: string): Promise<void> {
  const db = orderStore();
  if (!db) return;
  await db.update({
    where: { id: orderId },
    data: { stripeCheckoutSessionId: stripeSessionId },
  });
}

export async function getPaidStrategyCallOrderById(id: string): Promise<PaidStrategyCallOrderRow | null> {
  const db = orderStore();
  if (!db) return null;
  try {
    const row = await db.findUnique({ where: { id } });
    return row ? toOrderRow(row) : null;
  } catch {
    return null;
  }
}

export async function getPaidStrategyCallOrderBySession(
  stripeCheckoutSessionId: string
): Promise<PaidStrategyCallOrderRow | null> {
  const db = orderStore();
  if (!db) return null;
  try {
    const row = await db.findUnique({ where: { stripeCheckoutSessionId } });
    return row ? toOrderRow(row) : null;
  } catch {
    return null;
  }
}

export async function listPaidStrategyCallOrders(take = 200): Promise<PaidStrategyCallOrderRow[]> {
  const db = orderStore();
  if (!db) return [];
  try {
    const rows = await db.findMany({ orderBy: { createdAt: "desc" }, take });
    return rows.map(toOrderRow);
  } catch {
    return [];
  }
}

export async function updatePaidStrategyCallOrderStatus(
  id: string,
  patch: { status?: string; notes?: string; completedAt?: string | null }
): Promise<PaidStrategyCallOrderRow> {
  const db = orderStore();
  if (!db) throw new Error("Paid Strategy call orders unavailable.");
  const allowed = new Set(["pending", "paid", "contacted", "completed", "cancelled"]);
  const data: Record<string, unknown> = {};
  if (patch.status) {
    if (!allowed.has(patch.status)) throw new Error("Invalid status.");
    data.status = patch.status;
    if (patch.status === "completed") data.completedAt = new Date();
  }
  if (patch.notes !== undefined) data.notes = patch.notes.trim();
  if (patch.completedAt) {
    const d = new Date(patch.completedAt);
    if (!Number.isNaN(d.getTime())) data.completedAt = d;
  }
  const row = await db.update({ where: { id }, data });
  return toOrderRow(row);
}

function ownerEmails(): string[] {
  return (process.env.OWNER_EMAIL ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter((e) => e.includes("@"));
}

export async function sendPaidStrategyCallConfirmationEmail(order: {
  email: string;
  name: string;
  phone: string;
  amountUsd: number;
}): Promise<{ ok: boolean; error?: string }> {
  const cfg = await getPaidStrategyCallConfig();
  const tpl = resolveConfirmationEmail(cfg);
  const vars = strategyCallEmailVarsFrom(order);
  const subject = fillStrategyCallEmailTemplate(tpl.subject, vars);
  const body = fillStrategyCallEmailTemplate(tpl.body, vars);

  const html = buildNovaBrandedEmailHtml({
    body,
    eyebrow: "Strategy call",
    ctaLabel: "Open NovaStaris",
    ctaUrl: "https://novastaris.ai",
  });

  return sendEmailDetailed(order.email, subject, html);
}

export async function sendPaidStrategyCallOwnerAlert(order: {
  id: string;
  email: string;
  name: string;
  phone: string;
  amountUsd: number;
}): Promise<void> {
  const recipients = ownerEmails();
  if (!recipients.length) return;
  const body = `New paid Strategy call

Name: ${order.name}
Email: ${order.email}
Phone: ${order.phone}
Amount: $${order.amountUsd.toFixed(0)} USD
Order: ${order.id}

Contact them within 24 hours to schedule the 1-hour session.`;
  const html = buildNovaBrandedEmailHtml({
    body,
    eyebrow: "Admin alert",
  });
  await Promise.all(
    recipients.map((to) =>
      sendEmailDetailed(to, `New Strategy call payment — ${order.name}`, html).catch(() => ({ ok: false as const }))
    )
  );
}

/** Mark order paid, send emails once, optionally update user phone. */
export async function fulfillPaidStrategyCallOrder(args: {
  orderId?: string | null;
  stripeSessionId: string;
  amountUsd: number;
  userId?: string | null;
}): Promise<PaidStrategyCallOrderRow | null> {
  const db = orderStore();
  if (!db) return null;

  let order =
    (args.orderId ? await db.findUnique({ where: { id: args.orderId } }) : null) ??
    (await db.findUnique({ where: { stripeCheckoutSessionId: args.stripeSessionId } }));

  if (!order) return null;

  const alreadyPaid = order.status === "paid" || order.status === "contacted" || order.status === "completed";
  if (!alreadyPaid) {
    order = await db.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paidAt: new Date(),
        amountUsd: args.amountUsd > 0 ? args.amountUsd : order.amountUsd,
        stripeCheckoutSessionId: args.stripeSessionId,
      },
    });
  }

  if (args.userId && order.phone) {
    try {
      const user = await (
        prisma as unknown as {
          user: {
            findUnique: (a: { where: { id: string }; select: { phone: true } }) => Promise<{ phone: string | null } | null>;
            update: (a: { where: { id: string }; data: { phone: string } }) => Promise<unknown>;
          };
        }
      ).user.findUnique({ where: { id: args.userId }, select: { phone: true } });
      if (user && !(user.phone ?? "").trim()) {
        await (
          prisma as unknown as {
            user: { update: (a: { where: { id: string }; data: { phone: string } }) => Promise<unknown> };
          }
        ).user.update({ where: { id: args.userId }, data: { phone: order.phone } });
      }
    } catch {
      /* ignore */
    }
  }

  if (!order.confirmationEmailSentAt) {
    const sent = await sendPaidStrategyCallConfirmationEmail(order);
    if (sent.ok) {
      order = await db.update({
        where: { id: order.id },
        data: { confirmationEmailSentAt: new Date() },
      });
    }
  }

  if (!order.ownerAlertSentAt) {
    await sendPaidStrategyCallOwnerAlert(order);
    try {
      order = await db.update({
        where: { id: order.id },
        data: { ownerAlertSentAt: new Date() },
      });
    } catch {
      /* ignore */
    }
  }

  return toOrderRow(order);
}

export function buildPaidStrategyCallMarketingEmail(priceUsd = PAID_STRATEGY_CALL_PRICE_USD_DEFAULT): {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
} {
  return {
    subject: `NovaStaris Strategy call — $${priceUsd}/hour with our experts`,
    body: `Hi there,

Looking for a deeper working session with NovaStaris experts?

Our paid Strategy call is a focused 1-hour session to go beyond product orientation — trade workflow, desk setup, and how to use NovaStaris tools for your markets.

Investment: $${priceUsd} USD per hour
Format: 1-hour private session (scheduled after payment)

How it works:
1. Open the Strategy call page and share your name + phone number.
2. Pay securely with card via Stripe.
3. One of our experts contacts you within 24 hours by email and phone to book the session.

Learn more and book:
${PAID_STRATEGY_CALL_PAGE_URL}

Prefer a complimentary product introduction first? Book a Discovery call:
https://novastaris.ai/discovery-call

Need help? Use Chat or Support in the app at novastaris.ai — or reply to this email.

— The NovaStaris team
https://novastaris.ai`,
    ctaLabel: "View Strategy call",
    ctaUrl: PAID_STRATEGY_CALL_PAGE_URL,
  };
}

/** Owner follow-up after payment — ask for times to book the session. */
export function buildPaidStrategyCallScheduleEmail(): {
  subject: string;
  body: string;
  ctaLabel: string;
  ctaUrl: string;
} {
  return {
    subject: DEFAULT_SCHEDULE_SUBJECT,
    body: DEFAULT_SCHEDULE_BODY,
    ctaLabel: "Open dashboard",
    ctaUrl: "https://novastaris.ai",
  };
}

/** Personalize schedule template for a paid order (uses saved admin copy when available). */
export async function buildPersonalizedScheduleEmail(order: {
  name: string;
  phone: string;
  email: string;
  amountUsd: number;
}): Promise<{ subject: string; body: string; to: string }> {
  const cfg = await getPaidStrategyCallConfig();
  const tpl = resolveScheduleEmail(cfg);
  const vars = strategyCallEmailVarsFrom(order);
  return {
    to: order.email,
    subject: fillStrategyCallEmailTemplate(tpl.subject, vars),
    body: fillStrategyCallEmailTemplate(tpl.body, vars),
  };
}

/** Preview confirmation email with sample or order vars. */
export function previewConfirmationEmail(
  cfg: PaidStrategyCallConfigAdmin,
  vars?: Partial<StrategyCallEmailVars>
): { subject: string; body: string } {
  const tpl = resolveConfirmationEmail(cfg);
  const full: StrategyCallEmailVars = {
    name: vars?.name ?? "Alex Trader",
    firstName: vars?.firstName ?? "Alex",
    phone: vars?.phone ?? "+1 555 000 0000",
    email: vars?.email ?? "customer@email.com",
    amountUsd: vars?.amountUsd ?? String(cfg.priceUsd || PAID_STRATEGY_CALL_PRICE_USD_DEFAULT),
  };
  return {
    subject: fillStrategyCallEmailTemplate(tpl.subject, full),
    body: fillStrategyCallEmailTemplate(tpl.body, full),
  };
}

export function previewScheduleEmail(
  cfg: PaidStrategyCallConfigAdmin,
  vars?: Partial<StrategyCallEmailVars>
): { subject: string; body: string } {
  const tpl = resolveScheduleEmail(cfg);
  const full: StrategyCallEmailVars = {
    name: vars?.name ?? "Alex Trader",
    firstName: vars?.firstName ?? "Alex",
    phone: vars?.phone ?? "+1 555 000 0000",
    email: vars?.email ?? "customer@email.com",
    amountUsd: vars?.amountUsd ?? String(cfg.priceUsd || PAID_STRATEGY_CALL_PRICE_USD_DEFAULT),
  };
  return {
    subject: fillStrategyCallEmailTemplate(tpl.subject, full),
    body: fillStrategyCallEmailTemplate(tpl.body, full),
  };
}
