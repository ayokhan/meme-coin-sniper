"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { canViewAdminAffiliateSession } from "@/lib/admin-access";

type Row = {
  id: string;
  referrerEmail: string | null;
  referrerName: string | null;
  referrerCode: string | null;
  refereeEmail: string | null;
  refereeName: string | null;
  subscriptionAmountUsd: number;
  commissionRatePct: number;
  commissionAmountUsd: number;
  status: string;
  statusLabel: string;
  paidAt: string | null;
  createdAt: string;
};

export default function AdminAffiliatesPage() {
  const { data: session, status } = useSession();
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [stats, setStats] = useState({ count: 0, pendingUsd: 0, paidUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const allowed = canViewAdminAffiliateSession(session);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (month) params.set("month", month);
      if (date) params.set("date", date);
      if (statusFilter) params.set("status", statusFilter);
      const qs = params.toString();
      const res = await fetch(`/api/admin/affiliates${qs ? `?${qs}` : ""}`, { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Failed to load.");
        return;
      }
      setRows(data.commissions ?? []);
      setCanEdit(!!data.canEdit);
      setStats(data.stats ?? { count: 0, pendingUsd: 0, paidUsd: 0 });
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [month, date, statusFilter]);

  useEffect(() => {
    if (status === "authenticated" && allowed) void load();
    if (status === "authenticated" && !allowed) setLoading(false);
  }, [status, allowed, load]);

  const markPaid = async (id: string) => {
    if (!canEdit || !window.confirm("Mark this commission as paid?")) return;
    setSavingId(id);
    try {
      const res = await fetch(`/api/admin/affiliates/${encodeURIComponent(id)}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Update failed.");
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground py-8">Loading…</p>;
  }

  if (!allowed) {
    return (
      <Card className="max-w-lg">
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          You do not have access to affiliate records.{" "}
          <Link href="/admin" className="underline text-cyan-600">
            Admin hub
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="Affiliate program"
        description="Review referral commissions for weekly Friday payouts. Owner can mark rows as paid after verifying the VIP subscription was not refunded."
      />

      {!canEdit && (
        <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-950/20 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Read-only view — only the owner can mark commissions as paid.
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/50 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid sm:grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Records (filtered)</p>
            <p className="text-2xl font-bold">{stats.count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Pending payout</p>
            <p className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-300">
              ${stats.pendingUsd.toFixed(2)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Marked paid</p>
            <p className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">
              ${stats.paidUsd.toFixed(2)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-3">
          <CardTitle className="text-base">Referral commissions</CardTitle>
          <div className="flex flex-wrap gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
            >
              <option value="">All statuses</option>
              <option value="pending_verification">Pending verification</option>
              <option value="paid">Paid</option>
            </select>
            <input
              type="month"
              value={month}
              onChange={(e) => {
                setMonth(e.target.value);
                setDate("");
              }}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No commission records for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-3">Referrer</th>
                    <th className="py-2 pr-3">Invitee</th>
                    <th className="py-2 pr-3">VIP $</th>
                    <th className="py-2 pr-3">Commission</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Date</th>
                    {canEdit && <th className="py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-zinc-100 dark:border-zinc-800/80 align-top">
                      <td className="py-2.5 pr-3">
                        <p>{r.referrerName || r.referrerEmail || "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.referrerCode ?? ""}</p>
                      </td>
                      <td className="py-2.5 pr-3">{r.refereeName || r.refereeEmail || "—"}</td>
                      <td className="py-2.5 pr-3 font-mono">${r.subscriptionAmountUsd}</td>
                      <td className="py-2.5 pr-3 font-mono">
                        ${r.commissionAmountUsd.toFixed(2)} ({r.commissionRatePct}%)
                      </td>
                      <td className="py-2.5 pr-3">{r.statusLabel}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {new Date(r.createdAt).toLocaleString()}
                      </td>
                      {canEdit && (
                        <td className="py-2.5">
                          {r.status === "pending_verification" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingId === r.id}
                              onClick={() => void markPaid(r.id)}
                            >
                              {savingId === r.id ? "…" : "Mark paid"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {r.paidAt ? new Date(r.paidAt).toLocaleDateString() : "Paid"}
                            </span>
                          )}
                        </td>
                      )}
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
