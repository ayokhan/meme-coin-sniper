"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { DiscoveryCallCompletionRow } from "@/lib/discovery-call-completions";
import {
  DEFAULT_CONFIRMATION_BODY,
  DEFAULT_CONFIRMATION_SUBJECT,
  DEFAULT_SCHEDULE_BODY,
  DEFAULT_SCHEDULE_SUBJECT,
  previewConfirmationEmail,
  previewScheduleEmail,
  ADMIN_EMAIL_DRAFT_STORAGE_KEY,
  type PaidStrategyCallConfigAdmin,
  type PaidStrategyCallOrderRow,
} from "@/lib/paid-strategy-call";

const inputClass =
  "text-sm border border-zinc-300 dark:border-zinc-600 rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 w-full";

const taClass = `${inputClass} min-h-[160px] font-mono text-xs leading-relaxed`;

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
        const config = pData.config as PaidStrategyCallConfigAdmin;
        setCfg({
          ...config,
          confirmationSubject: config.confirmationSubject || DEFAULT_CONFIRMATION_SUBJECT,
          confirmationBody: config.confirmationBody || DEFAULT_CONFIRMATION_BODY,
          scheduleSubject: config.scheduleSubject || DEFAULT_SCHEDULE_SUBJECT,
          scheduleBody: config.scheduleBody || DEFAULT_SCHEDULE_BODY,
        });
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

  const confirmationPreview = useMemo(
    () => (cfg ? previewConfirmationEmail(cfg) : null),
    [cfg]
  );
  const schedulePreview = useMemo(() => (cfg ? previewScheduleEmail(cfg) : null), [cfg]);

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
          confirmationSubject: cfg.confirmationSubject,
          confirmationBody: cfg.confirmationBody,
          scheduleSubject: cfg.scheduleSubject,
          scheduleBody: cfg.scheduleBody,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const config = data.config as PaidStrategyCallConfigAdmin;
        setCfg({
          ...config,
          confirmationSubject: config.confirmationSubject || DEFAULT_CONFIRMATION_SUBJECT,
          confirmationBody: config.confirmationBody || DEFAULT_CONFIRMATION_BODY,
          scheduleSubject: config.scheduleSubject || DEFAULT_SCHEDULE_SUBJECT,
          scheduleBody: config.scheduleBody || DEFAULT_SCHEDULE_BODY,
        });
        onNotice?.("Strategy call settings & email templates saved.");
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

  const openScheduleEmail = async (orderId: string) => {
    try {
      const res = await fetch("/api/admin/paid-strategy-call", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, personalizeSchedule: true }),
      });
      const data = await res.json();
      if (!res.ok || !data.success || !data.draft) {
        onError?.(data.error || "Could not build schedule email.");
        return;
      }
      const draft = data.draft as { to: string; subject: string; body: string };
      try {
        sessionStorage.setItem(
          ADMIN_EMAIL_DRAFT_STORAGE_KEY,
          JSON.stringify({
            subject: draft.subject,
            body: draft.body,
            recipients: [draft.to],
            template: "nova-branded",
            presetId: "paid-strategy-schedule",
          })
        );
      } catch {
        /* ignore */
      }
      window.location.href = "/admin/emails?preset=paid-strategy-schedule";
    } catch {
      onError?.("Could not open schedule email.");
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
            </>
          )}
        </CardContent>
      </Card>

      {cfg && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Email templates (edit & approve)</CardTitle>
            <p className="text-sm text-muted-foreground">
              Placeholders: {"{{name}}"} {"{{firstName}}"} {"{{phone}}"} {"{{email}}"} {"{{amountUsd}}"}. Save before
              going live. Auto confirmation sends on payment; schedule email you send manually from each paid order.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <p className="text-sm font-medium">1. Auto confirmation (sent right after Stripe payment)</p>
              <input
                className={inputClass}
                value={cfg.confirmationSubject}
                onChange={(e) => setCfg({ ...cfg, confirmationSubject: e.target.value })}
                placeholder="Subject"
              />
              <textarea
                className={taClass}
                value={cfg.confirmationBody}
                onChange={(e) => setCfg({ ...cfg, confirmationBody: e.target.value })}
              />
              {confirmationPreview && (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview (sample customer)
                  </p>
                  <p className="text-sm font-medium">{confirmationPreview.subject}</p>
                  <pre className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 font-sans">
                    {confirmationPreview.body}
                  </pre>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">2. Schedule outreach (you send after payment to book the hour)</p>
              <input
                className={inputClass}
                value={cfg.scheduleSubject}
                onChange={(e) => setCfg({ ...cfg, scheduleSubject: e.target.value })}
                placeholder="Subject"
              />
              <textarea
                className={taClass}
                value={cfg.scheduleBody}
                onChange={(e) => setCfg({ ...cfg, scheduleBody: e.target.value })}
              />
              {schedulePreview && (
                <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Preview (sample customer)
                  </p>
                  <p className="text-sm font-medium">{schedulePreview.subject}</p>
                  <pre className="text-xs whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 font-sans">
                    {schedulePreview.body}
                  </pre>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Also available as preset{" "}
                <Link href="/admin/emails?preset=paid-strategy-schedule" className="underline text-teal-600">
                  Strategy call — schedule session
                </Link>{" "}
                in Admin → Emails.
              </p>
            </div>

            <Button type="button" size="sm" disabled={saving} onClick={() => void saveConfig()}>
              {saving ? "Saving…" : "Save Strategy settings & emails"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Strategy call payments</CardTitle>
          <p className="text-sm text-muted-foreground">
            Paid orders appear here. Confirmation email column shows if the auto email was sent. Use Schedule email to
            reach out and book.
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
                    <th className="py-2 pr-2">Confirm email</th>
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
                      <td className="py-2 pr-2 text-xs">
                        {o.confirmationEmailSentAt ? (
                          <span className="text-emerald-700 dark:text-emerald-300">
                            Sent {new Date(o.confirmationEmailSentAt).toLocaleString()}
                          </span>
                        ) : o.status === "pending" ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className="text-amber-700 dark:text-amber-300">Not logged / failed</span>
                        )}
                      </td>
                      <td className="py-2 space-x-1 whitespace-nowrap">
                        {(o.status === "paid" || o.status === "contacted" || o.status === "completed") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void openScheduleEmail(o.id)}
                          >
                            Schedule email
                          </Button>
                        )}
                        {o.status === "paid" && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void setOrderStatus(o.id, "contacted")}
                          >
                            Contacted
                          </Button>
                        )}
                        {(o.status === "paid" || o.status === "contacted") && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => void setOrderStatus(o.id, "completed")}
                          >
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
            <input
              className={inputClass}
              placeholder="Name *"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
            />
            <input
              className={inputClass}
              placeholder="Phone"
              value={draftPhone}
              onChange={(e) => setDraftPhone(e.target.value)}
            />
            <input
              className={inputClass}
              type="date"
              value={draftDate}
              onChange={(e) => setDraftDate(e.target.value)}
            />
            <input
              className={`${inputClass} sm:col-span-2`}
              placeholder="Notes"
              value={draftNotes}
              onChange={(e) => setDraftNotes(e.target.value)}
            />
          </div>
          <Button
            type="button"
            size="sm"
            disabled={saving || !draftName.trim()}
            onClick={() => void addCompletion()}
          >
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
