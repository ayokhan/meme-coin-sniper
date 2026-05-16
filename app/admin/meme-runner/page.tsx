"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemeRunnerLaunchpadId } from "@/lib/meme-runner/launchpads";
import { allLaunchpadIds } from "@/lib/meme-runner/launchpads";
import type { MemeRunnerLaneFilters, MemeRunnerSolConfig } from "@/lib/meme-runner/types";

type LaunchpadOption = { id: MemeRunnerLaunchpadId; label: string; defaultEnabled: boolean };

type LaneKey = "new" | "soon" | "migrated";

type FilterField = {
  key: keyof MemeRunnerLaneFilters;
  label: string;
  step?: number;
  type?: "number" | "boolean";
};

const SHARED_FIELDS: { key: keyof MemeRunnerSolConfig; label: string; step?: number }[] = [
  { key: "targetMarketCapUsd", label: "Soon target MC (USD)", step: 1000 },
  { key: "solPriceUsd", label: "SOL price for fee estimate (USD)" },
  { key: "pumpGraduationMcapUsd", label: "Pump graduation MC (USD)", step: 1000 },
  { key: "laneNewMaxMcapUsd", label: "Lane New: max MC (USD)", step: 1000 },
  { key: "laneSoonMinMcapUsd", label: "Lane Soon: min MC (USD)", step: 1000 },
  { key: "laneSoonMaxMcapUsd", label: "Lane Soon: max MC (USD)", step: 1000 },
];

const LANE_FILTER_FIELDS: FilterField[] = [
  { key: "minTokenAgeMinutes", label: "Min token age (minutes)" },
  { key: "maxTokenAgeMinutes", label: "Max token age (minutes)" },
  { key: "minMarketCapUsd", label: "Min market cap (USD)", step: 1000 },
  { key: "maxMarketCapUsd", label: "Max market cap (USD)", step: 1000 },
  { key: "minVolume24hUsd", label: "Min 24h volume (USD)", step: 500 },
  { key: "minEstimatedFeesSol", label: "Min estimated fees (SOL)", step: 0.1 },
  { key: "minLiquidityUsd", label: "Min liquidity (USD)", step: 500 },
  { key: "minRunnerScore", label: "Min runner score (0–100)" },
  { key: "requireAtLeastOneSocial", label: "Require at least one social", type: "boolean" },
  { key: "requireOriginalSocials", label: "Require Twitter or Telegram", type: "boolean" },
];

const LANE_LABELS: Record<LaneKey, string> = {
  new: "New (fresh pump.fun)",
  soon: "Soon (~$50k band)",
  migrated: "Migrated (Raydium / Orca / Meteora)",
};

function LaneFilterSection({
  lane,
  filters,
  onChange,
}: {
  lane: LaneKey;
  filters: MemeRunnerLaneFilters;
  onChange: (next: MemeRunnerLaneFilters) => void;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
      <h3 className="text-sm font-medium">{LANE_LABELS[lane]}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {LANE_FILTER_FIELDS.map((f) =>
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
  const [config, setConfig] = useState<MemeRunnerSolConfig | null>(null);
  const [defaults, setDefaults] = useState<MemeRunnerSolConfig | null>(null);
  const [launchpads, setLaunchpads] = useState<LaunchpadOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/meme-runner/config", { cache: "no-store" });
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
    if (status === "authenticated") void load();
  }, [status, load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/meme-runner/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Save failed");
        return;
      }
      setConfig(data.config as MemeRunnerSolConfig);
      setMsg("Saved. Each lane uses its own filter block.");
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

  const toggleLaunchpad = (id: MemeRunnerLaunchpadId) => {
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
    setConfig((c) => (c ? { ...c, enabledLaunchpads: allLaunchpadIds() } : c));
  };

  const selectDefaultLaunchpads = () => {
    if (defaults) setConfig((c) => (c ? { ...c, enabledLaunchpads: [...defaults.enabledLaunchpads] } : c));
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <p className="text-muted-foreground">{status === "loading" ? "Loading…" : "Sign in as owner."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-4 sm:p-8">
      <div className="max-w-2xl mx-auto space-y-4">
        <Link href="/admin" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
          ← Admin
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Meme Runner — SOL config</CardTitle>
            <p className="text-xs text-muted-foreground">
              Sources: <strong>pump.fun / pumpswap</strong> via DexScreener (+ optional Moralis new feed). Migrated =
              Raydium, Orca, Meteora. Not Bonk, Bags, Moonshot, etc. (Padre supports many launchpads; we start with
              pump.fun). Each lane has separate quality filters — New uses looser age/fees so fresh launches can appear.
              Enable <span className="font-mono">nova_meme_runner</span> in{" "}
              <Link href="/admin/feature-flags" className="underline">
                Feature flags
              </Link>
              .
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            {config && (
              <>
                <div className="space-y-2 rounded-lg border border-zinc-200 dark:border-zinc-700 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-medium">Launchpads</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={selectAllLaunchpads}>
                        Select all
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={selectDefaultLaunchpads}>
                        Defaults (Pump, Bonk, Bags)
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
                    Include migrated pools (Raydium / Orca / Meteora)
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SHARED_FIELDS.map((f) => (
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
                    lane={lane}
                    filters={config[lane]}
                    onChange={(next) => setLaneFilters(lane, next)}
                  />
                ))}
              </>
            )}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => void save()} disabled={saving || !config}>
                {saving ? "Saving…" : "Save config"}
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
