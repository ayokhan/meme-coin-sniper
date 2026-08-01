"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FOREX_BROKER_LABELS, type ForexBrokerId } from "@/lib/forex-broker-user-config";
import { drawClosedTradeShareCard, drawOpenPositionShareCard } from "@/lib/closed-pnl-share-image";
import { estimateForexMarginFromLots } from "@/lib/forex-lot-size";
import { formatHeldForDuration } from "@/lib/closed-trades";
import PnlShareButtons from "@/components/PnlShareButtons";
import { useI18n } from "@/components/I18nProvider";
import { DEFAULT_PNL_SHARE_FLAGS, type PnlShareFlags } from "@/lib/pnl-share-flags";

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

function marginForTrade(input: {
  symbol: string;
  openPrice: number;
  volume: number;
  leverage: number | null | undefined;
}): number | null {
  const lev = input.leverage;
  if (lev == null || !Number.isFinite(lev) || lev <= 0) return null;
  if (!Number.isFinite(input.openPrice) || input.openPrice <= 0) return null;
  if (!Number.isFinite(input.volume) || input.volume <= 0) return null;
  const m = estimateForexMarginFromLots({
    symbol: input.symbol,
    entryPrice: input.openPrice,
    lotSize: input.volume,
    leverage: lev,
  });
  return m > 0 ? m : null;
}

export default function ForexBrokerAccountPanel({ broker, connected, demoMode, className = "" }: Props) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [positions, setPositions] = useState<PositionRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [closedTrades, setClosedTrades] = useState<ClosedRow[]>([]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["id"]>("7d");
  const [tab, setTab] = useState<"positions" | "orders" | "closed">("positions");
  const [metaHint, setMetaHint] = useState<string | null>(null);
  /** Same share-card toggles as NovaScalper / Trading Bot. */
  const [shareShowRealizedUsdt, setShareShowRealizedUsdt] = useState(true);
  const [shareShowAmountInvested, setShareShowAmountInvested] = useState(false);
  const [shareShowHoldDuration, setShareShowHoldDuration] = useState(false);
  const [shareShowLeverage, setShareShowLeverage] = useState(true);
  const [shareCustomMessage, setShareCustomMessage] = useState("");
  const [pnlShareFlags, setPnlShareFlags] = useState<PnlShareFlags>(DEFAULT_PNL_SHARE_FLAGS);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.pnlShare) return;
        setPnlShareFlags({
          showUsd: data.pnlShare.showUsd !== false,
          showInvested: data.pnlShare.showInvested !== false,
          showHeldFor: data.pnlShare.showHeldFor !== false,
          showLeverage: data.pnlShare.showLeverage !== false,
          cardMessage: data.pnlShare.cardMessage === true,
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const effShowUsd = pnlShareFlags.showUsd && shareShowRealizedUsdt;
  const effShowInvested = pnlShareFlags.showInvested && shareShowAmountInvested;
  const effShowHeld = pnlShareFlags.showHeldFor && shareShowHoldDuration;
  const effShowLev = pnlShareFlags.showLeverage && shareShowLeverage;
  const effCardMessage = pnlShareFlags.cardMessage ? shareCustomMessage.trim() || null : null;

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
        setError(data.error ?? t("forex.accountLoadFailed"));
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
        setMetaHint(t("forex.metaStarting"));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("forex.accountLoadFailed"));
    } finally {
      setLoading(false);
    }
  }, [broker, connected, period, t]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!connected) return null;

  const modeLabel = demoMode ? t("common.demo") : t("common.live");
  const currency = account?.currency || "USD";

  return (
    <Card className={`border-cyan-500/20 ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold">
            {t("forex.accountTitle", { broker: FOREX_BROKER_LABELS[broker] })}
          </CardTitle>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? t("common.refreshing") : t("nav.refresh")}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("forex.accountBlurb")}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
        {metaHint && !account && <p className="text-xs text-amber-700 dark:text-amber-300">{metaHint}</p>}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.balance")}</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.balance)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.equity")}</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.equity)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.freeMargin")}</p>
            <p className="font-mono font-semibold text-sm">
              {account ? `${fmt(account.freeMargin)} ${currency}` : loading ? "…" : "—"}
            </p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("common.leverage")}</p>
            <p className="font-mono font-semibold text-sm">
              {account?.leverage ? `1:${account.leverage}` : loading ? "…" : "—"}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
              {t("forex.leverageReadonly")}
            </p>
          </div>
        </div>

        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 px-3 py-2 text-[11px] text-muted-foreground">
          {t("forex.leverageNote")}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 p-1 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 w-fit">
            {(
              [
                ["positions", t("forex.openCount", { count: positions.length })],
                ["orders", t("forex.pendingCount", { count: orders.length })],
                ["closed", t("forex.closedCount", { count: closedTrades.length })],
              ] as [typeof tab, string][]
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

        {(tab === "positions" || tab === "closed") && (
          <div className="space-y-2 rounded-md border border-cyan-500/30 bg-zinc-50/80 dark:bg-zinc-900/40 px-2.5 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
              Share card options
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {pnlShareFlags.showUsd && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareShowRealizedUsdt}
                    onChange={(e) => setShareShowRealizedUsdt(e.target.checked)}
                    className="rounded"
                  />
                  Show {currency} on card (ROI % always shown)
                </label>
              )}
              {pnlShareFlags.showInvested && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareShowAmountInvested}
                    onChange={(e) => setShareShowAmountInvested(e.target.checked)}
                    className="rounded"
                  />
                  Show Invested
                </label>
              )}
              {pnlShareFlags.showHeldFor && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareShowHoldDuration}
                    onChange={(e) => setShareShowHoldDuration(e.target.checked)}
                    className="rounded"
                  />
                  Show Held for
                </label>
              )}
              {pnlShareFlags.showLeverage && (
                <label className="text-[11px] text-muted-foreground flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={shareShowLeverage}
                    onChange={(e) => setShareShowLeverage(e.target.checked)}
                    className="rounded"
                  />
                  Show leverage
                </label>
              )}
            </div>
            {pnlShareFlags.cardMessage && (
              <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-zinc-700 dark:text-zinc-200">Card message (optional)</span>
                <input
                  type="text"
                  value={shareCustomMessage}
                  onChange={(e) => setShareCustomMessage(e.target.value.slice(0, 80))}
                  placeholder='e.g. ZaZa Smashed it'
                  maxLength={80}
                  className="w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2.5 py-2 text-sm text-zinc-800 dark:text-zinc-100"
                />
              </label>
            )}
          </div>
        )}

        {tab === "positions" && (
          <div className="space-y-2">
            {positions.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("forex.noPositions")}</p>
            ) : (
              positions.map((p) => {
                const profit = p.profit ?? 0;
                const invested =
                  marginForTrade({
                    symbol: p.symbol,
                    openPrice: p.openPrice,
                    volume: p.volume,
                    leverage: account?.leverage,
                  }) ??
                  (account?.margin && positions.length > 0 ? account.margin / positions.length : null);
                const roi = roiFromProfit(p.profit, invested);
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
                        <span className="text-xs text-muted-foreground font-normal">
                          {p.volume} {t("common.lots")}
                        </span>
                        {effShowLev && account?.leverage ? (
                          <span className="text-xs text-muted-foreground font-normal"> · {account.leverage}x</span>
                        ) : null}
                      </p>
                      <div className="text-right">
                        <p
                          className={`font-mono text-sm font-semibold ${
                            profit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {roi >= 0 ? "+" : ""}
                          {roi.toFixed(2)}%
                        </p>
                        {effShowUsd && (
                          <p
                            className={`font-mono text-xs ${
                              profit >= 0 ? "text-emerald-600/90 dark:text-emerald-400/90" : "text-rose-600/90 dark:text-rose-400/90"
                            }`}
                          >
                            {profit >= 0 ? "+" : ""}
                            {fmt(profit)} {currency}
                          </p>
                        )}
                      </div>
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
                      showUsdt={effShowUsd}
                      showAmountInvested={effShowInvested}
                      investedUsdt={invested}
                      filename={`novastaris-${p.symbol}-${p.side}-open.jpg`}
                      getBlob={async () =>
                        drawOpenPositionShareCard(
                          {
                            displaySymbol: p.symbol,
                            direction: p.side,
                            entryPrice: p.openPrice,
                            markPrice: p.currentPrice ?? p.openPrice,
                            roiPct: roi,
                            unrealizedPnlUsdt: profit,
                            modeLabel: modeLabel as "Live" | "Demo",
                            leverage: account?.leverage ?? null,
                            investedUsdt: invested,
                          },
                          {
                            showRealizedUsdt: effShowUsd,
                            showAmountInvested: effShowInvested,
                            showLeverage: effShowLev,
                            customMessage: effCardMessage,
                          }
                        )
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
              <p className="text-sm text-muted-foreground">{t("forex.noOrders")}</p>
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
              <p className="text-sm text-muted-foreground">{t("forex.noClosed")}</p>
            ) : (
              closedTrades.map((trade) => {
                const invested = marginForTrade({
                  symbol: trade.symbol,
                  openPrice: trade.openPrice,
                  volume: trade.volume,
                  leverage: account?.leverage,
                });
                const roi = roiFromProfit(trade.profit, invested);
                const heldFor = formatHeldForDuration(trade.openedAt, trade.closedAt);
                return (
                  <div
                    key={`${trade.id}-${trade.closedAt}`}
                    className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/60 dark:bg-zinc-950/40 p-3 space-y-1"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        <span className="font-mono">{trade.symbol}</span>{" "}
                        <span
                          className={
                            trade.side === "long"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }
                        >
                          {trade.side.toUpperCase()}
                        </span>
                        {effShowLev && account?.leverage ? (
                          <span className="text-xs text-muted-foreground font-normal"> · {account.leverage}x</span>
                        ) : null}
                      </p>
                      <div className="text-right">
                        <p
                          className={`font-mono text-sm font-semibold ${
                            trade.profit >= 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-rose-600 dark:text-rose-400"
                          }`}
                        >
                          {roi >= 0 ? "+" : ""}
                          {roi.toFixed(2)}%
                        </p>
                        {effShowUsd && (
                          <p
                            className={`font-mono text-xs ${
                              trade.profit >= 0
                                ? "text-emerald-600/90 dark:text-emerald-400/90"
                                : "text-rose-600/90 dark:text-rose-400/90"
                            }`}
                          >
                            {trade.profit >= 0 ? "+" : ""}
                            {fmt(trade.profit)} {currency}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      {fmt(trade.openPrice, 5)} → {fmt(trade.closePrice, 5)} · {trade.volume} {t("common.lots")} ·{" "}
                      {new Date(trade.closedAt).toLocaleString()}
                      {effShowHeld && heldFor ? ` · Held ${heldFor}` : ""}
                    </p>
                    <PnlShareButtons
                      compact
                      kind="closed"
                      symbol={trade.symbol}
                      roiPct={roi}
                      pnlUsdt={trade.profit}
                      showUsdt={effShowUsd}
                      showAmountInvested={effShowInvested}
                      investedUsdt={invested}
                      heldFor={heldFor}
                      showHoldDuration={effShowHeld}
                      filename={`novastaris-${trade.symbol}-${trade.side}-closed.jpg`}
                      getBlob={async () =>
                        drawClosedTradeShareCard(
                          {
                            displaySymbol: trade.symbol,
                            direction: trade.side,
                            openPrice: trade.openPrice,
                            closePrice: trade.closePrice,
                            roiPct: roi,
                            realizedPnlUsdt: trade.profit,
                            closedAt: trade.closedAt,
                            openedAt: trade.openedAt,
                            modeLabel: modeLabel as "Live" | "Demo",
                            leverage: account?.leverage ?? null,
                            investedUsdt: invested,
                            heldFor,
                          },
                          {
                            showRealizedUsdt: effShowUsd,
                            showAmountInvested: effShowInvested,
                            showHoldDuration: effShowHeld,
                            showLeverage: effShowLev,
                            customMessage: effCardMessage,
                          }
                        )
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
