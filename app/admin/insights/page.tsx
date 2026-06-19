"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, BarChart3, Globe, MapPin, Calendar, Smartphone, FileText, Monitor, X } from "lucide-react";

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

function formatInsightDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

type CityDrillPath = { path: string; label: string; count: number; lastSeen: string };
type CityDrillEvent = {
  path: string;
  pathLabel: string;
  createdAt: string;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  userEmail: string | null;
};
type CityDrill = {
  cityLabel: string;
  total: number;
  byPath: CityDrillPath[];
  recentEvents: CityDrillEvent[];
};

function insightsRangeQuery(viewMode: "date" | "range" | "all", selectedDate: string, days: number) {
  if (viewMode === "all") return "all=1";
  if (viewMode === "date") return `date=${selectedDate}`;
  return `days=${days}`;
}

export default function AdminInsightsPage() {
  const { data: session, status } = useSession();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"date" | "range" | "all">("date");
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10)); // today YYYY-MM-DD
  const [days, setDays] = useState(30);
  const [cityDrill, setCityDrill] = useState<CityDrill | null>(null);
  const [cityDrillLoading, setCityDrillLoading] = useState(false);
  const [cityDrillError, setCityDrillError] = useState("");

  const loadInsights = () => {
    setLoading(true);
    setError("");
    const url = `/api/admin/insights?${insightsRangeQuery(viewMode, selectedDate, days)}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setInsights(data);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  const openCityDrill = (cityLabel: string) => {
    setCityDrillLoading(true);
    setCityDrillError("");
    setCityDrill(null);
    const qs = insightsRangeQuery(viewMode, selectedDate, days);
    fetch(`/api/admin/insights?drill=city&cityLabel=${encodeURIComponent(cityLabel)}&${qs}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setCityDrill({
            cityLabel: data.cityLabel,
            total: data.total,
            byPath: data.byPath,
            recentEvents: data.recentEvents,
          });
        } else {
          setCityDrillError(data.error ?? "Failed to load details");
        }
      })
      .catch(() => setCityDrillError("Failed to load details"))
      .finally(() => setCityDrillLoading(false));
  };

  const closeCityDrill = () => {
    setCityDrill(null);
    setCityDrillError("");
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
                <Link href="/signin" className="underline">Sign in</Link>
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
          <Link href="/admin" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Nova Admin hub
          </Link>
          <Link href="/admin/metrics" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Metrics
          </Link>
          <Link href="/admin/customers" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Customers
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker
          </Link>
          <Link href="/admin/ai-feedback" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            AI Feedback
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
                            <th className="text-right py-2 px-3 font-medium w-28" />
                          </tr>
                        </thead>
                        <tbody>
                          {(insights.byCity ?? []).slice(0, 15).map(([name, count]) => (
                            <tr key={name} className="border-b border-zinc-100 dark:border-zinc-800">
                              <td className="py-2 px-3">{name}</td>
                              <td className="py-2 px-3 text-right tabular-nums">{count.toLocaleString()}</td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => openCityDrill(name)}
                                  className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline font-medium"
                                >
                                  More details
                                </button>
                              </td>
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
                  <p className="text-xs text-muted-foreground mb-2">
                    Main dashboard views are recorded as <span className="font-mono">/?tab=…</span> (plus optional sub-keys like{" "}
                    <span className="font-mono">futures</span>, <span className="font-mono">wallet</span>, <span className="font-mono">forecast</span>) so you can see which screen users opened—not only <span className="font-mono">/</span>.
                  </p>
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

      {(cityDrillLoading || cityDrill || cityDrillError) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="city-drill-title"
          onClick={closeCityDrill}
        >
          <div
            className="relative w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-5 py-4">
              <div>
                <h2 id="city-drill-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {cityDrill ? cityDrill.cityLabel : "Location details"}
                </h2>
                {cityDrill && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {cityDrill.total.toLocaleString()} page view{cityDrill.total === 1 ? "" : "s"} in this period
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={closeCityDrill}
                className="rounded-md p-1.5 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-6">
              {cityDrillLoading && (
                <p className="text-muted-foreground text-sm">Loading page breakdown…</p>
              )}
              {cityDrillError && (
                <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2">
                  {cityDrillError}
                </div>
              )}
              {cityDrill && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      Tabs & pages used
                    </h3>
                    {cityDrill.byPath.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No page views recorded.</p>
                    ) : (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                              <th className="text-left py-2 px-3 font-medium">Screen</th>
                              <th className="text-left py-2 px-3 font-medium hidden sm:table-cell">Path</th>
                              <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Last seen</th>
                              <th className="text-right py-2 px-3 font-medium">Views</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cityDrill.byPath.map((row) => (
                              <tr key={row.path} className="border-b border-zinc-100 dark:border-zinc-800">
                                <td className="py-2 px-3">{row.label}</td>
                                <td className="py-2 px-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">
                                  {row.path}
                                </td>
                                <td className="py-2 px-3 text-xs whitespace-nowrap hidden md:table-cell">
                                  {formatInsightDateTime(row.lastSeen)}
                                </td>
                                <td className="py-2 px-3 text-right tabular-nums">{row.count.toLocaleString()}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-2">
                      Recent activity
                    </h3>
                    {cityDrill.recentEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No recent events.</p>
                    ) : (
                      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                              <th className="text-left py-2 px-3 font-medium">When</th>
                              <th className="text-left py-2 px-3 font-medium">Screen</th>
                              <th className="text-left py-2 px-3 font-medium hidden md:table-cell">Device</th>
                              <th className="text-left py-2 px-3 font-medium hidden lg:table-cell">User</th>
                            </tr>
                          </thead>
                          <tbody>
                            {cityDrill.recentEvents.map((ev, i) => (
                              <tr key={`${ev.createdAt}-${ev.path}-${i}`} className="border-b border-zinc-100 dark:border-zinc-800">
                                <td className="py-2 px-3 whitespace-nowrap text-xs">
                                  {formatInsightDateTime(ev.createdAt)}
                                </td>
                                <td className="py-2 px-3">
                                  <span className="block">{ev.pathLabel}</span>
                                  <span className="font-mono text-xs text-muted-foreground sm:hidden">{ev.path}</span>
                                </td>
                                <td className="py-2 px-3 text-xs text-muted-foreground hidden md:table-cell">
                                  {[ev.deviceType, ev.browser, ev.os].filter(Boolean).join(" · ") || "—"}
                                </td>
                                <td className="py-2 px-3 text-xs hidden lg:table-cell">
                                  {ev.userEmail ?? <span className="text-muted-foreground">Guest</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
