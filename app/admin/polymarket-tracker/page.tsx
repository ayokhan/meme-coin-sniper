"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Wallet = {
  id: string;
  address: string;
  nickname: string | null;
  active: boolean;
  global: boolean;
  createdAt: string;
};

export default function AdminPolymarketTrackerPage() {
  const { data: session, status } = useSession();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newNickname, setNewNickname] = useState("");
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const loadWallets = () =>
    fetch("/api/admin/polymarket-tracker/wallets")
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

  const handleAdd = async () => {
    const addr = newAddress.trim();
    if (!addr) return;
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/admin/polymarket-tracker/wallets", {
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

  const handleDelete = async (address: string) => {
    if (!window.confirm(`Remove ${address}?`)) return;
    setDeleting(address);
    setError("");
    try {
      const res = await fetch(`/api/admin/polymarket-tracker/wallets?address=${encodeURIComponent(address)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        loadWallets();
        showSuccess("Removed.");
      } else setError(data.error ?? "Delete failed");
    } catch {
      setError("Delete failed");
    } finally {
      setDeleting(null);
    }
  };

  const patchWallet = async (address: string, body: Record<string, unknown>) => {
    setError("");
    try {
      const res = await fetch("/api/admin/polymarket-tracker/wallets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, ...body }),
      });
      const data = await res.json();
      if (data.success) {
        loadWallets();
        showSuccess("Updated.");
      } else setError(data.error ?? "Update failed");
    } catch {
      setError("Update failed");
    }
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <p className="text-muted-foreground">{status === "loading" ? "Loading…" : "Sign in required."}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            ← Admin hub
          </Link>
          <Link href="/" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline">
            Back to app
          </Link>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Polymarket Tracker wallets</CardTitle>
            <p className="text-sm text-muted-foreground">
              Polygon proxy addresses (0x…) used on Polymarket. <strong>Global</strong> wallets appear for all VIP users with Polymarket Bot access. Turn the whole tracker off in{" "}
              <Link href="/admin/feature-flags" className="underline">
                Feature flags
              </Link>{" "}
              (<span className="font-mono text-xs">nova_polymarket_tracker</span>). The separate{" "}
              <span className="font-mono text-xs">nova_polymarket_copy_bot</span> flag controls the VIP Copy trading bot subtab;{" "}
              <span className="font-mono text-xs">nova_polymarket_leaderboard</span> controls the Leaderboard subtab.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
            {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
            {successMessage && <p className="text-sm text-emerald-600 dark:text-emerald-400">{successMessage}</p>}

            <div className="flex flex-wrap gap-2 items-end">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Address</label>
                <input
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x…"
                  className="h-9 w-72 max-w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Nickname</label>
                <input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Optional"
                  className="h-9 w-48 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 text-sm"
                />
              </div>
              <Button type="button" onClick={() => void handleAdd()} disabled={adding || !newAddress.trim()}>
                {adding ? "Adding…" : "Add wallet"}
              </Button>
            </div>

            <div className="overflow-x-auto border border-zinc-200 dark:border-zinc-700 rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/80 text-left">
                    <th className="p-2">Nickname</th>
                    <th className="p-2">Address</th>
                    <th className="p-2">Active</th>
                    <th className="p-2">Global</th>
                    <th className="p-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {wallets.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-muted-foreground">
                        No wallets yet. Paste addresses from research tools (e.g. public leaderboards); verify before adding.
                      </td>
                    </tr>
                  ) : (
                    wallets.map((w) => (
                      <tr key={w.id} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="p-2">{w.nickname || "—"}</td>
                        <td className="p-2 font-mono text-xs break-all">{w.address}</td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={w.active}
                            onChange={(e) => void patchWallet(w.address, { active: e.target.checked })}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={w.global}
                            onChange={(e) => void patchWallet(w.address, { global: e.target.checked })}
                          />
                        </td>
                        <td className="p-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deleting === w.address}
                            onClick={() => void handleDelete(w.address)}
                          >
                            {deleting === w.address ? "…" : "Delete"}
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              In-app: Crypto Futures → Nova Polymarket Bot → <strong>Nova Polymarket Tracker</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
