"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const POLL_MS = 45_000;

type AccessRequestRow = {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  createdAt: string;
  alreadyGranted: boolean;
};

export default function AdminFeatureAccessRequestNotifier() {
  const { data: session, status } = useSession();
  const isOwner = !!session?.user?.isOwner;
  const seenIdsRef = useRef<Set<string>>(new Set());
  const [banners, setBanners] = useState<AccessRequestRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const dismiss = useCallback((id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/feature-access-requests?feature=coach_calls&status=pending", {
        cache: "no-store",
        credentials: "include",
      });
      const data = await res.json();
      if (!data?.success || !Array.isArray(data.requests)) return;
      const rows = data.requests as AccessRequestRow[];
      const fresh = rows.filter((r) => !seenIdsRef.current.has(r.id));
      for (const r of fresh) seenIdsRef.current.add(r.id);
      if (fresh.length > 0) {
        setBanners((prev) => {
          const ids = new Set(prev.map((p) => p.id));
          const next = [...prev];
          for (const r of fresh) {
            if (!ids.has(r.id)) next.push(r);
          }
          return next.slice(-8);
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const r of fresh) {
            const who = r.userEmail || r.userName || "A VIP user";
            try {
              new Notification("Coach Calls access request", {
                body: `${who} requested Coach Calls access.`,
              });
            } catch {
              /* ignore */
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "default") return;
    void Notification.requestPermission();
  }, [status, isOwner]);

  useEffect(() => {
    if (status !== "authenticated" || !isOwner) return;
    void load();
    const interval = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(interval);
  }, [status, isOwner, load]);

  const grant = async (row: AccessRequestRow) => {
    setBusyId(row.id);
    try {
      const res = await fetch("/api/admin/feature-access-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, action: "grant" }),
      });
      const data = await res.json();
      if (data.success) dismiss(row.id);
    } catch {
      /* ignore */
    } finally {
      setBusyId(null);
    }
  };

  if (!isOwner || banners.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[80] flex flex-col gap-2 max-w-sm w-[min(100vw-2rem,24rem)]">
      {banners.map((b) => {
        const who = b.userEmail || b.userName || "VIP user";
        return (
          <div
            key={b.id}
            className="rounded-xl border border-cyan-300/80 dark:border-cyan-700 bg-white dark:bg-zinc-900 shadow-lg p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Coach Calls request</p>
                <p className="text-xs text-muted-foreground truncate">{who}</p>
              </div>
              <button
                type="button"
                aria-label="Dismiss"
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                onClick={() => dismiss(b.id)}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busyId === b.id} onClick={() => void grant(b)}>
                {busyId === b.id ? "…" : "Grant access"}
              </Button>
              <Button size="sm" variant="outline" asChild>
                <Link href="/admin/customers">Customers</Link>
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
