import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import {
  detectDemandFibSetup,
  DEFAULT_DEMAND_FIB_CONFIG,
  formatDemandFibSignalText,
  type EntrySignal,
} from "@/lib/demand-zone-fib-strategy";
import { fetchBinanceFuturesKlines, fetchFundingRate, normalizePerpSymbol } from "@/lib/demand-fib-binance";
import {
  fetchHyperliquidStrategyCandles,
  fetchHyperliquidFunding,
  hyperliquidCoinFromInput,
} from "@/lib/demand-fib-hyperliquid";
import { runDemandFibChartAnalysis } from "@/lib/ai-demand-fib-chart";

export const maxDuration = 60;

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function serializeSignal(s: EntrySignal) {
  return {
    type: s.type,
    instrument: s.instrument,
    timeframe: s.timeframe,
    entryPrice: s.entryPrice,
    stopLoss: s.stopLoss,
    takeProfit1: s.takeProfit1,
    takeProfit2: s.takeProfit2,
    riskRewardRatio: s.riskRewardRatio,
    confluenceStrength: s.confluenceZone.strength,
    fibLevelsHit: s.confluenceZone.fibLevelsPresent,
    zoneBottom: s.confluenceZone.priceBottom,
    zoneTop: s.confluenceZone.priceTop,
    swingHigh: s.fibLevels.swingHigh,
    swingLow: s.fibLevels.swingLow,
    confirmationPattern: s.reasoning.split("Confirmation:")[1]?.split("|")[0]?.trim() ?? "",
    reasoning: s.reasoning,
    formatted: formatDemandFibSignalText(s),
  };
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Owner only." }, { status: 403 });
    }

    const ct = request.headers.get("content-type") ?? "";

    if (ct.includes("application/json")) {
      const body = (await request.json()) as { symbol?: string; exchange?: string };
      const raw = (body.symbol ?? "").trim();
      if (!raw) {
        return NextResponse.json({ success: false, error: "Enter a symbol (e.g. BTC or BTC/USDT)." }, { status: 400 });
      }
      const exchange = (body.exchange ?? "binance").toLowerCase();
      const useHl = exchange === "hyperliquid" || exchange === "hl";

      if (useHl) {
        const coin = hyperliquidCoinFromInput(raw);
        const [htf, ltf] = await Promise.all([
          fetchHyperliquidStrategyCandles(raw, "4h", 200),
          fetchHyperliquidStrategyCandles(raw, "5m", 300),
        ]);
        const funding = await fetchHyperliquidFunding(coin);
        const instrument = `${coin} (Hyperliquid)`;
        const config = {
          ...DEFAULT_DEMAND_FIB_CONFIG,
          instrument,
          htfTimeframe: "4h",
          ltfTimeframe: "5m",
          fundingRateFilter: 0.002,
        };
        const signal = detectDemandFibSetup(htf, ltf, config, funding);
        return NextResponse.json({
          success: true,
          mode: "symbol",
          exchange: "hyperliquid",
          symbol: coin,
          fundingRate: funding,
          hasSetup: !!signal,
          signal: signal ? serializeSignal(signal) : null,
          message: signal
            ? "Automated scan (Hyperliquid 4h/5m): demand zone + deep Fib + LTF confirmation aligned."
            : "No LONG setup on HL 4h/5m data. Try Binance, another coin, or chart upload.",
        });
      }

      const symbol = normalizePerpSymbol(raw);
      const [htf, ltf] = await Promise.all([
        fetchBinanceFuturesKlines(symbol, "4h", 200),
        fetchBinanceFuturesKlines(symbol, "5m", 300),
      ]);
      const funding = await fetchFundingRate(symbol);
      const config = {
        ...DEFAULT_DEMAND_FIB_CONFIG,
        instrument: symbol,
        htfTimeframe: "4h",
        ltfTimeframe: "5m",
        fundingRateFilter: 0.002,
      };
      const signal = detectDemandFibSetup(htf, ltf, config, funding);
      return NextResponse.json({
        success: true,
        mode: "symbol",
        exchange: "binance",
        symbol,
        fundingRate: funding,
        hasSetup: !!signal,
        signal: signal ? serializeSignal(signal) : null,
        message: signal
          ? "Automated scan (Binance 4h/5m): demand zone + deep Fib + LTF confirmation aligned."
          : "No LONG setup on current 4h/5m data. Try Hyperliquid, another symbol, or chart upload.",
      });
    }

    if (!ct.includes("multipart/form-data")) {
      return NextResponse.json(
        { success: false, error: "Send JSON { symbol, exchange? } or multipart with chart image." },
        { status: 400 }
      );
    }

    const formData = await request.formData();
    const chartFile = formData.get("chart") as File | null;
    const symbolHint = (formData.get("symbol") as string | null)?.trim() ?? "";

    if (!chartFile || typeof chartFile === "string") {
      return NextResponse.json({ success: false, error: "Upload a chart image." }, { status: 400 });
    }
    if (chartFile.size > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: "Image under 10 MB." }, { status: 400 });
    }
    const mediaType = chartFile.type as string;
    if (!ALLOWED_TYPES.includes(mediaType)) {
      return NextResponse.json({ success: false, error: "PNG, JPEG, WebP, or GIF only." }, { status: 400 });
    }

    const buf = await chartFile.arrayBuffer();
    const base64 = Buffer.from(buf).toString("base64");
    const imageMediaType = mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif";
    const result = await runDemandFibChartAnalysis(base64, imageMediaType, symbolHint || undefined);

    return NextResponse.json({
      success: true,
      mode: "chart",
      chart: {
        setup: result.setup,
        confluenceScore: result.confluenceScore,
        entry: result.entry,
        sl: result.sl,
        tp1: result.tp1,
        tp2: result.tp2,
        summary: result.summary,
        reasons: result.reasons,
        demandZoneNote: result.demandZoneNote,
        fibNote: result.fibNote,
      },
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Demand + Fib scan failed";
    console.error("demand-fib-strategy:", e);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
