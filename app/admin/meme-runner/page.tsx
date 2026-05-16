"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MemeRunnerSolConfig } from "@/lib/meme-runner/types";

type ConfigField = {
  key: keyof MemeRunnerSolConfig;
  label: string;
  step?: number;
  type?: "number" | "boolean";
};

const FIELDS: ConfigField[] = [
  { key: "minTokenAgeMinutes", label: "Min token age (minutes)" },
  { key: "maxTokenAgeMinutes", label: "Max token age (minutes)" },
  { key: "targetMarketCapUsd", label: "Target market cap (USD)", step: 1000 },
  { key: "minMarketCapUsd", label: "Min market cap (USD)", step: 1000 },
  { key: "maxMarketCapUsd", label: "Max market cap (USD)", step: 1000 },
  { key: "minVolume24hUsd", label: "Min 24h volume (USD)", step: 500 },
  { key: "minEstimatedFeesSol", label: "Min estimated fees (SOL)", step: 0.1 },
  { key: "minLiquidityUsd", label: "Min liquidity (USD)", step: 500 },
  { key: "minRunnerScore", label: "Min runner score (0–100)" },
  { key: "solPriceUsd", label: "SOL price for fee estimate (USD)" },
  { key: "pumpGraduationMcapUsd", label: "Pump graduation MC (USD)", step: 1000 },
  { key: "requireAtLeastOneSocial", label: "Require at least one social", type: "boolean" },
  { key: "requireOriginalSocials", label: "Require Twitter or Telegram", type: "boolean" },
  { key: "laneNewMaxMcapUsd", label: "Lane New: max MC (USD)", step: 1000 },
  { key: "laneSoonMinMcapUsd", label: "Lane Soon: min MC (USD)", step: 1000 },
  { key: "laneSoonMaxMcapUsd", label: "Lane Soon: max MC (USD)", step: 1000 },
];

export default function AdminMemeRunnerPage() {
  const { data: session, status } = useSession();
  const [config, setConfig] = useState<MemeRunnerSolConfig | null>(null);
  const [defaults, setDefaults] = useState<MemeRunnerSolConfig | null>(null);
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
      setMsg("Saved. VIP Meme Runner scans use these thresholds.");
    } catch {
      setError("Save failed");
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (defaults) setConfig({ ...defaults });
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
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin" className="text-sm text-violet-600 dark:text-violet-400 hover:underline">
            ← Admin
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Meme Runner — SOL config</CardTitle>
            <p className="text-xs text-muted-foreground">
              Tune filters for catching pre-migration pump.fun memes (~$50k MC). Lanes: New / Soon use MC thresholds on pump.fun;
              Migrated = Raydium, Orca, or Meteora. Defaults follow Padre Trenches research (≥45m age, ≥2 SOL est. fees). Enable in{" "}
              <Link href="/admin/feature-flags" className="underline">
                Feature flags
              </Link>{" "}
              (<span className="font-mono">nova_meme_runner</span>).
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {msg && <p className="text-sm text-emerald-600">{msg}</p>}
            {config && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {FIELDS.map((f) =>
                  f.type === "boolean" ? (
                    <label key={f.key} className="flex items-center gap-2 text-sm col-span-1 sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={!!config[f.key]}
                        onChange={(e) => setConfig((c) => (c ? { ...c, [f.key]: e.target.checked } : c))}
                      />
                      {f.label}
                    </label>
                  ) : (
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
                  )
                )}
              </div>
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
