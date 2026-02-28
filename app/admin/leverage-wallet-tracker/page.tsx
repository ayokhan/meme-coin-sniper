"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

type Wallet = { id: string; address: string; nickname?: string | null; active: boolean; alertEnabled: boolean; global: boolean; createdAt: string };

export default function AdminLeverageWalletTrackerPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const [bulkAddInput, setBulkAddInput] = useState("");
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkRemoveInput, setBulkRemoveInput] = useState("");
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [togglingActive, setTogglingActive] = useState<string | null>(null);
  const [togglingAlert, setTogglingAlert] = useState<string | null>(null);
  const [togglingGlobal, setTogglingGlobal] = useState<string | null>(null);
  const [editingNickname, setEditingNickname] = useState<string | null>(null);
  const [nicknameDraft, setNicknameDraft] = useState("");

  const loadWallets = () =>
    fetch("/api/admin/leverage-wallet-tracker/wallets")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setWallets(d.wallets ?? []);
        else setError(d.error ?? "Failed to load");
      });

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError("");
    loadWallets().finally(() => setLoading(false));
  }, [status]);

  const showSuccess = (msg: string) => {
    setError("");
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(""), 5000);
  };

  const handleSeed = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        loadWallets();
        showSuccess(data.message ?? "Default wallets loaded.");
      } else setError(data.error ?? "Seed failed");
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
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, nickname: newNickname.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        setNewAddress("");
        setNewNickname("");
        loadWallets();
        showSuccess("Wallet added.");
      } else setError(data.error ?? "Add failed");
    } catch {
      setError("Add failed");
    } finally {
      setAdding(false);
    }
  };

  const handleBulkAdd = async () => {
    const raw = bulkAddInput.trim();
    if (!raw) return;
    let items: { address: string; nickname?: string | null }[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        items = parsed.map((w: unknown) => {
          if (typeof w === "string") return { address: w.trim().toLowerCase(), nickname: null };
          if (w && typeof w === "object" && "address" in w)
            return { address: String((w as { address: string }).address).trim().toLowerCase(), nickname: (w as { nickname?: string }).nickname ?? null };
          return { address: "", nickname: null };
        }).filter((x: { address: string }) => x.address.length > 0);
      }
    } catch {
      items = raw.split(/[\n,]+/).map((line) => {
        const [addr, ...rest] = line.trim().split(/\s+/);
        return { address: (addr ?? "").trim().toLowerCase(), nickname: rest.length > 0 ? rest.join(" ") : null };
      }).filter((x) => x.address.length > 0);
    }
    if (items.length === 0) {
      setError("Paste a JSON array with address (and optional nickname) or one 0x address per line.");
      return;
    }
    setBulkAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets/add-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallets: items }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkAddInput("");
        loadWallets();
        showSuccess(data.message ?? `${data.added ?? 0} added.`);
      } else setError(data.error ?? "Bulk add failed");
    } catch {
      setError("Bulk add failed");
    } finally {
      setBulkAdding(false);
    }
  };

  const handleBulkRemove = async () => {
    const raw = bulkRemoveInput.trim();
    if (!raw) return;
    let addresses: string[] = [];
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) addresses = parsed.map((a: unknown) => String(a).trim().toLowerCase()).filter(Boolean);
    } catch {
      addresses = raw.split(/[\n,]+/).map((a) => a.trim().toLowerCase()).filter(Boolean);
    }
    if (addresses.length === 0) {
      setError("Paste a JSON array of addresses or one 0x address per line.");
      return;
    }
    if (!confirm(`Remove ${addresses.length} wallet(s)?`)) return;
    setBulkRemoving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets/delete-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addresses }),
      });
      const data = await res.json();
      if (data.success) {
        setBulkRemoveInput("");
        loadWallets();
        showSuccess(data.message ?? `${data.deleted ?? 0} removed.`);
      } else setError(data.error ?? "Bulk remove failed");
    } catch {
      setError("Bulk remove failed");
    } finally {
      setBulkRemoving(false);
    }
  };

  const handleSetActive = async (address: string, active: boolean) => {
    setTogglingActive(address);
    setError("");
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, active }),
      });
      const data = await res.json();
      if (data.success) loadWallets();
      else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setTogglingActive(null);
    }
  };

  const handleSetAlert = async (address: string, alertEnabled: boolean) => {
    setTogglingAlert(address);
    setError("");
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, alertEnabled }),
      });
      const data = await res.json();
      if (data.success) loadWallets();
      else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    } finally {
      setTogglingAlert(null);
    }
  };

  const handleSaveNickname = async (address: string) => {
    setError("");
    try {
      const res = await fetch("/api/admin/leverage-wallet-tracker/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, nickname: nicknameDraft.trim() || null }),
      });
      const data = await res.json();
      if (data.success) {
        loadWallets();
        setEditingNickname(null);
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    }
  };

  const handleRemove = async (address: string) => {
    if (!confirm("Remove this wallet from the list?")) return;
    setDeleting(address);
    try {
      const res = await fetch(`/api/admin/leverage-wallet-tracker/wallets?address=${encodeURIComponent(address)}`, { method: "DELETE" });
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

  const isOwner = (session?.user as { isOwner?: boolean })?.isOwner ?? false;

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to manage Leverage Wallet Tracker."}
            {!session && <p className="mt-2"><Link href="/signin" className="underline">Sign in</Link></p>}
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
            Owner only. <p className="mt-2"><Link href="/" className="underline">Back to app</Link></p>
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
          <Link href="/admin/wallet-tracker" className="text-sm text-muted-foreground hover:underline">Admin — Wallet Tracker</Link>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium">Admin — Leverage Wallet Tracker</span>
        </div>

        {successMessage && (
          <div className="rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 text-sm px-3 py-2 mb-4 font-medium">✓ {successMessage}</div>
        )}
        {error && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">{error}</div>
        )}

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Leverage wallets (Top Leverage Traders)
              <span className="text-base font-normal text-muted-foreground">({wallets.length} total{wallets.some((w) => !w.active) ? `, ${wallets.filter((w) => w.active).length} active` : ""})</span>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              EVM addresses (0x…) for Hyperliquid/ApexLiquid. Shown in Wallet Tracker → Top Leverage Traders. <strong>Global</strong>: show on global list for all users. <strong>Alert</strong>: Telegram when they make a new trade.
            </p>
          </CardHeader>
          <CardContent>
            {wallets.length === 0 && !loading && (
              <div className="mb-4 rounded-md bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200 text-sm px-3 py-3">
                No wallets. Click &quot;Load default (ApexLiquid top 5)&quot; or add manually.
                <Button variant="outline" size="sm" className="ml-3" onClick={handleSeed} disabled={seeding}>
                  {seeding ? "Loading…" : "Load default (ApexLiquid top 5)"}
                </Button>
              </div>
            )}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleSeed} disabled={seeding || wallets.length > 0}>
                {seeding ? "Loading…" : "Load default (ApexLiquid top 5)"}
              </Button>
            </div>
            <details className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">Bulk add</summary>
              <p className="text-xs text-muted-foreground mt-2 mb-1">JSON array with <code className="bg-zinc-200 dark:bg-zinc-700 px-0.5 rounded">address</code> (optional <code className="bg-zinc-200 dark:bg-zinc-700 px-0.5 rounded">nickname</code>) or one 0x address per line.</p>
              <textarea
                placeholder='[{"address":"0x...","nickname":"..."}] or one address per line'
                value={bulkAddInput}
                onChange={(e) => setBulkAddInput(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 mb-2"
              />
              <Button variant="outline" size="sm" className="border-emerald-500 text-emerald-700 dark:text-emerald-300" onClick={handleBulkAdd} disabled={bulkAdding || !bulkAddInput.trim()}>
                {bulkAdding ? "Adding…" : "Add listed"}
              </Button>
            </details>
            <details className="mb-4 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300">Bulk remove</summary>
              <p className="text-xs text-muted-foreground mt-2 mb-1">JSON array of addresses or one 0x address per line.</p>
              <textarea
                placeholder='["0x...","0x..."] or one per line'
                value={bulkRemoveInput}
                onChange={(e) => setBulkRemoveInput(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 mb-2"
              />
              <Button variant="outline" size="sm" className="border-rose-500 text-rose-700 dark:text-rose-300" onClick={handleBulkRemove} disabled={bulkRemoving || !bulkRemoveInput.trim()}>
                {bulkRemoving ? "Removing…" : "Remove listed"}
              </Button>
            </details>
            <div className="flex flex-wrap gap-2 mb-4">
              <input
                type="text"
                placeholder="0x… address"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                className="flex-1 min-w-[200px] rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm font-mono text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              <input
                type="text"
                placeholder="Nickname (optional)"
                value={newNickname}
                onChange={(e) => setNewNickname(e.target.value)}
                className="w-36 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500"
              />
              <Button onClick={handleAdd} disabled={adding || !newAddress.trim()} size="sm">{adding ? "Adding…" : "Add"}</Button>
            </div>
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {wallets.map((w) => (
                  <li key={w.id} className={`flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm ${w.active ? "border-zinc-200 dark:border-zinc-700" : "border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20"}`}>
                    <div className="min-w-0 flex-1 font-mono text-xs text-zinc-900 dark:text-zinc-100">{w.address}</div>
                    <div className="flex items-center gap-2">
                      {editingNickname === w.address ? (
                        <>
                          <input
                            type="text"
                            value={nicknameDraft}
                            onChange={(e) => setNicknameDraft(e.target.value)}
                            placeholder="Nickname"
                            className="w-28 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-xs"
                          />
                          <Button size="sm" className="h-6 text-xs" onClick={() => handleSaveNickname(w.address)}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingNickname(null); setNicknameDraft(""); }}>Cancel</Button>
                        </>
                      ) : (
                        <>
                          <span className="text-muted-foreground">{w.nickname || "—"}</span>
                          <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => { setEditingNickname(w.address); setNicknameDraft(w.nickname ?? ""); }}>Edit name</Button>
                        </>
                      )}
                    </div>
                    {!w.active && <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Inactive</span>}
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSetActive(w.address, !w.active)} disabled={togglingActive === w.address}>
                        {togglingActive === w.address ? "…" : w.active ? "Deactivate" : "Activate"}
                      </Button>
                      <span className="text-xs text-muted-foreground">Alert</span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={w.alertEnabled}
                        onClick={() => handleSetAlert(w.address, !w.alertEnabled)}
                        disabled={togglingAlert === w.address}
                        title={w.alertEnabled ? "Telegram alert ON for new trades" : "Telegram alert OFF"}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 ${w.alertEnabled ? "bg-cyan-500" : "bg-zinc-200 dark:bg-zinc-700"}`}
                      >
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${w.alertEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                      </button>
                    </div>
                    <Button variant="ghost" size="sm" className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 h-7 text-xs" onClick={() => handleRemove(w.address)} disabled={deleting === w.address}>
                      {deleting === w.address ? "…" : "Remove"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link> · View in app: Wallet Tracker → Top Leverage Traders
        </p>
      </div>
    </div>
  );
}
