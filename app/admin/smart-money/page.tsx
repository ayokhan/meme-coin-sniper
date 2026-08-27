"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Wallet = {
  id: string;
  address: string;
  label?: string | null;
  active?: boolean;
  source?: string | null;
};

export default function AdminSmartMoneyPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [bulkJson, setBulkJson] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    fetch("/api/admin/smart-money/wallets")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWallets(d.wallets ?? []);
        else setError(d.error || "Failed");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status]);

  if (status === "loading") return <p className="p-6 text-sm">Loading…</p>;
  if (!session) return <p className="p-6 text-sm">Sign in required.</p>;

  const add = async () => {
    setBusy(true);
    setMsg("");
    setError("");
    const res = await fetch("/api/admin/smart-money/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        address,
        label: label.trim() || `FOMO: ${address.slice(0, 4)}`,
        source: "fomo",
      }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.success) {
      setError(d.error || "Add failed");
      return;
    }
    setAddress("");
    setLabel("");
    setMsg("FOMO wallet added");
    load();
  };

  const importFomoJson = async () => {
    setBusy(true);
    setMsg("");
    setError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(bulkJson);
    } catch {
      setBusy(false);
      setError('Invalid JSON. Use [{"address":"...","name":"FOMO: handle"}, ...]');
      return;
    }
    const res = await fetch("/api/admin/smart-money/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "import_fomo_json", wallets: parsed }),
    });
    const d = await res.json();
    setBusy(false);
    if (!d.success) {
      setError(d.error || "Import failed");
      return;
    }
    setMsg(`Imported ${d.imported ?? 0} FOMO wallets`);
    setBulkJson("");
    load();
  };

  const toggle = async (id: string) => {
    await fetch("/api/admin/smart-money/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    load();
  };

  const remove = async (id: string) => {
    await fetch("/api/admin/smart-money/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id }),
    });
    load();
  };

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Smart Money — FOMO wallets</h1>
          <p className="text-sm text-muted-foreground">
            FOMO.family does not publish a public leaderboard API. Copy traders from FOMO Leaderboard / Clans, then add
            addresses here (cap ~20). Label as <span className="font-mono text-xs">FOMO: handle</span>.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <a href="https://fomo.family" target="_blank" rel="noopener noreferrer" className="text-sm text-cyan-600 hover:underline">
            Open FOMO.family
          </a>
          <Link href="/admin/wallet-tracker" className="text-sm text-muted-foreground hover:underline">
            Wallet Tracker admin
          </Link>
        </div>
      </div>

      {msg && <p className="text-sm text-emerald-600">{msg}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add FOMO wallet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            className="w-full px-3 py-2 rounded border text-sm bg-background font-mono"
            placeholder="Solana wallet address from FOMO"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <input
            className="w-full px-3 py-2 rounded border text-sm bg-background"
            placeholder="Label (e.g. FOMO: frogmanhaha)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button size="sm" disabled={busy || !address.trim()} onClick={() => void add()}>
            Add FOMO wallet
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Bulk import FOMO JSON</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Paste an array like{" "}
            <span className="font-mono">{`[{"address":"So1...","name":"FOMO: DumbCrayonEater"}]`}</span>
          </p>
          <textarea
            className="w-full min-h-[120px] px-3 py-2 rounded border text-xs bg-background font-mono"
            placeholder='[{"address":"...","name":"FOMO: handle"}]'
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
          />
          <Button size="sm" variant="outline" disabled={busy || !bulkJson.trim()} onClick={() => void importFomoJson()}>
            Import FOMO list
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">FOMO wallets ({wallets.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet — add from FOMO leaderboard.</p>
          ) : (
            wallets.map((w) => (
              <div
                key={w.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 dark:border-zinc-800 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{w.label || "Unlabeled"}</p>
                  <p className="font-mono text-xs text-muted-foreground truncate">{w.address}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {w.source || "fomo"} · {w.active === false ? "inactive" : "active"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => void toggle(w.id)}>
                    {w.active === false ? "Activate" : "Deactivate"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void remove(w.id)}>
                    Remove
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
