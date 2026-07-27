import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { storeDb } from "@/lib/nova-store/db";
import {
  STORE_DONATION_PER_ITEM_USD,
  VIP_DONATION_PER_SUBSCRIPTION_USD,
} from "@/lib/nova-store/giving";
import {
  CHARITY_PURPOSE_STORE,
  CHARITY_PURPOSE_VIP,
  STORE_DONATION_PER_ITEM_CENTS,
  VIP_DONATION_PER_SUB_CENTS,
  countItemsInOrder,
  parseOrderItems,
  summarizeStoreOrders,
} from "@/lib/nova-store/metrics";
import { VIP_PLANS } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const VIP_PLAN_IDS = new Set(VIP_PLANS.map((p) => p.id));

async function getCharitySettings(): Promise<{
  vipDonationStartsAt: Date | null;
  storeDonationStartsAt: Date | null;
}> {
  const row = await storeDb.storeCharitySettings
    .findUnique({ where: { id: "default" } })
    .catch(() => null);
  if (row) {
    return {
      vipDonationStartsAt: row.vipDonationStartsAt ? new Date(row.vipDonationStartsAt) : null,
      storeDonationStartsAt: row.storeDonationStartsAt
        ? new Date(row.storeDonationStartsAt)
        : null,
    };
  }
  // Fallback if migration not applied: treat VIP as starting now so history doesn't count
  return { vipDonationStartsAt: new Date(), storeDonationStartsAt: null };
}

async function loadDashboardPayload() {
  const settings = await getCharitySettings();

  const vipWhere: Record<string, unknown> = {
    status: "paid",
    plan: { in: [...VIP_PLAN_IDS] },
    /** Only real customer payments — exclude admin free grants and $0 comps. */
    amountUsd: { gt: 0 },
    OR: [
      { paymentMethod: { in: ["card", "usdc"] } },
      // Legacy invoices before paymentMethod was set: Stripe sessions = card.
      { paymentMethod: null, stripeSessionId: { not: null } },
    ],
  };
  if (settings.vipDonationStartsAt) {
    vipWhere.paidAt = { gte: settings.vipDonationStartsAt };
  }

  const [orders, remittances, vipInvoices] = await Promise.all([
    storeDb.storeOrder.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: { user: { select: { id: true, email: true, name: true } } },
    }),
    storeDb.storeCharityRemittance.findMany({
      orderBy: { paidAt: "desc" },
      take: 200,
    }),
    (prisma as unknown as {
      billingInvoice: {
        findMany: (args: unknown) => Promise<
          Array<{
            id: string;
            userId: string;
            amountUsd: number;
            plan: string | null;
            paidAt: Date;
            stripeSessionId: string | null;
            paymentMethod: string | null;
            user: { email: string | null; name: string | null } | null;
          }>
        >;
      };
    }).billingInvoice
      .findMany({
        where: vipWhere,
        orderBy: { paidAt: "desc" },
        take: 500,
        select: {
          id: true,
          userId: true,
          amountUsd: true,
          plan: true,
          paidAt: true,
          stripeSessionId: true,
          paymentMethod: true,
          user: { select: { email: true, name: true } },
        },
      })
      .catch(() => []),
  ]);

  const storeRemitted = remittances
    .filter((r: { purpose: string }) => r.purpose === CHARITY_PURPOSE_STORE)
    .reduce((s: number, r: { amountCents: number }) => s + r.amountCents, 0);
  const vipRemitted = remittances
    .filter((r: { purpose: string }) => r.purpose === CHARITY_PURPOSE_VIP)
    .reduce((s: number, r: { amountCents: number }) => s + r.amountCents, 0);

  const storeSummary = summarizeStoreOrders(
    orders,
    storeRemitted,
    settings.storeDonationStartsAt
  );
  const vipPurchases = Array.isArray(vipInvoices) ? vipInvoices.length : 0;
  const vipOwedCents = vipPurchases * VIP_DONATION_PER_SUB_CENTS;
  const vipOutstandingCents = Math.max(0, vipOwedCents - vipRemitted);

  const salesRows = orders
    .filter((o: { status: string }) => o.status === "paid" || o.status === "fulfilled")
    .map((o: any) => {
      const items = parseOrderItems(o.itemsJson);
      const itemCount = countItemsInOrder(o.itemsJson);
      return {
        id: o.id,
        email: o.email,
        buyerName: o.shipName || o.user?.name || null,
        userId: o.userId,
        status: o.status,
        totalCents: o.totalCents,
        currency: o.currency,
        itemCount,
        sickKidsCents: itemCount * STORE_DONATION_PER_ITEM_CENTS,
        items: items.map((i) => `${i.productName} (${i.variantLabel}) × ${i.quantity}`),
        shipSummary: [o.shipLine1, o.shipCity, o.shipState, o.shipPostal, o.shipCountry]
          .filter(Boolean)
          .join(", "),
        trackingNumber: o.trackingNumber ?? null,
        shippedEmailSentAt: o.shippedEmailSentAt ?? null,
        paidAt: o.paidAt,
        createdAt: o.createdAt,
      };
    });

  return {
    rates: {
      perStoreItemUsd: STORE_DONATION_PER_ITEM_USD,
      perVipUsd: VIP_DONATION_PER_SUBSCRIPTION_USD,
    },
    settings: {
      vipDonationStartsAt: settings.vipDonationStartsAt?.toISOString() ?? null,
      storeDonationStartsAt: settings.storeDonationStartsAt?.toISOString() ?? null,
    },
    store: storeSummary,
    vip: {
      purchases: vipPurchases,
      sickKidsOwedCents: vipOwedCents,
      sickKidsRemittedCents: vipRemitted,
      sickKidsOutstandingCents: vipOutstandingCents,
      /** Paid VIP invoices that count toward SickKids (card/USDC only). */
      countedPurchases: (Array.isArray(vipInvoices) ? vipInvoices : []).map((inv) => ({
        id: inv.id,
        email: inv.user?.email ?? null,
        name: inv.user?.name ?? null,
        plan: inv.plan,
        amountUsd: inv.amountUsd,
        paymentMethod: inv.paymentMethod ?? (inv.stripeSessionId ? "card" : null),
        paidAt: inv.paidAt instanceof Date ? inv.paidAt.toISOString() : String(inv.paidAt),
      })),
    },
    sales: salesRows,
    remittances,
  };
}

/** GET — sales dashboard + SickKids ledger. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const payload = await loadDashboardPayload();
    return NextResponse.json({ success: true, ...payload });
  } catch (e) {
    console.error("Nova Store dashboard GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load dashboard." }, { status: 500 });
  }
}

/**
 * PATCH — update charity start dates.
 * Body: { vipDonationStartsAt?: string | null, storeDonationStartsAt?: string | null }
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const data: { vipDonationStartsAt?: Date | null; storeDonationStartsAt?: Date | null } = {};

  if ("vipDonationStartsAt" in body) {
    if (body.vipDonationStartsAt == null || body.vipDonationStartsAt === "") {
      data.vipDonationStartsAt = null;
    } else {
      const d = new Date(String(body.vipDonationStartsAt));
      if (!Number.isFinite(d.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid VIP start date." }, { status: 400 });
      }
      data.vipDonationStartsAt = d;
    }
  }
  if ("storeDonationStartsAt" in body) {
    if (body.storeDonationStartsAt == null || body.storeDonationStartsAt === "") {
      data.storeDonationStartsAt = null;
    } else {
      const d = new Date(String(body.storeDonationStartsAt));
      if (!Number.isFinite(d.getTime())) {
        return NextResponse.json({ success: false, error: "Invalid store start date." }, { status: 400 });
      }
      data.storeDonationStartsAt = d;
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: false, error: "No settings to update." }, { status: 400 });
  }

  const row = await storeDb.storeCharitySettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      vipDonationStartsAt: data.vipDonationStartsAt ?? new Date(),
      storeDonationStartsAt: data.storeDonationStartsAt ?? null,
    },
    update: data,
  });

  return NextResponse.json({
    success: true,
    settings: {
      vipDonationStartsAt: row.vipDonationStartsAt
        ? new Date(row.vipDonationStartsAt).toISOString()
        : null,
      storeDonationStartsAt: row.storeDonationStartsAt
        ? new Date(row.storeDonationStartsAt).toISOString()
        : null,
    },
  });
}

/**
 * POST — record a SickKids remittance (mark sent/paid).
 * Body: { purpose: "sickkids_store" | "sickkids_vip", amountCents?, amountUsd?, unitsCovered?, notes?, paidAt? }
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";
  if (purpose !== CHARITY_PURPOSE_STORE && purpose !== CHARITY_PURPOSE_VIP) {
    return NextResponse.json({ success: false, error: "Invalid purpose." }, { status: 400 });
  }

  let amountCents =
    body.amountCents != null
      ? Math.round(Number(body.amountCents))
      : body.amountUsd != null
        ? Math.round(Number(body.amountUsd) * 100)
        : NaN;

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    const payload = await loadDashboardPayload();
    amountCents =
      purpose === CHARITY_PURPOSE_STORE
        ? payload.store.sickKidsOutstandingCents
        : payload.vip.sickKidsOutstandingCents;
  }

  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json(
      { success: false, error: "Nothing outstanding to mark as sent." },
      { status: 400 }
    );
  }

  const unitsCovered =
    body.unitsCovered != null && Number.isFinite(Number(body.unitsCovered))
      ? Math.max(0, Math.floor(Number(body.unitsCovered)))
      : purpose === CHARITY_PURPOSE_STORE
        ? Math.round(amountCents / STORE_DONATION_PER_ITEM_CENTS)
        : Math.round(amountCents / VIP_DONATION_PER_SUB_CENTS);

  const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
  const paidAt =
    typeof body.paidAt === "string" && body.paidAt.trim()
      ? new Date(body.paidAt)
      : new Date();

  const row = await storeDb.storeCharityRemittance.create({
    data: {
      purpose,
      amountCents,
      unitsCovered,
      notes,
      paidAt: Number.isFinite(paidAt.getTime()) ? paidAt : new Date(),
    },
  });

  return NextResponse.json({ success: true, remittance: row });
}

/** DELETE — undo a remittance row by id. */
export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing id." }, { status: 400 });
  }
  await storeDb.storeCharityRemittance.delete({ where: { id } }).catch(() => null);
  return NextResponse.json({ success: true });
}
