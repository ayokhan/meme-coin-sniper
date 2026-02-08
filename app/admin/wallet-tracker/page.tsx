"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

type Wallet = { id: string; address: string; label?: string | null };
type Rules = { minBuyers: number; maxAgeHours: number; maxAlerts: number };

export default function AdminWalletTrackerPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [rules, setRules] = useState<Rules>({ minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const loadWallets = () =>
    fetch("/api/admin/wallet-tracker/wallets")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWallets(d.wallets ?? []);
        else setError(d.error ?? "Failed to load");
      });

  const loadRules = () =>
    fetch("/api/admin/wallet-tracker/rules")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRules(d.rules ?? { minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 });
      });

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([loadWallets(), loadRules()])
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    load();
  }, [status]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/wallet-tracker/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) load();
      else setError(data.error ?? "Seed failed");
    } catch {
      setError("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const handleAdd = async () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wallet-tracker/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, label: newLabel.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setNewAddress("");
        setNewLabel("");
        loadWallets();
      } else setError(data.error ?? "Add failed");
    } catch {
      setError("Add failed");
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (address: string) => {
    if (!confirm("Remove this wallet from tracking?")) return;
    setDeleting(address);
    try {
      const res = await fetch(`/api/admin/wallet-tracker/wallets?address=${encodeURIComponent(address)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) loadWallets();
      else setError(data.error ?? "Remove failed");
    } catch {
      setError("Remove failed");
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    try {
      const res = await fetch("/api/admin/wallet-tracker/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) loadRules();
      else setError(data.error ?? "Save failed");
    } catch {
      setError("Save failed");
    } finally {
      setSavingRules(false);
    }
  };

  const isOwner = (session?.user as { isOwner?: boolean })?.isOwner ?? false;
  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to manage Wallet Tracker."}
            {!session && (
              <p className="mt-2">
                <Link href="/register" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            Admin only. Only owner emails (OWNER_EMAIL) can manage Wallet Tracker.
            <p className="mt-2">
              <Link href="/" className="underline">Back to app</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <div className="flex gap-2 mb-4">
          <Link href="/admin/customers" className="text-sm text-muted-foreground hover:underline">
            Admin — Customers
          </Link>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">Admin — Wallet Tracker</span>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle>Alert rules</CardTitle>
            <p className="text-sm text-muted-foreground">
              Alert when this many tracked wallets buy the same token within the time window.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Min wallets to trigger alert
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={rules.minBuyers}
                  onChange={(e) => setRules((r) => ({ ...r, minBuyers: Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1)) }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
                <p className="text-xs text-muted-foreground mt-0.5">e.g. 3 = alert when 3+ wallets buy same coin</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Lookback (hours)</label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={rules.maxAgeHours}
                  onChange={(e) => setRules((r) => ({ ...r, maxAgeHours: Math.max(1, Math.min(168, parseInt(e.target.value, 10) || 1)) }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
                <p className="text-xs text-muted-foreground mt-0.5">24 = last 24 hours</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Max alerts to show</label>
                <input
                  type="number"
                  min={5}
                  max={100}
                  value={rules.maxAlerts}
                  onChange={(e) => setRules((r) => ({ ...r, maxAlerts: Math.max(5, Math.min(100, parseInt(e.target.value, 10) || 5)) }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <Button onClick={handleSaveRules} disabled={savingRules} size="sm">
              {savingRules ? "Saving…" : "Save rules"}
            </Button>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Tracked wallets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add Solana wallet addresses to track. Alerts fire when {rules.minBuyers}+ of these wallets buy the same token.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {wallets.length === 0 && !loading && (
              <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-sm px-3 py-3">
                No wallets in database. Click &quot;Load default wallets&quot; to import from config, or add manually.
                <Button variant="outline" size="sm" className="ml-3" onClick={handleSeed} disabled={seeding}>
                  {seeding ? "Loading…" : "Load default wallets"}
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="Wallet address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              <input
                type="text"
                placeholder="Label (optional)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="w-28 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              <Button onClick={handleAdd} disabled={adding || !newAddress.trim()} size="sm">
                {adding ? "Adding…" : "Add"}
              </Button>
            </div>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {wallets.map((w) => (
                  <li key={w.id} className="flex items-center justify-between rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="font-mono text-zinc-900 dark:text-zinc-100">{w.address}</span>
                      {w.label && <span className="ml-2 text-muted-foreground">({w.label})</span>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                      onClick={() => handleRemove(w.address)}
                      disabled={deleting === w.address}
                    >
                      {deleting === w.address ? "Removing…" : "Remove"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
