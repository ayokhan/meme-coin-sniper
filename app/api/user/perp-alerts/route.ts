import { NextResponse } from "next/server";
import { getSessionAndSubscription } from "@/lib/auth-server";
import { prisma } from "@/lib/db";
import { getSubscriptionTier } from "@/lib/subscription";

export const dynamic = "force-dynamic";

const MAX_ALERTS_PRO = 5;
const MAX_ALERTS_VIP = 20;

const ALERT_TYPES = ["new_listing", "5m_pct_above", "5m_pct_below"] as const;

/** GET - List current user's perp alerts. Subscribers only. */
export async function GET() {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId || !isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to use perp alerts.", locked: true },
        { status: 403 }
      );
    }

    const db = prisma as unknown as {
      perpAlert?: {
        findMany: (args: { where: { userId: string }; orderBy: { createdAt: "desc" } }) => Promise<{ id: string; symbol: string | null; alertType: string; threshold: number | null; channel: string; lastTriggeredAt: Date | null; createdAt: Date }[]>;
      };
    };
    if (!db.perpAlert) {
      return NextResponse.json({ success: true, alerts: [] });
    }

    const alerts = await db.perpAlert.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, alerts });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to list perp alerts";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** POST - Create perp alert. Subscribers only; limit by tier (Pro 5, VIP 20). */
export async function POST(request: Request) {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId || !isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to use perp alerts.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const alertType = (body.alertType as string)?.trim();
    const symbol = (body.symbol as string)?.trim() || null;
    const threshold = typeof body.threshold === "number" && Number.isFinite(body.threshold) ? body.threshold : null;

    if (!ALERT_TYPES.includes(alertType as any)) {
      return NextResponse.json(
        { success: false, error: "alertType must be one of: new_listing, 5m_pct_above, 5m_pct_below" },
        { status: 400 }
      );
    }
    if (alertType !== "new_listing" && !symbol) {
      return NextResponse.json({ success: false, error: "symbol required for this alert type" }, { status: 400 });
    }
    if ((alertType === "5m_pct_above" || alertType === "5m_pct_below") && threshold == null) {
      return NextResponse.json({ success: false, error: "threshold required for 5m_pct_above / 5m_pct_below" }, { status: 400 });
    }

    const tier = await getSubscriptionTier(userId);
    const maxAlerts = tier === "vip" ? MAX_ALERTS_VIP : MAX_ALERTS_PRO;

    const db = prisma as unknown as {
      perpAlert?: {
        count: (args: { where: { userId: string } }) => Promise<number>;
        create: (args: { data: { userId: string; symbol: string | null; alertType: string; threshold: number | null; channel: string } }) => Promise<{ id: string }>;
      };
    };
    if (!db.perpAlert) {
      return NextResponse.json({ success: false, error: "Perp alerts not available" }, { status: 503 });
    }

    const count = await db.perpAlert.count({ where: { userId } });
    if (count >= maxAlerts) {
      return NextResponse.json(
        { success: false, error: `Max ${maxAlerts} perp alerts (${tier === "vip" ? "VIP" : "Pro"}). Delete one to add another.` },
        { status: 400 }
      );
    }

    const created = await db.perpAlert.create({
      data: {
        userId,
        symbol,
        alertType,
        threshold,
        channel: "telegram",
      },
    });
    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create perp alert";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/** DELETE - Remove perp alert by id. Body: { id }. */
export async function DELETE(request: Request) {
  try {
    const { userId, isPaid } = await getSessionAndSubscription();
    if (!userId || !isPaid) {
      return NextResponse.json(
        { success: false, error: "Subscribe to use perp alerts.", locked: true },
        { status: 403 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const id = (body.id as string)?.trim();
    if (!id) {
      return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    }

    const db = prisma as unknown as {
      perpAlert?: {
        deleteMany: (args: { where: { id: string; userId: string } }) => Promise<{ count: number }>;
      };
    };
    if (!db.perpAlert) {
      return NextResponse.json({ success: false, error: "Perp alerts not available" }, { status: 503 });
    }

    const { count } = await db.perpAlert.deleteMany({ where: { id, userId } });
    if (count === 0) {
      return NextResponse.json({ success: false, error: "Alert not found or already deleted" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete perp alert";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
