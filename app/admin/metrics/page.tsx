"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Zap, BarChart3, Sparkles, Bell, Users, CalendarDays, TrendingUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type AiAgentFunnelStats = {
  periodDays: number;
  periodStart: string;
  registered: number;
  activated: number;
  limited: number;
  subscribed: number;
  activatedPct: number;
  limitedPct: number;
  subscribedPct: number;
  limitedOfActivatedPct: number;
};

type UsageReportPeriod = "month" | "day";

type UsageReportUser = {
  userId: string;
  email: string | null;
  name: string | null;
  subscriptionTier: string | null;
  aiAnalyses: number;
  alerts: number;
};

type UsageReport = {
  period: UsageReportPeriod;
  periodKey: string;
  periodLabel: string;
  monthKey: string;
  dailyAiTrackingNote: string | null;
  totalUsers: number;
  usersWithActivity: number;
  totalAiAnalyses: number;
  totalAlerts: number;
  users: UsageReportUser[];
};

function getDefaultMonthKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function getDefaultDayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AdminMetricsPage() {
  const { data: session, status } = useSession();
  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active">("all");
  const [period, setPeriod] = useState<UsageReportPeriod>("month");
  const [monthKey, setMonthKey] = useState(getDefaultMonthKey);
  const [dayKey, setDayKey] = useState(getDefaultDayKey);
  const [funnelDays, setFunnelDays] = useState(30);
  const [funnel, setFunnel] = useState<AiAgentFunnelStats | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(true);

  const loadFunnel = useCallback(() => {
    if (status !== "authenticated") return;
    setFunnelLoading(true);
    fetch(`/api/admin/funnel?days=${funnelDays}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.funnel) setFunnel(data.funnel);
        else setFunnel(null);
      })
      .catch(() => setFunnel(null))
      .finally(() => setFunnelLoading(false));
  }, [status, funnelDays]);

  const loadReport = useCallback(() => {
    if (status !== "authenticated") return;
    setLoading(true);
    const params = new URLSearchParams({ period });
    if (period === "month") params.set("month", monthKey);
    else params.set("day", dayKey);

    fetch(`/api/admin/metrics?${params}`)
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
  }, [status, period, monthKey, dayKey]);

  useEffect(() => {
    if (status !== "authenticated") {
      setLoading(false);
      setFunnelLoading(false);
      return;
    }
    loadFunnel();
    loadReport();
  }, [status, loadFunnel, loadReport]);

  if (status === "loading" || (loading && !report)) {
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

  const periodDescription =
    report?.period === "day"
      ? `Platform-wide usage for ${report.periodLabel}. Every registered user is listed; AI analyses and alerts (meme coin + leverage) for that day.`
      : `Platform-wide usage for ${report?.periodLabel ?? "this month"}. Every registered user is listed; AI analyses and alerts (meme coin + leverage) for the month.`;

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

        {(funnelLoading || funnel) && (
          <Card className="border-cyan-200/80 dark:border-cyan-800/60 mb-6">
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-cyan-500" />
                  <CardTitle>AI Agent conversion funnel</CardTitle>
                </div>
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  Cohort window
                  <select
                    value={funnelDays}
                    onChange={(e) => setFunnelDays(Number(e.target.value))}
                    className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
                  >
                    <option value={7}>Last 7 days</option>
                    <option value={14}>Last 14 days</option>
                    <option value={30}>Last 30 days</option>
                    <option value={90}>Last 90 days</option>
                  </select>
                </label>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Users who registered in the selected window. Activated = ran Meme or Chart Analysis. Limited = free user hit daily quota at least once. Subscribed = active VIP now.
              </p>
            </CardHeader>
            <CardContent>
              {funnelLoading ? (
                <p className="text-sm text-muted-foreground">Loading funnel…</p>
              ) : funnel ? (
                <>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Registered", value: funnel.registered, pct: null },
                      { label: "Activated", value: funnel.activated, pct: funnel.activatedPct },
                      { label: "Hit limit", value: funnel.limited, pct: funnel.limitedPct },
                      { label: "VIP (active)", value: funnel.subscribed, pct: funnel.subscribedPct },
                    ].map((item) => (
                      <div key={item.label} className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-900/50 p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wide">{item.label}</p>
                        <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">{item.value}</p>
                        {item.pct != null && funnel.registered > 0 && (
                          <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-1">{item.pct}% of registered</p>
                        )}
                      </div>
                    ))}
                  </div>
                  {funnel.activated > 0 && (
                    <p className="text-xs text-muted-foreground mt-4">
                      {funnel.limitedOfActivatedPct}% of activated free users hit their daily limit at least once.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Could not load funnel data.</p>
              )}
            </CardContent>
          </Card>
        )}

        {report && (
          <>
            <Card className="border-zinc-200 dark:border-zinc-800 mb-6">
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-cyan-500" />
                    <CardTitle>Usage report</CardTitle>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5">
                      <Button
                        type="button"
                        size="sm"
                        variant={period === "month" ? "default" : "ghost"}
                        className="h-8"
                        onClick={() => setPeriod("month")}
                      >
                        Monthly
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={period === "day" ? "default" : "ghost"}
                        className="h-8"
                        onClick={() => setPeriod("day")}
                      >
                        Daily
                      </Button>
                    </div>
                    {period === "month" ? (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <input
                          type="month"
                          value={monthKey}
                          onChange={(e) => setMonthKey(e.target.value)}
                          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                    ) : (
                      <label className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-4 w-4 shrink-0" />
                        <input
                          type="date"
                          value={dayKey}
                          onChange={(e) => setDayKey(e.target.value)}
                          className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-sm text-zinc-900 dark:text-zinc-100"
                        />
                      </label>
                    )}
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{periodDescription}</p>
                {report.dailyAiTrackingNote && (
                  <p className="text-xs text-slate-600 dark:text-slate-300 bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50 rounded-md px-3 py-2 mt-2">
                    {report.dailyAiTrackingNote}
                  </p>
                )}
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
                    {loading && <span className="ml-2 text-xs">(refreshing…)</span>}
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
