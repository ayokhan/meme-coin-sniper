"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Building2,
  CheckCircle2,
  Circle,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  SkipForward,
  Sparkles,
} from "lucide-react";
import type { RealtorOsConfigPublic } from "@/lib/realtor-os-config";

type Lead = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  intent: string | null;
  area: string | null;
  status: string;
  notes: string | null;
  updatedAt: string;
};

type Message = {
  id: string;
  leadId: string | null;
  direction: string;
  fromAddress: string;
  toAddress: string;
  subject: string;
  bodyText: string;
  bodyPreview: string;
  receivedAt: string | null;
  draftBody: string | null;
  draftStatus: string;
  sentAt: string | null;
  createdAt: string;
};

function StatusDot({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
  ) : (
    <Circle className="h-4 w-4 text-zinc-400 shrink-0" />
  );
}

export default function RealtorOsPanel() {
  const [config, setConfig] = useState<RealtorOsConfigPublic | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draftEdit, setDraftEdit] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/realtor-os/desk", { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load desk");
      setConfig(data.config as RealtorOsConfigPublic);
      setLeads(Array.isArray(data.leads) ? data.leads : []);
      const msgs = Array.isArray(data.messages) ? (data.messages as Message[]) : [];
      setMessages(msgs);
      setSelectedId((prev) => {
        if (prev && msgs.some((m) => m.id === prev)) return prev;
        const firstInbound = msgs.find((m) => m.direction === "inbound");
        return firstInbound?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selected = useMemo(
    () => messages.find((m) => m.id === selectedId) ?? null,
    [messages, selectedId]
  );

  useEffect(() => {
    setDraftEdit(selected?.draftBody ?? "");
  }, [selected?.id, selected?.draftBody]);

  const emailReady = !!(config?.email.address && config.email.secretSet);

  const runSync = async () => {
    setBusy("sync");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/realtor-os/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync", limit: 15, autoDraft: true }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Sync failed");
      setNotice(
        `Synced: ${data.imported} new · ${data.drafted} drafted · ${data.skipped} skipped (of ${data.fetched} fetched)`
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setBusy("");
    }
  };

  const runTest = async () => {
    setBusy("test");
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/realtor-os/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Connection failed");
      setNotice("Mailbox login OK — ready to sync inbox.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    } finally {
      setBusy("");
    }
  };

  const action = async (payload: Record<string, unknown>, label: string) => {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/realtor-os/actions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Action failed");
      if (label === "send") setNotice("Reply sent.");
      if (label === "draft") setNotice("Draft ready — edit if needed, then Send.");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy("");
    }
  };

  const inbound = messages.filter((m) => m.direction === "inbound");

  return (
    <div className="mx-3 sm:mx-6 py-6 sm:py-8 max-w-6xl space-y-5">
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-gradient-to-br from-white via-zinc-50 to-amber-50/40 dark:from-zinc-900 dark:via-zinc-900 dark:to-amber-950/20 p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">Realtor OS</h2>
            {config && (
              <span
                className={`text-[11px] font-semibold uppercase tracking-wide rounded-full border px-2 py-0.5 ${
                  config.mode === "live"
                    ? "border-emerald-300/70 text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40"
                    : "border-amber-300/70 text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40"
                }`}
              >
                {config.mode}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!!busy || !emailReady} onClick={() => void runTest()}>
              {busy === "test" ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Mail className="h-3.5 w-3.5 mr-1.5" />}
              Test login
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!!busy || !emailReady}
              onClick={() => void runSync()}
              className="bg-amber-600 hover:bg-amber-500 text-white"
            >
              {busy === "sync" ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              )}
              Sync inbox + draft
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/realtor-os">Credentials</Link>
            </Button>
          </div>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Plug in a real Gmail (App Password) under Credentials, then Sync. Review AI drafts and Send — this is the live
          demo loop. Phone/transfer comes next.
        </p>
        {config?.clientName ? (
          <p className="text-sm">
            Desk for <span className="font-semibold">{config.clientName}</span>
            {config.email.address ? (
              <span className="text-zinc-500"> · {config.email.address}</span>
            ) : null}
          </p>
        ) : null}
        <div className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <StatusDot ok={emailReady} />
          {emailReady ? "Mailbox credentials saved" : "Add email + app password in Credentials first"}
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading desk…</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}

      <div className="grid lg:grid-cols-[240px_1fr_1.1fr] gap-4 items-start">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Leads ({leads.length})
          </div>
          <ul className="max-h-[28rem] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {leads.length === 0 && (
              <li className="p-3 text-xs text-muted-foreground">No leads yet — sync inbox after someone emails the desk.</li>
            )}
            {leads.map((l) => (
              <li key={l.id} className="p-3 space-y-1">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{l.name || l.email}</p>
                <p className="text-[11px] text-zinc-500 truncate">{l.email}</p>
                <p className="text-[11px] text-zinc-500">
                  {l.intent ?? "—"} · {l.status}
                  {l.area ? ` · ${l.area}` : ""}
                </p>
                <select
                  className="mt-1 w-full text-xs rounded border border-zinc-300 dark:border-zinc-600 bg-transparent px-1.5 py-1"
                  value={l.status}
                  disabled={!!busy}
                  onChange={(e) =>
                    void action({ action: "lead_status", leadId: l.id, status: e.target.value }, "status")
                  }
                >
                  <option value="new">new</option>
                  <option value="contacted">contacted</option>
                  <option value="booked">booked</option>
                  <option value="closed">closed</option>
                  <option value="spam">spam</option>
                </select>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-700 text-[11px] font-semibold uppercase tracking-wide text-zinc-500">
            Inbox ({inbound.length})
          </div>
          <ul className="max-h-[28rem] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800">
            {inbound.length === 0 && (
              <li className="p-3 text-xs text-muted-foreground">Empty — click Sync inbox + draft.</li>
            )}
            {inbound.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(m.id)}
                  className={`w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/80 ${
                    selectedId === m.id ? "bg-amber-50/80 dark:bg-amber-950/30" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium truncate">{m.fromAddress}</p>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">{m.draftStatus}</span>
                  </div>
                  <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{m.subject}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-2 mt-0.5">{m.bodyPreview}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/80 dark:bg-zinc-950/50 p-4 space-y-3 min-h-[28rem]">
          {!selected ? (
            <p className="text-sm text-muted-foreground">Select an inbound email to review / reply.</p>
          ) : (
            <>
              <div>
                <p className="text-xs text-zinc-500">From {selected.fromAddress}</p>
                <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{selected.subject}</h3>
                {selected.receivedAt && (
                  <p className="text-[11px] text-zinc-500">{new Date(selected.receivedAt).toLocaleString()}</p>
                )}
              </div>
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/60 p-3 max-h-40 overflow-y-auto">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">Inbound</p>
                <pre className="whitespace-pre-wrap text-xs text-zinc-700 dark:text-zinc-300 font-sans">{selected.bodyText}</pre>
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-1">AI draft reply</p>
                <textarea
                  className="w-full min-h-[160px] rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm"
                  value={draftEdit}
                  onChange={(e) => setDraftEdit(e.target.value)}
                  placeholder="Click Draft with AI, or Sync with auto-draft."
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => void action({ action: "draft", messageId: selected.id }, "draft")}
                >
                  {busy === "draft" ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Draft with AI
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy || !draftEdit.trim()}
                  onClick={() =>
                    void action({ action: "save_draft", messageId: selected.id, draftBody: draftEdit }, "save")
                  }
                >
                  Save draft
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy || !draftEdit.trim() || selected.draftStatus === "sent"}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white"
                  onClick={() =>
                    void action({ action: "send", messageId: selected.id, draftBody: draftEdit }, "send")
                  }
                >
                  {busy === "send" ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Send reply
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => void action({ action: "skip", messageId: selected.id }, "skip")}
                >
                  <SkipForward className="h-3.5 w-3.5 mr-1.5" />
                  Skip
                </Button>
              </div>
              {selected.draftStatus === "sent" && selected.sentAt && (
                <p className="text-xs text-emerald-600">Sent {new Date(selected.sentAt).toLocaleString()}</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
