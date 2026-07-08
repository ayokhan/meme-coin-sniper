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

type LinkedRow = {
  refereeId: string;
  refereeEmail: string | null;
  refereeName: string | null;
  refereeRegisteredAt: string;
  referrerEmail: string | null;
  referrerName: string | null;
  referrerCode: string | null;
  hasCommission: boolean;
};

export default function AdminAffiliatesPage() {
  const { data: session, status } = useSession();
  const [month, setMonth] = useState("");
  const [date, setDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [linkedRows, setLinkedRows] = useState<LinkedRow[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [stats, setStats] = useState({ count: 0, pendingUsd: 0, paidUsd: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [linkReferrer, setLinkReferrer] = useState("");
  const [linkReferee, setLinkReferee] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [linkMessage, setLinkMessage] = useState<string | null>(null);

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
      setLinkedRows(data.linkedReferrals ?? []);
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

  const syncCommission = async (refereeId: string, refereeEmail: string | null) => {
    if (!canEdit) return;
    setSavingId(refereeId);
    try {
      const res = await fetch("/api/admin/affiliates/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refereeQuery: refereeEmail || refereeId }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.error ?? "Sync failed.");
        return;
      }
      await load();
    } finally {
      setSavingId(null);
    }
  };

  const submitManualLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setLinkSaving(true);
    setLinkMessage(null);
    try {
      const res = await fetch("/api/admin/affiliates/link", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referrerQuery: linkReferrer.trim(),
          refereeQuery: linkReferee.trim(),
          notes: linkNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLinkMessage(data.error ?? "Link failed.");
        return;
      }
      setLinkMessage(data.message ?? "Referral linked.");
      setLinkReferrer("");
      setLinkReferee("");
      setLinkNotes("");
      await load();
    } catch {
      setLinkMessage("Network error.");
    } finally {
      setLinkSaving(false);
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

      {error && (
        <div className="rounded-lg border border-rose-200 dark:border-rose-800 bg-rose-50/50 p-3 text-sm text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {canEdit && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manually link referral</CardTitle>
            <p className="text-sm text-muted-foreground">
              Use when you verified someone was invited but did not use the referral link at signup. Creates a
              commission if the invitee has VIP (including admin grants).
            </p>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => void submitManualLink(e)} className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Referrer (email or code)
                  <input
                    value={linkReferrer}
                    onChange={(e) => setLinkReferrer(e.target.value)}
                    placeholder="referrer@email.com or 3fNcdD"
                    className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
                    required
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Invitee (email)
                  <input
                    value={linkReferee}
                    onChange={(e) => setLinkReferee(e.target.value)}
                    placeholder="invitee@email.com"
                    className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
                    required
                  />
                </label>
              </div>
              <label className="text-xs text-muted-foreground flex flex-col gap-1">
                Notes (optional)
                <input
                  value={linkNotes}
                  onChange={(e) => setLinkNotes(e.target.value)}
                  placeholder="Verified via support ticket #123"
                  className="text-sm rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-1.5"
                />
              </label>
              {linkMessage && (
                <p className={`text-sm ${linkMessage.includes("failed") || linkMessage.includes("not found") ? "text-rose-600" : "text-emerald-600"}`}>
                  {linkMessage}
                </p>
              )}
              <Button type="submit" size="sm" disabled={linkSaving}>
                {linkSaving ? "Linking…" : "Link referral & create commission"}
              </Button>
            </form>
          </CardContent>
        </Card>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Linked referrals</CardTitle>
          <p className="text-sm text-muted-foreground">
            Users attributed to a referrer. If VIP was granted manually and no commission appears above, use
            &quot;Create commission&quot;.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : linkedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No linked referrals for this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                    <th className="py-2 pr-3">Referrer</th>
                    <th className="py-2 pr-3">Invitee</th>
                    <th className="py-2 pr-3">Registered</th>
                    <th className="py-2 pr-3">Commission</th>
                    {canEdit && <th className="py-2">Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {linkedRows.map((r) => (
                    <tr key={r.refereeId} className="border-b border-zinc-100 dark:border-zinc-800/80 align-top">
                      <td className="py-2.5 pr-3">
                        <p>{r.referrerName || r.referrerEmail || "—"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.referrerCode ?? ""}</p>
                      </td>
                      <td className="py-2.5 pr-3">{r.refereeName || r.refereeEmail || "—"}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">
                        {new Date(r.refereeRegisteredAt).toLocaleString()}
                      </td>
                      <td className="py-2.5 pr-3">
                        {r.hasCommission ? (
                          <span className="text-emerald-600 dark:text-emerald-400">Yes</span>
                        ) : (
                          <span className="text-amber-600 dark:text-amber-400">Missing</span>
                        )}
                      </td>
                      {canEdit && (
                        <td className="py-2.5">
                          {!r.hasCommission ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={savingId === r.refereeId}
                              onClick={() => void syncCommission(r.refereeId, r.refereeEmail)}
                            >
                              {savingId === r.refereeId ? "…" : "Create commission"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
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
