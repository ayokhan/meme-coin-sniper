"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

type Wallet = { id: string; address: string; label?: string | null; firstBuyEnabled?: boolean };
type Rules = { minBuyers: number; maxAgeHours: number; maxAlerts: number };
type FirstBuyRules = { lookbackMinutes: number; maxAlerts: number };

export default function AdminWalletTrackerPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [rules, setRules] = useState<Rules>({ minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 });
  const FIRST_BUY_LOOKBACK_MINS = [1, 2, 5, 15, 30] as const;
  const FIRST_BUY_LOOKBACK_HOURS = [1, 2, 6, 12, 24] as const; // stored as mins: 60, 120, 360, 720, 1440
  const [firstBuyRules, setFirstBuyRules] = useState<FirstBuyRules>({ lookbackMinutes: 15, maxAlerts: 50 });
  const [firstBuyEnabled, setFirstBuyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [rulesSavedAt, setRulesSavedAt] = useState<number | null>(null);
  const [firstBuyRulesSavedAt, setFirstBuyRulesSavedAt] = useState<number | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [savingRules, setSavingRules] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [savingFirstBuyRules, setSavingFirstBuyRules] = useState(false);
  const [togglingFirstBuy, setTogglingFirstBuy] = useState(false);
  const [togglingFirstAlertWallet, setTogglingFirstAlertWallet] = useState<string | null>(null);
  const [bulkRemoveInput, setBulkRemoveInput] = useState("");
  const [bulkRemoving, setBulkRemoving] = useState(false);

  const loadWallets = () =>
    fetch("/api/admin/wallet-tracker/wallets")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWallets((d.wallets ?? []).map((w: Wallet) => ({ ...w, firstBuyEnabled: w.firstBuyEnabled !== false })));
        else setError(d.error ?? "Failed to load");
      });

  const loadRules = () =>
    fetch("/api/admin/wallet-tracker/rules")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setRules(d.rules ?? { minBuyers: 3, maxAgeHours: 24, maxAlerts: 30 });
      });

  const loadFirstBuy = () =>
    fetch("/api/admin/wallet-tracker/first-buy-rules")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setFirstBuyRules(d.rules ?? { lookbackMinutes: 15, maxAlerts: 50 });
          if (typeof d.firstBuyEnabled === "boolean") setFirstBuyEnabled(d.firstBuyEnabled);
        }
      });

  const load = () => {
    setLoading(true);
    setError("");
    Promise.all([loadWallets(), loadRules(), loadFirstBuy()])
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
      if (data.success) {
        load();
        showSuccess("Default wallets loaded.");
      } else setError(data.error ?? "Seed failed");
    } catch {
      setError("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const handleImportConfig = async () => {
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wallet-tracker/import-config", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        loadWallets();
        showSuccess("Wallets imported from config.");
      } else setError(data.error ?? "Import failed");
    } catch {
      setError("Import failed");
    } finally {
      setImporting(false);
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

  const handleBulkRemove = async () => {
    const raw = bulkRemoveInput.trim();
    if (!raw) return;
    let addresses: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        addresses = parsed
          .map((item: unknown) => {
            if (typeof item === "string") return item.trim();
            if (item && typeof item === "object" && "trackedWalletAddress" in item) return String((item as { trackedWalletAddress: string }).trackedWalletAddress).trim();
            if (item && typeof item === "object" && "address" in item) return String((item as { address: string }).address).trim();
            return "";
          })
          .filter((a: string) => a.length > 0);
      }
    } catch {
      addresses = raw.split(/[\n,]+/).map((a) => a.trim()).filter(Boolean);
    }
    if (addresses.length === 0) {
      setError("Paste a JSON array of wallets (with trackedWalletAddress or address) or one address per line.");
      return;
    }
    if (!confirm(`Remove ${addresses.length} wallet(s) from tracking? This cannot be undone.`)) return;
    setBulkRemoving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wallet-tracker/wallets/delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkRemoveInput("");
        loadWallets();
        showSuccess(data.message ?? `${data.deleted ?? 0} wallet(s) removed.`);
      } else setError(data.error ?? "Bulk remove failed");
    } catch {
      setError("Bulk remove failed");
    } finally {
      setBulkRemoving(false);
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
      if (data.success) {
        loadWallets();
        showSuccess("Wallet removed.");
      } else setError(data.error ?? "Remove failed");
    } catch {
      setError("Remove failed");
    } finally {
      setDeleting(null);
    }
  };

  const showSuccess = (msg: string) => {
    setError("");
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 6000);
  };

  const handleSaveRules = async () => {
    setSavingRules(true);
    setError("");
    try {
      const res = await fetch("/api/admin/wallet-tracker/rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rules),
      });
      const data = await res.json();
      if (data.success) {
        loadRules();
        setRulesSavedAt(Date.now());
        setTimeout(() => setRulesSavedAt(null), 5000);
        showSuccess("Alert rules saved.");
      } else setError(data.error ?? "Save failed");
    } catch {
      setError("Save failed");
    } finally {
      setSavingRules(false);
    }
  };

  const handleToggleFirstBuy = async () => {
    setTogglingFirstBuy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "owner_first_buy_alerts", enabled: !firstBuyEnabled }),
      });
      const data = await res.json();
      if (data.success && typeof data.flags?.owner_first_buy_alerts === "boolean") {
        setFirstBuyEnabled(data.flags.owner_first_buy_alerts);
        showSuccess(data.flags.owner_first_buy_alerts ? "First buy alerts turned ON." : "First buy alerts turned OFF.");
      } else setError(data.error ?? "Toggle failed");
    } catch {
      setError("Toggle failed");
    } finally {
      setTogglingFirstBuy(false);
    }
  };

  const handleSaveFirstBuyRules = async () => {
    setSavingFirstBuyRules(true);
    try {
      const res = await fetch("/api/admin/wallet-tracker/first-buy-rules", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(firstBuyRules),
      });
      const data = await res.json();
      if (data.success) {
        loadFirstBuy();
        setFirstBuyRulesSavedAt(Date.now());
        setTimeout(() => setFirstBuyRulesSavedAt(null), 5000);
        showSuccess("First-buy rules saved.");
      } else setError(data.error ?? "Save failed");
    } catch {
      setError("Save failed");
    } finally {
      setSavingFirstBuyRules(false);
    }
  };

  const handleToggleFirstAlert = async (address: string) => {
    const w = wallets.find((x) => x.address === address);
    if (w == null) return;
    const next = !(w.firstBuyEnabled !== false);
    setTogglingFirstAlertWallet(address);
    setError("");
    try {
      const res = await fetch("/api/admin/wallet-tracker/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, firstBuyEnabled: next }),
      });
      const data = await res.json();
      if (data.success) loadWallets();
      else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setTogglingFirstAlertWallet(null);
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
                <Link href="/signin" className="underline">Sign in</Link>
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

        {successMessage && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 mb-4 font-medium">
            ✓ {successMessage}
          </div>
        )}
        {error && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">
            {error}
          </div>
        )}

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
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveRules} disabled={savingRules} size="sm">
                {savingRules ? "Saving…" : "Save rules"}
              </Button>
              {rulesSavedAt != null && (
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Saved</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle>First buy alerts (owner only)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Notify in-app and Telegram the <strong>first time</strong> a tracked wallet buys a coin. No repeat alerts for the same wallet+token. Toggle and rules below.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                role="switch"
                aria-checked={firstBuyEnabled}
                onClick={handleToggleFirstBuy}
                disabled={togglingFirstBuy}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 ${firstBuyEnabled ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${firstBuyEnabled ? "translate-x-5" : "translate-x-1"}`} />
              </button>
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                {firstBuyEnabled ? "First buy alerts ON" : "First buy alerts OFF"}
              </span>
              {togglingFirstBuy && <span className="text-xs text-muted-foreground">Updating…</span>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Lookback</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {FIRST_BUY_LOOKBACK_MINS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setFirstBuyRules((r) => ({ ...r, lookbackMinutes: mins }))}
                      className={`rounded-md border px-3 py-1.5 text-sm font-medium ${firstBuyRules.lookbackMinutes === mins ? "border-cyan-500 bg-cyan-500 text-white dark:bg-cyan-600" : "border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700"}`}
                    >
                      {mins} min{mins !== 1 ? "s" : ""}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <label htmlFor="first-buy-lookback-hours" className="text-xs text-muted-foreground whitespace-nowrap">Hours:</label>
                  <select
                    id="first-buy-lookback-hours"
                    value={FIRST_BUY_LOOKBACK_HOURS.some((h) => h * 60 === firstBuyRules.lookbackMinutes) ? firstBuyRules.lookbackMinutes : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) setFirstBuyRules((r) => ({ ...r, lookbackMinutes: Number(val) }));
                    }}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
                  >
                    <option value="">—</option>
                    {FIRST_BUY_LOOKBACK_HOURS.map((h) => (
                      <option key={h} value={h * 60}>{h} h</option>
                    ))}
                  </select>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">How far back to check for first buys</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Max first-buy alerts per cron run</label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={firstBuyRules.maxAlerts}
                  onChange={(e) => setFirstBuyRules((r) => ({ ...r, maxAlerts: Math.max(5, Math.min(200, parseInt(e.target.value, 10) || 5)) }))}
                  className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleSaveFirstBuyRules} disabled={savingFirstBuyRules} size="sm">
                {savingFirstBuyRules ? "Saving…" : "Save first-buy rules"}
              </Button>
              {firstBuyRulesSavedAt != null && (
                <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">✓ Saved</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Recent first-buy alerts appear in the app under Wallet Tracker (owner view).
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Tracked wallets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Add Solana wallet addresses to track. Alerts fire when {rules.minBuyers}+ of these wallets buy the same token. Use <strong>First alert</strong> to choose which wallets trigger first-buy alerts (first time they buy a coin).
            </p>
          </CardHeader>
          <CardContent>
            {wallets.length === 0 && !loading && (
              <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-sm px-3 py-3">
                No wallets in database. Click &quot;Load default wallets&quot; to import from config, or add manually.
                <Button variant="outline" size="sm" className="ml-3" onClick={handleSeed} disabled={seeding}>
                  {seeding ? "Loading…" : "Load default wallets"}
                </Button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleImportConfig} disabled={importing}>
                {importing ? "Importing…" : "Import from config"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Adds all wallets from config (lib/config/ct-wallets.ts) to the list. Does not remove existing wallets.
              </span>
            </div>
            <details className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">Bulk remove wallets</summary>
              <p className="text-xs text-muted-foreground mt-2 mb-1">Paste a JSON array (with <code className="bg-zinc-200 dark:bg-zinc-700 px-0.5 rounded">trackedWalletAddress</code> or <code className="bg-zinc-200 dark:bg-zinc-700 px-0.5 rounded">address</code>) or one address per line.</p>
              <textarea
                placeholder='[{"trackedWalletAddress":"12zQ...","name":"..."}, ...] or one address per line'
                value={bulkRemoveInput}
                onChange={(e) => setBulkRemoveInput(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 mb-2"
              />
              <Button variant="outline" size="sm" className="border-rose-500 text-rose-700 dark:text-rose-300" onClick={handleBulkRemove} disabled={bulkRemoving || !bulkRemoveInput.trim()}>
                {bulkRemoving ? "Removing…" : "Remove listed wallets"}
              </Button>
            </details>
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
                  <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-sm">
                    <div className="min-w-0 flex-1">
                      <span className="font-mono text-zinc-900 dark:text-zinc-100">{w.address}</span>
                      {w.label && <span className="ml-2 text-muted-foreground">({w.label})</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs text-muted-foreground whitespace-nowrap">First alert</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={w.firstBuyEnabled !== false}
                        onClick={() => handleToggleFirstAlert(w.address)}
                        disabled={togglingFirstAlertWallet === w.address}
                        title={w.firstBuyEnabled !== false ? "First-buy alerts ON for this wallet" : "First-buy alerts OFF for this wallet"}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 ${w.firstBuyEnabled !== false ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition-transform ${w.firstBuyEnabled !== false ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                      {togglingFirstAlertWallet === w.address && <span className="text-xs text-muted-foreground">…</span>}
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
