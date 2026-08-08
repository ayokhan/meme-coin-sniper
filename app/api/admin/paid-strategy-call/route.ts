import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  getPaidStrategyCallConfig,
  listPaidStrategyCallOrders,
  setPaidStrategyCallConfig,
  updatePaidStrategyCallOrderStatus,
} from "@/lib/paid-strategy-call";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const [config, orders] = await Promise.all([
      getPaidStrategyCallConfig(),
      listPaidStrategyCallOrders(),
    ]);
    return NextResponse.json({ success: true, config, orders });
  } catch (e) {
    console.error("admin paid-strategy-call GET:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerSession(session)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }
  try {
    const body = (await request.json()) as {
      enabled?: boolean;
      showNavButton?: boolean;
      priceUsd?: number;
      confirmationSubject?: string;
      confirmationBody?: string;
      scheduleSubject?: string;
      scheduleBody?: string;
      orderId?: string;
      status?: string;
      notes?: string;
      personalizeSchedule?: boolean;
    };

    if (body.orderId && body.personalizeSchedule) {
      const { getPaidStrategyCallOrderById, buildPersonalizedScheduleEmail } = await import(
        "@/lib/paid-strategy-call"
      );
      const order = await getPaidStrategyCallOrderById(body.orderId);
      if (!order) {
        return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
      }
      const draft = await buildPersonalizedScheduleEmail(order);
      return NextResponse.json({ success: true, draft });
    }

    if (body.orderId) {
      const order = await updatePaidStrategyCallOrderStatus(body.orderId, {
        status: body.status,
        notes: body.notes,
      });
      return NextResponse.json({ success: true, order });
    }

    const config = await setPaidStrategyCallConfig({
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      showNavButton: typeof body.showNavButton === "boolean" ? body.showNavButton : undefined,
      priceUsd: typeof body.priceUsd === "number" ? body.priceUsd : undefined,
      confirmationSubject:
        typeof body.confirmationSubject === "string" ? body.confirmationSubject : undefined,
      confirmationBody: typeof body.confirmationBody === "string" ? body.confirmationBody : undefined,
      scheduleSubject: typeof body.scheduleSubject === "string" ? body.scheduleSubject : undefined,
      scheduleBody: typeof body.scheduleBody === "string" ? body.scheduleBody : undefined,
    });
    return NextResponse.json({ success: true, config });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to save." },
      { status: 400 }
    );
  }
}
