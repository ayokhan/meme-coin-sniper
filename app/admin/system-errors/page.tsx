"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import AdminPageHeader from "@/components/admin/AdminPageHeader";

type SystemError = {
  id: string;
  source: string;
  message: string;
  detail: string | null;
  meta: string | null;
  createdAt: string;
};

export default function AdminSystemErrorsPage() {
  const { data: session, status } = useSession();
  const isOwner = !!(session?.user as { isOwner?: boolean } | undefined)?.isOwner;
  const [errors, setErrors] = useState<SystemError[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "150" });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/system-errors?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Failed to load");
      setErrors(data.errors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [q]);

  useEffect(() => {
    if (status === "authenticated" && isOwner) void load();
  }, [status, isOwner, load]);

  const clearOld = async () => {
    setNotice("");
    try {
      const res = await fetch("/api/admin/system-errors?days=30", { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? "Clear failed");
      setNotice(`Cleared ${data.deleted} error(s) older than ${data.days} days.`);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clear failed");
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

  return (
    <div className="max-w-5xl space-y-6">
      <AdminPageHeader
        title="System error log"
        description="Cron failures, Stripe webhook errors, unhandled API/route crashes, and email send failures — not just VIP trial mail."
      />

      {notice && <p className="text-sm text-emerald-600 dark:text-emerald-400">{notice}</p>}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <label className="text-xs text-muted-foreground flex flex-col gap-1 min-w-[200px] flex-1">
            Source contains
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. cron, stripe, route, email"
              className="text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
            />
          </label>
          <Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}>
            {loading ? "Loading…" : "Refresh"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void clearOld()}>
            Clear older than 30d
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Errors {loading ? "" : `(${errors.length})`}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Sources look like <code className="text-[10px]">cron.scan</code>,{" "}
            <code className="text-[10px]">stripe.webhook</code>,{" "}
            <code className="text-[10px]">route.action</code>,{" "}
            <code className="text-[10px]">cron.vipTrialEmails</code>.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : errors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No system errors logged yet.</p>
          ) : (
            <ul className="space-y-2 max-h-[70vh] overflow-y-auto text-sm">
              {errors.map((e) => (
                <li
                  key={e.id}
                  className="rounded-lg border border-rose-200/80 dark:border-rose-900/50 px-3 py-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-medium text-rose-800 dark:text-rose-200">{e.source}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-xs mt-1">{e.message}</p>
                  {(e.detail || e.meta) && (
                    <button
                      type="button"
                      className="text-[11px] text-cyan-600 dark:text-cyan-400 mt-1 hover:underline"
                      onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                    >
                      {expanded === e.id ? "Hide detail" : "Show detail"}
                    </button>
                  )}
                  {expanded === e.id && (
                    <div className="mt-1 space-y-1">
                      {e.detail ? (
                        <pre className="text-[10px] whitespace-pre-wrap break-words text-muted-foreground bg-zinc-50 dark:bg-zinc-900/60 rounded p-2 max-h-48 overflow-y-auto">
                          {e.detail}
                        </pre>
                      ) : null}
                      {e.meta ? (
                        <pre className="text-[10px] whitespace-pre-wrap break-words text-muted-foreground bg-zinc-50 dark:bg-zinc-900/60 rounded p-2 max-h-40 overflow-y-auto">
                          {e.meta}
                        </pre>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
