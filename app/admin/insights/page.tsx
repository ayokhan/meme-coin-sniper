"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BarChart3, Globe, MapPin, Calendar, Smartphone, FileText, Monitor } from "lucide-react";

type Insights = {
  days: number;
  all?: boolean;
  date?: string | null;
  total: number;
  byCountry: [string, number][];
  byCity: [string, number][];
  byDate: [string, number][];
  byDevice: [string, number][];
  byPath: [string, number][];
  byBrowser: [string, number][];
  byOs: [string, number][];
};

export default function AdminInsightsPage() {
  const { data: session, status } = useSession();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"date" | "range" | "all">("date");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10)); // today YYYY-MM-DD
  const [days, setDays] = useState(30);

  const loadInsights = () => {
    setLoading(true);
    setError("");
    const url = viewMode === "all"
      ? "/api/admin/insights?all=1"
      : viewMode === "date"
        ? `/api/admin/insights?date=${selectedDate}`
        : `/api/admin/insights?days=${days}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setInsights(data);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadInsights();
  }, [status, viewMode, selectedDate, days]);

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view App Insights."}
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
        <div className="flex flex-wrap gap-4 mb-4">
          <Link href="/admin/customers" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Customers
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker
          </Link>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-cyan-500" />
              <CardTitle>App Insights</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">View</span>
              <select
                value={viewMode === "all" ? "all" : viewMode === "date" ? "date" : `range-${days}`}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "all") {
                    setViewMode("all");
                  } else if (v === "date") {
                    setViewMode("date");
                    setSelectedDate(new Date().toISOString().slice(0, 10));
                  } else {
                    setViewMode("range");
                    setDays(Number(v.replace("range-", "")));
                  }
                }}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              >
                <option value="date">Specific date</option>
                <option value="range-7">Last 7 days</option>
                <option value="range-30">Last 30 days</option>
                <option value="range-90">Last 90 days</option>
                <option value="all">All</option>
              </select>
              {viewMode === "date" && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
                />
              )}
              <button
                type="button"
                onClick={loadInsights}
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Refresh
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Where visitors are from, what device they use, and which pages they view. Only visible to owners (OWNER_EMAIL).
            </p>
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : insights ? (
              <>
                {insights.all && (
                  <p className="text-sm text-muted-foreground">Viewing: All time</p>
                )}
                {insights.date && !insights.all && (
                  <p className="text-sm text-muted-foreground">
                    Viewing: {new Date(insights.date + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  </p>
                )}
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  Total page views: {insights.total.toLocaleString()}
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      <Globe className="h-4 w-4" /> By country
                    </h3>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-2 px-3 font-medium">Country</th>
                            <th className="text-right py-2 px-3 font-medium">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.byCountry.slice(0, 15).map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      <MapPin className="h-4 w-4" /> By city
                    </h3>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-2 px-3 font-medium">City</th>
                            <th className="text-right py-2 px-3 font-medium">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(insights.byCity ?? []).slice(0, 15).map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    <Calendar className="h-4 w-4" /> By date
                  </h3>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-2 px-3 font-medium">Date</th>
                          <th className="text-right py-2 px-3 font-medium">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(insights.byDate ?? []).map(([dateStr, count]) => (
                          <tr key={dateStr} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 px-3">{new Date(dateStr + "T12:00:00").toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" })}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      <Smartphone className="h-4 w-4" /> By device
                    </h3>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-2 px-3 font-medium">Device</th>
                            <th className="text-right py-2 px-3 font-medium">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.byDevice.map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                    <FileText className="h-4 w-4" /> By page (path)
                  </h3>
                  <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                          <th className="text-left py-2 px-3 font-medium">Path</th>
                          <th className="text-right py-2 px-3 font-medium">Views</th>
                        </tr>
                      </thead>
                      <tbody>
                        {insights.byPath.slice(0, 20).map(([path, count]) => (
                          <tr key={path} className="border-b border-zinc-100 dark:border-zinc-800">
                            <td className="py-2 px-3 font-mono text-xs">{path || "/"}</td>
                            <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      By browser
                    </h3>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-2 px-3 font-medium">Browser</th>
                            <th className="text-right py-2 px-3 font-medium">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.byBrowser.slice(0, 10).map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  <div>
                    <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      <Monitor className="h-4 w-4" /> By OS
                    </h3>
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                            <th className="text-left py-2 px-3 font-medium">OS</th>
                            <th className="text-right py-2 px-3 font-medium">Views</th>
                          </tr>
                        </thead>
                        <tbody>
                          {insights.byOs.slice(0, 10).map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
        <p className="mt-4 text-sm text-muted-foreground">
          <Link href="/" className="underline">Back to app</Link>
        </p>
      </div>
    </div>
  );
}
