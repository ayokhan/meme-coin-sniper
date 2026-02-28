const HYPERLIQUID_INFO = "https://api.hyperliquid.xyz/info";

type RawPosition = {
  coin?: string;
  szi?: string;
  entryPx?: string;
  positionValue?: string;
  unrealizedPnl?: string;
  leverage?: { type?: string; value?: number; rawUsd?: string };
  liquidationPx?: string;
  marginUsed?: string;
};

type RawAssetPosition = {
  position?: RawPosition;
  type?: string;
};

type RawClearinghouseState = {
  assetPositions?: RawAssetPosition[];
  marginSummary?: { accountValue?: string };
  crossMarginSummary?: { accountValue?: string };
};

export type HyperliquidPosition = {
  coin: string;
  side: "long" | "short";
  szi: string;
  entryPx: string;
  positionValue: string;
  unrealizedPnl: string;
  leverage?: number;
  liquidationPx?: string;
};

export type TopTraderState = {
  address: string;
  label?: string;
  accountValue?: string;
  positions: HyperliquidPosition[];
};

function parsePosition(ap: RawAssetPosition): HyperliquidPosition | null {
  const p = ap?.position;
  if (!p?.coin) return null;
  const szi = (p.szi ?? "0").trim();
  const num = parseFloat(szi);
  const side: "long" | "short" = num >= 0 ? "long" : "short";
  return {
    coin: p.coin,
    side,
    szi: szi,
    entryPx: p.entryPx ?? "0",
    positionValue: p.positionValue ?? "0",
    unrealizedPnl: p.unrealizedPnl ?? "0",
    leverage: p.leverage?.value,
    liquidationPx: p.liquidationPx,
  };
}

/**
 * Fetch clearinghouse state for multiple Hyperliquid users (e.g. ApexLiquid top traders).
 * Returns one entry per address with their open perp positions (long/short).
 */
export async function getTopTradersPositions(
  traders: { address: string; label?: string }[]
): Promise<TopTraderState[]> {
  const addresses = traders.map((t) => t.address).filter((a) => /^0x[a-fA-F0-9]{40}$/.test(a));
  if (addresses.length === 0) return [];

  const res = await fetch(HYPERLIQUID_INFO, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: "batchClearinghouseStates", users: addresses }),
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    throw new Error(`Hyperliquid API error: ${res.status}`);
  }

  const rawStates: RawClearinghouseState[] = await res.json();
  if (!Array.isArray(rawStates)) return [];

  return rawStates.map((state, i) => {
    const address = addresses[i] ?? "";
    const trader = traders.find((t) => t.address.toLowerCase() === address.toLowerCase()) ?? { address, label: undefined };
    const positions: HyperliquidPosition[] = (state.assetPositions ?? [])
      .map(parsePosition)
      .filter((p): p is HyperliquidPosition => p != null);
    const accountValue =
      state.marginSummary?.accountValue ?? state.crossMarginSummary?.accountValue;
    return {
      address: trader.address,
      label: trader.label,
      accountValue,
      positions,
    };
  });
}
