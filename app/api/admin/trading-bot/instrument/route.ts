import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, canAccessTradingBot, isOwnerSession } from "@/lib/auth";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import { getCoinbaseConfigForUser } from "@/lib/coinbase-user-config";
import { getConfig as getBlofinEnv, getInstrument as getBlofinInstrument } from "@/lib/blofin";
import {
  getConfig as getCoinbaseEnv,
  getInstrument as getCoinbaseInstrument,
  toCoinbaseInstrument,
  computeCoinbaseSizeFromConfig,
} from "@/lib/coinbase";
import { parseScalperInstrument } from "@/lib/nova-scalper-instrument";

export const dynamic = "force-dynamic";

/**
 * GET ?provider=coinbase|blofin&symbol=BTC&leverage=10&sizeMode=contracts&size=1
 * Returns instrument meta (max leverage, contract size) + size preview for Coinbase.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!canAccessTradingBot(session) || !session?.user?.id) {
      return NextResponse.json({ success: false, error: "Access denied." }, { status: 403 });
    }
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider") === "coinbase" ? "coinbase" : "blofin";
    const symbol = (url.searchParams.get("symbol") ?? "BTC").trim().toUpperCase();
    const leverage = Math.max(1, Number(url.searchParams.get("leverage") ?? 10) || 10);
    const sizeMode = url.searchParams.get("sizeMode") === "contracts" ? "contracts" : "margin";
    const sizeValue = Math.max(0, Number(url.searchParams.get("size") ?? (sizeMode === "contracts" ? 1 : 50)) || 0);
    const priceHint = Number(url.searchParams.get("price") ?? 0);

    if (provider === "coinbase") {
      let cfg = await getCoinbaseConfigForUser(session.user.id);
      if (!cfg && isOwnerSession(session)) cfg = getCoinbaseEnv();
      if (!cfg) {
        return NextResponse.json({ success: false, error: "Coinbase keys required." }, { status: 400 });
      }
      const instId = toCoinbaseInstrument(symbol, "USDC");
      const inst = await getCoinbaseInstrument(instId, { config: cfg });
      if (!inst) {
        return NextResponse.json({ success: false, error: `Instrument not found: ${instId}` }, { status: 404 });
      }
      const contractSize = Number(inst.contractValue) || 0.01;
      const maxLeverage = Number(inst.maxLeverage) || 50;
      const minContracts = Number(inst.minSize) || 1;
      const price = priceHint > 0 ? priceHint : 0;
      const preview =
        price > 0
          ? computeCoinbaseSizeFromConfig({
              sizeMode,
              sizeValue,
              leverage: Math.min(leverage, maxLeverage),
              price,
              contractSize,
              minContracts,
            })
          : null;
      return NextResponse.json({
        success: true,
        provider,
        instId,
        contractSize,
        maxLeverage,
        minContracts,
        tickSize: Number(inst.tickSize) || null,
        preview,
        note:
          "Coinbase Advanced Trade sizes in contracts. Contract size is base coin per contract (nano BTC often 0.01). Max leverage comes from the exchange instrument.",
      });
    }

    let cfg = await getBlofinConfigForUser(session.user.id);
    if (!cfg && isOwnerSession(session)) cfg = getBlofinEnv();
    if (!cfg) {
      return NextResponse.json({ success: false, error: "Blofin keys required." }, { status: 400 });
    }
    const { instId } = parseScalperInstrument(symbol, "USDT", "blofin");
    const inst = await getBlofinInstrument(instId, { config: cfg });
    if (!inst) {
      return NextResponse.json({ success: false, error: `Instrument not found: ${instId}` }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      provider,
      instId,
      contractSize: Number(inst.contractValue) || 1,
      maxLeverage: Number(inst.maxLeverage) || 125,
      minContracts: Number(inst.minSize) || 1,
      tickSize: Number(inst.tickSize) || null,
      preview: null,
    });
  } catch (e) {
    console.error("trading-bot instrument GET:", e);
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed to load instrument." },
      { status: 500 }
    );
  }
}
