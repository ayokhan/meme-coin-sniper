import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNovaProUsageToday } from "@/lib/nova-pro";

export const dynamic = "force-dynamic";

/** GET — today's Nova Pro usage (shared AI pool + Nova Pulse) for the signed-in Pro subscriber. */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ success: false, error: "Sign in required." }, { status: 401 });
  }
  if (!session.user.isNovaPro) {
    return NextResponse.json({ success: true, isNovaPro: false });
  }
  const usage = await getNovaProUsageToday(session.user.id);
  return NextResponse.json({
    success: true,
    isNovaPro: true,
    founding: !!session.user.isFoundingPro,
    ai: usage.ai,
    pulse: usage.pulse,
  });
}
