"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import AdminPageHeader from "@/components/admin/AdminPageHeader";
import type { RealtorOsConfigPublic } from "@/lib/realtor-os-config";

type FormState = {
  clientName: string;
  mode: "test" | "live";
  approveBeforeSend: boolean;
  notes: string;
  bookingLink: string;
  emailProvider: "gmail" | "outlook" | "other";
  emailAddress: string;
  emailSecret: string;
  phoneProvider: "twilio" | "other";
  phoneNumber: string;
  phoneAccountSid: string;
  phoneAuthToken: string;
  calendarProvider: "google" | "outlook" | "other";
  calendarId: string;
  calendarSecret: string;
};

function fromPublic(c: RealtorOsConfigPublic): FormState {
  return {
    clientName: c.clientName,
    mode: c.mode,
    approveBeforeSend: c.approveBeforeSend,
    notes: c.notes,
    bookingLink: c.bookingLink,
    emailProvider: c.email.provider,
    emailAddress: c.email.address,
    emailSecret: c.email.secretMasked || "",
    phoneProvider: c.phone.provider,
    phoneNumber: c.phone.number,
    phoneAccountSid: c.phone.accountSidMasked || "",
    phoneAuthToken: c.phone.authTokenMasked || "",
    calendarProvider: c.calendar.provider,
    calendarId: c.calendar.calendarId,
    calendarSecret: c.calendar.secretMasked || "",
  };
}

export default function AdminRealtorOsPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [form, setForm] = useState<FormState | null>(null);
  const [meta, setMeta] = useState<{ updatedAt: string | null; status: RealtorOsConfigPublic["connectionStatus"] | null }>({
    updatedAt: null,
    status: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/realtor-os", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      const cfg = data.config as RealtorOsConfigPublic;
      setForm(fromPublic(cfg));
      setMeta({ updatedAt: cfg.updatedAt, status: cfg.connectionStatus });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner]);

  const save = async (opts?: { reset?: boolean }) => {
    if (!form && !opts?.reset) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const body = opts?.reset
        ? { resetToDefault: true }
        : {
            clientName: form!.clientName,
            mode: form!.mode,
            approveBeforeSend: form!.approveBeforeSend,
            notes: form!.notes,
            bookingLink: form!.bookingLink,
            email: {
              provider: form!.emailProvider,
              address: form!.emailAddress,
              secret: form!.emailSecret,
            },
            phone: {
              provider: form!.phoneProvider,
              number: form!.phoneNumber,
              accountSid: form!.phoneAccountSid,
              authToken: form!.phoneAuthToken,
            },
            calendar: {
              provider: form!.calendarProvider,
              calendarId: form!.calendarId,
              secret: form!.calendarSecret,
            },
          };
      const res = await fetch("/api/admin/realtor-os", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Save failed");
      const cfg = data.config as RealtorOsConfigPublic;
      setForm(fromPublic(cfg));
      setMeta({ updatedAt: cfg.updatedAt, status: cfg.connectionStatus });
      setNotice(opts?.reset ? "Reset to defaults." : "Saved. Leave masked secrets unchanged to keep existing values.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6">
        <AdminPageHeader title="Realtor OS" description="Loading…" />
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="p-6">
        <AdminPageHeader title="Realtor OS" description="Owner only." />
        <p className="text-sm text-muted-foreground mt-4">
          <Link href="/admin" className="underline">
            Back to admin
          </Link>
        </p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="p-6">
        <AdminPageHeader title="Realtor OS" description={error || "No config"} />
        <Button type="button" className="mt-4" onClick={() => void load()}>
          Retry
        </Button>
      </div>
    );
  }

  const field = (label: string, children: ReactNode) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );

  const inputClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100";

  return (
    <div className="p-4 sm:p-6 max-w-3xl space-y-6">
      <AdminPageHeader
        title="Realtor OS"
        description="Test email / phone / calendar credentials for the realtor AI ops prototype. Swap to live later without rewriting the app."
      />

      <div className="rounded-lg border border-amber-200/80 dark:border-amber-800/50 bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-100 space-y-2">
        <p>
          <strong>Demo setup (Gmail):</strong> turn on 2-Step Verification → Google Account → Security → App passwords →
          create one for Mail → paste the 16-character password into <em>Secret</em> below (not your normal Gmail
          password). Then open the desk tab → <strong>Test login</strong> → <strong>Sync inbox + draft</strong>.
        </p>
        <p className="text-xs opacity-90">
          Mode <strong>test</strong> vs <strong>live</strong> is a label for you — both use the credentials you save here.
          Swap the address/secret when you move from your demo inbox to the realtor&apos;s inbox.
        </p>
        {meta.updatedAt && (
          <span className="block text-xs opacity-80">Last saved {new Date(meta.updatedAt).toLocaleString()}</span>
        )}
      </div>

      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Client & mode</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {field(
            "Client name",
            <input
              className={inputClass}
              value={form.clientName}
              onChange={(e) => setForm({ ...form, clientName: e.target.value })}
              placeholder="Realtor or brokerage name"
            />
          )}
          <div className="grid sm:grid-cols-2 gap-3">
            {field(
              "Mode",
              <select
                className={inputClass}
                value={form.mode}
                onChange={(e) => setForm({ ...form, mode: e.target.value as "test" | "live" })}
              >
                <option value="test">Test (sandbox)</option>
                <option value="live">Live (production)</option>
              </select>
            )}
            <label className="flex items-center gap-2 pt-6 text-sm">
              <input
                type="checkbox"
                checked={form.approveBeforeSend}
                onChange={(e) => setForm({ ...form, approveBeforeSend: e.target.checked })}
              />
              Approve email drafts before send
            </label>
          </div>
          {field(
            "Booking link (optional fallback)",
            <input
              className={inputClass}
              value={form.bookingLink}
              onChange={(e) => setForm({ ...form, bookingLink: e.target.value })}
              placeholder="https://calendly.com/…"
            />
          )}
          {field(
            "Internal notes",
            <textarea
              className={inputClass}
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Email</span>
            <span className="text-xs font-normal text-muted-foreground">
              {meta.status?.email === "configured" ? "Configured" : "Empty"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field(
              "Provider",
              <select
                className={inputClass}
                value={form.emailProvider}
                onChange={(e) => setForm({ ...form, emailProvider: e.target.value as FormState["emailProvider"] })}
              >
                <option value="gmail">Gmail</option>
                <option value="outlook">Outlook</option>
                <option value="other">Other</option>
              </select>
            )}
            {field(
              "Address",
              <input
                className={inputClass}
                value={form.emailAddress}
                onChange={(e) => setForm({ ...form, emailAddress: e.target.value })}
                placeholder="ops-test@…"
              />
            )}
          </div>
          {field(
            "Secret / app password (leave masked to keep)",
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={form.emailSecret}
              onChange={(e) => setForm({ ...form, emailSecret: e.target.value })}
              placeholder="••••"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Phone / SMS</span>
            <span className="text-xs font-normal text-muted-foreground">
              {meta.status?.phone === "configured" ? "Configured" : "Empty"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field(
              "Provider",
              <select
                className={inputClass}
                value={form.phoneProvider}
                onChange={(e) => setForm({ ...form, phoneProvider: e.target.value as FormState["phoneProvider"] })}
              >
                <option value="twilio">Twilio</option>
                <option value="other">Other</option>
              </select>
            )}
            {field(
              "Number",
              <input
                className={inputClass}
                value={form.phoneNumber}
                onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                placeholder="+1…"
              />
            )}
          </div>
          {field(
            "Account SID (leave masked to keep)",
            <input
              className={inputClass}
              value={form.phoneAccountSid}
              onChange={(e) => setForm({ ...form, phoneAccountSid: e.target.value })}
              placeholder="••••"
            />
          )}
          {field(
            "Auth token (leave masked to keep)",
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={form.phoneAuthToken}
              onChange={(e) => setForm({ ...form, phoneAuthToken: e.target.value })}
              placeholder="••••"
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2">
            <span>Calendar</span>
            <span className="text-xs font-normal text-muted-foreground">
              {meta.status?.calendar === "configured" ? "Configured" : "Empty"}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            {field(
              "Provider",
              <select
                className={inputClass}
                value={form.calendarProvider}
                onChange={(e) =>
                  setForm({ ...form, calendarProvider: e.target.value as FormState["calendarProvider"] })
                }
              >
                <option value="google">Google</option>
                <option value="outlook">Outlook</option>
                <option value="other">Other</option>
              </select>
            )}
            {field(
              "Calendar ID",
              <input
                className={inputClass}
                value={form.calendarId}
                onChange={(e) => setForm({ ...form, calendarId: e.target.value })}
                placeholder="primary or calendar email"
              />
            )}
          </div>
          {field(
            "OAuth / service secret (leave masked to keep)",
            <input
              className={inputClass}
              type="password"
              autoComplete="off"
              value={form.calendarSecret}
              onChange={(e) => setForm({ ...form, calendarSecret: e.target.value })}
              placeholder="••••"
            />
          )}
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={saving} onClick={() => void save()} className="bg-cyan-600 hover:bg-cyan-500 text-white">
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={async () => {
            setError("");
            setNotice("");
            setSaving(true);
            try {
              const body = {
                clientName: form.clientName,
                mode: form.mode,
                approveBeforeSend: form.approveBeforeSend,
                notes: form.notes,
                bookingLink: form.bookingLink,
                email: {
                  provider: form.emailProvider,
                  address: form.emailAddress,
                  secret: form.emailSecret,
                },
                phone: {
                  provider: form.phoneProvider,
                  number: form.phoneNumber,
                  accountSid: form.phoneAccountSid,
                  authToken: form.phoneAuthToken,
                },
                calendar: {
                  provider: form.calendarProvider,
                  calendarId: form.calendarId,
                  secret: form.calendarSecret,
                },
              };
              const saveRes = await fetch("/api/admin/realtor-os", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const saveData = await saveRes.json();
              if (!saveData.success) throw new Error(saveData.error ?? "Save failed");
              const cfg = saveData.config as RealtorOsConfigPublic;
              setForm(fromPublic(cfg));
              setMeta({ updatedAt: cfg.updatedAt, status: cfg.connectionStatus });

              const res = await fetch("/api/admin/realtor-os/sync", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "test" }),
              });
              const data = await res.json();
              if (!data.success) throw new Error(data.error ?? "Connection failed");
              setNotice("Saved. Mailbox login OK.");
            } catch (e) {
              setError(e instanceof Error ? e.message : "Save/test failed");
            } finally {
              setSaving(false);
            }
          }}
        >
          Save & test login
        </Button>
        <Button type="button" variant="outline" disabled={saving} onClick={() => void load()}>
          Reload
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          onClick={() => {
            if (confirm("Reset all Realtor OS config to defaults?")) void save({ reset: true });
          }}
        >
          Reset defaults
        </Button>
        <Button asChild variant="outline">
          <Link href="/?tab=realtor-os">Open desk</Link>
        </Button>
      </div>
    </div>
  );
}
