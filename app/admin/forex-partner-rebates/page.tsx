"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import {
  REBATE_BROKERS,
  REBATE_REWARD_TYPES,
  REBATE_STATUSES,
  rebateBrokerLabel,
  shortenWallet,
  type RebateBrokerId,
  type RebateRewardType,
  type RebateStatus,
} from "@/lib/forex-partner-rebates";

type Payout = {
  id: string;
  broker: string;
  brokerLabel: string;
  customerName: string;
  customerEmail: string | null;
  userId?: string | null;
  rewardType: string;
  rewardValue: number;
  rewardLabel: string;
  lotsTraded: number | null;
  suggestedAmountUsd: number | null;
  amountPaidUsd: number | null;
  status: string;
  periodNote: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
};

type Enrollment = {
  id: string;
  userId: string;
  broker: string;
  brokerLabel: string;
  customerName: string;
  customerEmail: string;
  mtLogin: string;
  usdcWallet: string;
  rewardType: string;
  rewardValue: number;
  rewardLabel: string;
  createdAt: string;
  updatedAt: string;
};

const inputClass = "mt-1 w-full h-9 rounded border px-2 bg-white dark:bg-zinc-900 text-sm";

export default function AdminForexPartnerRebatesPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [filterBroker, setFilterBroker] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [broker, setBroker] = useState<RebateBrokerId>("tiomarkets");
  const [rewardType, setRewardType] = useState<RebateRewardType>("per_lot");
  const [rewardValue, setRewardValue] = useState("2");
  const [lotsTraded, setLotsTraded] = useState("");
  const [amountPaidUsd, setAmountPaidUsd] = useState("");
  const [status, setStatus] = useState<RebateStatus>("pending");
  const [periodNote, setPeriodNote] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const suggestedAmountUsd =
    rewardType === "per_lot" && lotsTraded !== "" && Number.isFinite(Number(lotsTraded)) && Number.isFinite(Number(rewardValue))
      ? Math.round(Number(lotsTraded) * Number(rewardValue) * 100) / 100
      : null;

  const loadEnrollments = useCallback(async () => {
    try {
      const q = new URLSearchParams();
      if (filterBroker && filterBroker !== "other") q.set("broker", filterBroker);
      const res = await fetch(`/api/admin/forex-partner-rebate-enrollments?${q}`, { credentials: "include" });
      const data = await res.json();
      if (res.ok && data.success) setEnrollments(data.enrollments ?? []);
    } catch {
      /* ignore */
    }
  }, [filterBroker]);

  const load = useCallback(async () => {
    setError(null);
    try {
      const q = new URLSearchParams();
      if (filterBroker) q.set("broker", filterBroker);
      if (filterStatus) q.set("status", filterStatus);
      const res = await fetch(`/api/admin/forex-partner-rebates?${q}`, { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load rebates.");
        return;
      }
      setPayouts(data.payouts ?? []);
    } catch {
      setError("Network error loading rebates.");
    }
  }, [filterBroker, filterStatus]);

  useEffect(() => {
    void load();
    void loadEnrollments();
  }, [load, loadEnrollments]);

  const copyWallet = async (wallet: string) => {
    try {
      await navigator.clipboard.writeText(wallet);
      setNotice("Wallet copied.");
    } catch {
      setError("Could not copy wallet.");
    }
  };

  const prefillFromEnrollment = (e: Enrollment) => {
    setEditingId(null);
    setCustomerName(e.customerName);
    setCustomerEmail(e.customerEmail);
    setUserId(e.userId || "");
    setBroker((REBATE_BROKERS.includes(e.broker as RebateBrokerId) ? e.broker : "other") as RebateBrokerId);
    setRewardType((e.rewardType as RebateRewardType) || "per_lot");
    setRewardValue(String(e.rewardValue || 2));
    setLotsTraded("");
    setAmountPaidUsd("");
    setStatus("pending");
    setPeriodNote("");
    setNotes(`MT login: ${e.mtLogin}\nUSDC wallet: ${e.usdcWallet}`);
    setNotice(`Prefilled payout for ${e.customerName}. Enter lots/period, then Add record.`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const resetForm = () => {
    setEditingId(null);
    setCustomerName("");
    setCustomerEmail("");
    setUserId("");
    setBroker("tiomarkets");
    setRewardType("per_lot");
    setRewardValue("2");
    setLotsTraded("");
    setAmountPaidUsd("");
    setStatus("pending");
    setPeriodNote("");
    setNotes("");
  };

  const editRow = (p: Payout) => {
    setEditingId(p.id);
    setCustomerName(p.customerName);
    setCustomerEmail(p.customerEmail ?? "");
    setUserId(p.userId ?? "");
    setBroker((REBATE_BROKERS.includes(p.broker as RebateBrokerId) ? p.broker : "other") as RebateBrokerId);
    setRewardType((p.rewardType as RebateRewardType) || "usd");
    setRewardValue(String(p.rewardValue));
    setLotsTraded(p.lotsTraded != null ? String(p.lotsTraded) : "");
    setAmountPaidUsd(p.amountPaidUsd != null ? String(p.amountPaidUsd) : "");
    setStatus((p.status as RebateStatus) || "pending");
    setPeriodNote(p.periodNote ?? "");
    setNotes(p.notes ?? "");
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const payload = {
        id: editingId || undefined,
        customerName,
        customerEmail,
        userId: userId.trim() || null,
        broker,
        rewardType,
        rewardValue,
        lotsTraded: lotsTraded === "" ? null : lotsTraded,
        suggestedAmountUsd,
        amountPaidUsd: amountPaidUsd === "" ? null : amountPaidUsd,
        status,
        periodNote,
        notes,
      };
      const res = await fetch("/api/admin/forex-partner-rebates", {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Save failed.");
        return;
      }
      setNotice(editingId ? "Updated." : "Added.");
      resetForm();
      await load();
    } catch {
      setError("Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const markPaid = async (p: Payout) => {
    setBusy(true);
    try {
      const payload: Record<string, unknown> = { id: p.id, status: "paid" };
      if (p.amountPaidUsd == null && p.suggestedAmountUsd != null) {
        payload.amountPaidUsd = p.suggestedAmountUsd;
      }
      const res = await fetch("/api/admin/forex-partner-rebates", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not mark paid.");
        return;
      }
      setNotice("Marked paid.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this rebate record?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/forex-partner-rebates?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Delete failed.");
        return;
      }
      setNotice("Deleted.");
      if (editingId === id) resetForm();
      await load();
    } finally {
      setBusy(false);
    }
  };

  const pendingCount = payouts.filter((p) => p.status === "pending").length;
  const paidTotal = payouts
    .filter((p) => p.status === "paid" && p.amountPaidUsd != null)
    .reduce((sum, p) => sum + (p.amountPaidUsd || 0), 0);

  return (
    <div className="max-w-5xl">
      <AdminPageHeader
        title="Partner rebates"
        description="Users submit MT login + Solana USDC wallet in Nova Forex Bots. You pay $2/lot from IB commission manually, then log it here."
      />
      <div className="space-y-4">
        {error && <p className="text-sm text-rose-600">{error}</p>}
        {notice && <p className="text-sm text-emerald-700 dark:text-emerald-300">{notice}</p>}

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enrollments ({enrollments.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {enrollments.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No user submissions yet. Users enroll under Nova Forex Bots → Submit rebate details.
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Customer</th>
                    <th className="py-2 pr-2">Broker</th>
                    <th className="py-2 pr-2">MT login</th>
                    <th className="py-2 pr-2">USDC wallet</th>
                    <th className="py-2 pr-2">Offer</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {enrollments.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">{e.customerName}</div>
                        <div className="text-muted-foreground">{e.customerEmail}</div>
                      </td>
                      <td className="py-1.5 pr-2">{e.brokerLabel}</td>
                      <td className="py-1.5 pr-2 font-mono">{e.mtLogin}</td>
                      <td className="py-1.5 pr-2">
                        <button
                          type="button"
                          className="font-mono text-left hover:underline"
                          title={e.usdcWallet}
                          onClick={() => void copyWallet(e.usdcWallet)}
                        >
                          {shortenWallet(e.usdcWallet, 6, 6)}
                        </button>
                      </td>
                      <td className="py-1.5 pr-2">{e.rewardLabel}</td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => void copyWallet(e.usdcWallet)}
                          >
                            Copy wallet
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => prefillFromEnrollment(e)}
                          >
                            Create payout
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Pending records</p>
              <p className="text-2xl font-semibold">{pendingCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-xs text-muted-foreground">Paid total (entered $)</p>
              <p className="text-2xl font-semibold">${paidTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{editingId ? "Edit rebate" : "Add rebate"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block text-xs text-muted-foreground">
                Customer name *
                <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              </label>
              <label className="block text-xs text-muted-foreground">
                Email (optional)
                <input
                  type="email"
                  className={inputClass}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                User ID (optional)
                <input
                  className={inputClass}
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  placeholder="From enrollment when available"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Broker
                <select
                  className={inputClass}
                  value={broker}
                  onChange={(e) => setBroker(e.target.value as RebateBrokerId)}
                >
                  {REBATE_BROKERS.map((b) => (
                    <option key={b} value={b}>
                      {rebateBrokerLabel(b)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-muted-foreground">
                  Reward type
                  <select
                    className={inputClass}
                    value={rewardType}
                    onChange={(e) => setRewardType(e.target.value as RebateRewardType)}
                  >
                    {REBATE_REWARD_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block text-xs text-muted-foreground">
                  Value *
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className={inputClass}
                    value={rewardValue}
                    onChange={(e) => setRewardValue(e.target.value)}
                    placeholder={rewardType === "percent" ? "e.g. 25" : "e.g. 2"}
                  />
                </label>
              </div>
              {rewardType === "per_lot" && (
                <div className="grid grid-cols-2 gap-2">
                  <label className="block text-xs text-muted-foreground">
                    Lots traded
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      className={inputClass}
                      value={lotsTraded}
                      onChange={(e) => setLotsTraded(e.target.value)}
                      placeholder="e.g. 12"
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Suggested USD
                    <input
                      readOnly
                      className={`${inputClass} opacity-80`}
                      value={suggestedAmountUsd != null ? suggestedAmountUsd.toFixed(2) : ""}
                      placeholder="lots × value"
                    />
                  </label>
                </div>
              )}
              <label className="block text-xs text-muted-foreground">
                Status
                <select
                  className={inputClass}
                  value={status}
                  onChange={(e) => setStatus(e.target.value as RebateStatus)}
                >
                  {REBATE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Amount paid USD (when you pay them)
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className={inputClass}
                  value={amountPaidUsd}
                  onChange={(e) => setAmountPaidUsd(e.target.value)}
                  placeholder={suggestedAmountUsd != null ? `Suggested $${suggestedAmountUsd.toFixed(2)}` : "Optional until paid"}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Period / lots note
                <input
                  className={inputClass}
                  value={periodNote}
                  onChange={(e) => setPeriodNote(e.target.value)}
                  placeholder="e.g. July 2026 · 12 FX lots"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Notes
                <textarea
                  className="mt-1 w-full min-h-[64px] rounded border px-2 py-1.5 bg-white dark:bg-zinc-900 text-sm"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" disabled={busy || !customerName.trim()} onClick={() => void save()}>
                  {busy ? "Saving…" : editingId ? "Save changes" : "Add record"}
                </Button>
                {editingId && (
                  <Button type="button" size="sm" variant="ghost" onClick={resetForm}>
                    Cancel edit
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block text-xs text-muted-foreground">
                Broker
                <select className={inputClass} value={filterBroker} onChange={(e) => setFilterBroker(e.target.value)}>
                  <option value="">All</option>
                  {REBATE_BROKERS.map((b) => (
                    <option key={b} value={b}>
                      {rebateBrokerLabel(b)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Status
                <select className={inputClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All</option>
                  {REBATE_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Example: you earn $8/lot FX from TIO → share $2/lot with the customer → set reward type “$ per lot”,
                value 2, then enter the USD you actually sent when you mark Paid.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Records ({payouts.length})</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {payouts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rebate records yet.</p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 pr-2">Customer</th>
                    <th className="py-2 pr-2">Broker</th>
                    <th className="py-2 pr-2">Reward</th>
                    <th className="py-2 pr-2">Lots</th>
                    <th className="py-2 pr-2">Suggested</th>
                    <th className="py-2 pr-2">Period</th>
                    <th className="py-2 pr-2">Paid $</th>
                    <th className="py-2 pr-2">Status</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => (
                    <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                      <td className="py-1.5 pr-2">
                        <div className="font-medium">{p.customerName}</div>
                        <div className="text-muted-foreground">{p.customerEmail || "—"}</div>
                      </td>
                      <td className="py-1.5 pr-2">{p.brokerLabel}</td>
                      <td className="py-1.5 pr-2">{p.rewardLabel}</td>
                      <td className="py-1.5 pr-2">{p.lotsTraded != null ? p.lotsTraded : "—"}</td>
                      <td className="py-1.5 pr-2">
                        {p.suggestedAmountUsd != null ? `$${p.suggestedAmountUsd.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-1.5 pr-2">{p.periodNote || "—"}</td>
                      <td className="py-1.5 pr-2">
                        {p.amountPaidUsd != null ? `$${p.amountPaidUsd.toFixed(2)}` : "—"}
                      </td>
                      <td className="py-1.5 pr-2">
                        <span
                          className={
                            p.status === "paid"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-amber-600 dark:text-amber-400"
                          }
                        >
                          {p.status}
                        </span>
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap gap-1">
                          <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => editRow(p)}>
                            Edit
                          </Button>
                          {p.status !== "paid" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px]"
                              disabled={busy}
                              onClick={() => void markPaid(p)}
                            >
                              Mark paid
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-7 text-[11px] text-rose-600"
                            disabled={busy}
                            onClick={() => void remove(p.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
