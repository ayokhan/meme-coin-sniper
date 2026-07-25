import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { storeDb as prisma } from "@/lib/nova-store/db";
import { sendStoreOrderShippedEmail } from "@/lib/nova-store/ship-email";

export const dynamic = "force-dynamic";

/** GET — list store orders (owner). Optional ?status= */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();
  const orders = await prisma.storeOrder.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      user: { select: { id: true, email: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, orders });
}

/**
 * PATCH — update order status / ship.
 * Body: { id, status?, trackingNumber?, notifyCustomer?, notes? }
 * When status is "fulfilled" (or notifyCustomer with paid order), can email the buyer.
 */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json({ success: false, error: "Missing order id." }, { status: 400 });
  }

  const existing = await prisma.storeOrder.findFirst({
    where: { id },
  });
  const current = existing;
  if (!current) {
    return NextResponse.json({ success: false, error: "Order not found." }, { status: 404 });
  }

  const status =
    typeof body.status === "string" && body.status.trim()
      ? body.status.trim()
      : (current.status as string);
  const allowed = new Set(["pending", "paid", "fulfilled", "cancelled", "refunded"]);
  if (!allowed.has(status)) {
    return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
  }

  const trackingNumber =
    typeof body.trackingNumber === "string" ? body.trackingNumber.trim() || null : undefined;
  const notifyCustomer = body.notifyCustomer === true;
  const notes = typeof body.notes === "string" ? body.notes.trim() : undefined;

  const data: Record<string, unknown> = { status };
  if (status === "fulfilled") data.fulfilledAt = current.fulfilledAt ?? new Date();
  if (status !== "fulfilled") data.fulfilledAt = null;
  if (trackingNumber !== undefined) data.trackingNumber = trackingNumber;
  if (notes !== undefined) data.notes = notes;

  let order = await prisma.storeOrder.update({
    where: { id },
    data,
  });

  let emailSent = false;
  let emailError: string | null = null;

  if (notifyCustomer && (status === "fulfilled" || status === "paid")) {
    // Ensure fulfilled when notifying ship
    if (status !== "fulfilled") {
      order = await prisma.storeOrder.update({
        where: { id },
        data: { status: "fulfilled", fulfilledAt: new Date() },
      });
    }
    const result = await sendStoreOrderShippedEmail({
      email: order.email,
      shipName: order.shipName,
      trackingNumber: order.trackingNumber,
      totalCents: order.totalCents,
      currency: order.currency,
      itemsJson: order.itemsJson,
    });
    if (result.ok) {
      emailSent = true;
      order = await prisma.storeOrder.update({
        where: { id },
        data: { shippedEmailSentAt: new Date() },
      });
    } else {
      emailError = result.error;
    }
  }

  return NextResponse.json({
    success: true,
    order,
    emailSent,
    emailError,
  });
}
