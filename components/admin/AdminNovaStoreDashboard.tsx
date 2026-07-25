"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatStoreMoney } from "@/lib/nova-store/constants";
import { CHARITY_PURPOSE_STORE, CHARITY_PURPOSE_VIP } from "@/lib/nova-store/metrics";

type StoreSummary = {
  paidOrders: number;
  itemsSold: number;
  revenueCents: number;
  sickKidsOwedCents: number;
  sickKidsRemittedCents: number;
  sickKidsOutstandingCents: number;
};

type VipSummary = {
  purchases: number;
  sickKidsOwedCents: number;
  sickKidsRemittedCents: number;
  sickKidsOutstandingCents: number;
};

type SaleRow = {
  id: string;
  email: string;
  buyerName: string | null;
  status: string;
  totalCents: number;
  currency: string;
  itemCount: number;
  sickKidsCents: number;
  items: string[];
  shipSummary: string;
  paidAt: string | null;
  createdAt: string;
};

type Remittance = {
  id: string;
  purpose: string;
  amountCents: number;
  unitsCovered: number | null;
  notes: string | null;
  paidAt: string;
};

type Props = {
  onError: (msg: string) => void;
  onOk: (msg: string) => void;
};

export default function AdminNovaStoreDashboard({ onError, onOk }: Props) {
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [vip, setVip] = useState<VipSummary | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [rates, setRates] = useState({ perStoreItemUsd: 2, perVipUsd: 5 });
  const [busy, setBusy] = useState(false);
  const [storeNotes, setStoreNotes] = useState("");
  const [vipNotes, setVipNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/nova-store/dashboard", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onError(data.error || "Could not load dashboard.");
        return;
      }
      setStore(data.store);
      setVip(data.vip);
      setSales(data.sales ?? []);
      setRemittances(data.remittances ?? []);
      if (data.rates) setRates(data.rates);
    } catch {
      onError("Could not load dashboard.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- avoid reload loop from inline onError
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const markSent = async (purpose: string, outstandingCents: number, notes: string) => {
    if (outstandingCents <= 0) {
      onError("Nothing outstanding to mark as sent.");
      return;
    }
    const usd = (outstandingCents / 100).toFixed(2);
    if (!confirm(`Mark $${usd} as sent to SickKids?`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/nova-store/dashboard", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          amountCents: outstandingCents,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onError(data.error || "Could not record remittance.");
        return;
      }
      onOk(`Recorded $${usd} sent to SickKids.`);
      if (purpose === CHARITY_PURPOSE_STORE) setStoreNotes("");
      else setVipNotes("");
      await load();
    } catch {
      onError("Could not record remittance.");
    } finally {
      setBusy(false);
    }
  };

  const undoRemittance = async (id: string) => {
    if (!confirm("Remove this remittance record?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/nova-store/dashboard", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onError(data.error || "Could not undo.");
        return;
      }
      onOk("Remittance removed.");
      await load();
    } catch {
      onError("Could not undo.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !store) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Items sold</p>
            <p className="text-2xl font-bold tabular-nums">{store?.itemsSold ?? 0}</p>
            <p className="text-xs text-muted-foreground">{store?.paidOrders ?? 0} paid orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Store revenue</p>
            <p className="text-2xl font-bold tabular-nums">
              {formatStoreMoney(store?.revenueCents ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              SickKids owed (store)
            </p>
            <p className="text-2xl font-bold tabular-nums text-sky-700 dark:text-sky-300">
              {formatStoreMoney(store?.sickKidsOwedCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              ${rates.perStoreItemUsd} × {store?.itemsSold ?? 0} items
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Outstanding to send
            </p>
            <p className="text-2xl font-bold tabular-nums text-amber-700 dark:text-amber-300">
              {formatStoreMoney(store?.sickKidsOutstandingCents ?? 0)}
            </p>
            <p className="text-xs text-muted-foreground">
              Sent so far {formatStoreMoney(store?.sickKidsRemittedCents ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold text-sm">Store → SickKids</h3>
            <p className="text-xs text-muted-foreground">
              After you donate to SickKids for store sales, mark it here so the outstanding balance updates.
            </p>
            <label className="block text-xs text-muted-foreground">
              Note (optional)
              <input
                className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                value={storeNotes}
                onChange={(e) => setStoreNotes(e.target.value)}
                placeholder="e.g. SickKids Foundation receipt #…"
              />
            </label>
            <Button
              type="button"
              size="sm"
              disabled={busy || (store?.sickKidsOutstandingCents ?? 0) <= 0}
              onClick={() =>
                void markSent(
                  CHARITY_PURPOSE_STORE,
                  store?.sickKidsOutstandingCents ?? 0,
                  storeNotes
                )
              }
            >
              Mark{" "}
              {formatStoreMoney(store?.sickKidsOutstandingCents ?? 0)} as sent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold text-sm">VIP → SickKids</h3>
            <p className="text-xs text-muted-foreground">
              {vip?.purchases ?? 0} VIP purchases recorded · owed{" "}
              {formatStoreMoney(vip?.sickKidsOwedCents ?? 0)} (${rates.perVipUsd} each) ·
              outstanding {formatStoreMoney(vip?.sickKidsOutstandingCents ?? 0)}
            </p>
            <label className="block text-xs text-muted-foreground">
              Note (optional)
              <input
                className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                value={vipNotes}
                onChange={(e) => setVipNotes(e.target.value)}
                placeholder="e.g. Monthly VIP giving remittance"
              />
            </label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={busy || (vip?.sickKidsOutstandingCents ?? 0) <= 0}
              onClick={() =>
                void markSent(CHARITY_PURPOSE_VIP, vip?.sickKidsOutstandingCents ?? 0, vipNotes)
              }
            >
              Mark {formatStoreMoney(vip?.sickKidsOutstandingCents ?? 0)} as sent
            </Button>
          </CardContent>
        </Card>
      </div>

      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="font-semibold text-sm">Paid purchases</h3>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        {sales.length === 0 ? (
          <p className="text-sm text-muted-foreground">No paid store orders yet.</p>
        ) : (
          <div className="space-y-2">
            {sales.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-3 pb-3 text-sm space-y-1">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {s.buyerName ? `${s.buyerName} · ` : ""}
                        {s.email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.paidAt
                          ? new Date(s.paidAt).toLocaleString()
                          : new Date(s.createdAt).toLocaleString()}{" "}
                        · <span className="uppercase">{s.status}</span>
                      </p>
                    </div>
                    <div className="text-right tabular-nums">
                      <p className="font-semibold">{formatStoreMoney(s.totalCents, s.currency)}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.itemCount} item{s.itemCount === 1 ? "" : "s"} · SickKids{" "}
                        {formatStoreMoney(s.sickKidsCents)}
                      </p>
                    </div>
                  </div>
                  <ul className="text-xs text-muted-foreground list-disc list-inside">
                    {s.items.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                  {s.shipSummary && (
                    <p className="text-xs text-muted-foreground">Ship: {s.shipSummary}</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {remittances.length > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-2">Remittance history</h3>
          <div className="space-y-2">
            {remittances.map((r) => (
              <div
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs"
              >
                <div>
                  <p className="font-medium">
                    {formatStoreMoney(r.amountCents)} ·{" "}
                    {r.purpose === CHARITY_PURPOSE_VIP ? "VIP" : "Store"}
                    {r.unitsCovered != null ? ` · ${r.unitsCovered} units` : ""}
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(r.paidAt).toLocaleString()}
                    {r.notes ? ` · ${r.notes}` : ""}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={busy}
                  onClick={() => void undoRemittance(r.id)}
                >
                  Undo
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
