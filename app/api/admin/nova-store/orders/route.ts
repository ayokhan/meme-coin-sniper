import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { storeDb as prisma } from "@/lib/nova-store/db";

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

/** PATCH — update order status (fulfilled / cancelled / refunded). */
export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!isOwnerEmail(session?.user?.email ?? null)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const status = typeof body.status === "string" ? body.status.trim() : "";
  const allowed = new Set(["pending", "paid", "fulfilled", "cancelled", "refunded"]);
  if (!id || !allowed.has(status)) {
    return NextResponse.json({ success: false, error: "Invalid id or status." }, { status: 400 });
  }

  const data: { status: string; fulfilledAt?: Date | null; notes?: string } = { status };
  if (status === "fulfilled") data.fulfilledAt = new Date();
  if (status !== "fulfilled") data.fulfilledAt = null;
  if (typeof body.notes === "string") data.notes = body.notes.trim();

  const order = await prisma.storeOrder.update({
    where: { id },
    data,
  });

  return NextResponse.json({ success: true, order });
}
