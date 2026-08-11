"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, CheckCircle2, Circle, Mail, Phone } from "lucide-react";
import type { RealtorOsConfigPublic } from "@/lib/realtor-os-config";

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  ) : (
    <Circle className="h-4 w-4 text-zinc-400 shrink-0" />
  );
}

export default function RealtorOsPanel() {
  const [config, setConfig] = useState<RealtorOsConfigPublic | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/realtor-os", { cache: "no-store" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setConfig(data.config as RealtorOsConfigPublic);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const emailOk = config?.connectionStatus.email === "configured";
  const phoneOk = config?.connectionStatus.phone === "configured";
  const calOk = config?.connectionStatus.calendar === "configured";

  return (
    <div className="mx-3 sm:mx-6 py-6 sm:py-8 max-w-3xl space-y-6">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-white via-zinc-50 to-amber-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-amber-950/20 p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-amber-600" />
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Realtor OS</h2>
          {config && (
            <span
              className={`text-[11px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${
                config.mode === "test"
                  ? "border-amber-300/70 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40"
                  : "border-emerald-300/70 text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40"
              }`}
            >
              {config.mode} mode
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Owner-only prototype for a realtor AI ops desk (email, SMS/phone, booking). Wire{" "}
          <strong>test</strong> credentials first; swap to live when the client is ready. Not part of the public
          NovaStaris trading product.
        </p>
        {config?.clientName ? (
          <p className="text-sm text-zinc-800 dark:text-zinc-200">
            Client: <span className="font-semibold">{config.clientName}</span>
          </p>
        ) : null}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading connection status…</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {config && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Mail className="h-4 w-4 text-cyan-600" /> Email
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <StatusDot ok={emailOk} />
              {emailOk ? config.email.address : "Not set — add test inbox"}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Phone className="h-4 w-4 text-violet-600" /> Phone / SMS
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <StatusDot ok={phoneOk} />
              {phoneOk ? config.phone.number || "Credentials saved" : "Not set — Twilio trial OK"}
            </div>
          </div>
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Calendar className="h-4 w-4 text-emerald-600" /> Calendar
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <StatusDot ok={calOk} />
              {calOk ? config.calendar.calendarId : "Not set — use a test calendar"}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4 space-y-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">MVP checklist</p>
        <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1.5">
          <li className="flex gap-2">
            <StatusDot ok={emailOk} />
            Test inbox + secret saved
          </li>
          <li className="flex gap-2">
            <StatusDot ok={!!config?.approveBeforeSend} />
            Approve-before-send on (safe default)
          </li>
          <li className="flex gap-2">
            <StatusDot ok={calOk || !!config?.bookingLink} />
            Test calendar or booking link
          </li>
          <li className="flex gap-2">
            <StatusDot ok={phoneOk} />
            Test phone / SMS (phase 1 after-hours; voice later)
          </li>
          <li className="flex gap-2">
            <Circle className="h-4 w-4 text-zinc-400 shrink-0" />
            Ingest + draft replies (next build)
          </li>
          <li className="flex gap-2">
            <Circle className="h-4 w-4 text-zinc-400 shrink-0" />
            Live call + transfer (phase 2)
          </li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="bg-amber-600 hover:bg-amber-500 text-white">
          <Link href="/admin/realtor-os">Edit test credentials</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/admin">Admin hub</Link>
        </Button>
      </div>

      {config?.notes ? (
        <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-amber-300/70 pl-3">{config.notes}</p>
      ) : null}
    </div>
  );
}
