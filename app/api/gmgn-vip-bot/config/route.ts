import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getGmgnVipBotAccess } from "@/lib/vip-futures-addon-access";
import {
  ensureGmgnVipBotConfig,
  getGmgnVipBotConfigView,
  resolveUserGmgnCredentials,
  updateGmgnVipBotConfig,
  type GmgnTradingMode,
} from "@/lib/gmgn-vip-bot-config";
import type { GmgnChain } from "@/lib/gmgn-client";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const config = await getGmgnVipBotConfigView(access.userId);
    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("gmgn-vip-bot/config GET:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const row = await ensureGmgnVipBotConfig(access.userId);
    if (row.ownerForceOff && body.enabled === true) {
      return NextResponse.json(
        { success: false, error: "GMGN VIP Bot was disabled by the owner. Contact support to re-enable." },
        { status: 403 }
      );
    }

    const chains = Array.isArray(body.chains)
      ? (body.chains.filter((c) => typeof c === "string") as GmgnChain[])
      : undefined;

    const config = await updateGmgnVipBotConfig(access.userId, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      tradingMode: body.tradingMode === "auto" || body.tradingMode === "semi_auto" ? (body.tradingMode as GmgnTradingMode) : undefined,
      chains,
      maxTradeUsd: body.maxTradeUsd != null ? Number(body.maxTradeUsd) : undefined,
      maxDailyLossUsd: body.maxDailyLossUsd != null ? Number(body.maxDailyLossUsd) : undefined,
      maxOpenTrades: body.maxOpenTrades != null ? Number(body.maxOpenTrades) : undefined,
      slippagePct: body.slippagePct != null ? Number(body.slippagePct) : undefined,
      stopLossPct: body.stopLossPct != null ? Number(body.stopLossPct) : undefined,
      takeProfitPct: body.takeProfitPct != null ? Number(body.takeProfitPct) : undefined,
      walletAddress: body.walletAddress != null ? String(body.walletAddress) : undefined,
      gmgnApiKey: body.gmgnApiKey != null ? String(body.gmgnApiKey) : undefined,
      gmgnPrivateKey: body.gmgnPrivateKey != null ? String(body.gmgnPrivateKey) : undefined,
      clearCredentials: body.clearCredentials === true,
    });

    return NextResponse.json({ success: true, config });
  } catch (e) {
    console.error("gmgn-vip-bot/config POST:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Failed." }, { status: 500 });
  }
}

/** POST { testConnection: true } — verify GMGN credentials. */
export async function PATCH(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const access = await getGmgnVipBotAccess(session);
    if (!access.ok) {
      return NextResponse.json({ success: false, error: access.error, disabled: access.disabled }, { status: access.status });
    }
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    if (body.testConnection !== true) {
      return NextResponse.json({ success: false, error: "Unsupported patch." }, { status: 400 });
    }
    const creds = await resolveUserGmgnCredentials(access.userId, session);
    if (!creds?.apiKey) {
      return NextResponse.json({ success: false, error: "No GMGN API key configured." }, { status: 400 });
    }
    const { fetchGmgnTrending } = await import("@/lib/gmgn-client");
    await fetchGmgnTrending("sol", creds, 1);
    return NextResponse.json({ success: true, message: "GMGN connection OK." });
  } catch (e) {
    console.error("gmgn-vip-bot/config PATCH:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Connection failed." }, { status: 502 });
  }
}
