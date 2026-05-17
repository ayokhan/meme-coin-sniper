"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getChainMeta } from "@/lib/meme-runner/chain-meta";
import { allLaunchpadIds, defaultEnabledLaunchpadIds } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerChain, MemeRunnerLaneFilters, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

type LaunchpadOption = { id: string; label: string; defaultEnabled: boolean };

type LaneKey = "new" | "soon" | "migrated";

type FilterField = {
  key: keyof MemeRunnerLaneFilters;
  label: string;
  step?: number;
  type?: "number" | "boolean";
};

function sharedFields(chain: MemeRunnerChain): { key: keyof MemeRunnerSolConfig; label: string; step?: number }[] {
  const native = getChainMeta(chain).nativeSymbol;
  return [
    { key: "targetMarketCapUsd", label: "Soon target MC (USD)", step: 1000 },
    { key: "solPriceUsd", label: `${native} price for fee estimate (USD)` },
    { key: "pumpGraduationMcapUsd", label: "Bonding graduation MC (USD)", step: 1000 },
    { key: "laneNewMaxMcapUsd", label: "Lane New: max MC (USD)", step: 1000 },
    { key: "laneSoonMinMcapUsd", label: "Lane Soon: min MC (USD)", step: 1000 },
    { key: "laneSoonMaxMcapUsd", label: "Lane Soon: max MC (USD)", step: 1000 },
  ];
}

function laneFilterFields(chain: MemeRunnerChain, lane: LaneKey): FilterField[] {
  const native = getChainMeta(chain).nativeSymbol;
  const base: FilterField[] = [
    { key: "minTokenAgeMinutes", label: "Min token age (minutes)" },
    { key: "maxTokenAgeMinutes", label: "Max token age (minutes)" },
    { key: "minMarketCapUsd", label: "Min market cap (USD)", step: 1000 },
    { key: "maxMarketCapUsd", label: "Max market cap (USD)", step: 1000 },
    { key: "minVolume24hUsd", label: "Min 24h volume (USD)", step: 500 },
    { key: "minEstimatedFeesSol", label: `Min estimated fees (${native})`, step: 0.1 },
    { key: "minLiquidityUsd", label: "Min liquidity (USD)", step: 500 },
    { key: "minRunnerScore", label: "Min runner score (0–100)" },
    { key: "requireAtLeastOneSocial", label: "Require at least one social", type: "boolean" },
    { key: "requireOriginalSocials", label: "Require Twitter or Telegram", type: "boolean" },
  ];
  if (lane === "soon") {
    base.push(
      { key: "minContinuationScore", label: "Min continuation score (0=off)", step: 1 },
      { key: "maxBondingProgressPct", label: "Max bonding curve % (100=off)", step: 1 },
      { key: "continuationSweetMinMcapUsd", label: "Sweet-spot MC min (USD)", step: 1000 },
      { key: "continuationSweetMaxMcapUsd", label: "Sweet-spot MC max (USD)", step: 1000 }
    );
  }
  return base;
}

function laneLabels(chain: MemeRunnerChain): Record<LaneKey, string> {
  const migrated = getChainMeta(chain).migratedPoolsLabel;
  return {
    new: "New (early bonding)",
    soon: "Soon (continuation / avoid late curve)",
    migrated: `Migrated (${migrated})`,
  };
}

function LaneFilterSection({
  chain,
  lane,
  filters,
  onChange,
}: {
  chain: MemeRunnerChain;
  lane: LaneKey;
  filters: MemeRunnerLaneFilters;
  onChange: (next: MemeRunnerLaneFilters) => void;
}) {
  const labels = laneLabels(chain);
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-medium">{labels[lane]}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {laneFilterFields(chain, lane).map((f) =>
          f.type === "boolean" ? (
            <label key={f.key} className="flex items-center gap-2 text-sm col-span-1 sm:col-span-2">
              <input
                type="checkbox"
                checked={!!filters[f.key]}
                onChange={(e) => onChange({ ...filters, [f.key]: e.target.checked })}
              />
              {f.label}
            </label>
          ) : (
            <div key={f.key} className="space-y-1">
              <label className="text-xs text-muted-foreground">{f.label}</label>
              <input
                type="number"
                step={f.step ?? 1}
                value={filters[f.key] as number}
                onChange={(e) => onChange({ ...filters, [f.key]: Number(e.target.value) })}
                className="w-full h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
              />
            </div>
          )
        )}
      </div>
    </div>
  );
}

export default function AdminMemeRunnerPage() {
  const { data: session, status } = useSession();
  const [adminChain, setAdminChain] = useState<MemeRunnerChain>("sol");
  const [config, setConfig] = useState<MemeRunnerSolConfig | null>(null);
  const [defaults, setDefaults] = useState<MemeRunnerSolConfig | null>(null);
  const [launchpads, setLaunchpads] = useState<LaunchpadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (chain: MemeRunnerChain) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/meme-runner/config?chain=${chain}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to load");
        return;
      }
      setConfig(data.config as MemeRunnerSolConfig);
      setDefaults(data.defaults as MemeRunnerSolConfig);
      setLaunchpads((data.launchpads as LaunchpadOption[]) ?? []);
    } catch {
      setError("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated") void load(adminChain);
  }, [status, adminChain, load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch(`/api/admin/meme-runner/config?chain=${adminChain}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      const saved = data.config as MemeRunnerSolConfig;
      setConfig(saved);
      setMsg(
        `Saved ${adminChain.toUpperCase()} config. Migrated min MC $${saved.migrated.minMarketCapUsd.toLocaleString()}, Soon socials ${saved.soon.requireAtLeastOneSocial ? "required" : "off"}.`
      );
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (defaults) setConfig({ ...defaults });
  };

  const setLaneFilters = (lane: LaneKey, next: MemeRunnerLaneFilters) => {
    setConfig((c) => (c ? { ...c, [lane]: next } : c));
  };

  const toggleLaunchpad = (id: string) => {
    setConfig((c) => {
      if (!c) return c;
      const on = c.enabledLaunchpads.includes(id);
      const enabledLaunchpads = on
        ? c.enabledLaunchpads.filter((x) => x !== id)
        : [...c.enabledLaunchpads, id];
      return { ...c, enabledLaunchpads };
    });
  };

  const selectAllLaunchpads = () => {
    setConfig((c) => (c ? { ...c, enabledLaunchpads: allLaunchpadIds(adminChain) } : c));
  };

  const selectDefaultLaunchpads = () => {
    setConfig((c) =>
      c ? { ...c, enabledLaunchpads: defaultEnabledLaunchpadIds(adminChain) } : c
    );
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{status === "loading" ? "Loading…" : "Sign in as owner."}</p>
      </div>
    );
  }

  const chainLabel = adminChain.toUpperCase();

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/admin" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
          ← Admin
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Meme Runner config</CardTitle>
            <p className="text-xs text-muted-foreground">
              Per-chain launchpads and lane filters. Click <strong>Save {chainLabel} config</strong> after
              changes — settings are stored in the database (not reset on save). Soon: uncheck &quot;Require at
              least one social&quot; for more names. Migrated: lower min/max MC to catch earlier grads (defaults
              $25k–$1.2M). SOL defaults: Pump, Bonk, Bags. Enable{" "}
              <span className="font-mono">nova_meme_runner</span> in{" "}
              <Link href="/admin/feature-flags" className="underline">
                Feature flags
              </Link>
              .
            </p>
            <Tabs value={adminChain} onValueChange={(v) => setAdminChain(v as MemeRunnerChain)}>
              <TabsList className="mt-2">
                <TabsTrigger value="sol">SOL</TabsTrigger>
                <TabsTrigger value="bsc">BSC</TabsTrigger>
                <TabsTrigger value="eth">ETH</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading {chainLabel}…</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            {config && (
              <>
                <div className="space-y-2 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">{chainLabel} launchpads</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllLaunchpads}>
                        Select all
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={selectDefaultLaunchpads}>
                        Defaults
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {launchpads.map((p) => {
                      const on = config.enabledLaunchpads.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleLaunchpad(p.id)}
                          className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                            on
                              ? "bg-fuchsia-600 text-white border-fuchsia-600"
                              : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-300 dark:border-zinc-600"
                          }`}
                        >
                          {p.label}
                        </button>
                      );
                    })}
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={config.includeMigratedPools}
                      onChange={(e) =>
                        setConfig((c) => (c ? { ...c, includeMigratedPools: e.target.checked } : c))
                      }
                    />
                    Include migrated pools ({getChainMeta(adminChain).migratedPoolsLabel})
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sharedFields(adminChain).map((f) => (
                    <div key={f.key} className="space-y-1">
                      <label className="text-xs text-muted-foreground">{f.label}</label>
                      <input
                        type="number"
                        step={f.step ?? 1}
                        value={config[f.key] as number}
                        onChange={(e) =>
                          setConfig((c) => (c ? { ...c, [f.key]: Number(e.target.value) } : c))
                        }
                        className="w-full h-9 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                      />
                    </div>
                  ))}
                </div>
                {(["new", "soon", "migrated"] as LaneKey[]).map((lane) => (
                  <LaneFilterSection
                    key={lane}
                    chain={adminChain}
                    lane={lane}
                    filters={config[lane]}
                    onChange={(next) => setLaneFilters(lane, next)}
                  />
                ))}
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void save()} disabled={saving || !config}>
                {saving ? "Saving…" : `Save ${chainLabel} config`}
              </Button>
              <Button type="button" variant="outline" onClick={resetDefaults} disabled={!defaults}>
                Reset to code defaults
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
