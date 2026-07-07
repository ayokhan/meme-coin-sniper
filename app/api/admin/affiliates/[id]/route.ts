import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerEmail } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { REFERRAL_COMMISSION_STATUS } from "@/lib/referral-program";

type Params = { params: Promise<{ id: string }> };

/** PATCH — owner marks commission as paid (non-owner admins: read-only). */
export async function PATCH(request: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email || !isOwnerEmail(session.user.email)) {
    return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const status = (body.status ?? "").toString();
  const notes = body.notes != null ? String(body.notes).trim() : undefined;

  if (status !== REFERRAL_COMMISSION_STATUS.PAID && status !== REFERRAL_COMMISSION_STATUS.PENDING) {
    return NextResponse.json({ success: false, error: "Invalid status." }, { status: 400 });
  }

  const existing = await prisma.referralCommission.findUnique({ where: { id } });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Commission not found." }, { status: 404 });
  }

  const updated = await prisma.referralCommission.update({
    where: { id },
    data: {
      status,
      paidAt: status === REFERRAL_COMMISSION_STATUS.PAID ? new Date() : null,
      paidByUserId: status === REFERRAL_COMMISSION_STATUS.PAID ? session.user.id : null,
      ...(notes !== undefined ? { notes: notes || null } : {}),
    },
  });

  return NextResponse.json({ success: true, commission: updated });
}
