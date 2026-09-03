/**
 * Unified Blofin / Coinbase exchange adapter for NovaScalper ticks.
 */
import {
  getTicker as getBlofinTicker,
  getInstrument as getBlofinInstrument,
  getPositions as getBlofinPositions,
  getOpenOrders as getBlofinOpenOrders,
  setLeverage as setBlofinLeverage,
  placeMarketOrder as placeBlofinMarketOrder,
  closePositionViaApi as closeBlofinPosition,
  placeTPSLOrder as placeBlofinTPSL,
  clampBlofinLeverage,
  roundBlofinSize,
  getConfig as getBlofinEnvConfig,
  type BlofinConfig,
} from "@/lib/blofin";
import { getBlofinConfigForUser } from "@/lib/blofin-user-config";
import {
  getTicker as getCoinbaseTicker,
  getInstrument as getCoinbaseInstrument,
  getPositions as getCoinbasePositions,
  getOpenOrders as getCoinbaseOpenOrders,
  setLeverage as setCoinbaseLeverage,
  placeMarketOrder as placeCoinbaseMarketOrder,
  closePositionViaApi as closeCoinbasePosition,
  placeTPSLOrder as placeCoinbaseTPSL,
  clampCoinbaseLeverage,
  roundCoinbaseSize,
  computeCoinbaseSizeFromConfig,
  getConfig as getCoinbaseEnvConfig,
  type CoinbaseConfig,
} from "@/lib/coinbase";
import { getCoinbaseConfigForUser } from "@/lib/coinbase-user-config";
import { parseScalperInstrument, type ScalperExchange } from "@/lib/nova-scalper-instrument";

export type PositionRow = {
  instId: string;
  pos: string;
  posSide?: string;
  avgPx?: string;
  upl?: string | null;
  markPx?: string | null;
};

export type InstrumentInfo = {
  minSize: string;
  contractValue: string;
  lotSize: string;
  maxLeverage?: string | null;
  maxMarketSize?: string;
  tickSize?: string;
  state?: string;
  assetClass?: string;
};

export type ScalperExchangeSession =
  | {
      exchange: "blofin";
      label: string;
      opts: { demo?: boolean; config: BlofinConfig };
      instId: string;
      base: string;
    }
  | {
      exchange: "coinbase";
      label: string;
      opts: { demo?: boolean; config: CoinbaseConfig };
      instId: string;
      base: string;
    };

export async function resolveScalperExchangeSession(
  userId: string,
  row: { symbol: string; marginCurrency?: string | null; mode?: string | null; exchange?: string | null },
  runOpts?: { envFallbackForOwner?: boolean }
): Promise<{ session: ScalperExchangeSession } | { error: string }> {
  const exchange: ScalperExchange = row.exchange === "coinbase" ? "coinbase" : "blofin";
  const isDemo = row.mode === "demo";
  const quote = row.marginCurrency === "USDC" ? "USDC" : "USDT";
  const { instId, base } = parseScalperInstrument(row.symbol, quote, exchange);
  if (!base || !instId) {
    return { error: "Invalid instrument. Save BTC/USDT or BTC/USDC (or base + margin) in NovaScalper." };
  }

  if (exchange === "coinbase") {
    let coinbaseConfig: CoinbaseConfig | null = await getCoinbaseConfigForUser(userId);
    if (!coinbaseConfig && runOpts?.envFallbackForOwner) {
      coinbaseConfig = getCoinbaseEnvConfig();
    }
    if (!coinbaseConfig) {
      return {
        error: runOpts?.envFallbackForOwner
          ? "Coinbase API keys missing. Save keys under NovaScalper or set server COINBASE_* env."
          : "Coinbase API keys missing. Save your keys in NovaScalper settings (server keys are owner-only).",
      };
    }
    return {
      session: {
        exchange,
        label: "Coinbase",
        opts: { demo: isDemo, config: coinbaseConfig },
        instId,
        base,
      },
    };
  }

  let blofinConfig: BlofinConfig | null = await getBlofinConfigForUser(userId);
  if (!blofinConfig && runOpts?.envFallbackForOwner) {
    blofinConfig = getBlofinEnvConfig();
  }
  if (!blofinConfig) {
    return {
      error: runOpts?.envFallbackForOwner
        ? "Blofin API keys missing. Save keys under NovaScalper or set server BLOFIN_* env."
        : "Blofin API keys missing. Save your keys in NovaScalper settings (server keys are owner-only).",
    };
  }
  return {
    session: {
      exchange,
      label: "Blofin",
      opts: { demo: isDemo, config: blofinConfig },
      instId,
      base,
    },
  };
}

export async function scalperGetTicker(session: ScalperExchangeSession): Promise<{ last: string } | null> {
  if (session.exchange === "coinbase") {
    return getCoinbaseTicker(session.instId, session.opts.demo, { config: session.opts.config });
  }
  return getBlofinTicker(session.instId, session.opts.demo, { config: session.opts.config });
}

export async function scalperGetPositions(session: ScalperExchangeSession): Promise<PositionRow[]> {
  if (session.exchange === "coinbase") {
    return getCoinbasePositions(session.instId, session.opts);
  }
  return getBlofinPositions(session.instId, session.opts);
}

export async function scalperGetOpenOrders(session: ScalperExchangeSession) {
  if (session.exchange === "coinbase") {
    return getCoinbaseOpenOrders({ demo: session.opts.demo, instId: session.instId, config: session.opts.config });
  }
  return getBlofinOpenOrders({
    demo: session.opts.demo,
    instId: session.instId,
    config: session.opts.config,
  });
}

export async function scalperGetInstrument(session: ScalperExchangeSession): Promise<InstrumentInfo | null> {
  if (session.exchange === "coinbase") {
    return getCoinbaseInstrument(session.instId, session.opts);
  }
  return getBlofinInstrument(session.instId, session.opts);
}

export async function scalperClosePosition(
  session: ScalperExchangeSession,
  marginMode: "isolated" | "cross"
): Promise<{ ok: boolean; error?: string }> {
  if (session.exchange === "coinbase") {
    return closeCoinbasePosition(session.instId, marginMode, "net", session.opts);
  }
  return closeBlofinPosition(session.instId, marginMode, "net", session.opts);
}

export function scalperClampLeverage(
  session: ScalperExchangeSession,
  requested: number,
  maxLeverageStr?: string | null
) {
  if (session.exchange === "coinbase") {
    return clampCoinbaseLeverage(requested, maxLeverageStr);
  }
  return clampBlofinLeverage(requested, maxLeverageStr);
}

export function scalperRoundSize(
  session: ScalperExchangeSession,
  size: number,
  minSize: number,
  lotSize: number
): string {
  if (session.exchange === "coinbase") {
    return roundCoinbaseSize(size, minSize, lotSize);
  }
  return roundBlofinSize(size, minSize, lotSize);
}

export async function scalperSetLeverage(
  session: ScalperExchangeSession,
  leverage: number,
  marginMode: "isolated" | "cross"
): Promise<{ ok: boolean; error?: string }> {
  if (session.exchange === "coinbase") {
    return setCoinbaseLeverage(session.instId, leverage, marginMode, session.opts);
  }
  return setBlofinLeverage(session.instId, leverage, marginMode, session.opts);
}

export async function scalperPlaceMarketOrder(
  session: ScalperExchangeSession,
  side: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross",
  extras?: { amountBase?: number }
): Promise<{ ok: boolean; orderId?: string; error?: string }> {
  if (session.exchange === "coinbase") {
    return placeCoinbaseMarketOrder(session.instId, side, size, marginMode, {
      ...session.opts,
      sizeUnit: "contracts",
      amountBase: extras?.amountBase,
    });
  }
  return placeBlofinMarketOrder(session.instId, side, size, marginMode, session.opts);
}

export async function scalperPlaceTPSL(
  session: ScalperExchangeSession,
  orderSide: "buy" | "sell",
  size: string,
  marginMode: "isolated" | "cross",
  fillPrice: number,
  tpPct: number,
  slPct: number,
  extras: { tpTriggerPrice?: number | null; slTriggerPrice?: number | null; amountBase?: number }
): Promise<{ ok: boolean; error?: string }> {
  if (session.exchange === "coinbase") {
    return placeCoinbaseTPSL(
      session.instId,
      orderSide,
      size,
      marginMode,
      fillPrice,
      tpPct,
      slPct,
      { ...session.opts, ...extras }
    );
  }
  return placeBlofinTPSL(session.instId, orderSide, size, marginMode, fillPrice, tpPct, slPct, {
    ...session.opts,
    ...extras,
  });
}
