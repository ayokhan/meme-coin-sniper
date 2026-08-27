"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fomoTokenUrl } from "@/lib/meme-token-links";

type AlertRow = {
  id: string;
  type: string;
  walletAddress: string;
  walletLabel?: string | null;
  mint: string;
  symbol?: string | null;
  buyUsd?: number | null;
  buyAt?: string | null;
  soldAt?: string | null;
  heldMinutes?: number | null;
  createdAt: string;
};

type WalletRow = {
  id: string;
  address: string;
  label?: string | null;
  source?: string | null;
};

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  buy_2k: { label: "Buy ≥ $2k", className: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/25" },
  buy_10k: { label: "Buy ≥ $10k", className: "bg-amber-500/15 text-amber-800 dark:text-amber-200 border-amber-500/25" },
  held_over_5m: { label: "Held > 5 min", className: "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25" },
  still_holding: { label: "Still holding", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25" },
  sold: { label: "Sold", className: "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/25" },
};

function fmtLocal(iso?: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortAddr(a: string) {
  return a.length > 10 ? `${a.slice(0, 4)}…${a.slice(-4)}` : a;
}

export default function SmartMoneyAlertsPanel({ isOwner }: { isOwner?: boolean }) {
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{ used: number; limit: number | null } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet-tracker/smart-money", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Failed to load");
        return;
      }
      setAlerts(data.alerts ?? []);
      setWallets(data.wallets ?? []);
      setUsage(data.usage ?? null);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const scan = async () => {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch("/api/wallet-tracker/smart-money", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Scan failed");
        return;
      }
      await load();
    } catch {
      setError("Network error");
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Smart Money Alerts</h3>
          <p className="text-sm text-muted-foreground mt-0.5 max-w-xl">
            Track admin-curated wallets (FOMO / leaderboard / manual). Alerts for buys ≥ $2k / ≥ $10k, held &gt; 5 min,
            still holding, and sold — times shown in your local timezone. In-app only.
          </p>
          {usage && usage.limit != null && (
            <p className="text-xs text-muted-foreground mt-1">
              Refresh usage today: {usage.used}/{usage.limit} (resets midnight UTC)
            </p>
          )}
          {isOwner && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
              Owner: unlimited refresh. Manage wallets in Admin → Smart Money.
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => void scan()} disabled={scanning || loading}>
          {scanning ? "Scanning…" : "Refresh alerts"}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/80 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Watched wallets ({wallets.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {wallets.length === 0 ? (
            <p className="text-xs text-muted-foreground">No wallets yet. Admin can add FOMO addresses or import top 20 from the meme leaderboard.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {wallets.map((w) => (
                <li
                  key={w.id}
                  className="text-xs font-mono px-2 py-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900"
                  title={w.address}
                >
                  {w.label || shortAddr(w.address)}
                  {w.source === "fomo" && <span className="ml-1 text-[10px] text-cyan-600">FOMO</span>}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alert feed</p>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No alerts yet. Hit Refresh alerts after wallets are added.</p>
        ) : (
          alerts.map((a) => {
            const badge = TYPE_LABEL[a.type] ?? { label: a.type, className: "bg-zinc-100 text-zinc-700 border-zinc-200" };
            const analyzeHref = `/?tab=wallets&wallet=meme-leaderboard&analyze=${encodeURIComponent(a.walletAddress)}`;
            return (
              <div
                key={a.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/40 px-3 py-2.5 space-y-1.5"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${badge.className}`}>
                    {badge.label}
                  </span>
                  <span className="text-sm font-medium">{a.walletLabel || shortAddr(a.walletAddress)}</span>
                  {a.buyUsd != null && (
                    <span className="text-xs font-mono text-muted-foreground">${a.buyUsd.toFixed(0)}</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                  <span className="font-mono">{a.symbol || shortAddr(a.mint)}</span>
                  <span>Bought: {fmtLocal(a.buyAt)}</span>
                  {a.soldAt && <span>Sold: {fmtLocal(a.soldAt)}</span>}
                  {a.heldMinutes != null && <span>Held: {a.heldMinutes.toFixed(0)}m</span>}
                  <span>Alert: {fmtLocal(a.createdAt)}</span>
                </div>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  <a
                    href={fomoTokenUrl(a.mint)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                  >
                    FOMO
                  </a>
                  <a
                    href={`https://dexscreener.com/solana/${a.mint}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-cyan-100 dark:hover:bg-cyan-900/40"
                  >
                    Dex
                  </a>
                  <a
                    href={analyzeHref}
                    className="text-[10px] px-2 py-1 rounded bg-amber-500/15 text-amber-800 dark:text-amber-200 border border-amber-500/20 hover:bg-amber-500/25"
                  >
                    Analyze wallet
                  </a>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
