import { NextResponse } from "next/server";
import {
  isVipStrategySessionPromoActive,
  vipStrategySessionPromoPublicPayload,
} from "@/lib/vip-strategy-session-promo";

export const dynamic = "force-dynamic";

/** Public: whether the VIP strategy session promo is live (flag + end date). */
export async function GET() {
  try {
    const active = await isVipStrategySessionPromoActive();
    const payload = await vipStrategySessionPromoPublicPayload(active);
    return NextResponse.json({
      success: true,
      ...payload,
    });
  } catch (e) {
    console.error("vip-strategy-session-promo GET:", e);
    return NextResponse.json({ success: false, active: false }, { status: 500 });
  }
}
