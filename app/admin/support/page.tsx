"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap } from "lucide-react";

type Ticket = {
  id: string;
  supportNumber: string;
  title: string;
  message: string;
  name: string;
  email: string;
  source: string;
  createdAt: string;
};

export default function AdminSupportPage() {
  const { data: session, status } = useSession();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    setError("");
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setTickets(data.tickets ?? []);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view support tickets."}
            {!session && (
              <p className="mt-2">
                <Link href="/register" className="underline">Sign in</Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6">
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <div className="flex gap-4 mb-4 flex-wrap">
          <Link href="/admin/customers" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Customers
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker
          </Link>
          <Link href="/admin/feature-flags" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Feature flags
          </Link>
          <Link href="/admin/chat" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Live chat
          </Link>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader>
            <CardTitle>Admin — Support tickets</CardTitle>
            <p className="text-sm text-muted-foreground">
              All messages sent via the support form and from chat when you were offline.
            </p>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : (
              <div className="space-y-4">
                {tickets.length === 0 && !error && (
                  <p className="py-6 text-muted-foreground">No support tickets yet.</p>
                )}
                {tickets.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900/50"
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">
                        {t.supportNumber}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                      {t.source === "chat" && (
                        <span className="text-xs px-2 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                          From chat
                        </span>
                      )}
                    </div>
                    <h3 className="font-medium text-zinc-900 dark:text-zinc-100 mb-1">{t.title}</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap mb-2">
                      {t.message}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t.name} — {t.email}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
