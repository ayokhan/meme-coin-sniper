"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { CARD_PAYMENT_FEE_USD, NOVA_PRO_PLANS } from "@/lib/subscription";

type Config = {
  enabled: boolean;
  sharedDailyLimit: number;
  pulseDailyLimit: number;
  refundMaxRuns: number;
  foundingEnabled: boolean;
  foundingSeats: number;
  updatedAt: string | null;
};

type Stats = { activeSubscribers: number; activePaid: number; activeComplimentary: number; foundingUsed: number };

type Row = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  amountUsd: number;
  founding: boolean;
  complimentary: boolean;
  method: string;
  autoRenew: boolean;
  expiresAt: string;
  createdAt: string;
  active: boolean;
};

const inputClass =
  "text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600";

export default function AdminNovaProPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [config, setConfig] = useState<Config | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nova-pro", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setConfig(data.config);
      setStats(data.stats);
      setRows(data.recent ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner, load]);

  const save = async (patch?: Partial<Config>) => {
    if (!config) return;
    const next = { ...config, ...patch };
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/nova-pro", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setConfig(data.config);
      setNotice(data.config.enabled ? "Saved. Nova Pro is ON — visible on pricing pages." : "Saved. Nova Pro is OFF — hidden, new purchases blocked.");
      window.setTimeout(() => setNotice(""), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in required."}
        </CardContent>
      </Card>
    );
  }
  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="Nova Pro"
        description="Cheaper tier: every VIP desk with daily caps. No bots (NovaScalper, Forex Bots, GMGN, Prop Firm, Nova Ultimate, Polymarket) and no Coach Calls."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-3">
            <span>Availability</span>
            {config && (
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded ${
                  config.enabled
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {config.enabled ? "ON" : "OFF"}
              </span>
            )}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            OFF hides Nova Pro from the subscribe page and blocks new purchases. Existing Pro subscribers keep access until their
            period ends (no paid access is ever revoked).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={saving || config.enabled}
                  onClick={() => void save({ enabled: true })}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  Turn Nova Pro ON
                </Button>
                <Button type="button" variant="outline" disabled={saving || !config.enabled} onClick={() => void save({ enabled: false })}>
                  Turn Nova Pro OFF
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Prices (code):{" "}
                {NOVA_PRO_PLANS.map((p) => `${p.label}: $${p.priceUsd} USDC / $${p.priceUsd + CARD_PAYMENT_FEE_USD} card`).join(" · ")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {config && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily limits, refunds & founding seats</CardTitle>
            <p className="text-xs text-muted-foreground">
              Limits reset at 00:00 UTC. The AI pool is shared across every AI desk (AI Agent, NovaForecast, Nova Forex, CT, Wallet
              Tracker, Nova+, Radar, NovaQ Fib, Pattern Detector, Nova Extra, Meme Intelligence, Futures Narratives, Nova Eagle).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-3 gap-3">
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                AI runs per day (shared)
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.sharedDailyLimit}
                  onChange={(e) => setConfig({ ...config, sharedDailyLimit: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Nova Pulse runs per day
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.pulseDailyLimit}
                  onChange={(e) => setConfig({ ...config, pulseDailyLimit: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Max runs for a 24h refund
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={config.refundMaxRuns}
                  onChange={(e) => setConfig({ ...config, refundMaxRuns: Number(e.target.value) })}
                  className={inputClass}
                />
              </label>
            </div>
            <div className="rounded-md border border-violet-200 dark:border-violet-800/60 p-3 space-y-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={config.foundingEnabled}
                  onChange={(e) => setConfig({ ...config, foundingEnabled: e.target.checked })}
                />
                Limited edition: <strong>Founding Pro</strong> seats for the first paid subscribers
              </label>
              <div className="flex flex-wrap items-end gap-3">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Founding seats
                  <input
                    type="number"
                    min={0}
                    value={config.foundingSeats}
                    onChange={(e) => setConfig({ ...config, foundingSeats: Number(e.target.value) })}
                    className={inputClass}
                  />
                </label>
                <p className="text-xs text-muted-foreground pb-2">
                  Used: <strong>{stats?.foundingUsed ?? 0}</strong> / {config.foundingSeats}. Founders get a badge and keep launch
                  prices while they keep renewing (7-day grace). Admin grants can also use a seat.
                </p>
              </div>
            </div>
            <Button type="button" disabled={saving} onClick={() => void save()}>
              {saving ? "Saving…" : "Save limits & seats"}
            </Button>
          </CardContent>
        </Card>
      )}

      {config && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Launch kit</CardTitle>
            <p className="text-xs text-muted-foreground">
              Turn Nova Pro ON first. Then publish the in-app announcement, send the launch email, and share the postcards.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={saving || !config.enabled}
                onClick={async () => {
                  setError("");
                  try {
                    const res = await fetch("/api/admin/site-announcement-banner", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ preset: "nova-pro-launch" }),
                    });
                    const data = await res.json();
                    if (!data.success) throw new Error(data.error ?? "Publish failed");
                    setNotice("In-app announcement published to all signed-in users.");
                    window.setTimeout(() => setNotice(""), 5000);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Publish failed");
                  }
                }}
              >
                Publish in-app announcement
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/emails?preset=nova-pro-launch">Open launch email</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/admin/emails#nova-pro-postcard">Postcards &amp; captions</Link>
              </Button>
            </div>
            <div className="grid sm:grid-cols-[2fr_1fr] gap-3 items-start">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing/novastaris-nova-pro-postcard-premium.png"
                alt="Nova Pro square postcard"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/marketing/novastaris-nova-pro-story-premium.png"
                alt="Nova Pro story postcard"
                className="w-full rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Subscribers</CardTitle>
            <p className="text-xs text-muted-foreground">
              Active: <strong>{stats.activeSubscribers}</strong> (paid {stats.activePaid}, complimentary {stats.activeComplimentary}).
              Grant Pro (1 day, 3-day trial, 7 days, 1 month…) from{" "}
              <Link href="/admin/customers" className="underline">
                Customers
              </Link>{" "}
              → Manage.
            </p>
          </CardHeader>
          <CardContent>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Nova Pro subscriptions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                      <th className="py-1.5 pr-3">Customer</th>
                      <th className="py-1.5 pr-3">Plan</th>
                      <th className="py-1.5 pr-3">Amount</th>
                      <th className="py-1.5 pr-3">Method</th>
                      <th className="py-1.5 pr-3">Started</th>
                      <th className="py-1.5 pr-3">Expires</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-1.5 pr-3">
                          {r.email ?? r.name ?? "—"}
                          {r.founding && <span className="ml-1 text-violet-600 dark:text-violet-300">★ Founding</span>}
                        </td>
                        <td className="py-1.5 pr-3">{r.plan}</td>
                        <td className="py-1.5 pr-3">{r.complimentary ? "Comp" : `$${r.amountUsd}`}</td>
                        <td className="py-1.5 pr-3">
                          {r.method}
                          {r.autoRenew ? " · auto-renew" : ""}
                        </td>
                        <td className="py-1.5 pr-3">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className={`py-1.5 pr-3 ${r.active ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500"}`}>
                          {new Date(r.expiresAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
