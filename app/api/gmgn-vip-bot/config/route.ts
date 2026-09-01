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
import { getServerEgressIpv4 } from "@/lib/gmgn-egress-ip";
import { validateGmgnWalletAddress } from "@/lib/gmgn-vip-bot-rules";

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

    if (body.walletAddresses != null && Array.isArray(body.walletAddresses)) {
      for (const w of body.walletAddresses) {
        if (typeof w !== "string" || !w.trim()) continue;
        const walletCheck = validateGmgnWalletAddress(w);
        if (!walletCheck.ok) {
          return NextResponse.json({ success: false, error: walletCheck.error }, { status: 400 });
        }
      }
    } else if (body.walletAddress != null && String(body.walletAddress).trim()) {
      const walletCheck = validateGmgnWalletAddress(String(body.walletAddress));
      if (!walletCheck.ok) {
        return NextResponse.json({ success: false, error: walletCheck.error }, { status: 400 });
      }
    }

    if (body.gmgnPrivateKey != null && String(body.gmgnPrivateKey).trim()) {
      const keyCheck = validateGmgnPrivateKey(String(body.gmgnPrivateKey));
      if (!keyCheck.ok) {
        return NextResponse.json({ success: false, error: keyCheck.error }, { status: 400 });
      }
    }

    const config = await updateGmgnVipBotConfig(access.userId, {
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      tradingMode: body.tradingMode === "auto" || body.tradingMode === "semi_auto" ? (body.tradingMode as GmgnTradingMode) : undefined,
      chains,
      maxTradeUsd: body.maxTradeUsd != null ? Number(body.maxTradeUsd) : undefined,
      maxDailyLossUsd: body.maxDailyLossUsd != null ? Number(body.maxDailyLossUsd) : undefined,
      maxOpenTrades: body.maxOpenTrades != null ? Number(body.maxOpenTrades) : undefined,
      minLiquidityUsd: body.minLiquidityUsd != null ? Number(body.minLiquidityUsd) : undefined,
      minMomentum1hPct: body.minMomentum1hPct != null ? Number(body.minMomentum1hPct) : undefined,
      slippagePct: body.slippagePct != null ? Number(body.slippagePct) : undefined,
      stopLossPct: body.stopLossPct != null ? Number(body.stopLossPct) : undefined,
      takeProfitPct: body.takeProfitPct != null ? Number(body.takeProfitPct) : undefined,
      walletAddresses: Array.isArray(body.walletAddresses)
        ? body.walletAddresses.filter((w): w is string => typeof w === "string")
        : undefined,
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
    if (!creds.privateKey) {
      return NextResponse.json({
        success: false,
        error:
          "API key works, but no valid private key for signing. Paste -----BEGIN PRIVATE KEY----- (not the public key).",
      }, { status: 400 });
    }
    const egressIp = await getServerEgressIpv4();
    const ipNote = egressIp
      ? ` Whitelist server IP in GMGN: ${egressIp}`
      : "";
    return NextResponse.json({
      success: true,
      message: `GMGN connection and signing key OK.${ipNote}`,
      egressIp,
    });
  } catch (e) {
    console.error("gmgn-vip-bot/config PATCH:", e);
    return NextResponse.json({ success: false, error: e instanceof Error ? e.message : "Connection failed." }, { status: 502 });
  }
}
