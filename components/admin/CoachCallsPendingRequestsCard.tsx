"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
};

export default function CoachCallsPendingRequestsCard({ onGranted }: { onGranted?: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/feature-access-requests?feature=coach_calls&status=pending", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (data?.success && Array.isArray(data.requests)) {
        setRows(data.requests as Row[]);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grant = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/feature-access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "grant" }),
      });
      const data = await res.json();
      if (data.success) {
        setRows((prev) => prev.filter((r) => r.id !== id));
        onGranted?.();
      }
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  const dismiss = async (id: string) => {
    setBusyId(id);
    try {
      const res = await fetch("/api/admin/feature-access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      const data = await res.json();
      if (data.success) setRows((prev) => prev.filter((r) => r.id !== id));
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  if (loading && rows.length === 0) return null;
  if (rows.length === 0) return null;

  return (
    <Card className="border-amber-200/80 dark:border-amber-900/50 bg-amber-50/40 dark:bg-amber-950/20 mb-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Coach Calls access requests ({rows.length})</CardTitle>
        <p className="text-sm text-muted-foreground">
          VIP users asked for Coach Calls. Grant to enable their tab content, or dismiss.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((r) => {
          const who = r.userEmail || r.userName || r.userId;
          return (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200/70 dark:border-amber-900/40 bg-white/80 dark:bg-zinc-900/50 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{who}</p>
                <p className="text-[11px] text-muted-foreground">
                  {new Date(r.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" disabled={busyId === r.id} onClick={() => void grant(r.id)}>
                  {busyId === r.id ? "…" : "Grant"}
                </Button>
                <Button size="sm" variant="outline" disabled={busyId === r.id} onClick={() => void dismiss(r.id)}>
                  Dismiss
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
