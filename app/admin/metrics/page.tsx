"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, BarChart3, Sparkles, Bell, Users } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UsageReportUser = {
  userId: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  aiAnalyses: number;
  alerts: number;
};

type UsageReport = {
  monthKey: string;
  startOfMonth: string;
  totalUsers: number;
  usersWithActivity: number;
  totalAiAnalyses: number;
  totalAlerts: number;
  users: UsageReportUser[];
};

function formatMonthKey(key: string): string {
  const [y, m] = key.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1);
  return date.toLocaleString("default", { month: "long", year: "numeric" });
}

export default function AdminMetricsPage() {
  const { data: session, status } = useSession();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active">("all");

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      return;
    }
    fetch("/api/admin/metrics")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error === "Forbidden." ? "Owner access required." : data.error);
          setReport(null);
        } else {
          setReport(data);
          setError("");
        }
      })
      .catch(() => {
        setError("Failed to load metrics.");
        setReport(null);
      })
      .finally(() => setLoading(false));
  }, [status]);

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl border-zinc-200 dark:border-zinc-800">
          <CardContent className="py-12 text-center text-muted-foreground">
            Loading metrics…
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-md border-zinc-200 dark:border-zinc-800">
          <CardHeader className="text-center">
            <CardTitle>Usage metrics</CardTitle>
            <p className="text-sm text-muted-foreground">Sign in to view.</p>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/signin?callbackUrl=${encodeURIComponent("/admin/metrics")}`}>Sign in</Link>
            </Button>
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
        <div className="flex flex-wrap gap-4 mb-6">
          <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Nova Admin hub
          </Link>
          <Link href="/admin/insights" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Insights
          </Link>
          <Link href="/admin/customers" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Customers
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker
          </Link>
        </div>

        {error && (
          <Card className="border-rose-200 dark:border-rose-800 mb-6">
            <CardContent className="py-4 text-rose-700 dark:text-rose-300">
              {error}
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-cyan-500" />
                  <CardTitle>Usage report</CardTitle>
                </div>
                <p className="text-sm text-muted-foreground">
                  Platform-wide usage for <strong>{formatMonthKey(report.monthKey)}</strong>. Every registered user is listed; AI analyses and alerts (meme coin + leverage) for the month.
                </p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="rounded-xl bg-gradient-to-br from-cyan-50 to-cyan-100/50 dark:from-cyan-950/40 dark:to-cyan-900/20 border border-cyan-200/60 dark:border-cyan-800/50 p-4">
                    <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 mb-1">
                      <Sparkles className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium uppercase tracking-wide">Total AI analyses</span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {report.totalAiAnalyses.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20 border border-violet-200/60 dark:border-violet-800/50 p-4">
                    <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 mb-1">
                      <Bell className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium uppercase tracking-wide">Total alerts</span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {report.totalAlerts.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium uppercase tracking-wide">Total users</span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {report.totalUsers.toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl bg-zinc-100 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 p-4">
                    <div className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 mb-1">
                      <Users className="h-4 w-4 shrink-0" />
                      <span className="text-xs font-medium uppercase tracking-wide">With activity</span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tabular-nums">
                      {report.usersWithActivity.toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    Showing{" "}
                    {filter === "all"
                      ? `${report.users.length} users`
                      : `${report.users.filter((u) => u.aiAnalyses > 0 || u.alerts > 0).length} users with activity`}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={filter === "all" ? "default" : "outline"}
                      onClick={() => setFilter("all")}
                    >
                      All users
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={filter === "active" ? "default" : "outline"}
                      onClick={() => setFilter("active")}
                    >
                      Activity only
                    </Button>
                  </div>
                </div>

                {report.users.length > 0 ? (
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-zinc-50 dark:bg-zinc-800/50">
                          <TableHead className="font-medium">User</TableHead>
                          <TableHead className="font-medium">Plan</TableHead>
                          <TableHead className="text-right font-medium">AI analyses</TableHead>
                          <TableHead className="text-right font-medium">Alerts</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {report.users
                          .filter((u) => filter === "all" || u.aiAnalyses > 0 || u.alerts > 0)
                          .map((u) => (
                          <TableRow key={u.userId} className="border-zinc-200 dark:border-zinc-700">
                            <TableCell className="font-mono text-sm">
                              <Link
                                href="/admin/customers"
                                className="text-cyan-700 dark:text-cyan-300 hover:underline"
                              >
                                {u.email ?? u.name ?? u.userId.slice(0, 8) + "…"}
                              </Link>
                            </TableCell>
                            <TableCell className="text-sm capitalize text-muted-foreground">
                              {u.subscriptionTier ?? "Free"}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">{u.aiAnalyses}</TableCell>
                            <TableCell className="text-right tabular-nums">{u.alerts}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground py-4">No registered users yet.</p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
