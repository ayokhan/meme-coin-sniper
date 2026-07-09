"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BillingInvoiceRow } from "@/lib/billing-invoices";

function monthOptions(): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [{ value: "", label: "All time" }];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const value = d.toISOString().slice(0, 7);
    const label = d.toLocaleDateString(undefined, { month: "long", year: "numeric", timeZone: "UTC" });
    out.push({ value, label });
  }
  return out;
}

type Props = {
  enabled: boolean;
};

export default function AccountBillingHistory({ enabled }: Props) {
  const [month, setMonth] = useState("");
  const [invoices, setInvoices] = useState<BillingInvoiceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const months = useMemo(() => monthOptions(), []);

  const load = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setError("");
    try {
      const qs = month ? `?month=${encodeURIComponent(month)}` : "";
      const res = await fetch(`/api/user/billing-invoices${qs}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setInvoices(data.invoices ?? []);
      else setError(data.error ?? "Could not load billing history.");
    } catch {
      setError("Could not load billing history.");
    } finally {
      setLoading(false);
    }
  }, [enabled, month]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled) return null;

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-cyan-500" />
              <CardTitle className="text-lg">Billing history</CardTitle>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Your NovaStaris VIP payments. Filter by month — loaded from your account records (no live Stripe calls).
            </p>
          </div>
          <label className="text-xs text-muted-foreground flex flex-col gap-1 min-w-[160px]">
            Billing period
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-900 dark:text-zinc-100"
            >
              {months.map((m) => (
                <option key={m.value || "all"} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
            {error}
          </div>
        )}
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading invoices…</p>
        ) : invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payments found for this period. Older card receipts may also appear in{" "}
            <button type="button" className="text-cyan-600 dark:text-cyan-400 underline-offset-2 hover:underline">
              Stripe billing portal
            </button>{" "}
            via Update payment method above.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-700 text-left text-xs text-muted-foreground">
                  <th className="p-2 font-medium">Date</th>
                  <th className="p-2 font-medium">Description</th>
                  <th className="p-2 font-medium">Amount</th>
                  <th className="p-2 font-medium">Method</th>
                  <th className="p-2 font-medium">Receipt</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv.id} className="border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <td className="p-2 whitespace-nowrap tabular-nums">
                      {new Date(inv.paidAt).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </td>
                    <td className="p-2">{inv.description}</td>
                    <td className="p-2 whitespace-nowrap tabular-nums font-medium">
                      ${inv.amountUsd.toLocaleString()} {inv.currency.toUpperCase()}
                    </td>
                    <td className="p-2 capitalize text-muted-foreground">{inv.paymentMethod ?? "—"}</td>
                    <td className="p-2">
                      {inv.hostedInvoiceUrl || inv.invoicePdfUrl ? (
                        <Link
                          href={inv.hostedInvoiceUrl ?? inv.invoicePdfUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-cyan-600 dark:text-cyan-400 hover:underline text-xs"
                        >
                          View
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
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
  );
}
