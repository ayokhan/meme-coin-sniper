"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FOREX_BROKER_LABELS, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import { drawClosedTradeShareCard, drawOpenPositionShareCard } from "@/lib/closed-pnl-share-image";
import PnlShareButtons from "@/components/PnlShareButtons";

type AccountInfo = {
  balance: number;
  equity: number;
  margin: number;
  freeMargin: number;
  leverage: number;
  currency: string;
};

type PositionRow = {
  id: string;
  symbol: string;
  side: "long" | "short";
  volume: number;
  openPrice: number;
  currentPrice: number | null;
  profit: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
};

type OrderRow = {
  id: string;
  symbol: string;
  side: "buy" | "sell" | "—";
  kind: string;
  type: string;
  state: string | null;
  volume: number | null;
  openPrice: number | null;
  currentPrice: number | null;
  stopLoss: number | null;
  takeProfit: number | null;
  time: string | null;
};

type ClosedRow = {
  id: string;
  symbol: string;
  side: "long" | "short";
  volume: number;
  openPrice: number;
  closePrice: number;
  profit: number;
  openedAt: string | null;
  closedAt: string;
};

type Props = {
  broker: ForexBrokerId;
  /** When true, parent already knows MetaAPI id exists. */
  connected: boolean;
  demoMode?: boolean;
  className?: string;
};

const PERIODS = [
  { id: "1d", label: "1D" },
  { id: "7d", label: "7D" },
  { id: "30d", label: "30D" },
  { id: "90d", label: "90D" },
] as const;

function fmt(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(undefined, { maximumFractionDigits: digits });
}

function roiFromProfit(profit: number | null, marginHint: number | null): number {
  if (profit == null || !Number.isFinite(profit)) return 0;
  if (marginHint && marginHint > 0) return (profit / marginHint) * 100;
  return 0;
}

export default function ForexBrokerAccountPanel({ broker, connected, demoMode, className = "" }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedRow[]>([]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("7d");
  const [tab, setTab] = useState<"positions" | "orders" | "closed">("positions");
  const [metaHint, setMetaHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!connected) return;
    setLoading(true);
    setError(null);
    setMetaHint(null);
    try {
      const res = await fetch(
        `/api/user/forex-broker-config/account?broker=${broker}&period=${period}&wait=1`,
        { credentials: "include", cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!data.success) {
        setError(data.error ?? "Failed to load account.");
        setAccount(null);
        setPositions([]);
        setOrders([]);
        setClosedTrades([]);
        return;
      }
      setAccount(data.account ?? null);
      setPositions(Array.isArray(data.positions) ? data.positions : []);
      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setClosedTrades(Array.isArray(data.closedTrades) ? data.closedTrades : []);
      if (data.accountError) setError(String(data.accountError));
      if (data.metaApi && !data.metaApi.ready && !data.account) {
        setMetaHint("Broker link is still starting. Balance appears once the connection finishes — tap Refresh.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load account.");
    } finally {
      setLoading(false);
    }
  }, [broker, connected, period]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!connected) return null;

  const modeLabel = demoMode ? "Demo" : "Live";
  const currency = account?.currency || "USD";

  return (
    <Card className={`border-cyan-500/20 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            {FOREX_BROKER_LABELS[broker]} account
          </CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? "Refreshing…" : "Refresh"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Live account view — balance, leverage (from your MT4/MT5 account), open positions, pending orders, and closed
          records. Share PNL cards work the same way as on Blofin.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        {metaHint && !account && <p className="text-xs text-amber-700 dark:text-amber-300">{metaHint}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Balance</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.balance)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Equity</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.equity)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Free margin</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.freeMargin)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Leverage</p>
            <p className="font-mono font-semibold text-sm">
              {account?.leverage ? `1:${account.leverage}` : loading ? "…" : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              Set in MT5 (or your broker portal) — NovaStaris cannot change it
            </p>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 px-3 py-2 text-[11px] text-muted-foreground">
          <strong className="text-foreground">Leverage:</strong> change it in MetaTrader (account settings / broker
          website), then tap Refresh here. We only display what your MT account reports.
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 w-fit">
            {(
              [
                ["positions", `Open (${positions.length})`],
                ["orders", `Pending (${orders.length})`],
                ["closed", `Closed (${closedTrades.length})`],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  tab === id
                    ? "bg-emerald-500 text-white"
                    : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200/80 dark:hover:bg-zinc-700/80"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {tab === "closed" && (
            <div className="flex gap-1">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPeriod(p.id)}
                  className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                    period === p.id
                      ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                      : "bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {tab === "positions" && (
          <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open positions.</p>
            ) : (
              positions.map((p) => {
                const profit = p.profit ?? 0;
                const marginHint =
                  account?.margin && positions.length > 0 ? account.margin / positions.length : null;
                const roi = roiFromProfit(p.profit, marginHint);
                return (
                  <div
                    key={p.id}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-950/40 p-3 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        <span className="font-mono">{p.symbol}</span>{" "}
                        <span
                          className={
                            p.side === "long"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {p.side.toUpperCase()}
                        </span>{" "}
                        <span className="text-xs text-muted-foreground font-normal">{p.volume} lots</span>
                      </p>
                      <p
                        className={`font-mono text-sm font-semibold ${
                          profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {profit >= 0 ? "+" : ""}
                        {fmt(profit)} {currency}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Entry {fmt(p.openPrice, 5)} → Mark {fmt(p.currentPrice, 5)}
                      {p.stopLoss != null ? ` · SL ${fmt(p.stopLoss, 5)}` : ""}
                      {p.takeProfit != null ? ` · TP ${fmt(p.takeProfit, 5)}` : ""}
                    </p>
                    <PnlShareButtons
                      compact
                      kind="open"
                      symbol={p.symbol}
                      roiPct={roi}
                      pnlUsdt={profit}
                      filename={`novastaris-${p.symbol}-${p.side}-open.jpg`}
                      getBlob={async () =>
                        drawOpenPositionShareCard({
                          displaySymbol: p.symbol,
                          direction: p.side,
                          entryPrice: p.openPrice,
                          markPrice: p.currentPrice ?? p.openPrice,
                          roiPct: roi,
                          unrealizedPnlUsdt: profit,
                          modeLabel: modeLabel as "Live" | "Demo",
                          leverage: account?.leverage ?? null,
                        })
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        )}

        {tab === "orders" && (
          <div className="space-y-2">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No pending (limit/stop) orders.</p>
            ) : (
              orders.map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-950/40 p-3 text-sm"
                >
                  <p className="font-semibold">
                    <span className="font-mono">{o.symbol}</span>{" "}
                    <span className="uppercase text-xs text-muted-foreground">{o.kind}</span>{" "}
                    <span className="uppercase">{o.side}</span>
                  </p>
                  <p className="text-xs text-muted-foreground font-mono mt-1">
                    Vol {fmt(o.volume, 2)} · Price {fmt(o.openPrice, 5)}
                    {o.state ? ` · ${o.state}` : ""}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "closed" && (
          <div className="space-y-2">
            {closedTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">No closed trades in this period.</p>
            ) : (
              closedTrades.map((t) => {
                const roi =
                  t.openPrice > 0
                    ? ((t.closePrice - t.openPrice) / t.openPrice) * 100 * (t.side === "short" ? -1 : 1)
                    : 0;
                return (
                  <div
                    key={`${t.id}-${t.closedAt}`}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-950/40 p-3 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        <span className="font-mono">{t.symbol}</span>{" "}
                        <span
                          className={
                            t.side === "long"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {t.side.toUpperCase()}
                        </span>
                      </p>
                      <p
                        className={`font-mono text-sm font-semibold ${
                          t.profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                        }`}
                      >
                        {t.profit >= 0 ? "+" : ""}
                        {fmt(t.profit)} {currency}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {fmt(t.openPrice, 5)} → {fmt(t.closePrice, 5)} · {t.volume} lots ·{" "}
                      {new Date(t.closedAt).toLocaleString()}
                    </p>
                    <PnlShareButtons
                      compact
                      kind="closed"
                      symbol={t.symbol}
                      roiPct={roi}
                      pnlUsdt={t.profit}
                      filename={`novastaris-${t.symbol}-${t.side}-closed.jpg`}
                      getBlob={async () =>
                        drawClosedTradeShareCard({
                          displaySymbol: t.symbol,
                          direction: t.side,
                          openPrice: t.openPrice,
                          closePrice: t.closePrice,
                          roiPct: roi,
                          realizedPnlUsdt: t.profit,
                          closedAt: t.closedAt,
                          modeLabel: modeLabel as "Live" | "Demo",
                          leverage: account?.leverage ?? null,
                        })
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
