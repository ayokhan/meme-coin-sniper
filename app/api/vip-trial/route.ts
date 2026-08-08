import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getVipTrialPublicOffer } from "@/lib/vip-trial";

export const dynamic = "force-dynamic";

/** GET — public trial offer for signed-in users (subscribe / lock screens). */
export async function GET() {
  const session = await getServerSession(authOptions);
  const offer = await getVipTrialPublicOffer(session?.user?.id ?? null);
  return NextResponse.json({ success: true, offer });
}
