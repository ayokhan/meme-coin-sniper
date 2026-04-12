"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import NovaScalperPanel from "@/components/NovaScalperPanel";
import { drawPnlToJpegBlob } from "@/lib/pnl-image";
import { useSession } from "next-auth/react";

type PositionWithPnl = {
  instId: string;
  posSide: string;
  size: number;
  entryPrice: number;
  markPrice: number;
  unrealizedPnl: number;
  pnlPct?: number | null;
  liqPrice?: number | null;
  margin?: number | null;
  marginRatioBlofin?: number | null;
  initialMarginPct?: number | null;
};

type Strategy = "simple" | "indicators" | "ai" | "hybrid";

type Config = {
  provider: "blofin";
  symbol: string;
  timeframe: string;
  leverage: number;
  tpPct: number;
  slPct: number;
  mode: "demo" | "live";
  marginCurrency: "USDT" | "USDC";
  marginMode: "cross" | "isolated";
  positionSizeUsdt: number;
  strategy: Strategy;
  emaPeriod: number;
  fastMA: number;
  slowMA: number;
  rsiPeriod: number;
  enabled: boolean;
  lastRunAt: string | null;
  lastError: string | null;
  lastDecision: string | null;
  lastDecisionMsg: string | null;
  lastDecisionReason: string | null;
  monitorSymbols?: string[];
  aiMonitorAutopilot?: boolean;
  monitorTpTargets?: Record<string, number>;
  monitorDeepTimeframes?: [string, string];
  aiMonitorRunDeepEachCycle?: boolean;
  aiMonitorDeepCheckAutopilot?: boolean;
};

type SuggestedClose = { instId: string; posSide: "long" | "short" | "net"; reason: string };

const DEEP_CHECK_TF_OPTIONS: { bar: string; label: string }[] = [
  { bar: "15m", label: "15m" },
  { bar: "30m", label: "30m" },
  { bar: "1H", label: "1 Hour" },
  { bar: "2H", label: "2 Hour" },
  { bar: "4H", label: "4 Hour" },
  { bar: "6H", label: "6 Hour" },
  { bar: "8H", label: "8 Hour" },
  { bar: "12H", label: "12 Hour" },
  { bar: "1D", label: "1 Day" },
  { bar: "3D", label: "3 Day" },
  { bar: "1W", label: "1 Week" },
  { bar: "1M", label: "1 Month" },
];

function parseOneTpLine(t: string): { key: string; price: number } | null {
    const patterns = [
      /^(.+?)\s*:\s*([\d,.\s]+)\s*$/i,
      /^(.+?)\s*=\s*([\d,.\s]+)\s*$/i,
      /^(.+?)\s+[-–]\s*([\d,.\s]+)\s*$/i,
    ];
    for (const re of patterns) {
      const m = t.match(re);
      if (m) {
        const key = m[1].trim().toUpperCase().replace(/\//g, "-");
        const price = parseFloat(m[2].replace(/,/g, "").replace(/\s/g, ""));
        if (key && Number.isFinite(price) && price > 0) return { key, price };
      }
    }
    return null;
}

function tpMapFromLines(text: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const parsed = parseOneTpLine(t);
    if (parsed) out[parsed.key] = parsed.price;
  }
  return out;
}

function monitorTpForRow(instIdNorm: string, targets?: Record<string, number>): number | undefined {
  if (!targets) return undefined;
  const id = instIdNorm.trim().toUpperCase().replace(/\//g, "-");
  if (targets[id] != null) return targets[id];
  const compact = id.replace(/-/g, "");
  for (const [k, v] of Object.entries(targets)) {
    if (k.replace(/-/g, "") === compact) return v;
  }
  return undefined;
}
type PolymarketMarket = {
  question: string;
  volume: number;
  liquidity: number;
  endDate: string | null;
  url: string;
  bestOutcome: string;
  confidencePct: number;
  direction: "bullish" | "bearish" | "mixed";
};
type PolymarketPosition = {
  title?: string;
  slug?: string;
  outcome?: string;
  size?: number;
  avgPrice?: number;
  currentValue?: number;
  initialValue?: number;
  cashPnl?: number;
};
type PolymarketTrade = {
  side?: "BUY" | "SELL";
  title?: string;
  outcome?: string;
  size?: number;
  price?: number;
  timestamp?: number;
  slug?: string;
};

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

type TradingBotPanelMode = "all" | "futures-only" | "polymarket-only";

export default function TradingBotPanel({ mode = "all" }: { mode?: TradingBotPanelMode }) {
  const { data: session } = useSession();
  const tier = (session?.user as { tier?: "pro" | "vip" | null } | undefined)?.tier ?? null;
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const polymarketOnDemand = !!(session?.user as { polymarketBotOnDemand?: boolean } | undefined)?.polymarketBotOnDemand;
  const canAccessPolymarket = isOwner || (tier === "vip" && polymarketOnDemand);
  const [config, setConfig] = useState<Config | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [running, setRunning] = useState(false);
  const [closing, setClosing] = useState(false);
  const [positionsData, setPositionsData] = useState<{
    positions: PositionWithPnl[];
    totalUnrealizedPnl: number;
    markPrice: number | null;
  } | null>(null);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [orderHistory, setOrderHistory] = useState<{ orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; fillPrice?: string; createdAt?: string; pnl?: string }[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(false);
  const [openOrders, setOpenOrders] = useState<{ orderId: string; instId: string; side: string; orderType: string; size: string; price: string; state: string; createdAt?: string }[]>([]);
  const [openOrdersLoading, setOpenOrdersLoading] = useState(false);
  const [cancelingOrderId, setCancelingOrderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"open_orders" | "positions" | "orders">("positions");
  const [limitOrderPrice, setLimitOrderPrice] = useState("");
  const [limitOrderSide, setLimitOrderSide] = useState<"long" | "short">("long");
  const [placingLimit, setPlacingLimit] = useState(false);
  const [monitoring, setMonitoring] = useState(false);
  const [monitorIntervalMins, setMonitorIntervalMins] = useState<0 | 5 | 10 | 15 | 60>(0);
  const [lastMonitorResult, setLastMonitorResult] = useState<string | null>(null);
  const [lastMonitorReasons, setLastMonitorReasons] = useState<string[]>([]);
  const [lastMonitorRunAt, setLastMonitorRunAt] = useState<string | null>(null);
  const [suggestedCloses, setSuggestedCloses] = useState<SuggestedClose[]>([]);
  const [boardMonitoring, setBoardMonitoring] = useState(false);
  const [boardMonitorIntervalMins, setBoardMonitorIntervalMins] = useState<0 | 5 | 10 | 15 | 60>(0);
  const [lastBoardMonitorResult, setLastBoardMonitorResult] = useState<string | null>(null);
  const [lastBoardMonitorReasons, setLastBoardMonitorReasons] = useState<string[]>([]);
  const [lastBoardMonitorRunAt, setLastBoardMonitorRunAt] = useState<string | null>(null);
  const [suggestedClosesBoard, setSuggestedClosesBoard] = useState<SuggestedClose[]>([]);
  const [downloadingPnlImage, setDownloadingPnlImage] = useState(false);
  const [downloadingClosedPnlImage, setDownloadingClosedPnlImage] = useState(false);
  const [monitorBoardSymbols, setMonitorBoardSymbols] = useState<string[]>([]);
  const [monitorBoardInput, setMonitorBoardInput] = useState("");
  const [savingMonitorBoard, setSavingMonitorBoard] = useState(false);
  const [deepTpText, setDeepTpText] = useState("");
  const [savingDeepTp, setSavingDeepTp] = useState(false);
  const [savingDeepTfs, setSavingDeepTfs] = useState(false);
  const [deepTfPrimary, setDeepTfPrimary] = useState("4H");
  const [deepTfSecondary, setDeepTfSecondary] = useState("1D");
  const [deepMonitoring, setDeepMonitoring] = useState(false);
  const [lastDeepReasons, setLastDeepReasons] = useState<string[]>([]);
  const [lastDeepSuggested, setLastDeepSuggested] = useState<SuggestedClose[]>([]);
  const [lastDeepRunAt, setLastDeepRunAt] = useState<string | null>(null);
  const [lastDeepMessage, setLastDeepMessage] = useState<string | null>(null);
  const [cancelingAll, setCancelingAll] = useState(false);
  const [userBlofinConfigured, setUserBlofinConfigured] = useState<boolean | null>(null);
  const [blofinKeysForm, setBlofinKeysForm] = useState({ apiKey: "", secretKey: "", passphrase: "", demoMode: true, brokerId: "" });
  const [savingBlofinKeys, setSavingBlofinKeys] = useState(false);
  const [clearingBlofinKeys, setClearingBlofinKeys] = useState(false);

  const [form, setForm] = useState<Partial<Config>>({});
  const [botSubTab, setBotSubTab] = useState<"ai" | "scalper" | "polymarket">("ai");
  useEffect(() => {
    if (mode === "polymarket-only") setBotSubTab("polymarket");
    if (mode === "futures-only" && botSubTab === "polymarket") setBotSubTab("ai");
  }, [mode, botSubTab]);

  const [polyKeyword, setPolyKeyword] = useState("bitcoin");
  const [polyBankroll, setPolyBankroll] = useState("1000");
  const [polyMode, setPolyMode] = useState<"demo" | "live">("demo");
  const [polyWalletConnected, setPolyWalletConnected] = useState(false);
  const [polyWalletAddress, setPolyWalletAddress] = useState<string | null>(null);
  const [polyWalletConnecting, setPolyWalletConnecting] = useState(false);
  const [polyCopyMode, setPolyCopyMode] = useState<"exact" | "scaled">("exact");
  const [polyCopyWallets, setPolyCopyWallets] = useState("");
  const [polyCopyTradeAmountUsd, setPolyCopyTradeAmountUsd] = useState("50");
  const [polyCopySlPct, setPolyCopySlPct] = useState("8");
  const [polyCopyTpPct, setPolyCopyTpPct] = useState("20");
  const [polyCopyMaxOpen, setPolyCopyMaxOpen] = useState("3");
  const [polyTradeAmount, setPolyTradeAmount] = useState("50");
  const [polyTradeOutcome, setPolyTradeOutcome] = useState<"yes" | "no">("yes");
  const [polyTradeUrl, setPolyTradeUrl] = useState<string | null>(null);
  const [polyAutoCopyEnabled, setPolyAutoCopyEnabled] = useState(false);
  const [polyAutoCopyIntervalMins, setPolyAutoCopyIntervalMins] = useState<1 | 5 | 15>(5);
  const [polyAutoCopyRunning, setPolyAutoCopyRunning] = useState(false);
  const [polyAutoCopyLastRunAt, setPolyAutoCopyLastRunAt] = useState<string | null>(null);
  const [polyAutoCopyQueue, setPolyAutoCopyQueue] = useState<Array<{ key: string; title: string; outcome: "yes" | "no"; url: string; amountUsd: number; slPct: number; tpPct: number }>>([]);
  const polySeenSignalKeysRef = useRef<Set<string>>(new Set());
  const [polyLiveLoading, setPolyLiveLoading] = useState(false);
  const [polyLiveError, setPolyLiveError] = useState<string | null>(null);
  const [polyLiveValueUsd, setPolyLiveValueUsd] = useState<number | null>(null);
  const [polyLivePositions, setPolyLivePositions] = useState<PolymarketPosition[]>([]);
  const [polyLiveTrades, setPolyLiveTrades] = useState<PolymarketTrade[]>([]);
  const [polyL2Address, setPolyL2Address] = useState("");
  const [polyL2ApiKey, setPolyL2ApiKey] = useState("");
  const [polyL2Passphrase, setPolyL2Passphrase] = useState("");
  const [polyL2Secret, setPolyL2Secret] = useState("");
  const [polyUseStoredCreds, setPolyUseStoredCreds] = useState(true);
  const [polyStoredCredsConfigured, setPolyStoredCredsConfigured] = useState<boolean | null>(null);
  const [polyStoredCredsAddress, setPolyStoredCredsAddress] = useState<string | null>(null);
  const [polySavingStoredCreds, setPolySavingStoredCreds] = useState(false);
  const [polyClearingStoredCreds, setPolyClearingStoredCreds] = useState(false);
  const [polyAutoRefreshOpenOrders, setPolyAutoRefreshOpenOrders] = useState(true);
  const [polyOpenOrdersLoading, setPolyOpenOrdersLoading] = useState(false);
  const [polyOpenOrdersError, setPolyOpenOrdersError] = useState<string | null>(null);
  const [polyOpenOrders, setPolyOpenOrders] = useState<Array<{ id?: string; market?: string; outcome?: string; side?: string; original_size?: number; price?: number; status?: string; created_at?: number }>>([]);
  const [polyOpenOrdersLastLoadedAt, setPolyOpenOrdersLastLoadedAt] = useState<string | null>(null);
  const [polyLoading, setPolyLoading] = useState(false);
  const [polyError, setPolyError] = useState<string | null>(null);
  const [polyResult, setPolyResult] = useState<{
    keyword: string;
    direction: "bullish" | "bearish" | "mixed";
    confidence: "low" | "medium" | "high";
    summary: string;
    markets: PolymarketMarket[];
    institutionalHint: string;
    copyPlan: { wallet: string; allocationUsd: number | null; copyMode: "exact" | "scaled"; copyTradeAmountUsd: number; copySlPct: number; copyTpPct: number; copyMaxOpen: number; note: string }[];
    copySignals: { slug: string; title: string; outcome: string; wallets: string[]; buys: number; sells: number; score: number; url: string }[];
    copyRiskTemplate: { copyTradeAmountUsd: number; copySlPct: number; copyTpPct: number; copyMaxOpen: number };
    execution: {
      mode: "demo" | "live";
      walletConnected: boolean;
      ownerBypass: boolean;
      readyForLive: boolean;
      loginHint: string;
    };
    riskNote: string;
  } | null>(null);

  const getEthereumProvider = (): EthereumProvider | null => {
    if (typeof window === "undefined") return null;
    const w = window as unknown as { ethereum?: EthereumProvider };
    return w.ethereum ?? null;
  };

  const refreshConnectedWallet = useCallback(async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setPolyWalletConnected(false);
      setPolyWalletAddress(null);
      return;
    }
    try {
      const accounts = (await provider.request({ method: "eth_accounts" })) as string[];
      const addr = Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0]) : null;
      setPolyWalletConnected(!!addr);
      setPolyWalletAddress(addr);
    } catch {
      setPolyWalletConnected(false);
      setPolyWalletAddress(null);
    }
  }, []);

  const connectPolymarketWallet = async () => {
    const provider = getEthereumProvider();
    if (!provider) {
      setPolyError("No EVM wallet detected. Install/use Phantom (EVM), MetaMask, or Coinbase Wallet to connect.");
      return;
    }
    try {
      setPolyWalletConnecting(true);
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const addr = Array.isArray(accounts) && accounts.length > 0 ? String(accounts[0]) : null;
      setPolyWalletConnected(!!addr);
      setPolyWalletAddress(addr);
      if (!addr) setPolyError("Wallet connection failed. No account returned.");
      else setPolyError(null);
    } catch {
      setPolyWalletConnected(false);
      setPolyWalletAddress(null);
      setPolyError("Wallet connection was rejected or failed.");
    } finally {
      setPolyWalletConnecting(false);
    }
  };

  const disconnectPolymarketWallet = () => {
    setPolyWalletConnected(false);
    setPolyWalletAddress(null);
    setPolyLiveValueUsd(null);
    setPolyLivePositions([]);
    setPolyLiveTrades([]);
    setPolyAutoCopyEnabled(false);
    setPolyAutoCopyQueue([]);
    setPolyL2Address("");
    setPolyOpenOrders([]);
    setPolyError("Wallet disconnected from NovaStaris session. If needed, disconnect in your wallet extension too.");
  };

  useEffect(() => {
    refreshConnectedWallet();
    const provider = getEthereumProvider();
    if (!provider?.on || !provider?.removeListener) return;
    const onAccountsChanged = (...args: unknown[]) => {
      const first = args[0] as string[] | undefined;
      const addr = Array.isArray(first) && first.length > 0 ? String(first[0]) : null;
      setPolyWalletConnected(!!addr);
      setPolyWalletAddress(addr);
    };
    provider.on("accountsChanged", onAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", onAccountsChanged);
  }, [refreshConnectedWallet]);

  const fetchPolymarketLiveData = useCallback(async () => {
    if (!polyWalletAddress) return;
    try {
      setPolyLiveLoading(true);
      setPolyLiveError(null);
      const [vRes, pRes, tRes] = await Promise.all([
        fetch(`https://data-api.polymarket.com/value?user=${encodeURIComponent(polyWalletAddress)}`, { cache: "no-store" }),
        fetch(`https://data-api.polymarket.com/positions?user=${encodeURIComponent(polyWalletAddress)}&sizeThreshold=1`, { cache: "no-store" }),
        fetch(`https://data-api.polymarket.com/trades?user=${encodeURIComponent(polyWalletAddress)}&limit=20`, { cache: "no-store" }),
      ]);
      const vJson = await vRes.json().catch(() => ({}));
      const pJson = await pRes.json().catch(() => []);
      const tJson = await tRes.json().catch(() => []);
      setPolyLiveValueUsd(typeof vJson?.value === "number" ? vJson.value : (typeof vJson?.totalValue === "number" ? vJson.totalValue : null));
      setPolyLivePositions(Array.isArray(pJson) ? pJson.slice(0, 20) : []);
      setPolyLiveTrades(Array.isArray(tJson) ? tJson.slice(0, 20) : []);
    } catch {
      setPolyLiveError("Could not load live Polymarket data for this wallet.");
    } finally {
      setPolyLiveLoading(false);
    }
  }, [polyWalletAddress]);

  useEffect(() => {
    if (botSubTab !== "polymarket") return;
    if (!polyWalletConnected || !polyWalletAddress) return;
    fetchPolymarketLiveData();
  }, [botSubTab, polyWalletConnected, polyWalletAddress, fetchPolymarketLiveData]);

  useEffect(() => {
    if (polyWalletAddress) setPolyL2Address(polyWalletAddress);
  }, [polyWalletAddress]);

  const loadPolymarketOpenOrders = async () => {
    if (!polyUseStoredCreds && (!polyL2Address || !polyL2ApiKey || !polyL2Passphrase || !polyL2Secret)) {
      setPolyOpenOrdersError("Fill address + API key + passphrase + secret first.");
      return;
    }
    try {
      setPolyOpenOrdersLoading(true);
      setPolyOpenOrdersError(null);
      const res = await fetch("/api/polymarket/l2-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "open_orders",
          address: polyL2Address,
          apiKey: polyL2ApiKey,
          passphrase: polyL2Passphrase,
          secret: polyL2Secret,
          useStored: polyUseStoredCreds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPolyOpenOrders(Array.isArray(data.orders) ? data.orders : []);
        setPolyOpenOrdersLastLoadedAt(new Date().toISOString());
      }
      else setPolyOpenOrdersError(data.error ?? "Failed to load open orders.");
    } catch {
      setPolyOpenOrdersError("Failed to load open orders.");
    } finally {
      setPolyOpenOrdersLoading(false);
    }
  };

  const cancelPolymarketOrder = async (orderID: string) => {
    if (!orderID) return;
    try {
      setPolyOpenOrdersLoading(true);
      setPolyOpenOrdersError(null);
      const res = await fetch("/api/polymarket/l2-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_order",
          orderID,
          address: polyL2Address,
          apiKey: polyL2ApiKey,
          passphrase: polyL2Passphrase,
          secret: polyL2Secret,
          useStored: polyUseStoredCreds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.success)) setPolyOpenOrdersError(data.error ?? "Cancel failed.");
      await loadPolymarketOpenOrders();
    } catch {
      setPolyOpenOrdersError("Cancel failed.");
    } finally {
      setPolyOpenOrdersLoading(false);
    }
  };

  const cancelAllPolymarketOrders = async () => {
    try {
      setPolyOpenOrdersLoading(true);
      setPolyOpenOrdersError(null);
      const res = await fetch("/api/polymarket/l2-proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "cancel_all",
          address: polyL2Address,
          apiKey: polyL2ApiKey,
          passphrase: polyL2Passphrase,
          secret: polyL2Secret,
          useStored: polyUseStoredCreds,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.success)) {
        setPolyOpenOrdersError(data.error ?? "Cancel all failed.");
        return;
      }
      await loadPolymarketOpenOrders();
      setSuccess(`Canceled ${Number(data.cancelled ?? 0)} of ${Number(data.total ?? 0)} open orders.`);
    } catch {
      setPolyOpenOrdersError("Cancel all failed.");
    } finally {
      setPolyOpenOrdersLoading(false);
    }
  };

  const formatLocalTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" }) : null;

  const fetchPositions = useCallback(async () => {
    try {
      setPositionsLoading(true);
      const res = await fetch("/api/admin/trading-bot/positions");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.positions)) {
        setPositionsData({
          positions: data.positions,
          totalUnrealizedPnl: data.totalUnrealizedPnl ?? 0,
          markPrice: data.markPrice ?? null,
        });
      } else {
        setPositionsData(null);
      }
    } catch {
      setPositionsData(null);
    } finally {
      setPositionsLoading(false);
    }
  }, []);

  const clearFeedback = () => {
    setError(null);
    setSuccess(null);
  };

  const loadUserBlofinConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/user/blofin-config");
      const data = await res.json().catch(() => ({}));
      setUserBlofinConfigured(data.success && data.configured === true);
    } catch {
      setUserBlofinConfigured(null);
    }
  }, []);

  const loadUserPolymarketConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/user/polymarket-clob-config");
      const data = await res.json().catch(() => ({}));
      const configured = data.success && data.configured === true;
      setPolyStoredCredsConfigured(configured);
      setPolyStoredCredsAddress(typeof data.address === "string" ? data.address : null);
      if (configured) setPolyUseStoredCreds(true);
    } catch {
      setPolyStoredCredsConfigured(null);
      setPolyStoredCredsAddress(null);
    }
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      clearFeedback();
      loadUserBlofinConfig();
      loadUserPolymarketConfig();
      const res = await fetch("/api/admin/trading-bot");
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        setMonitorBoardSymbols(Array.isArray(data.config.monitorSymbols) ? data.config.monitorSymbols : []);
        const mtp = data.config.monitorTpTargets;
        if (mtp && typeof mtp === "object") {
          const entries = Object.entries(mtp as Record<string, number>).filter(([, v]) => typeof v === "number" && Number.isFinite(v) && v > 0);
          setDeepTpText(entries.length ? entries.map(([k, v]) => `${k}: ${v}`).join("\n") : "");
        } else {
          setDeepTpText("");
        }
        const dtf = data.config.monitorDeepTimeframes;
        if (Array.isArray(dtf) && dtf.length >= 2 && typeof dtf[0] === "string" && typeof dtf[1] === "string") {
          setDeepTfPrimary(dtf[0]);
          setDeepTfSecondary(dtf[1]);
        } else {
          setDeepTfPrimary("4H");
          setDeepTfSecondary("1D");
        }
        setForm({
          provider: "blofin",
          symbol: data.config.symbol,
          timeframe: data.config.timeframe,
          leverage: data.config.leverage,
          tpPct: data.config.tpPct,
          slPct: data.config.slPct,
          mode: data.config.mode,
          marginCurrency: data.config.marginCurrency ?? "USDT",
          marginMode: data.config.marginMode === "isolated" ? "isolated" : "cross",
          positionSizeUsdt: data.config.positionSizeUsdt ?? 50,
          strategy: data.config.strategy ?? "simple",
          emaPeriod: data.config.emaPeriod ?? 200,
          fastMA: data.config.fastMA ?? 9,
          slowMA: data.config.slowMA ?? 21,
          rsiPeriod: data.config.rsiPeriod ?? 14,
        });
      } else {
        setError(data.error ?? (res.status === 403 ? "Owner only." : "Failed to load config."));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (botSubTab !== "polymarket") return;
    if (!polyAutoRefreshOpenOrders) return;
    const hasManual = !!polyL2Address && !!polyL2ApiKey && !!polyL2Passphrase && !!polyL2Secret;
    const hasStored = polyUseStoredCreds && polyStoredCredsConfigured === true;
    if (!hasManual && !hasStored) return;
    const timer = setInterval(() => {
      void loadPolymarketOpenOrders();
    }, 20000);
    return () => clearInterval(timer);
  }, [
    botSubTab,
    polyAutoRefreshOpenOrders,
    polyL2Address,
    polyL2ApiKey,
    polyL2Passphrase,
    polyL2Secret,
    polyUseStoredCreds,
    polyStoredCredsConfigured,
  ]);

  useEffect(() => {
    loadConfig();
  }, []);

  const fetchOrderHistory = useCallback(async () => {
    try {
      setOrderHistoryLoading(true);
      const res = await fetch("/api/admin/trading-bot/orders-history?limit=50");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.orders)) setOrderHistory(data.orders);
      else setOrderHistory([]);
    } catch {
      setOrderHistory([]);
    } finally {
      setOrderHistoryLoading(false);
    }
  }, []);

  const fetchOpenOrders = useCallback(async () => {
    try {
      setOpenOrdersLoading(true);
      const res = await fetch("/api/admin/trading-bot/open-orders?limit=50");
      const data = await res.json().catch(() => ({}));
      if (data.success && Array.isArray(data.orders)) setOpenOrders(data.orders);
      else setOpenOrders([]);
    } catch {
      setOpenOrders([]);
    } finally {
      setOpenOrdersLoading(false);
    }
  }, []);

  useEffect(() => {
    if (config != null) fetchPositions();
  }, [config, fetchPositions]);

  useEffect(() => {
    if (activeTab === "open_orders") fetchOpenOrders();
  }, [activeTab, fetchOpenOrders]);

  // AI Monitor auto-refresh — runs on all open positions
  useEffect(() => {
    if (monitorIntervalMins <= 0) return undefined;
    const runMonitor = async () => {
      try {
        setMonitoring(true);
        setLastMonitorRunAt(new Date().toISOString());
        const res = await fetch("/api/admin/trading-bot/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedOnly: false }),
        });
        const data = await res.json().catch(() => ({}));
        const msg = data.success ? (data.message ?? "Done.") : (data.error ?? "Failed.");
        setLastMonitorResult(msg);
        setLastMonitorReasons(data.success && Array.isArray(data.reasons) ? data.reasons : []);
        setSuggestedCloses(data.success && Array.isArray(data.suggestedCloses) ? data.suggestedCloses : []);
        setLastDeepReasons(data.success && Array.isArray(data.deepReasons) ? data.deepReasons : []);
        setLastDeepSuggested(data.success && Array.isArray(data.deepSuggestedCloses) ? data.deepSuggestedCloses : []);
        if (data.success && (data.closed ?? 0) > 0) fetchPositions();
      } catch {
        setLastMonitorResult("Failed.");
        setLastMonitorReasons([]);
      } finally {
        setMonitoring(false);
      }
    };
    const intervalMs = monitorIntervalMins * 60 * 1000;
    const t = setInterval(runMonitor, intervalMs);
    runMonitor();
    return () => clearInterval(t);
  }, [monitorIntervalMins, fetchPositions]);

  // Monitoring board auto-refresh — runs only on pinned symbols
  useEffect(() => {
    if (boardMonitorIntervalMins <= 0) return undefined;
    const runBoardMonitor = async () => {
      try {
        setBoardMonitoring(true);
        setLastBoardMonitorRunAt(new Date().toISOString());
        const res = await fetch("/api/admin/trading-bot/monitor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pinnedOnly: true }),
        });
        const data = await res.json().catch(() => ({}));
        const msg = data.success ? (data.message ?? "Done.") : (data.error ?? "Failed.");
        setLastBoardMonitorResult(msg);
        setLastBoardMonitorReasons(data.success && Array.isArray(data.reasons) ? data.reasons : []);
        setSuggestedClosesBoard(data.success && Array.isArray(data.suggestedCloses) ? data.suggestedCloses : []);
        setLastDeepReasons(data.success && Array.isArray(data.deepReasons) ? data.deepReasons : []);
        setLastDeepSuggested(data.success && Array.isArray(data.deepSuggestedCloses) ? data.deepSuggestedCloses : []);
        if (data.success && (data.closed ?? 0) > 0) fetchPositions();
      } catch {
        setLastBoardMonitorResult("Failed.");
        setLastBoardMonitorReasons([]);
        setSuggestedClosesBoard([]);
      } finally {
        setBoardMonitoring(false);
      }
    };
    const intervalMs = boardMonitorIntervalMins * 60 * 1000;
    const t = setInterval(runBoardMonitor, intervalMs);
    runBoardMonitor();
    return () => clearInterval(t);
  }, [boardMonitorIntervalMins, fetchPositions]);

  useEffect(() => {
    if (activeTab === "orders") fetchOrderHistory();
  }, [activeTab, fetchOrderHistory]);

  const VALID_TIMEFRAMES = ["1m", "5m", "15m", "1h", "4h", "1D"];
  const validateForm = (): string | null => {
    const symbol = (form.symbol ?? "").trim().toUpperCase();
    if (!symbol) return "Symbol is required (e.g. BTC or BTC/USDT).";
    const tf = (form.timeframe ?? "").trim();
    if (!VALID_TIMEFRAMES.includes(tf)) return `Timeframe must be one of: ${VALID_TIMEFRAMES.join(", ")}.`;
    const lev = form.leverage ?? 0;
    if (lev < 1 || lev > 125) return "Leverage must be between 1 and 125.";
    const tp = form.tpPct ?? 0;
    if (tp <= 0 || tp > 100) return "Take profit % must be between 0.1 and 100.";
    const sl = form.slPct ?? 0;
    if (sl <= 0 || sl > 100) return "Stop loss % must be between 0.1 and 100.";
    const pos = form.positionSizeUsdt ?? 0;
    if (pos <= 0 || pos > 1_000_000) return "Position size must be between 1 and 1,000,000.";
    return null;
  };

  const saveConfig = async () => {
    const err = validateForm();
    if (err) {
      setError(err);
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "blofin",
          symbol: (form.symbol ?? "").trim().toUpperCase(),
          timeframe: (form.timeframe ?? "").trim(),
          leverage: form.leverage ?? 5,
          tpPct: form.tpPct ?? 2,
          slPct: form.slPct ?? 1,
          mode: form.mode ?? "demo",
          marginCurrency: form.marginCurrency ?? "USDT",
          marginMode: form.marginMode === "isolated" ? "isolated" : "cross",
          positionSizeUsdt: form.positionSizeUsdt ?? 50,
          strategy: form.strategy ?? "simple",
          emaPeriod: form.emaPeriod ?? 200,
          fastMA: form.fastMA ?? 9,
          slowMA: form.slowMA ?? 21,
          rsiPeriod: form.rsiPeriod ?? 14,
        }),
      });
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
        setSuccess("Configuration saved successfully.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to save");
        setSuccess(null);
      }
    } catch {
      setError("Failed to save");
      setSuccess(null);
    } finally {
      setSaving(false);
    }
  };

  const toggleBot = async (start: boolean) => {
    if (start) {
      const err = validateForm();
      if (err) {
        setError(err);
        return;
      }
    }
    try {
      setToggling(true);
      setError(null);
      const res = await fetch("/api/admin/trading-bot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: start ? "start" : "stop" }),
      });
      const data = await res.json();
      if (data.success && config) {
        setConfig({ ...config, enabled: data.enabled });
        setSuccess(start ? "Bot started. It will run on schedule." : "Bot stopped.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to update");
        setSuccess(null);
      }
    } catch {
      setError("Failed to update");
      setSuccess(null);
    } finally {
      setToggling(false);
    }
  };

  const runNow = async () => {
    const err = validateForm();
    if (err) {
      setError(err);
      setSuccess(null);
      return;
    }
    try {
      setRunning(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/run", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ? `Run completed. ${data.message}` : "Run completed. Check last decision below.");
        setError(null);
        loadConfig();
      } else {
        setError(data.error ?? "Run failed");
        setSuccess(null);
      }
    } catch {
      setError("Run failed");
      setSuccess(null);
    } finally {
      setRunning(false);
    }
  };

  const placeLimitOrder = async () => {
    const price = parseFloat(limitOrderPrice);
    if (!Number.isFinite(price) || price <= 0) {
      setError("Enter a valid entry price (e.g. from NovaStaris AI suggested entry).");
      return;
    }
    try {
      setPlacingLimit(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/place-limit-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ price, side: limitOrderSide }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Limit order placed.");
        setError(null);
        fetchOrderHistory();
        fetchOpenOrders();
      } else {
        setError(data.error ?? "Failed to place limit order.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to place limit order.");
      setSuccess(null);
    } finally {
      setPlacingLimit(false);
    }
  };

  const runAIMonitor = async () => {
    try {
      setMonitoring(true);
      clearFeedback();
      setSuggestedCloses([]);
      setLastMonitorRunAt(new Date().toISOString());
      const res = await fetch("/api/admin/trading-bot/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedOnly: false }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        const msg = data.message ?? "Evaluation complete.";
        setSuccess(msg);
        setError(null);
        setLastMonitorResult(msg);
        setLastMonitorReasons(Array.isArray(data.reasons) ? data.reasons : []);
        setSuggestedCloses(Array.isArray(data.suggestedCloses) ? data.suggestedCloses : []);
        setLastDeepReasons(Array.isArray(data.deepReasons) ? data.deepReasons : []);
        setLastDeepSuggested(Array.isArray(data.deepSuggestedCloses) ? data.deepSuggestedCloses : []);
        if (Array.isArray(data.deepReasons) && data.deepReasons.length > 0) {
          setLastDeepRunAt(new Date().toISOString());
          setLastDeepMessage(data.message ?? null);
        }
        fetchPositions();
      } else {
        setError(data.error ?? "Monitor failed.");
        setSuccess(null);
        setLastMonitorResult(null);
        setLastMonitorReasons([]);
        setSuggestedCloses([]);
        setLastDeepReasons([]);
        setLastDeepSuggested([]);
      }
    } catch {
      setError("Monitor failed.");
      setSuccess(null);
      setLastMonitorResult(null);
      setLastMonitorReasons([]);
      setSuggestedCloses([]);
      setLastDeepReasons([]);
      setLastDeepSuggested([]);
    } finally {
      setMonitoring(false);
    }
  };

  const runBoardMonitor = async () => {
    try {
      setBoardMonitoring(true);
      clearFeedback();
      setSuggestedClosesBoard([]);
      setLastBoardMonitorRunAt(new Date().toISOString());
      const res = await fetch("/api/admin/trading-bot/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinnedOnly: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        const msg = data.message ?? "Evaluation complete.";
        setSuccess(msg);
        setError(null);
        setLastBoardMonitorResult(msg);
        setLastBoardMonitorReasons(Array.isArray(data.reasons) ? data.reasons : []);
        setSuggestedClosesBoard(Array.isArray(data.suggestedCloses) ? data.suggestedCloses : []);
        setLastDeepReasons(Array.isArray(data.deepReasons) ? data.deepReasons : []);
        setLastDeepSuggested(Array.isArray(data.deepSuggestedCloses) ? data.deepSuggestedCloses : []);
        if (Array.isArray(data.deepReasons) && data.deepReasons.length > 0) {
          setLastDeepRunAt(new Date().toISOString());
          setLastDeepMessage(data.message ?? null);
        }
        fetchPositions();
      } else {
        setError(data.error ?? "Monitor failed.");
        setSuccess(null);
        setLastBoardMonitorResult(null);
        setLastBoardMonitorReasons([]);
        setSuggestedClosesBoard([]);
        setLastDeepReasons([]);
        setLastDeepSuggested([]);
      }
    } catch {
      setError("Monitor failed.");
      setSuccess(null);
      setLastBoardMonitorResult(null);
      setLastBoardMonitorReasons([]);
      setSuggestedClosesBoard([]);
      setLastDeepReasons([]);
      setLastDeepSuggested([]);
    } finally {
      setBoardMonitoring(false);
    }
  };

  const saveDeepTpTargets = async () => {
    try {
      setSavingDeepTp(true);
      clearFeedback();
      const map = tpMapFromLines(deepTpText);
      const res = await fetch("/api/admin/trading-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorTpTargetsJson: JSON.stringify(map) }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        setSuccess("Take-profit targets saved for Deep check.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to save TP targets.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to save TP targets.");
      setSuccess(null);
    } finally {
      setSavingDeepTp(false);
    }
  };

  const saveDeepTimeframes = async () => {
    try {
      setSavingDeepTfs(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ monitorDeepTimeframes: [deepTfPrimary, deepTfSecondary] }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.config) {
        setConfig(data.config);
        const dtf = data.config.monitorDeepTimeframes;
        if (Array.isArray(dtf) && dtf.length >= 2) {
          setDeepTfPrimary(dtf[0]);
          setDeepTfSecondary(dtf[1]);
        }
        setSuccess("Deep check timeframes saved.");
        setError(null);
      } else {
        setError(data.error ?? "Failed to save timeframes.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to save timeframes.");
      setSuccess(null);
    } finally {
      setSavingDeepTfs(false);
    }
  };

  const runDeepCheckNow = async () => {
    try {
      setDeepMonitoring(true);
      clearFeedback();
      setLastDeepRunAt(new Date().toISOString());
      const map = tpMapFromLines(deepTpText);
      const body: Record<string, unknown> = { deepOnly: true, pinnedOnly: false };
      if (Object.keys(map).length > 0) body.tpTargets = map;
      const res = await fetch("/api/admin/trading-bot/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success) {
        setLastDeepMessage(data.message ?? "Deep check complete.");
        setLastDeepReasons(Array.isArray(data.deepReasons) ? data.deepReasons : Array.isArray(data.reasons) ? data.reasons : []);
        setLastDeepSuggested(Array.isArray(data.deepSuggestedCloses) ? data.deepSuggestedCloses : []);
        setSuccess(data.message ?? "Deep check complete.");
        setError(null);
      } else {
        setLastDeepMessage(null);
        setLastDeepReasons([]);
        setLastDeepSuggested([]);
        setError(data.error ?? "Deep check failed.");
        setSuccess(null);
      }
    } catch {
      setLastDeepMessage(null);
      setLastDeepReasons([]);
      setLastDeepSuggested([]);
      setError("Deep check failed.");
      setSuccess(null);
    } finally {
      setDeepMonitoring(false);
    }
  };

  const cancelOpenOrder = async (orderId: string, instId: string) => {
    if (!window.confirm(`Cancel limit order ${instId} @ ${orderId}?`)) return;
    try {
      setCancelingOrderId(orderId);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, instId }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Order canceled.");
        setError(null);
        fetchOpenOrders();
      } else {
        setError(data.error ?? "Failed to cancel order.");
        setSuccess(null);
      }
    } catch {
      setError("Failed to cancel order.");
      setSuccess(null);
    } finally {
      setCancelingOrderId(null);
    }
  };

  const cancelAllOpenOrders = async () => {
    if (openOrders.length === 0) return;
    if (!window.confirm(`Cancel all ${openOrders.length} open order(s)? This cannot be undone.`)) return;
    try {
      setCancelingAll(true);
      clearFeedback();
      let ok = 0;
      let fail = 0;
      for (const o of openOrders) {
        const res = await fetch("/api/admin/trading-bot/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: o.orderId, instId: o.instId }),
        });
        const data = await res.json().catch(() => ({}));
        if (data.success) ok++;
        else fail++;
      }
      if (ok > 0) setSuccess(`${ok} order(s) canceled.` + (fail > 0 ? ` ${fail} failed.` : ""));
      else setSuccess(null);
      if (fail > 0) setError(`${fail} order(s) could not be canceled.`);
      else setError(null);
      fetchOpenOrders();
    } catch {
      setError("Failed to cancel some or all orders.");
      setSuccess(null);
    } finally {
      setCancelingAll(false);
    }
  };

  const closePosition = async (instId?: string, closeAll?: boolean) => {
    const label = closeAll ? "all positions" : instId ?? config?.symbol ?? "position";
    if (!window.confirm(`Close ${label}? NovaStaris will use Blofin's close-position API to exit.`)) return;
    try {
      setClosing(true);
      clearFeedback();
      const res = await fetch("/api/admin/trading-bot/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(closeAll ? { closeAll: true } : instId ? { instId } : {}),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(data.message ?? "Position closed.");
        setError(null);
        setPositionsData(null);
        fetchPositions();
        loadConfig();
      } else {
        setError(data.error ?? "Failed to close position");
        setSuccess(null);
      }
    } catch {
      setError("Failed to close position");
      setSuccess(null);
    } finally {
      setClosing(false);
    }
  };

  const runPolymarketCopilot = async () => {
    const keyword = polyKeyword.trim();
    if (!keyword) {
      setPolyError("Enter a keyword, e.g. bitcoin, fed, election.");
      return;
    }
    try {
      setPolyLoading(true);
      setPolyError(null);
      const res = await fetch("/api/polymarket/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keyword,
          bankroll: Number(polyBankroll),
          mode: polyMode,
          walletConnected: polyWalletConnected || isOwner,
          copyMode: polyCopyMode,
          copyWallets: polyCopyWallets,
          copyTradeAmountUsd: Number(polyCopyTradeAmountUsd),
          copySlPct: Number(polyCopySlPct),
          copyTpPct: Number(polyCopyTpPct),
          copyMaxOpen: Number(polyCopyMaxOpen),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.success && data.result) {
        setPolyResult(data.result);
      } else {
        setPolyResult(null);
        setPolyError(data.error ?? "Failed to run Polymarket copilot.");
      }
    } catch {
      setPolyResult(null);
      setPolyError("Failed to run Polymarket copilot.");
    } finally {
      setPolyLoading(false);
    }
  };

  const placePolymarketTrade = (url: string) => {
    if (!polyWalletConnected && !isOwner) {
      setPolyError("Connect wallet first for live trading.");
      return;
    }
    const amount = Number(polyTradeAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setPolyError("Enter a valid trade amount.");
      return;
    }
    // Polymarket does not support stable prefill query params for order placement.
    // We still route user directly to selected market so they can confirm in wallet.
    const hint = `Opening market for manual confirmation: ${polyTradeOutcome.toUpperCase()} / $${amount}.`;
    setPolyError(null);
    setSuccess(hint);
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const buildCopilotPayload = useCallback(() => ({
    keyword: polyKeyword.trim(),
    bankroll: Number(polyBankroll),
    mode: polyMode,
    walletConnected: polyWalletConnected || isOwner,
    copyMode: polyCopyMode,
    copyWallets: polyCopyWallets,
    copyTradeAmountUsd: Number(polyCopyTradeAmountUsd),
    copySlPct: Number(polyCopySlPct),
    copyTpPct: Number(polyCopyTpPct),
    copyMaxOpen: Number(polyCopyMaxOpen),
  }), [polyKeyword, polyBankroll, polyMode, polyWalletConnected, isOwner, polyCopyMode, polyCopyWallets, polyCopyTradeAmountUsd, polyCopySlPct, polyCopyTpPct, polyCopyMaxOpen]);

  const runAutoCopyScan = useCallback(async () => {
    if (!polyAutoCopyEnabled) return;
    const payload = buildCopilotPayload();
    if (!payload.keyword) return;
    try {
      setPolyAutoCopyRunning(true);
      const res = await fetch("/api/polymarket/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!(res.ok && data.success && data.result)) return;
      const result = data.result as {
        copySignals: Array<{ slug: string; title: string; outcome: string; buys: number; sells: number; wallets: string[]; url: string }>;
        copyRiskTemplate: { copyTradeAmountUsd: number; copySlPct: number; copyTpPct: number; copyMaxOpen: number };
      };
      const maxOpen = Math.max(1, result.copyRiskTemplate.copyMaxOpen || 3);
      setPolyAutoCopyLastRunAt(new Date().toISOString());
      const nextAdds: Array<{ key: string; title: string; outcome: "yes" | "no"; url: string; amountUsd: number; slPct: number; tpPct: number }> = [];
      for (const s of result.copySignals ?? []) {
        if (s.buys <= s.sells) continue;
        const key = `${s.slug}::${s.outcome}::${s.buys}::${s.sells}::${s.wallets.length}`;
        if (polySeenSignalKeysRef.current.has(key)) continue;
        polySeenSignalKeysRef.current.add(key);
        nextAdds.push({
          key,
          title: s.title,
          outcome: /yes|up|higher|win/i.test(s.outcome) ? "yes" : "no",
          url: s.url,
          amountUsd: result.copyRiskTemplate.copyTradeAmountUsd,
          slPct: result.copyRiskTemplate.copySlPct,
          tpPct: result.copyRiskTemplate.copyTpPct,
        });
      }
      if (nextAdds.length > 0) {
        setPolyAutoCopyQueue((prev) => {
          const merged = [...prev, ...nextAdds];
          return merged.slice(0, maxOpen);
        });
      }
    } catch {
      // ignore loop failures
    } finally {
      setPolyAutoCopyRunning(false);
    }
  }, [polyAutoCopyEnabled, buildCopilotPayload]);

  useEffect(() => {
    if (!polyAutoCopyEnabled) return;
    runAutoCopyScan();
    const t = setInterval(runAutoCopyScan, polyAutoCopyIntervalMins * 60 * 1000);
    return () => clearInterval(t);
  }, [polyAutoCopyEnabled, polyAutoCopyIntervalMins, runAutoCopyScan]);

  if (loading) {
    return (
      <div className="mx-6 py-8">
        <p className="text-sm text-muted-foreground">Loading trading bot…</p>
      </div>
    );
  }

  return (
    <div className="mx-6 py-8 max-w-2xl space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-cyan-500 bg-clip-text text-transparent dark:from-cyan-300 dark:via-blue-300 dark:to-cyan-400">
        NovaStaris AI Trading Bots
      </h2>
      <Tabs value={botSubTab} onValueChange={(v) => setBotSubTab(v as "ai" | "scalper" | "polymarket")} className="space-y-4">
        {(mode === "all" || mode === "futures-only") && (
        <TabsList className="bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 p-1 rounded-lg h-auto flex-wrap">
          <TabsTrigger
            value="ai"
            className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"
          >
              NovaAI Futures Bot
          </TabsTrigger>
          <TabsTrigger
            value="scalper"
            className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"
          >
            NovaScalper
          </TabsTrigger>
            {mode === "all" && (
              <TabsTrigger
                value="polymarket"
                className="rounded-md px-3 py-1.5 text-sm font-medium data-[state=inactive]:bg-transparent data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:text-zinc-300 data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600"
              >
                Nova Polymarket Bot
              </TabsTrigger>
            )}
        </TabsList>
        )}

        {mode !== "polymarket-only" && (
        <TabsContent value="scalper" className="mt-0 space-y-4">
          <NovaScalperPanel />
        </TabsContent>
        )}

        {mode !== "futures-only" && (
          <TabsContent value="polymarket" className="mt-0 space-y-4">
          <Card className="border-zinc-200/80 dark:border-zinc-700/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">NovaStaris Polymarket Copilot (VIP)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canAccessPolymarket ? (
                <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/70 dark:bg-amber-950/30 p-3 text-sm">
                  <p className="font-medium text-amber-800 dark:text-amber-200">VIP on-demand access required</p>
                  <p className="text-amber-700 dark:text-amber-300 mt-1">
                    Ask admin to enable <strong>Nova Polymarket Bot (On demand)</strong> for your account.
                  </p>
                </div>
              ) : (
                <>
              <p className="text-sm text-muted-foreground">
                Scan active Polymarket narratives, estimate directional bias, and build a copy-trader plan with Demo/Live mode. Live mode requires wallet login.
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-300">
                No AI can guarantee wins. This copilot improves process, not certainty.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                <div className="flex flex-col">
                  <label className="h-4 block text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400 mb-1">Keyword</label>
                  <input
                    type="text"
                    value={polyKeyword}
                    onChange={(e) => setPolyKeyword(e.target.value)}
                    placeholder="e.g. bitcoin, election, fed"
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="h-4 block text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400 mb-1">Bankroll ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={polyBankroll}
                    onChange={(e) => setPolyBankroll(e.target.value)}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="h-4 block text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400 mb-1">Mode</label>
                  <select
                    value={polyMode}
                    onChange={(e) => setPolyMode(e.target.value as "demo" | "live")}
                    className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  >
                    <option value="demo">Demo</option>
                    <option value="live">Live</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="h-4 block text-[11px] font-medium leading-4 text-zinc-600 dark:text-zinc-400 mb-1">Run</label>
                  <Button onClick={runPolymarketCopilot} disabled={polyLoading} className="bg-cyan-500 hover:bg-cyan-600 text-white w-full h-9 py-0 text-sm align-middle">
                    {polyLoading ? "Running…" : "Run Copilot"}
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="button" variant="outline" size="sm" onClick={connectPolymarketWallet} disabled={polyWalletConnecting}>
                  {polyWalletConnecting ? "Connecting…" : (polyWalletConnected ? "Wallet connected" : "Connect wallet")}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={refreshConnectedWallet}>
                  Refresh wallet status
                </Button>
                {polyWalletConnected && (
                  <Button type="button" variant="ghost" size="sm" onClick={disconnectPolymarketWallet} className="text-rose-600 dark:text-rose-400">
                    Disconnect wallet
                  </Button>
                )}
                <span className={`text-xs ${polyWalletConnected ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
                  {polyWalletConnected ? `Connected: ${polyWalletAddress?.slice(0, 6)}…${polyWalletAddress?.slice(-4)}` : "Not connected"}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">Copy mode</span>
                  <select
                    value={polyCopyMode}
                    onChange={(e) => setPolyCopyMode(e.target.value as "exact" | "scaled")}
                    className="rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                  >
                    <option value="exact">Exact copy</option>
                    <option value="scaled">Scaled copy</option>
                  </select>
                </div>
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs text-muted-foreground">
                <p><strong className="text-zinc-700 dark:text-zinc-300">How to connect wallet:</strong></p>
                <p>1) Click <strong>Connect wallet</strong> above and approve in Phantom (EVM), MetaMask, or Coinbase Wallet.</p>
                <p>2) Make sure the same wallet is used for Polymarket trading.</p>
                <p>3) Set mode to <strong>Live</strong> and run the copilot.</p>
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Trade ticket</p>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Selected market URL</label>
                    <input
                      type="text"
                      value={polyTradeUrl ?? ""}
                      onChange={(e) => setPolyTradeUrl(e.target.value)}
                      placeholder="Pick a market below or paste market URL"
                      className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Outcome</label>
                    <select
                      value={polyTradeOutcome}
                      onChange={(e) => setPolyTradeOutcome(e.target.value as "yes" | "no")}
                      className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-1">Amount ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={polyTradeAmount}
                      onChange={(e) => setPolyTradeAmount(e.target.value)}
                      className="h-9 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => polyTradeUrl && placePolymarketTrade(polyTradeUrl)}
                  disabled={!polyTradeUrl}
                  className="bg-cyan-500 hover:bg-cyan-600 text-white"
                >
                  Place Trade
                </Button>
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Copy-trader wallets (optional, comma/newline separated)</label>
                <textarea
                  value={polyCopyWallets}
                  onChange={(e) => setPolyCopyWallets(e.target.value)}
                  placeholder="0xabc..., 0xdef..."
                  rows={3}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Live Polymarket account data</p>
                  <Button type="button" size="sm" variant="outline" onClick={fetchPolymarketLiveData} disabled={!polyWalletConnected || polyLiveLoading}>
                    {polyLiveLoading ? "Refreshing…" : "Refresh live data"}
                  </Button>
                </div>
                {!polyWalletConnected ? (
                  <p className="text-xs text-muted-foreground">Connect wallet to load live positions, PNL and recent trades.</p>
                ) : (
                  <>
                    {polyLiveError && <p className="text-xs text-rose-600 dark:text-rose-400">{polyLiveError}</p>}
                    <p className="text-xs text-muted-foreground">
                      Total value: {polyLiveValueUsd != null ? `$${polyLiveValueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"}.
                    </p>
                    {polyLivePositions.length > 0 && (
                      <div className="space-y-1 max-h-44 overflow-y-auto">
                        {polyLivePositions.map((p, i) => {
                          const pnl = typeof p.cashPnl === "number" ? p.cashPnl : ((p.currentValue ?? 0) - (p.initialValue ?? 0));
                          return (
                            <div key={`${p.slug ?? "pos"}-${i}`} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs">
                              <p className="font-medium">{p.title ?? "Position"} · {p.outcome ?? "—"}</p>
                              <p className="text-muted-foreground">
                                Size {p.size ?? 0} · Avg {p.avgPrice ?? 0} · PNL: <span className={pnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}</span>
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {polyLiveTrades.length > 0 && (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Recent trades</p>
                        {polyLiveTrades.map((t, i) => (
                          <div key={`trade-${i}`} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs">
                            <p className="font-medium">{t.title ?? "Trade"} · {t.outcome ?? "—"}</p>
                            <p className="text-muted-foreground">
                              {t.side ?? "—"} · size {t.size ?? 0} · price {t.price ?? 0}
                              {t.timestamp ? ` · ${new Date(t.timestamp).toLocaleString()}` : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Live Open Orders (CLOB auth)</p>
                <p className="text-xs text-muted-foreground">
                  Save your Polymarket API credentials once (encrypted at rest), or paste manually for this session.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={polyUseStoredCreds}
                      onChange={(e) => setPolyUseStoredCreds(e.target.checked)}
                      className="rounded"
                    />
                    Use saved encrypted credentials
                  </label>
                  <Badge variant={polyStoredCredsConfigured ? "default" : "outline"}>
                    {polyStoredCredsConfigured ? `Saved${polyStoredCredsAddress ? ` (${polyStoredCredsAddress.slice(0, 6)}...${polyStoredCredsAddress.slice(-4)})` : ""}` : "Not saved"}
                  </Badge>
                  <label className="inline-flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={polyAutoRefreshOpenOrders}
                      onChange={(e) => setPolyAutoRefreshOpenOrders(e.target.checked)}
                      className="rounded"
                    />
                    Auto-refresh every 20s
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input type="text" value={polyL2Address} onChange={(e) => setPolyL2Address(e.target.value)} placeholder="POLY_ADDRESS (0x...)" className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs" />
                  <input type="text" value={polyL2ApiKey} onChange={(e) => setPolyL2ApiKey(e.target.value)} placeholder="POLY_API_KEY" className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs" />
                  <input type="text" value={polyL2Passphrase} onChange={(e) => setPolyL2Passphrase(e.target.value)} placeholder="POLY_PASSPHRASE" className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs" />
                  <input type="password" value={polyL2Secret} onChange={(e) => setPolyL2Secret(e.target.value)} placeholder="POLY_SECRET (base64)" className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-xs" />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    disabled={polySavingStoredCreds || (!polyL2Address || !polyL2ApiKey || !polyL2Passphrase || !polyL2Secret)}
                    onClick={async () => {
                      setPolySavingStoredCreds(true);
                      try {
                        const res = await fetch("/api/user/polymarket-clob-config", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            address: polyL2Address,
                            apiKey: polyL2ApiKey,
                            passphrase: polyL2Passphrase,
                            secret: polyL2Secret,
                          }),
                        });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.success) {
                          setPolyStoredCredsConfigured(true);
                          setPolyStoredCredsAddress(typeof data.address === "string" ? data.address : polyL2Address);
                          setPolyUseStoredCreds(true);
                          setSuccess("Polymarket credentials saved (encrypted).");
                          setPolyL2ApiKey("");
                          setPolyL2Passphrase("");
                          setPolyL2Secret("");
                        } else {
                          setPolyOpenOrdersError(data.error ?? "Could not save credentials.");
                        }
                      } finally {
                        setPolySavingStoredCreds(false);
                      }
                    }}
                  >
                    {polySavingStoredCreds ? "Saving..." : "Save encrypted creds"}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={polyClearingStoredCreds}
                    onClick={async () => {
                      setPolyClearingStoredCreds(true);
                      try {
                        const res = await fetch("/api/user/polymarket-clob-config", { method: "DELETE" });
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.success) {
                          setPolyStoredCredsConfigured(false);
                          setPolyStoredCredsAddress(null);
                          setPolyUseStoredCreds(false);
                          setSuccess("Saved Polymarket credentials cleared.");
                        }
                      } finally {
                        setPolyClearingStoredCreds(false);
                      }
                    }}
                  >
                    {polyClearingStoredCreds ? "Clearing..." : "Clear saved creds"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={loadPolymarketOpenOrders} disabled={polyOpenOrdersLoading}>
                    {polyOpenOrdersLoading ? "Loading…" : "Load open orders"}
                  </Button>
                  <Button type="button" size="sm" variant="destructive" onClick={cancelAllPolymarketOrders} disabled={polyOpenOrdersLoading}>
                    {polyOpenOrdersLoading ? "Working..." : "Cancel all"}
                  </Button>
                </div>
                {polyOpenOrdersError && <p className="text-xs text-rose-600 dark:text-rose-400">{polyOpenOrdersError}</p>}
                {polyOpenOrdersLastLoadedAt && (
                  <p className="text-[11px] text-muted-foreground">
                    Last synced: {new Date(polyOpenOrdersLastLoadedAt).toLocaleString()}
                    {polyAutoRefreshOpenOrders ? " (auto-refresh on)" : ""}
                  </p>
                )}
                {polyOpenOrders.length > 0 && (
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {polyOpenOrders.map((o, i) => (
                      <div key={`${o.id ?? "order"}-${i}`} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs">
                        <p className="font-medium">Order {o.id ?? "—"}</p>
                        <p className="text-muted-foreground">Side {o.side ?? "—"} · Price {o.price ?? "—"} · Size {o.original_size ?? "—"} · Status {o.status ?? "—"}</p>
                        {o.id && (
                          <button type="button" onClick={() => cancelPolymarketOrder(o.id!)} className="mt-1 text-rose-600 dark:text-rose-400 hover:underline">
                            Cancel order
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3">
                <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">Copy trader risk settings</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">Amount / trade ($)</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={polyCopyTradeAmountUsd}
                      onChange={(e) => setPolyCopyTradeAmountUsd(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">SL %</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={polyCopySlPct}
                      onChange={(e) => setPolyCopySlPct(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">TP %</label>
                    <input
                      type="number"
                      min="0.1"
                      step="0.1"
                      value={polyCopyTpPct}
                      onChange={(e) => setPolyCopyTpPct(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-zinc-600 dark:text-zinc-400 mb-1">Max open mirrors</label>
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={polyCopyMaxOpen}
                      onChange={(e) => setPolyCopyMaxOpen(e.target.value)}
                      className="h-8 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  These settings are applied to mirror suggestions from tracked wallets (similar to Maestro-style copy risk templates).
                </p>
              </div>
              <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={polyAutoCopyEnabled}
                      onChange={(e) => setPolyAutoCopyEnabled(e.target.checked)}
                      className="rounded"
                    />
                    Auto-copy loop
                  </label>
                  <select
                    value={polyAutoCopyIntervalMins}
                    onChange={(e) => setPolyAutoCopyIntervalMins(Number(e.target.value) as 1 | 5 | 15)}
                    className="h-8 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                  >
                    <option value={1}>Every 1 min</option>
                    <option value={5}>Every 5 min</option>
                    <option value={15}>Every 15 min</option>
                  </select>
                  <Button type="button" size="sm" variant="outline" onClick={runAutoCopyScan} disabled={polyAutoCopyRunning}>
                    {polyAutoCopyRunning ? "Scanning…" : "Scan now"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Auto-copy scans tracked wallets and queues mirror candidates (based on your amount/SL/TP template). You approve by clicking Mirror in ticket / Place Trade.
                  {polyAutoCopyLastRunAt ? ` Last run: ${new Date(polyAutoCopyLastRunAt).toLocaleString()}.` : ""}
                </p>
                {polyAutoCopyQueue.length > 0 && (
                  <div className="space-y-1">
                    {polyAutoCopyQueue.map((q) => (
                      <div key={q.key} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs">
                        <p className="font-medium">{q.title}</p>
                        <p className="text-muted-foreground">Mirror: {q.outcome.toUpperCase()} · ${q.amountUsd} · SL {q.slPct}% · TP {q.tpPct}%</p>
                        <div className="mt-1 flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              setPolyTradeUrl(q.url);
                              setPolyTradeOutcome(q.outcome);
                              setPolyTradeAmount(String(q.amountUsd));
                            }}
                            className="text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            Mirror in ticket
                          </button>
                          <button
                            type="button"
                            onClick={() => setPolyAutoCopyQueue((prev) => prev.filter((x) => x.key !== q.key))}
                            className="text-rose-600 dark:text-rose-400 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {polyError && <p className="text-sm text-rose-600 dark:text-rose-400">{polyError}</p>}
              {polyResult && (
                <div className="space-y-3">
                  <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                    <p className="text-sm font-medium">Direction: <span className="capitalize">{polyResult.direction}</span> ({polyResult.confidence})</p>
                    <p className="text-xs text-muted-foreground mt-1">{polyResult.summary}</p>
                    <p className="text-xs text-muted-foreground mt-1">{polyResult.institutionalHint}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Mode: <strong className="capitalize">{polyResult.execution.mode}</strong> · Wallet: {polyResult.execution.walletConnected ? "Connected" : "Not connected"}
                    </p>
                    <p className={`text-xs mt-1 ${polyResult.execution.readyForLive ? "text-emerald-600 dark:text-emerald-400" : "text-amber-700 dark:text-amber-300"}`}>
                      {polyResult.execution.loginHint}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Copy template: ${polyResult.copyRiskTemplate.copyTradeAmountUsd}/trade · SL {polyResult.copyRiskTemplate.copySlPct}% · TP {polyResult.copyRiskTemplate.copyTpPct}% · Max open {polyResult.copyRiskTemplate.copyMaxOpen}
                    </p>
                  </div>
                  {polyResult.markets.length > 0 && (
                    <div className="space-y-2">
                      {polyResult.markets.map((m, i) => (
                        <div key={`${m.url}-${i}`} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-sm">
                          <p className="font-medium">{m.question}</p>
                          <p className="text-xs text-muted-foreground">
                            Outcome lead: {m.bestOutcome} ({m.confidencePct}%) · Vol ${m.volume.toLocaleString()} · Liq ${m.liquidity.toLocaleString()}
                          </p>
                          <a href={m.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline">
                            Trade this market on Polymarket
                          </a>
                          <button
                            type="button"
                            onClick={() => setPolyTradeUrl(m.url)}
                            className="ml-3 text-xs text-violet-600 dark:text-violet-400 hover:underline"
                          >
                            Use in ticket
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {polyResult.copyPlan.length > 0 && (
                    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                      <p className="text-sm font-medium mb-1">Copy-trader allocation plan</p>
                      {polyResult.copyPlan.map((c, i) => (
                        <p key={`${c.wallet}-${i}`} className="text-xs text-muted-foreground">
                          {c.wallet}: {c.allocationUsd != null ? `$${c.allocationUsd}` : "—"} · {c.copyMode === "exact" ? "Exact" : "Scaled"} · ${c.copyTradeAmountUsd} / SL {c.copySlPct}% / TP {c.copyTpPct}% / max {c.copyMaxOpen} · {c.note}
                        </p>
                      ))}
                    </div>
                  )}
                  {polyResult.copySignals.length > 0 && (
                    <div className="rounded border border-zinc-200 dark:border-zinc-700 p-3 bg-zinc-50/50 dark:bg-zinc-900/40">
                      <p className="text-sm font-medium mb-2">Copy-trader live signals</p>
                      <div className="space-y-2">
                        {polyResult.copySignals.map((s, i) => (
                          <div key={`${s.slug}-${i}`} className="rounded border border-zinc-200 dark:border-zinc-700 p-2 text-xs">
                            <p className="font-medium text-sm">{s.title}</p>
                            <p className="text-muted-foreground">Outcome: {s.outcome} · Buys {s.buys} / Sells {s.sells} · Wallets: {s.wallets.length}</p>
                            <div className="mt-1 flex items-center gap-3">
                              <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-cyan-600 dark:text-cyan-400 hover:underline">Open market</a>
                              <button
                                type="button"
                                onClick={() => {
                                  setPolyTradeUrl(s.url);
                                  setPolyTradeOutcome(/yes|up|higher|win/i.test(s.outcome) ? "yes" : "no");
                                  setPolyTradeAmount(polyCopyTradeAmountUsd);
                                }}
                                className="text-violet-600 dark:text-violet-400 hover:underline"
                              >
                                Mirror in ticket
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <p className="text-xs text-amber-700 dark:text-amber-300">{polyResult.riskNote}</p>
                </div>
              )}
                </>
              )}
            </CardContent>
          </Card>
          </TabsContent>
        )}

        {mode !== "polymarket-only" && (
        <TabsContent value="ai" className="mt-0 space-y-6">
      <p className="text-sm text-muted-foreground">
        <strong className="text-cyan-600 dark:text-cyan-400">AI bot</strong> (this tab): signals + Blofin execution. Use{" "}
        <strong>NovaScalper</strong> for fixed entry/exit price loops.
      </p>

      {success && (
        <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 p-3 text-sm text-emerald-800 dark:text-emerald-200 flex items-start justify-between gap-2">
          <p className="font-medium">{success}</p>
          <button
            type="button"
            onClick={() => setSuccess(null)}
            className="shrink-0 text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-200"
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-rose-200/80 dark:border-rose-800/80 bg-rose-50/50 dark:bg-rose-950/30 p-3 text-sm text-rose-700 dark:text-rose-300 space-y-2">
          <p>{error}</p>
          {(error.includes("does not exist") || error.includes("column") || error.includes("relation") || error.includes("TradingBot")) && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-2">
              Database may need updating. Run: <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">npx prisma db push</code> against your production DATABASE_URL.
            </p>
          )}
          {error.toLowerCase().includes("brokerid") && (
            <p className="text-xs text-rose-600/90 dark:text-rose-400/90 mt-2">
              Add <code className="bg-rose-200/50 dark:bg-rose-900/30 px-1 rounded">BLOFIN_BROKER_ID</code> to your server environment (e.g. Vercel env vars) with your Blofin broker ID, then redeploy.
            </p>
          )}
        </div>
      )}

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Your Blofin API keys</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Store your Blofin API keys here to run the bot with your account. Keys are encrypted and never sent to our servers except to place orders. Leave empty to use server env keys (owner).</p>
          {userBlofinConfigured === true && (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">Keys are configured. Run uses your account.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">API Key</label>
              <input type="password" placeholder="••••••••" value={blofinKeysForm.apiKey} onChange={(e) => setBlofinKeysForm((f) => ({ ...f, apiKey: e.target.value }))} className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Secret Key</label>
              <input type="password" placeholder="••••••••" value={blofinKeysForm.secretKey} onChange={(e) => setBlofinKeysForm((f) => ({ ...f, secretKey: e.target.value }))} className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Passphrase</label>
              <input type="password" placeholder="••••••••" value={blofinKeysForm.passphrase} onChange={(e) => setBlofinKeysForm((f) => ({ ...f, passphrase: e.target.value }))} className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="blofin-demo" checked={blofinKeysForm.demoMode} onChange={(e) => setBlofinKeysForm((f) => ({ ...f, demoMode: e.target.checked }))} className="rounded" />
              <label htmlFor="blofin-demo" className="text-sm">Demo mode</label>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Broker ID (optional)</label>
              <input type="text" placeholder="Leave empty if not using broker key" value={blofinKeysForm.brokerId} onChange={(e) => setBlofinKeysForm((f) => ({ ...f, brokerId: e.target.value }))} className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={savingBlofinKeys || (!blofinKeysForm.apiKey || !blofinKeysForm.secretKey || !blofinKeysForm.passphrase)} onClick={async () => { setSavingBlofinKeys(true); try { const res = await fetch("/api/user/blofin-config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: blofinKeysForm.apiKey, secretKey: blofinKeysForm.secretKey, passphrase: blofinKeysForm.passphrase, demoMode: blofinKeysForm.demoMode, brokerId: blofinKeysForm.brokerId || undefined }) }); const data = await res.json(); if (data.success) { setUserBlofinConfigured(true); setBlofinKeysForm((f) => ({ ...f, apiKey: "", secretKey: "", passphrase: "" })); setSuccess("Blofin keys saved."); } else setError(data.error ?? "Save failed"); } finally { setSavingBlofinKeys(false); } }}>{savingBlofinKeys ? "Saving…" : "Save keys"}</Button>
            {userBlofinConfigured && (
              <Button size="sm" variant="outline" disabled={clearingBlofinKeys} onClick={async () => { setClearingBlofinKeys(true); try { const res = await fetch("/api/user/blofin-config", { method: "DELETE" }); const data = await res.json(); if (data.success) { setUserBlofinConfigured(false); setSuccess("Blofin keys cleared."); } } finally { setClearingBlofinKeys(false); loadUserBlofinConfig(); } }}>{clearingBlofinKeys ? "…" : "Clear keys"}</Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Config</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Provider</label>
            <p className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800/80 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300">
              Blofin
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Symbol</label>
              <input
                type="text"
                placeholder="e.g. BTC, ETH or BTC/USDT"
                value={form.symbol ?? ""}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <p className="text-xs text-muted-foreground mt-1">BTC or BTC/USDT both work; converted to Blofin format (e.g. BTC-USDT).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Timeframe</label>
              <select
                value={form.timeframe ?? "15m"}
                onChange={(e) => setForm({ ...form, timeframe: e.target.value })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {["1m", "5m", "15m", "1h", "4h", "1D"].map((tf) => (
                  <option key={tf} value={tf}>{tf}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Leverage</label>
              <select
                value={form.leverage ?? 5}
                onChange={(e) => setForm({ ...form, leverage: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                {[1, 2, 3, 5, 10, 20, 50, 75, 100, 125].map((x) => (
                  <option key={x} value={x}>{x}x</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Mode</label>
              <select
                value={form.mode ?? "demo"}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "demo" | "live" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="demo">Demo (test)</option>
                <option value="live">Live (real funds)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Margin (currency)</label>
              <select
                value={form.marginCurrency ?? "USDT"}
                onChange={(e) => setForm({ ...form, marginCurrency: e.target.value as "USDT" | "USDC" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="USDT">USDT</option>
                <option value="USDC">USDC</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Margin mode</label>
              <select
                value={form.marginMode ?? "cross"}
                onChange={(e) => setForm({ ...form, marginMode: e.target.value as "cross" | "isolated" })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="cross">Cross</option>
                <option value="isolated">Isolated</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Cross uses full account balance; isolated limits risk per position.</p>
            </div>
          </div>
          <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Strategy</label>
              <select
                value={form.strategy ?? "simple"}
                onChange={(e) => setForm({ ...form, strategy: e.target.value as Strategy })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="simple">Simple (price change)</option>
                <option value="indicators">Indicators (EMA, MA cross, RSI, S/R, candles)</option>
                <option value="ai">AI (LLM analysis)</option>
                <option value="hybrid">Hybrid (indicators + AI must agree)</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">Hybrid and Indicators use the settings below.</p>
            </div>
            {(form.strategy === "indicators" || form.strategy === "ai" || form.strategy === "hybrid") && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">EMA period</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={form.emaPeriod ?? 200}
                    onChange={(e) => setForm({ ...form, emaPeriod: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Fast MA</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={form.fastMA ?? 9}
                    onChange={(e) => setForm({ ...form, fastMA: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Slow MA</label>
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={form.slowMA ?? 21}
                    onChange={(e) => setForm({ ...form, slowMA: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">RSI period</label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={form.rsiPeriod ?? 14}
                    onChange={(e) => setForm({ ...form, rsiPeriod: Number(e.target.value) })}
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                  />
                </div>
              </div>
            )}
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Position size (target notional)</label>
            <input
              type="number"
              min="1"
              max="1000000"
              step="1"
              value={form.positionSizeUsdt ?? 50}
              onChange={(e) => setForm({ ...form, positionSizeUsdt: Number(e.target.value) })}
              className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <p className="text-xs text-muted-foreground mt-1">Margin per trade in USDT/USDC. Notional = margin × leverage. Actual position may be rounded up to the exchange minimum contract size.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Take profit %</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={form.tpPct ?? 2}
                onChange={(e) => setForm({ ...form, tpPct: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Stop loss %</label>
              <input
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={form.slPct ?? 1}
                onChange={(e) => setForm({ ...form, slPct: Number(e.target.value) })}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            TP/SL are sent to Blofin when the bot opens a position. If they don’t trigger, confirm with Blofin that <code className="rounded bg-zinc-200 dark:bg-zinc-700 px-0.5">order-tpsl</code> is supported for your account.          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Trailing stop:</strong> NovaStaris uses fixed TP/SL for automated risk. Blofin supports trailing stop on their platform; we can add API support here once Blofin exposes it in their API docs.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveConfig} disabled={saving} className="bg-cyan-500 hover:bg-cyan-600 text-white dark:bg-cyan-600 dark:hover:bg-cyan-700">
              {saving ? "Saving…" : "Save config"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Place limit order &amp; AI Monitor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">Place limit order at entry price</p>
            <p className="text-xs text-muted-foreground">
              When NovaStaris AI suggests an entry price, set an order to be placed at that price (uses bot symbol, size, leverage).
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Entry price</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="e.g. 97234.5"
                  value={limitOrderPrice}
                  onChange={(e) => setLimitOrderPrice(e.target.value)}
                  className="w-32 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Side</label>
                <select
                  value={limitOrderSide}
                  onChange={(e) => setLimitOrderSide(e.target.value as "long" | "short")}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                >
                  <option value="long">Long</option>
                  <option value="short">Short</option>
                </select>
              </div>
              <Button onClick={placeLimitOrder} disabled={placingLimit} size="sm" className="bg-cyan-500 hover:bg-cyan-600 text-white">
                {placingLimit ? "Placing…" : "Place limit order"}
              </Button>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              Monitoring board
              {config != null && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${config.mode === "demo" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                  {config.mode === "demo" ? "Demo" : "Live"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Pin positions or add symbols to choose which positions the AI monitor evaluates. <strong>Leave empty to monitor all</strong> open positions. <strong>Click Save</strong> after pinning so the AI monitor uses this list (it reads the saved board, not the list on screen). Use <strong>Run now</strong> / <strong>Auto-refresh</strong> below to refresh PNL only (no AI).
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-600">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Autopilot mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={config?.aiMonitorAutopilot ?? false}
                onClick={async () => {
                  const next = !(config?.aiMonitorAutopilot ?? false);
                  try {
                    const res = await fetch("/api/admin/trading-bot", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aiMonitorAutopilot: next }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.success && data.config) {
                      setConfig(data.config);
                      setSuccess(next ? "Autopilot on: you can confirm and close from AI Monitor." : "Autopilot off: monitor only suggests.");
                    }
                  } catch {
                    setError("Failed to update Autopilot.");
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${(config?.aiMonitorAutopilot ?? false) ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${(config?.aiMonitorAutopilot ?? false) ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-muted-foreground">{(config?.aiMonitorAutopilot ?? false) ? "On — AI closes positions automatically" : "Off — monitor only suggests"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="e.g. ETH-USDT"
                value={monitorBoardInput}
                onChange={(e) => setMonitorBoardInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const v = monitorBoardInput.trim().toUpperCase().replace("/", "-");
                    if (v && !monitorBoardSymbols.includes(v)) setMonitorBoardSymbols([...monitorBoardSymbols, v]);
                    setMonitorBoardInput("");
                  }
                }}
                className="w-36 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  const v = monitorBoardInput.trim().toUpperCase().replace("/", "-");
                  if (v && !monitorBoardSymbols.includes(v)) setMonitorBoardSymbols([...monitorBoardSymbols, v]);
                  setMonitorBoardInput("");
                }}
              >
                Add
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={savingMonitorBoard}
                onClick={async () => {
                  try {
                    setSavingMonitorBoard(true);
                    clearFeedback();
                    const res = await fetch("/api/admin/trading-bot", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ monitorSymbols: monitorBoardSymbols }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.success) {
                      setSuccess("Monitoring board saved.");
                      setError(null);
                    } else setError(data.error ?? "Failed to save.");
                  } catch {
                    setError("Failed to save.");
                  } finally {
                    setSavingMonitorBoard(false);
                  }
                }}
              >
                {savingMonitorBoard ? "Saving…" : "Save"}
              </Button>
              {positionsData && positionsData.positions.length > 0 && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const symbols = [...new Set(positionsData!.positions.map((p) => (p.instId ?? "").trim().toUpperCase().replace("/", "-")).filter(Boolean))];
                    const merged = [...new Set([...monitorBoardSymbols, ...symbols])];
                    setMonitorBoardSymbols(merged);
                  }}
                  className="border-cyan-500 text-cyan-700 dark:text-cyan-300"
                >
                  Pin all positions
                </Button>
              )}
            </div>
            {monitorBoardSymbols.length > 0 && (
              <>
                <p className="text-xs text-amber-700 dark:text-amber-400 font-medium">Click <strong>Save</strong> above. Run now / Auto-refresh here will evaluate only these pinned symbols (not all positions).</p>
                <div className="flex flex-wrap gap-1.5">
                {monitorBoardSymbols.map((s) => (
                  <span
                    key={s}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-200 dark:bg-zinc-700 px-2 py-0.5 text-xs"
                  >
                    {s}
                    <button
                      type="button"
                      aria-label={`Remove ${s}`}
                      onClick={() => setMonitorBoardSymbols(monitorBoardSymbols.filter((x) => x !== s))}
                      className="hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              </>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-600">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Autopilot mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={config?.aiMonitorAutopilot ?? false}
                onClick={async () => {
                  const next = !(config?.aiMonitorAutopilot ?? false);
                  try {
                    const res = await fetch("/api/admin/trading-bot", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aiMonitorAutopilot: next }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.success && data.config) {
                      setConfig(data.config);
                      setSuccess(next ? "Autopilot on: AI can close positions automatically." : "Autopilot off: monitor only suggests.");
                    }
                  } catch {
                    setError("Failed to update Autopilot.");
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${(config?.aiMonitorAutopilot ?? false) ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${(config?.aiMonitorAutopilot ?? false) ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-muted-foreground">{(config?.aiMonitorAutopilot ?? false) ? "On — AI closes automatically" : "Off — suggestions only"}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Auto-refresh:</span>
              <select
                value={boardMonitorIntervalMins}
                onChange={(e) => setBoardMonitorIntervalMins(Number(e.target.value) as 0 | 5 | 10 | 15 | 60)}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
              >
                <option value={0}>Off</option>
                <option value={5}>Every 5 min</option>
                <option value={10}>Every 10 min</option>
                <option value={15}>Every 15 min</option>
                <option value={60}>Every 1 hour</option>
              </select>
              <Button type="button" variant="outline" size="sm" onClick={runBoardMonitor} disabled={boardMonitoring} className="border-cyan-500 text-cyan-700 dark:text-cyan-300">
                {boardMonitoring ? "Running…" : "Run now"}
              </Button>
              <span className="text-xs text-muted-foreground">Runs only on pinned symbols above.</span>
            </div>
            {lastBoardMonitorResult != null && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Last monitor (pinned): {lastBoardMonitorResult}
                  {lastBoardMonitorRunAt && (
                    <>
                      {" · "}
                      <span title={new Date(lastBoardMonitorRunAt).toLocaleString()}>
                        {formatLocalTime(lastBoardMonitorRunAt)}
                      </span>
                    </>
                  )}
                </p>
                {suggestedClosesBoard.length > 0 && (
                  <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-2 space-y-2">
                    <p className="font-medium text-amber-800 dark:text-amber-200">AI suggests closing ({suggestedClosesBoard.length})</p>
                    <ul className="space-y-1">
                      {suggestedClosesBoard.map((s, i) => (
                        <li key={i} className="text-amber-700 dark:text-amber-300">
                          {s.instId} {s.posSide.toUpperCase()} — {s.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Turn on Autopilot to let AI close these positions automatically.</p>
                  </div>
                )}
                {lastBoardMonitorReasons.length > 0 && (
                  <div className="mt-1.5 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-900/40 p-2 space-y-0.5">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">Reasons:</p>
                    {lastBoardMonitorReasons.map((r, i) => (
                      <p key={i} className="pl-0 text-muted-foreground">{r}</p>
                    ))}
                  </div>
                )}
                {suggestedClosesBoard.length === 0 && lastBoardMonitorReasons.length === 0 && (lastBoardMonitorResult.includes("No positions") || lastBoardMonitorResult.includes("evaluate") || lastBoardMonitorResult.includes("match")) && (
                  <span className="block mt-0.5 text-muted-foreground/90">Pinned position(s) were evaluated; none met the exit criteria.</span>
                )}
              </div>
            )}
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/30 p-3 space-y-3">
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
              AI Monitor
              {config != null && (
                <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${config.mode === "demo" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200" : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"}`}>
                  {config.mode === "demo" ? "Demo" : "Live"}
                </span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              Run NovaStaris AI on <strong>all open positions</strong>. When the trend is opposite or the analysis is negative, it suggests or closes positions. With <strong>Autopilot on</strong>, AI closes positions automatically. With <strong>Autopilot off</strong>, it only suggests (no close). Uses the same account (<strong>{config?.mode === "demo" ? "Demo" : "Live"}</strong>) as the bot.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-600">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Autopilot mode</span>
              <button
                type="button"
                role="switch"
                aria-checked={config?.aiMonitorAutopilot ?? false}
                onClick={async () => {
                  const next = !(config?.aiMonitorAutopilot ?? false);
                  try {
                    const res = await fetch("/api/admin/trading-bot", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ aiMonitorAutopilot: next }),
                    });
                    const data = await res.json().catch(() => ({}));
                    if (data.success && data.config) {
                      setConfig(data.config);
                      setSuccess(next ? "Autopilot on: you can confirm and close from AI Monitor." : "Autopilot off: monitor only suggests.");
                    }
                  } catch {
                    setError("Failed to update Autopilot.");
                  }
                }}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${(config?.aiMonitorAutopilot ?? false) ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${(config?.aiMonitorAutopilot ?? false) ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-xs text-muted-foreground">{(config?.aiMonitorAutopilot ?? false) ? "On — AI closes automatically" : "Off — suggestions only"}</span>
            </div>
            <details className="rounded-md border border-violet-200/80 dark:border-violet-800/60 bg-violet-50/40 dark:bg-violet-950/20 px-2 py-2 space-y-2">
              <summary className="text-xs font-semibold cursor-pointer text-violet-900 dark:text-violet-200 select-none">Deep check — longer horizon &amp; your TP</summary>
              <p className="text-xs text-muted-foreground">
                Uses <strong>two Blofin candle series</strong> you choose (default 4 Hour + 1 Day; you can pick longer frames like 1 Week / 1 Month). Enter take-profit prices Blofin may not show — one line per symbol (e.g.{" "}
                <code className="text-[11px]">ETH-USDT:2100</code>). ETAs are rough and uncertain; not financial advice.
              </p>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">Primary series</label>
                  <select
                    value={deepTfPrimary}
                    onChange={(e) => setDeepTfPrimary(e.target.value)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs min-w-[7.5rem]"
                  >
                    {DEEP_CHECK_TF_OPTIONS.map((o) => (
                      <option key={`p-${o.bar}`} value={o.bar}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-zinc-600 dark:text-zinc-400 mb-0.5">Secondary series</label>
                  <select
                    value={deepTfSecondary}
                    onChange={(e) => setDeepTfSecondary(e.target.value)}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1 text-xs min-w-[7.5rem]"
                  >
                    {DEEP_CHECK_TF_OPTIONS.map((o) => (
                      <option key={`s-${o.bar}`} value={o.bar}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Button type="button" size="sm" variant="secondary" onClick={saveDeepTimeframes} disabled={savingDeepTfs || config == null}>
                  {savingDeepTfs ? "Saving…" : "Save timeframes"}
                </Button>
              </div>
              {config?.monitorDeepTimeframes && (
                <p className="text-[11px] text-muted-foreground">
                  Saved: {config.monitorDeepTimeframes[0]} + {config.monitorDeepTimeframes[1]}
                </p>
              )}
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">TP targets (save before monitor runs)</label>
              <textarea
                value={deepTpText}
                onChange={(e) => setDeepTpText(e.target.value)}
                rows={3}
                placeholder={"ETH-USDT:2100 or ETH-USDT - 2100\nBTC-USDT=98500"}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5 text-xs font-mono"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" onClick={saveDeepTpTargets} disabled={savingDeepTp || config == null}>
                  {savingDeepTp ? "Saving…" : "Save TP targets"}
                </Button>
                <Button type="button" size="sm" variant="outline" className="border-violet-500 text-violet-800 dark:text-violet-300" onClick={runDeepCheckNow} disabled={deepMonitoring}>
                  {deepMonitoring ? "Running deep…" : "Run deep check now"}
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-violet-200/60 dark:border-violet-800/40">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Deep on each run</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config?.aiMonitorRunDeepEachCycle ?? false}
                  onClick={async () => {
                    const next = !(config?.aiMonitorRunDeepEachCycle ?? false);
                    try {
                      const res = await fetch("/api/admin/trading-bot", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ aiMonitorRunDeepEachCycle: next }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (data.success && data.config) {
                        setConfig(data.config);
                        setSuccess(next ? "Deep check will run on each monitor / auto-refresh." : "Deep check only when you use Run deep check now.");
                      }
                    } catch {
                      setError("Failed to update Deep check setting.");
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${(config?.aiMonitorRunDeepEachCycle ?? false) ? "bg-violet-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${(config?.aiMonitorRunDeepEachCycle ?? false) ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <span className="text-xs text-muted-foreground">Adds your saved series pair whenever you run or auto-refresh the monitor.</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Deep autopilot</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={config?.aiMonitorDeepCheckAutopilot ?? false}
                  onClick={async () => {
                    const next = !(config?.aiMonitorDeepCheckAutopilot ?? false);
                    try {
                      const res = await fetch("/api/admin/trading-bot", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ aiMonitorDeepCheckAutopilot: next }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (data.success && data.config) {
                        setConfig(data.config);
                        setSuccess(
                          next
                            ? "Deep autopilot on: if Deep check recommends exit during a monitor run, the position can be closed automatically (separate from short-term Autopilot)."
                            : "Deep autopilot off: Deep check never auto-closes."
                        );
                      }
                    } catch {
                      setError("Failed to update Deep autopilot.");
                    }
                  }}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 ${(config?.aiMonitorDeepCheckAutopilot ?? false) ? "bg-violet-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${(config?.aiMonitorDeepCheckAutopilot ?? false) ? "translate-x-5" : "translate-x-1"}`} />
                </button>
                <span className="text-xs text-muted-foreground">Only when Deep recommends closing — independent of short-term Autopilot above.</span>
              </div>
            </details>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Auto-refresh:</span>
              <select
                value={monitorIntervalMins}
                onChange={(e) => setMonitorIntervalMins(Number(e.target.value) as 0 | 5 | 10 | 15 | 60)}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
              >
                <option value={0}>Off</option>
                <option value={5}>Every 5 min</option>
                <option value={10}>Every 10 min</option>
                <option value={15}>Every 15 min</option>
                <option value={60}>Every 1 hour</option>
              </select>
              <Button onClick={runAIMonitor} disabled={monitoring} variant="outline" size="sm" className="border-cyan-500 text-cyan-700 dark:text-cyan-300">
                {monitoring ? "Running…" : "Run now"}
              </Button>
              <span className="text-xs text-muted-foreground">Runs on all open positions.</span>
            </div>
            {lastMonitorResult != null && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Last monitor (all): {lastMonitorResult}
                  {lastMonitorRunAt && (
                    <>
                      {" · "}
                      <span title={new Date(lastMonitorRunAt).toLocaleString()}>
                        {formatLocalTime(lastMonitorRunAt)}
                      </span>
                    </>
                  )}
                </p>
                {suggestedCloses.length > 0 && (
                  <div className="mt-2 rounded border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-950/30 p-2 space-y-2">
                    <p className="font-medium text-amber-800 dark:text-amber-200">AI suggests closing ({suggestedCloses.length})</p>
                    <ul className="space-y-1">
                      {suggestedCloses.map((s, i) => (
                        <li key={i} className="text-amber-700 dark:text-amber-300">
                          {s.instId} {s.posSide.toUpperCase()} — {s.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 dark:text-amber-300">Turn on Autopilot to let AI close these positions automatically.</p>
                  </div>
                )}
                {lastMonitorReasons.length > 0 && (
                  <div className="mt-1.5 rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-900/40 p-2 space-y-0.5">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">Reasons:</p>
                    {lastMonitorReasons.map((r, i) => (
                      <p key={i} className="pl-0 text-muted-foreground">{r}</p>
                    ))}
                  </div>
                )}
                {suggestedCloses.length === 0 && lastMonitorReasons.length === 0 && lastMonitorResult != null && (lastMonitorResult.includes("No positions") || lastMonitorResult.includes("evaluate")) && (
                  <span className="block mt-0.5 text-muted-foreground/90">Your position(s) were evaluated; none met the exit criteria.</span>
                )}
              </div>
            )}
            {(lastDeepReasons.length > 0 || lastDeepSuggested.length > 0 || lastDeepMessage) && (
              <div className="text-xs space-y-1.5 mt-2 pt-2 border-t border-violet-200/60 dark:border-violet-800/40">
                <p className="font-medium text-violet-900 dark:text-violet-200">
                  Deep check results
                  {lastDeepRunAt && (
                    <>
                      {" · "}
                      <span className="text-muted-foreground font-normal" title={new Date(lastDeepRunAt).toLocaleString()}>
                        {formatLocalTime(lastDeepRunAt)}
                      </span>
                    </>
                  )}
                </p>
                {lastDeepMessage && <p className="text-muted-foreground">{lastDeepMessage}</p>}
                {lastDeepSuggested.length > 0 && (
                  <div className="rounded border border-violet-200 dark:border-violet-800 bg-violet-50/80 dark:bg-violet-950/30 p-2 space-y-1">
                    <p className="font-medium text-violet-900 dark:text-violet-200">Deep suggests closing ({lastDeepSuggested.length})</p>
                    <ul className="space-y-0.5">
                      {lastDeepSuggested.map((s, i) => (
                        <li key={i} className="text-violet-800 dark:text-violet-300">
                          {s.instId} {s.posSide.toUpperCase()} — {s.reason}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-violet-800/90 dark:text-violet-300/90">Turn on Deep autopilot inside Deep check to allow auto-close when Deep recommends exit (separate from short-term Autopilot).</p>
                  </div>
                )}
                {lastDeepReasons.length > 0 && (
                  <div className="rounded border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-900/40 p-2 space-y-0.5">
                    <p className="font-medium text-zinc-700 dark:text-zinc-300">Deep lines:</p>
                    {lastDeepReasons.map((r, i) => (
                      <p key={i} className="pl-0 text-muted-foreground">
                        {r}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-700/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Bot control</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {config?.enabled ? "Bot is running." : "Bot is stopped. Start to begin automated trading."}
          </p>
          {config?.lastRunAt && (
            <p className="text-xs text-muted-foreground">Last run: {new Date(config.lastRunAt).toLocaleString()}</p>
          )}
          {config?.lastDecision && config.lastDecision !== "no_trade" && config?.lastDecisionMsg && positionsData && (() => {
            const botSymbolNorm = (config.symbol ?? "").toUpperCase().replace("/", "-");
            const decisionSide = (config.lastDecision ?? "").toLowerCase();
            const hasMatchingOpenPosition = positionsData.positions.some((p) => {
              const instNorm = (p.instId ?? "").toUpperCase().replace("/", "-");
              const side = (p.posSide ?? "").toLowerCase();
              return (instNorm === botSymbolNorm || instNorm.startsWith(botSymbolNorm + "-")) && side === decisionSide;
            });
            return hasMatchingOpenPosition;
          })() && (
            <div className="rounded-lg border border-emerald-200/80 dark:border-emerald-800/80 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-sm">
              <p className="font-semibold text-emerald-800 dark:text-emerald-200">Position opened</p>
              <p className="mt-1 text-emerald-700 dark:text-emerald-300 break-words">{config.lastDecisionMsg}</p>
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                Direction: <span className={config.lastDecision === "long" ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>{config.lastDecision.toUpperCase()}</span>
              </p>
              {(config as { lastDecisionReason?: string | null }).lastDecisionReason && (
                <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 border-t border-emerald-200/60 dark:border-emerald-800/60 pt-2">
                  <span className="font-medium">Reason: </span>{(config as { lastDecisionReason?: string }).lastDecisionReason}
                </p>
              )}
            </div>
          )}
          {config != null && (
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-600 bg-zinc-50/80 dark:bg-zinc-900/40 p-3 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-semibold text-zinc-800 dark:text-zinc-200">Open orders, positions &amp; history</p>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab("open_orders")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "open_orders" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Open orders
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("positions")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "positions" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Positions
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("orders")}
                    className={`px-2 py-0.5 rounded text-xs ${activeTab === "orders" ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200/60 dark:bg-zinc-700/60"}`}
                  >
                    Order history
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mb-2 -mt-1">Open orders = pending (unfilled). Positions = open positions only. Order history = filled/canceled.</p>
              {activeTab === "open_orders" && (
                <div className="mt-2 max-h-64 overflow-auto">
                  {openOrdersLoading ? (
                    <p className="text-muted-foreground text-xs">Loading open orders…</p>
                  ) : openOrders.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No open (pending) orders.</p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {openOrders.map((o, i) => (
                        <div key={o.orderId || i} className="flex flex-wrap items-center gap-x-2 gap-y-0.5 p-1.5 rounded border border-zinc-200 dark:border-zinc-600">
                          <span className="font-medium">{o.instId}</span>
                          <span className={o.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{o.side.toUpperCase()}</span>
                          <span>{o.orderType}</span>
                          <span>size {o.size}</span>
                          <span>@ {o.price}</span>
                          <span className="text-muted-foreground">{o.state}</span>
                          {o.createdAt != null && <span className="text-muted-foreground">{new Date(Number(o.createdAt)).toLocaleString()}</span>}
                          <Button type="button" variant="outline" size="sm" className="ml-auto h-6 text-xs border-amber-500 text-amber-700 dark:text-amber-300" onClick={() => cancelOpenOrder(o.orderId, o.instId)} disabled={cancelingOrderId === o.orderId}>
                            {cancelingOrderId === o.orderId ? "Canceling…" : "Cancel"}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchOpenOrders} disabled={openOrdersLoading}>
                      {openOrdersLoading ? "Refreshing…" : "Refresh"}
                    </Button>
                    {openOrders.length > 0 && (
                      <Button type="button" variant="outline" size="sm" className="h-7 text-xs border-rose-500 text-rose-700 dark:text-rose-300" onClick={cancelAllOpenOrders} disabled={cancelingAll}>
                        {cancelingAll ? "Canceling…" : "Cancel all"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
              {activeTab === "positions" && (
                <>
                  {positionsLoading && !positionsData ? (
                    <p className="text-muted-foreground text-xs">Loading…</p>
                  ) : positionsData && positionsData.positions.length > 0 ? (
                    <div className="mt-2 space-y-2">
                      {positionsData.positions.map((p, i) => {
                        const instIdNorm = (p.instId ?? "").trim().toUpperCase().replace("/", "-");
                        const isPinned = instIdNorm && monitorBoardSymbols.includes(instIdNorm);
                        return (
                          <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs p-2 rounded border border-zinc-200 dark:border-zinc-600">
                            <span className="text-zinc-600 dark:text-zinc-400 font-medium">{p.instId}</span>
                            <span className={p.posSide === "long" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{p.posSide.toUpperCase()}</span>
                            <span className="text-muted-foreground">Entry: {p.entryPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                            {(p.markPrice ?? positionsData.markPrice) != null && <span className="text-muted-foreground">Mark: {(p.markPrice ?? positionsData.markPrice)!.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {(() => {
                              const tpSaved = monitorTpForRow(instIdNorm, config?.monitorTpTargets);
                              return tpSaved != null ? (
                                <span className="text-muted-foreground" title="Saved under AI Monitor → Deep check (Blofin often does not show TP here).">
                                  TP (saved): {tpSaved.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              ) : null;
                            })()}
                            {p.liqPrice != null && Number.isFinite(p.liqPrice) && <span className="text-muted-foreground">Liq: {p.liqPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                            {p.margin != null && Number.isFinite(p.margin) && <span className="text-muted-foreground">Margin: {p.margin.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT</span>}
                            {p.marginRatioBlofin != null && Number.isFinite(p.marginRatioBlofin) ? (
                              <span className="text-muted-foreground" title="Blofin margin ratio (risk metric)">Margin ratio: {p.marginRatioBlofin >= 100 ? p.marginRatioBlofin.toLocaleString(undefined, { maximumFractionDigits: 2 }) : p.marginRatioBlofin.toFixed(2)}%</span>
                            ) : p.initialMarginPct != null && Number.isFinite(p.initialMarginPct) ? (
                              <span className="text-muted-foreground" title="Initial margin as % of notional (Blofin margin ratio shown on exchange)">Initial margin: {p.initialMarginPct.toFixed(2)}%</span>
                            ) : (
                              <span className="text-muted-foreground" title="Margin ratio from exchange when available">Margin ratio: —</span>
                            )}
                            <span className="text-muted-foreground" title="Quantity of the asset (contracts). Long = positive, Short = negative.">Size: {(p.posSide === "short" ? -p.size : p.size).toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                            <span className={p.unrealizedPnl >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                              PNL: {p.unrealizedPnl >= 0 ? "+" : ""}{p.unrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                              {p.pnlPct != null && Number.isFinite(p.pnlPct) && (
                                <span className="ml-1">({p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%)</span>
                              )}
                            </span>
                            {instIdNorm && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-6 text-xs border-cyan-500 text-cyan-700 dark:text-cyan-300"
                                onClick={() => {
                                  if (isPinned) setMonitorBoardSymbols(monitorBoardSymbols.filter((x) => x !== instIdNorm));
                                  else if (!monitorBoardSymbols.includes(instIdNorm)) setMonitorBoardSymbols([...monitorBoardSymbols, instIdNorm]);
                                }}
                              >
                                {isPinned ? "Unpin" : "Pin to board"}
                              </Button>
                            )}
                            <Button type="button" variant="outline" size="sm" className="h-6 text-xs border-amber-500 text-amber-700 dark:text-amber-300" onClick={() => closePosition(p.instId)} disabled={closing}>
                              Close
                            </Button>
                          </div>
                        );
                      })}
                      <p className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-600 font-semibold">
                        Total unrealized:{" "}
                        <span className={positionsData.totalUnrealizedPnl >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                          {positionsData.totalUnrealizedPnl >= 0 ? "+" : ""}{positionsData.totalUnrealizedPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
                        </span>
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => fetchPositions()} disabled={positionsLoading}>
                          {positionsLoading ? "Refreshing…" : "Refresh PNL"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-cyan-500 text-cyan-700 dark:text-cyan-300"
                          disabled={downloadingPnlImage}
                          onClick={async () => {
                            if (!positionsData?.positions?.length) return;
                            setDownloadingPnlImage(true);
                            try {
                              const items = positionsData.positions.map((p) => ({
                                name: p.instId ?? "",
                                side: p.posSide ?? "",
                                pnlDisplay: p.pnlPct != null ? `${p.pnlPct >= 0 ? "+" : ""}${p.pnlPct.toFixed(2)}%` : "—",
                              }));
                              const blob = await drawPnlToJpegBlob({
                                title: "NovaStaris AI — PNL Report",
                                subtitle: "Open positions",
                                items,
                                totalLabel: "Total unrealized",
                                totalValue: positionsData.totalUnrealizedPnl,
                              });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement("a");
                              a.href = url;
                              a.download = `NovaStaris_PNL_Open_${new Date().toISOString().slice(0, 10)}.jpg`;
                              a.click();
                              URL.revokeObjectURL(url);
                            } finally {
                              setDownloadingPnlImage(false);
                            }
                          }}
                        >
                          {downloadingPnlImage ? "Creating…" : "Share PNL (JPEG)"}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs border-zinc-500 text-zinc-700 dark:text-zinc-300"
                          onClick={() => {
                            const total = positionsData.totalUnrealizedPnl;
                            const sign = total >= 0 ? "+" : "";
                            const text = `My NovaStaris PNL this week ${sign}${total.toFixed(2)} USDT 🚀\n\nTrack & trade with AI → novastaris.ai`;
                            window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
                          }}
                        >
                          Share to X / CT
                        </Button>
                      </div>
                    </div>
                  ) : positionsData && positionsData.positions.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No open positions on exchange.</p>
                  ) : null}
                </>
              )}
              {activeTab === "orders" && (
                <div className="mt-2 max-h-64 overflow-auto">
                  {orderHistoryLoading ? (
                    <p className="text-muted-foreground text-xs">Loading order history…</p>
                  ) : orderHistory.length === 0 ? (
                    <p className="text-muted-foreground text-xs">No orders in history.</p>
                  ) : (
                    <div className="space-y-1 text-xs">
                      {orderHistory.map((o, i) => (
                        <div key={o.orderId || i} className="flex flex-wrap gap-x-2 gap-y-0.5 p-1.5 rounded border border-zinc-200 dark:border-zinc-600">
                          <span className="font-medium">{o.instId}</span>
                          <span className={o.side === "buy" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{o.side.toUpperCase()}</span>
                          <span>{o.orderType}</span>
                          <span>size {o.size}</span>
                          {o.fillPrice != null && <span>@ {o.fillPrice}</span>}
                          {o.pnl != null && o.pnl !== "" && (
                            <span className={Number(o.pnl) >= 0 ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-rose-600 dark:text-rose-400 font-medium"}>
                              PNL: {Number(o.pnl) >= 0 ? "+" : ""}{Number(o.pnl).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} USDT
                            </span>
                          )}
                          <span className="text-muted-foreground">{o.state}</span>
                          {o.createdAt != null && <span className="text-muted-foreground">{new Date(Number(o.createdAt)).toLocaleString()}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchOrderHistory} disabled={orderHistoryLoading}>
                      {orderHistoryLoading ? "Refreshing…" : "Refresh"}
                    </Button>
                    {orderHistory.some((o) => o.pnl != null && o.pnl !== "") && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-cyan-500 text-cyan-700 dark:text-cyan-300"
                        disabled={downloadingClosedPnlImage}
                        onClick={async () => {
                          const withPnl = orderHistory.filter((o) => o.pnl != null && o.pnl !== "");
                          if (withPnl.length === 0) return;
                          setDownloadingClosedPnlImage(true);
                          try {
                            const totalClosed = withPnl.reduce((sum, o) => sum + Number(o.pnl ?? 0), 0);
                            const items = withPnl.map((o) => {
                              const pnlNum = Number(o.pnl ?? 0);
                              const sign = pnlNum >= 0 ? "+" : "";
                              return { name: o.instId ?? "", side: o.side ?? "", pnlDisplay: `$${sign}${pnlNum.toFixed(2)}` };
                            });
                            const blob = await drawPnlToJpegBlob({
                              title: "NovaStaris AI — Closed PNL",
                              subtitle: "Closed positions (order history)",
                              items,
                              totalLabel: "Total realized",
                              totalValue: totalClosed,
                            });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `NovaStaris_PNL_Closed_${new Date().toISOString().slice(0, 10)}.jpg`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } finally {
                            setDownloadingClosedPnlImage(false);
                          }
                        }}
                      >
                        {downloadingClosedPnlImage ? "Creating…" : "Download closed PNL (JPEG)"}
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
          {(config?.lastDecision || config?.lastDecisionMsg) && (config?.lastDecision === "no_trade" || !config?.lastDecision) && (
            <div className="rounded-md border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/40 p-2 text-xs">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">Last decision: </span>
              <span className="text-muted-foreground">No trade</span>
              {config.lastDecisionMsg && (
                <p className="mt-1 text-muted-foreground break-words">{config.lastDecisionMsg}</p>
              )}
            </div>
          )}
          {config?.lastError && (
            <>
              <p className="text-xs text-rose-600 dark:text-rose-400">Last error: {config.lastError}</p>
              {config.lastError.toLowerCase().includes("brokerid") && (
                <p className="text-xs text-muted-foreground mt-1">
                  Set <code className="bg-zinc-200 dark:bg-zinc-700 px-1 rounded">BLOFIN_BROKER_ID</code> in your server env (e.g. Vercel) to your Blofin broker ID, then redeploy.
                </p>
              )}
            </>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => toggleBot(true)}
              disabled={toggling || config?.enabled}
              className="bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-700"
            >
              {toggling ? "Updating…" : "Start bot"}
            </Button>
            <Button
              onClick={() => toggleBot(false)}
              disabled={toggling || !config?.enabled}
              variant="destructive"
            >
              Stop bot
            </Button>
            <Button
              onClick={runNow}
              disabled={running || !config?.enabled}
              variant="outline"
              className="border-cyan-500 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/50"
            >
              {running ? "Running…" : "Run now"}
            </Button>
            <Button
              onClick={() => closePosition()}
              disabled={closing}
              variant="outline"
              className="border-amber-500 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/50"
            >
              {closing ? "Closing…" : "Close position"}
            </Button>
            {positionsData && positionsData.positions.length > 1 && (
              <Button
                onClick={() => closePosition(undefined, true)}
                disabled={closing}
                variant="outline"
                className="border-rose-500 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              >
                Close all
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Close: uses Blofin close-position API for the configured symbol (or choose &quot;Close all&quot; when multiple positions). You will be asked to confirm.
          </p>
          <p className="text-xs text-muted-foreground">
            <strong>Run now</strong> runs one cycle. If you already have a position, the bot skips opening (no second position). To add size at a specific price, use <strong>Place limit order</strong> above—no need to stop the bot.
          </p>
        </CardContent>
      </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
