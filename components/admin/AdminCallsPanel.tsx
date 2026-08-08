"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscoveryCallCompletionRow } from "@/lib/discovery-call-completions";
import type { PaidStrategyCallConfigAdmin, PaidStrategyCallOrderRow } from "@/lib/paid-strategy-call";

const inputClass =
  "text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 w-full";

type Props = {
  onNotice?: (msg: string) => void;
  onError?: (msg: string) => void;
};

export default function AdminCallsPanel({ onNotice, onError }: Props) {
  const [completions, setCompletions] = useState<DiscoveryCallCompletionRow[]>([]);
  const [orders, setOrders] = useState<PaidStrategyCallOrderRow[]>([]);
  const [cfg, setCfg] = useState<PaidStrategyCallConfigAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftEmail, setDraftEmail] = useState("");
  const [draftPhone, setDraftPhone] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [draftDate, setDraftDate] = useState(() => new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes] = await Promise.all([
        fetch("/api/admin/discovery-completions", { credentials: "include" }),
        fetch("/api/admin/paid-strategy-call", { credentials: "include" }),
      ]);
      const cData = await cRes.json();
      const pData = await pRes.json();
      if (cRes.ok && cData.success) setCompletions(cData.completions ?? []);
      else onError?.(cData.error || "Could not load Discovery completions.");
      if (pRes.ok && pData.success) {
        setCfg(pData.config ?? null);
        setOrders(pData.orders ?? []);
      } else onError?.(pData.error || "Could not load Strategy call settings.");
    } catch {
      onError?.("Could not load calls data.");
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveConfig = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/paid-strategy-call", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: cfg.enabled,
          showNavButton: cfg.showNavButton,
          priceUsd: cfg.priceUsd,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setCfg(data.config);
        onNotice?.("Strategy call settings saved.");
      } else onError?.(data.error || "Save failed.");
    } catch {
      onError?.("Save failed.");
    } finally {
      setSaving(false);
    }
  };

  const addCompletion = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/discovery-completions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draftName,
          email: draftEmail || null,
          phone: draftPhone || null,
          notes: draftNotes,
          completedAt: draftDate ? new Date(draftDate).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setDraftName("");
        setDraftEmail("");
        setDraftPhone("");
        setDraftNotes("");
        onNotice?.("Discovery completion logged.");
        await load();
      } else onError?.(data.error || "Could not add.");
    } catch {
      onError?.("Could not add.");
    } finally {
      setSaving(false);
    }
  };

  const removeCompletion = async (id: string) => {
    if (!confirm("Delete this Discovery completion?")) return;
    try {
      const res = await fetch(`/api/admin/discovery-completions?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotice?.("Deleted.");
        await load();
      } else onError?.(data.error || "Delete failed.");
    } catch {
      onError?.("Delete failed.");
    }
  };

  const setOrderStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch("/api/admin/paid-strategy-call", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, status }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        onNotice?.(`Order marked ${status}.`);
        await load();
      } else onError?.(data.error || "Update failed.");
    } catch {
      onError?.("Update failed.");
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Paid Strategy call</CardTitle>
          <p className="text-sm text-muted-foreground">
            ${cfg?.priceUsd ?? 200}/hour · Stripe pay first · you schedule manually within 24h. Turn off anytime.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {cfg && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, enabled: e.target.checked })}
                />
                Enabled (checkout + page purchase)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={cfg.showNavButton}
                  disabled={!cfg.enabled}
                  onChange={(e) => setCfg({ ...cfg, showNavButton: e.target.checked })}
                />
                Show “Strategy call” in dashboard nav
              </label>
              <label className="flex flex-col gap-1 text-sm max-w-[140px]">
                Price (USD)
                <input
                  type="number"
                  min={1}
                  max={10000}
                  className={inputClass}
                  value={cfg.priceUsd}
                  onChange={(e) => setCfg({ ...cfg, priceUsd: Number(e.target.value) || 200 })}
                />
              </label>
              <Button type="button" size="sm" disabled={saving} onClick={() => void saveConfig()}>
                {saving ? "Saving…" : "Save Strategy settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy call payments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paid orders — contact by email/phone within 24 hours, then mark contacted or completed.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No Strategy call payments yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-2">When</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Contact</th>
                    <th className="py-2 pr-2">$</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">
                        {o.paidAt ? new Date(o.paidAt).toLocaleString() : new Date(o.createdAt).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">{o.name}</td>
                      <td className="py-2 pr-2 text-xs">
                        <div>{o.email}</div>
                        <div>{o.phone}</div>
                      </td>
                      <td className="py-2 pr-2">${o.amountUsd.toFixed(0)}</td>
                      <td className="py-2 pr-2">{o.status}</td>
                      <td className="py-2 space-x-1 whitespace-nowrap">
                        {o.status === "paid" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void setOrderStatus(o.id, "contacted")}>
                            Contacted
                          </Button>
                        )}
                        {(o.status === "paid" || o.status === "contacted") && (
                          <Button type="button" size="sm" variant="outline" onClick={() => void setOrderStatus(o.id, "completed")}>
                            Completed
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Discovery call completions</CardTitle>
          <p className="text-sm text-muted-foreground">
            Manually log people who finished a complimentary Discovery call (for your records).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-2">
            <input className={inputClass} placeholder="Name *" value={draftName} onChange={(e) => setDraftName(e.target.value)} />
            <input className={inputClass} placeholder="Email" value={draftEmail} onChange={(e) => setDraftEmail(e.target.value)} />
            <input className={inputClass} placeholder="Phone" value={draftPhone} onChange={(e) => setDraftPhone(e.target.value)} />
            <input className={inputClass} type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} />
            <input
              className={`${inputClass} sm:col-span-2`}
              placeholder="Notes"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
            />
          </div>
          <Button type="button" size="sm" disabled={saving || !draftName.trim()} onClick={() => void addCompletion()}>
            Add completion
          </Button>

          {completions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completions logged yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-2">Date</th>
                    <th className="py-2 pr-2">Name</th>
                    <th className="py-2 pr-2">Contact</th>
                    <th className="py-2 pr-2">Notes</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {completions.map((c) => (
                    <tr key={c.id} className="border-b border-zinc-100 dark:border-zinc-800 align-top">
                      <td className="py-2 pr-2 whitespace-nowrap text-xs">
                        {new Date(c.completedAt).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-2">{c.name}</td>
                      <td className="py-2 pr-2 text-xs">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                      </td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">{c.notes || "—"}</td>
                      <td className="py-2">
                        <Button type="button" size="sm" variant="ghost" onClick={() => void removeCompletion(c.id)}>
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
