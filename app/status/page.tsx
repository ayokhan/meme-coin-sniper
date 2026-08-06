"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import SiteInstagramFooter from "@/components/SiteInstagramFooter";

type Service = { name: string; status: "ok" | "degraded" | "error" | "skip"; message: string };

export default function StatusPage() {
  const { data: session, status: authStatus } = useSession();
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isOwner = !!session?.user && (session.user as { isOwner?: boolean }).isOwner === true;

  const fetchStatus = () => {
    setLoading(true);
    setError(null);
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        if (d.success && Array.isArray(d.services)) setServices(d.services);
        else setError(d.error ?? "Failed to load status");
      })
      .catch(() => setError("Failed to load status"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isOwner) fetchStatus();
    else setLoading(false);
  }, [isOwner]);

  const statusColor = (status: Service["status"]) => {
    switch (status) {
      case "ok": return "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50";
      case "degraded": return "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50";
      case "error": return "text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50";
      default: return "text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/50";
    }
  };

  const statusLabel = (status: Service["status"]) => {
    switch (status) {
      case "ok": return "OK";
      case "degraded": return "Degraded";
      case "error": return "Error";
      default: return "Skipped";
    }
  };

  if (authStatus === "loading" || !isOwner) {
    return (
      <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
        <div className="max-w-lg mx-auto">
          <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
            <Zap className="h-5 w-5 text-amber-500" />
            NovaStaris
          </Link>
          <Card className="border-zinc-200 dark:border-zinc-800">
            <CardHeader>
              <CardTitle>API status</CardTitle>
              <p className="text-sm text-muted-foreground">
                {authStatus === "loading" ? "Loading…" : "Owner only. Sign in with an owner account to view."}
              </p>
            </CardHeader>
            {authStatus !== "loading" && (
              <CardContent>
                <Button asChild variant="outline" size="sm">
                  <Link href={authStatus === "unauthenticated" ? "/signin" : "/"}>{authStatus === "unauthenticated" ? "Sign in" : "Back to app"}</Link>
                </Button>
              </CardContent>
            )}
          </Card>
          <p className="mt-4 text-sm text-muted-foreground">
            <Link href="/" className="underline hover:no-underline">Back to app</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-lg mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>API status</CardTitle>
            <p className="text-sm text-muted-foreground">
              Quick health check for integrations used by the app. Refresh to re-check.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-sm text-muted-foreground">Checking…</p>
            ) : (
              <ul className="space-y-2">
                {services.map((s) => (
                  <li
                    key={s.name}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${statusColor(s.status)}`}
                  >
                    <span className="font-medium">{s.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="font-medium">{statusLabel(s.status)}</span>
                      <span className="text-xs opacity-90">· {s.message}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Button variant="outline" size="sm" onClick={fetchStatus} disabled={loading} className="mt-2">
              Refresh
            </Button>
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline hover:no-underline">Back to app</Link>
        </p>
        <SiteInstagramFooter className="border-0 pt-4 pb-0" />
      </div>
    </div>
  );
}
