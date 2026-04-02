"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  BarChart3,
  Users,
  Wallet,
  Flag,
  MessageCircle,
  Lightbulb,
  Headphones,
  Activity,
} from "lucide-react";

type Ticket = {
  id: string;
  supportNumber: string;
  title: string;
  status: string;
  createdAt: string;
};

const RECENT_TICKETS = 8;

export default function AdminHubPage() {
  const { data: session, status } = useSession();
  const [recentTickets, setRecentTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;
    setTicketsLoading(true);
    fetch("/api/admin/support")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.tickets)) {
          const sorted = [...data.tickets].sort(
            (a: Ticket, b: Ticket) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
          setRecentTickets(sorted.slice(0, RECENT_TICKETS));
        }
      })
      .catch(() => {})
      .finally(() => setTicketsLoading(false));
  }, [status]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view Nova Admin."}
            {!session && (
              <p className="mt-2">
                <Link href="/signin" className="underline">
                  Sign in
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const links = [
    { href: "/admin/insights", label: "App insights", icon: BarChart3 },
    { href: "/admin/metrics", label: "Metrics", icon: BarChart3 },
    { href: "/admin/customers", label: "Customers", icon: Users },
    { href: "/admin/nova-scalper", label: "NovaScalper", icon: Activity },
    { href: "/admin/wallet-tracker", label: "Wallet Tracker", icon: Wallet },
    { href: "/admin/leverage-wallet-tracker", label: "Leverage Wallet Tracker", icon: Wallet },
    { href: "/admin/feature-flags", label: "Feature flags", icon: Flag },
    { href: "/admin/support", label: "Support", icon: Headphones },
    { href: "/admin/chat", label: "Chat", icon: MessageCircle },
    { href: "/admin/ai-feedback", label: "AI Feedback", icon: Lightbulb },
  ];

  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-lg font-bold text-zinc-900 dark:text-zinc-100 mb-6"
        >
          <Zap className="h-5 w-5 text-amber-500" />
          NovaStaris
        </Link>
        <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
          <CardHeader>
            <CardTitle className="text-xl">Nova Admin hub</CardTitle>
            <p className="text-sm text-muted-foreground">
              Central links for insights, metrics, customers, NovaScalper, wallet tracking, feature flags, support, and chat.
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {links.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 px-4 py-3 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                >
                  <Icon className="h-5 w-5 text-cyan-500 shrink-0" />
                  <span className="font-medium">{label}</span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg">Recent support tickets</CardTitle>
            <Link
              href="/admin/support"
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
            >
              View all
            </Link>
          </CardHeader>
          <CardContent>
            {ticketsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : recentTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tickets yet.</p>
            ) : (
              <ul className="space-y-2">
                {recentTickets.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href="/admin/support"
                      className="text-zinc-700 dark:text-zinc-300 hover:underline truncate min-w-0"
                    >
                      <span className="font-mono text-zinc-500 dark:text-zinc-400 mr-2 shrink-0">
                        #{t.supportNumber}
                      </span>
                      <span className="truncate">{t.title || "No title"}</span>
                    </Link>
                    <span
                      className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                        t.status === "resolved"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200"
                      }`}
                    >
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
