import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { rebateBrokerLabel } from "@/lib/forex-partner-rebates";
import { FOREX_BROKER_LABELS, parseForexBrokerId } from "@/lib/forex-broker-user-config";

export const dynamic = "force-dynamic";

type TimelineEvent = {
  at: string;
  type: string;
  label: string;
  detail?: string;
};

function toIso(v: unknown): string | null {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "string" && v) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** GET — owner-only activity timeline for a customer. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const { userId } = await params;
  if (!userId) {
    return NextResponse.json({ success: false, error: "User ID required." }, { status: 400 });
  }

  try {
    const db = prisma as unknown as {
      user: {
        findUnique: (args: unknown) => Promise<{ id: string; createdAt: Date; email: string | null; name: string | null } | null>;
      };
      subscription: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      forexPartnerRebateEnrollment: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      forexPartnerRebatePayout: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      referralCommission: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
      forexBrokerPartnerLinkClick: {
        findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      };
    };

    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, createdAt: true, email: true, name: true },
    });
    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    const email = (user.email ?? "").trim().toLowerCase();
    const events: TimelineEvent[] = [];

    const createdAt = toIso(user.createdAt);
    if (createdAt) {
      events.push({
        at: createdAt,
        type: "user_created",
        label: "Account created",
        detail: user.email ?? user.name ?? undefined,
      });
    }

    const [subs, enrollments, payouts, commissions, linkClicks] = await Promise.all([
      db.subscription.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.forexPartnerRebateEnrollment.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.forexPartnerRebatePayout.findMany({
        where: {
          OR: [{ userId }, ...(email ? [{ customerEmail: email }] : [])],
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.referralCommission.findMany({
        where: { referrerUserId: userId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      db.forexBrokerPartnerLinkClick
        ? db.forexBrokerPartnerLinkClick.findMany({
            where: { userId },
            orderBy: { clickedAt: "desc" },
            take: 30,
          })
        : Promise.resolve([]),
    ]);

    try {
      const configs = await (
        prisma as unknown as {
          userForexBrokerConfig: {
            findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
          };
        }
      ).userForexBrokerConfig.findMany({
        where: { userId },
        take: 20,
      });
      for (const row of configs) {
        const at = toIso(row.updatedAt ?? row.createdAt);
        if (!at) continue;
        const brokerId = parseForexBrokerId(row.broker);
        const brokerLabel = brokerId ? FOREX_BROKER_LABELS[brokerId] : String(row.broker ?? "broker");
        events.push({
          at,
          type: "forex_broker_config",
          label: `Forex broker connected: ${brokerLabel}`,
          detail: row.server ? String(row.server) : undefined,
        });
      }
    } catch {
      /* optional */
    }

    for (const s of subs) {
      const at = toIso(s.createdAt);
      if (!at) continue;
      events.push({
        at,
        type: "subscription",
        label: `VIP subscription · ${String(s.plan ?? "plan")} · $${Number(s.amountUsd) || 0}`,
        detail: s.expiresAt ? `Expires ${toIso(s.expiresAt) ?? ""}` : undefined,
      });
    }

    for (const e of enrollments) {
      const at = toIso(e.createdAt);
      if (!at) continue;
      events.push({
        at,
        type: "rebate_enrollment",
        label: `Rebate enrollment · ${rebateBrokerLabel(String(e.broker ?? ""))}`,
        detail: e.mtLogin ? `MT ${String(e.mtLogin)}` : undefined,
      });
    }

    for (const p of payouts) {
      const at = toIso(p.paidAt ?? p.createdAt);
      if (!at) continue;
      const status = String(p.status ?? "pending");
      const amount =
        p.amountPaidUsd != null
          ? `$${Number(p.amountPaidUsd).toFixed(2)}`
          : p.suggestedAmountUsd != null
            ? `~$${Number(p.suggestedAmountUsd).toFixed(2)} suggested`
            : null;
      events.push({
        at,
        type: status === "paid" ? "rebate_payout_paid" : "rebate_payout",
        label: `Rebate ${status} · ${rebateBrokerLabel(String(p.broker ?? ""))}${amount ? ` · ${amount}` : ""}`,
        detail: p.periodNote ? String(p.periodNote) : undefined,
      });
    }

    for (const c of commissions) {
      const at = toIso(c.createdAt);
      if (!at) continue;
      events.push({
        at,
        type: "referral_commission",
        label: `Referral commission · $${Number(c.commissionAmountUsd).toFixed(2)} (${String(c.status)})`,
        detail: `Rate ${Number(c.commissionRatePct)}%`,
      });
    }

    for (const click of linkClicks) {
      const at = toIso(click.clickedAt ?? click.createdAt);
      if (!at) continue;
      events.push({
        at,
        type: "partner_link_click",
        label: `Partner register link clicked · ${rebateBrokerLabel(String(click.broker ?? ""))}`,
      });
    }

    // Logins
    try {
      const logins = await (
        prisma as unknown as {
          loginEvent: {
            findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
          };
        }
      ).loginEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 25,
      });
      for (const row of logins) {
        const at = toIso(row.createdAt);
        if (!at) continue;
        const place = [row.city, row.country].filter(Boolean).join(", ");
        events.push({
          at,
          type: "login",
          label: `Signed in · ${String(row.provider ?? "auth")}`,
          detail: [place, row.deviceType, row.browser].filter(Boolean).join(" · ") || undefined,
        });
      }
    } catch {
      /* optional */
    }

    // AI / usage analysis
    try {
      const usage = await (
        prisma as unknown as {
          usageAnalysisEvent: {
            findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
          };
        }
      ).usageAnalysisEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 30,
      });
      for (const row of usage) {
        const at = toIso(row.createdAt);
        if (!at) continue;
        events.push({
          at,
          type: "usage_analysis",
          label: `AI usage · ${String(row.source ?? "analysis")}`,
        });
      }
    } catch {
      /* optional */
    }

    events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

    return NextResponse.json({ success: true, events: events.slice(0, 120) });
  } catch (e) {
    console.error("admin customer timeline GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load timeline." }, { status: 500 });
  }
}
