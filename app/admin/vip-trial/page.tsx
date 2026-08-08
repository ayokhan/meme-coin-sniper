"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import { VIP_PLANS } from "@/lib/subscription";
import { VIP_CANCEL_SURVEY_REASONS } from "@/lib/vip-trial-constants";

type Config = {
  enabled: boolean;
  trialDays: number;
  reminderHoursBefore: number;
  planIdAfterTrial: string;
  updatedAt: string | null;
};

type Signup = {
  id: string;
  email: string | null;
  name: string | null;
  plan: string;
  trialEndsAt: string | null;
  expiresAt: string;
  autoRenew: boolean;
  cancelAtPeriodEnd: boolean;
  reminderSent: boolean;
  createdAt: string;
};

type EmailLog = {
  id: string;
  email: string;
  kind: string;
  success: boolean;
  error: string | null;
  meta: string | null;
  createdAt: string;
};

type Survey = {
  id: string;
  email: string | null;
  name: string | null;
  reasons: string[];
  comment: string;
  wasTrial: boolean;
  createdAt: string;
};

export default function AdminVipTrialPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [config, setConfig] = useState<Config | null>(null);
  const [signups, setSignups] = useState<Signup[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vip-trial", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setConfig(data.config);
      setSignups(data.signups ?? []);
      setEmailLogs(data.emailLogs ?? []);
      setSurveys(data.surveys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner, load]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/vip-trial", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      setConfig(data.config);
      setNotice(
        `Saved. New checkouts use ${data.config.trialDays}-day trial; reminder ~${data.config.reminderHoursBefore}h before end.`
      );
      window.setTimeout(() => setNotice(""), 5000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || !session) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">
          {status === "loading" ? "Loading…" : "Sign in required."}
        </CardContent>
      </Card>
    );
  }

  if (!isOwner) {
    return (
      <Card className="max-w-lg mx-auto">
        <CardContent className="py-10 text-center text-muted-foreground">Owner access only.</CardContent>
      </Card>
    );
  }

  const reasonLabel = (id: string) =>
    VIP_CANCEL_SURVEY_REASONS.find((r) => r.id === id)?.label ?? id;

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="VIP trial"
        description="Card-required free VIP trial. Changing days updates Stripe checkout + reminder email copy for new trials."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Settings</CardTitle>
          <p className="text-xs text-muted-foreground">
            In-flight trials keep the days they started with. New checkouts use the values you save here.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading || !config ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded"
                  checked={config.enabled}
                  onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                />
                Enable VIP trial offer (subscribe + lock screens)
              </label>
              <div className="grid sm:grid-cols-3 gap-3">
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Trial days (1–14)
                  <input
                    type="number"
                    min={1}
                    max={14}
                    value={config.trialDays}
                    onChange={(e) => setConfig({ ...config, trialDays: Number(e.target.value) })}
                    className="text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Reminder hours before end
                  <input
                    type="number"
                    min={6}
                    max={72}
                    value={config.reminderHoursBefore}
                    onChange={(e) =>
                      setConfig({ ...config, reminderHoursBefore: Number(e.target.value) })
                    }
                    className="text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                  />
                </label>
                <label className="text-xs text-muted-foreground flex flex-col gap-1">
                  Plan after trial
                  <select
                    value={config.planIdAfterTrial}
                    onChange={(e) => setConfig({ ...config, planIdAfterTrial: e.target.value })}
                    className="text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
                  >
                    {VIP_PLANS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label} (${p.priceUsd})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <Button size="sm" disabled={saving} onClick={() => void save()}>
                {saving ? "Saving…" : "Save settings"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Who started a VIP trial</CardTitle>
        </CardHeader>
        <CardContent>
          {signups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trial signups yet.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto text-sm">
              {signups.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2 flex flex-wrap justify-between gap-2"
                >
                  <div>
                    <p className="font-medium">{s.email ?? s.userId}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Started {new Date(s.createdAt).toLocaleString()} · ends{" "}
                      {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleString() : "—"}
                      {s.cancelAtPeriodEnd ? " · cancelled (no charge)" : ""}
                      {s.reminderSent ? " · reminder sent" : ""}
                    </p>
                  </div>
                  <Link
                    href={`/admin/customers?q=${encodeURIComponent(s.email ?? "")}`}
                    className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline"
                  >
                    Customer →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Trial email log</CardTitle>
          <p className="text-xs text-muted-foreground">
            trial_started (checkout) and trial_reminder (~{config?.reminderHoursBefore ?? 24}h before end).
          </p>
        </CardHeader>
        <CardContent>
          {emailLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trial emails logged yet.</p>
          ) : (
            <ul className="space-y-2 max-h-72 overflow-y-auto text-sm">
              {emailLogs.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium">{e.email}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                        e.success
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                          : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                      }`}
                    >
                      {e.kind} · {e.success ? "sent" : "failed"}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(e.createdAt).toLocaleString()}
                    {e.error ? ` · ${e.error}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cancel surveys</CardTitle>
        </CardHeader>
        <CardContent>
          {surveys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cancel surveys yet.</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-y-auto text-sm">
              {surveys.map((s) => (
                <li
                  key={s.id}
                  className="rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 py-2"
                >
                  <p className="font-medium">
                    {s.email ?? s.userId}
                    {s.wasTrial ? (
                      <span className="ml-2 text-[10px] uppercase tracking-wide text-amber-700 dark:text-amber-300">
                        trial
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs mt-1">{s.reasons.map(reasonLabel).join(" · ") || "—"}</p>
                  {s.comment ? (
                    <p className="text-xs text-muted-foreground mt-1 italic">&ldquo;{s.comment}&rdquo;</p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {new Date(s.createdAt).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
