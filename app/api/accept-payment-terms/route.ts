import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** POST - Record that the current user accepted Payment Terms and Conditions. Required before any subscription payment. */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }

  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        paymentTermsAcceptedAt: new Date(),
      },
    });
    return NextResponse.json({ success: true, message: "Payment terms accepted." });
  } catch (e) {
    console.error("Accept payment terms error:", e);
    return NextResponse.json({ success: false, error: "Failed to save." }, { status: 500 });
  }
}
