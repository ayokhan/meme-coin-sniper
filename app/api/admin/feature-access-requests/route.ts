import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { COACH_CALLS_FEATURE_KEY } from "@/lib/coach-calls-access";

export const dynamic = "force-dynamic";

/** GET — Owner: list pending (or all) feature access requests. */
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") ?? "pending";
    const feature = url.searchParams.get("feature") ?? COACH_CALLS_FEATURE_KEY;

    const where: { feature: string; status?: string } = { feature };
    if (statusFilter !== "all") where.status = statusFilter;

    const rows = await (prisma as any).featureAccessRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            coachCallsOnDemand: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      requests: rows.map((r: any) => ({
        id: r.id,
        feature: r.feature,
        status: r.status,
        createdAt: r.createdAt,
        resolvedAt: r.resolvedAt,
        userId: r.userId,
        userEmail: r.user?.email ?? null,
        userName: r.user?.name ?? null,
        alreadyGranted: !!r.user?.coachCallsOnDemand,
      })),
    });
  } catch (e) {
    console.error("Admin feature-access-requests GET error:", e);
    return NextResponse.json({ success: false, error: "Failed to load." }, { status: 500 });
  }
}

/** PATCH — Owner: grant or dismiss a request. Grant also sets coachCallsOnDemand. */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Not authorized." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body.id === "string" ? body.id.trim() : "";
    const action = body.action === "dismiss" ? "dismiss" : body.action === "grant" ? "grant" : null;
    if (!id || !action) {
      return NextResponse.json({ success: false, error: "id and action (grant|dismiss) required." }, { status: 400 });
    }

    const row = await (prisma as any).featureAccessRequest.findUnique({ where: { id } });
    if (!row) {
      return NextResponse.json({ success: false, error: "Request not found." }, { status: 404 });
    }

    if (action === "grant") {
      await (prisma as any).user.update({
        where: { id: row.userId },
        data: { coachCallsOnDemand: true },
      });
      await (prisma as any).featureAccessRequest.update({
        where: { id },
        data: { status: "granted", resolvedAt: new Date() },
      });
      // Close any other pending coach_calls requests for this user.
      await (prisma as any).featureAccessRequest.updateMany({
        where: {
          userId: row.userId,
          feature: COACH_CALLS_FEATURE_KEY,
          status: "pending",
          id: { not: id },
        },
        data: { status: "granted", resolvedAt: new Date() },
      });
      return NextResponse.json({ success: true, status: "granted" });
    }

    await (prisma as any).featureAccessRequest.update({
      where: { id },
      data: { status: "dismissed", resolvedAt: new Date() },
    });
    return NextResponse.json({ success: true, status: "dismissed" });
  } catch (e) {
    console.error("Admin feature-access-requests PATCH error:", e);
    return NextResponse.json({ success: false, error: "Failed to update." }, { status: 500 });
  }
}
