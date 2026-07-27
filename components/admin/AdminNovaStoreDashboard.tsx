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
  countedPurchases?: Array<{
    id: string;
    email: string | null;
    name: string | null;
    plan: string | null;
    amountUsd: number;
    paymentMethod: string | null;
    paidAt: string;
  }>;
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
  trackingNumber: string | null;
  shippedEmailSentAt: string | null;
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

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminNovaStoreDashboard({ onError, onOk }: Props) {
  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<StoreSummary | null>(null);
  const [vip, setVip] = useState<VipSummary | null>(null);
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [rates, setRates] = useState({ perStoreItemUsd: 2, perVipUsd: 5 });
  const [vipStartsLocal, setVipStartsLocal] = useState("");
  const [busy, setBusy] = useState(false);
  const [storeNotes, setStoreNotes] = useState("");
  const [vipNotes, setVipNotes] = useState("");
  const [trackingById, setTrackingById] = useState<Record<string, string>>({});

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
      setVipStartsLocal(toDatetimeLocal(data.settings?.vipDonationStartsAt ?? null));
      const track: Record<string, string> = {};
      for (const s of data.sales ?? []) {
        if (s.trackingNumber) track[s.id] = s.trackingNumber;
      }
      setTrackingById(track);
    } catch {
      onError("Could not load dashboard.");
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const saveVipStart = async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/nova-store/dashboard", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vipDonationStartsAt: vipStartsLocal
            ? new Date(vipStartsLocal).toISOString()
            : null,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onError(data.error || "Could not save VIP start date.");
        return;
      }
      onOk("VIP SickKids start date saved — only purchases on/after this date count.");
      await load();
    } catch {
      onError("Could not save VIP start date.");
    } finally {
      setBusy(false);
    }
  };

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

  const shipOrder = async (id: string, notify: boolean) => {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/nova-store/orders", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          status: "fulfilled",
          trackingNumber: trackingById[id] ?? "",
          notifyCustomer: notify,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        onError(data.error || "Could not update order.");
        return;
      }
      if (notify) {
        if (data.emailSent) onOk("Marked shipped and emailed the customer.");
        else onOk(`Marked shipped. Email failed: ${data.emailError || "unknown error"}`);
      } else {
        onOk("Marked as shipped (no email).");
      }
      await load();
    } catch {
      onError("Could not ship order.");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !store) {
    return <p className="text-sm text-muted-foreground">Loading dashboard…</p>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-5 space-y-3">
          <h3 className="font-semibold text-sm">SickKids counting — start dates</h3>
          <p className="text-xs text-muted-foreground">
            VIP giving only counts <strong>card</strong> or <strong>USDC</strong> subscriptions paid on or after the
            date you set. Admin complimentary grants (e.g. 1 month free) are marked separately and never add to
            SickKids owed.
          </p>
          <label className="block text-xs text-muted-foreground max-w-sm">
            VIP SickKids starts at
            <input
              type="datetime-local"
              className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              value={vipStartsLocal}
              onChange={(e) => setVipStartsLocal(e.target.value)}
            />
          </label>
          <Button type="button" size="sm" disabled={busy} onClick={() => void saveVipStart()}>
            Save VIP start date
          </Button>
        </CardContent>
      </Card>

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
              Mark {formatStoreMoney(store?.sickKidsOutstandingCents ?? 0)} as sent
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5 space-y-3">
            <h3 className="font-semibold text-sm">VIP → SickKids</h3>
            <p className="text-xs text-muted-foreground">
              {vip?.purchases ?? 0} paid VIP (card/USDC) since start date · owed{" "}
              {formatStoreMoney(vip?.sickKidsOwedCents ?? 0)} (${rates.perVipUsd} each) ·
              outstanding {formatStoreMoney(vip?.sickKidsOutstandingCents ?? 0)}. Free admin grants excluded.
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
                <CardContent className="pt-3 pb-3 text-sm space-y-2">
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
                        {s.shippedEmailSentAt
                          ? ` · emailed ${new Date(s.shippedEmailSentAt).toLocaleString()}`
                          : ""}
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
                  {(s.status === "paid" || s.status === "fulfilled") && (
                    <div className="flex flex-wrap items-end gap-2 pt-1 border-t border-zinc-200 dark:border-zinc-700">
                      <label className="text-xs text-muted-foreground grow min-w-[140px]">
                        Tracking #
                        <input
                          className="mt-1 w-full rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                          value={trackingById[s.id] ?? ""}
                          onChange={(e) =>
                            setTrackingById((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          placeholder="Optional"
                        />
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={busy}
                        onClick={() => void shipOrder(s.id, true)}
                      >
                        Mark shipped &amp; email
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs"
                        disabled={busy}
                        onClick={() => void shipOrder(s.id, false)}
                      >
                        Ship only
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {(vip?.countedPurchases?.length ?? 0) > 0 && (
        <div>
          <h3 className="font-semibold text-sm mb-2">VIP payments counting toward SickKids</h3>
          <p className="text-xs text-muted-foreground mb-2">Card and USDC only — complimentary admin grants do not appear here.</p>
          <div className="space-y-2">
            {vip!.countedPurchases!.slice(0, 50).map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 dark:border-zinc-700 px-3 py-2 text-xs"
              >
                <span>
                  {p.email || p.name || "—"} · {p.plan ?? "VIP"} ·{" "}
                  <span className="uppercase">{p.paymentMethod ?? "—"}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  ${p.amountUsd} · {new Date(p.paidAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
