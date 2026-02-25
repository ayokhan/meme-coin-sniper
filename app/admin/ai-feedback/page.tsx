"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, MessageSquare, Download } from "lucide-react";

type FeedbackItem = {
  id: string;
  contractAddress: string;
  outcome: string;
  note: string | null;
  score: number | null;
  signal: string | null;
  createdAt: string;
};

export default function AdminAiFeedbackPage() {
  const { data: session, status } = useSession();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState<"all" | "good" | "bad">("all");

  const loadFeedback = () => {
    setLoading(true);
    setError("");
    const url = outcomeFilter === "all"
      ? "/api/admin/ai-feedback?limit=500"
      : `/api/admin/ai-feedback?outcome=${outcomeFilter}&limit=500`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setFeedback(Array.isArray(data.feedback) ? data.feedback : []);
        else setError(data.error ?? "Failed to load");
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadFeedback();
  }, [status, outcomeFilter]);

  const exportCsv = () => {
    const headers = ["Date", "Contract address", "Outcome", "Score", "Signal", "Note"];
    const rows = feedback.map((f) => [
      new Date(f.createdAt).toISOString(),
      f.contractAddress,
      f.outcome,
      f.score ?? "",
      f.signal ?? "",
      (f.note ?? "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((c) => `"${String(c)}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `ai-analysis-feedback-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (status === "loading" || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-100 dark:bg-zinc-950 px-4">
        <Card className="w-full max-w-4xl">
          <CardContent className="py-8 text-center text-muted-foreground">
            {status === "loading" ? "Loading…" : "Sign in to view AI Feedback."}
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
          <Link href="/admin/customers" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Customers
          </Link>
          <Link href="/admin/insights" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            App Insights
          </Link>
          <Link href="/admin/wallet-tracker" className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline font-medium">
            Wallet Tracker
          </Link>
        </div>
        <Card className="border-zinc-200 dark:border-zinc-800">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-cyan-500" />
              <CardTitle>AI Analysis Feedback</CardTitle>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">Filter</span>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value as "all" | "good" | "bad")}
                className="rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm"
              >
                <option value="all">All</option>
                <option value="good">Worked well</option>
                <option value="bad">Didn&apos;t work</option>
              </select>
              <button
                type="button"
                onClick={loadFeedback}
                className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={exportCsv}
                disabled={feedback.length === 0}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 px-2 py-1.5 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              >
                <Download className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Owner-only. Use this list to tune prompts or train the model. Export for analysis.
            </p>
            {error && (
              <div className="rounded-md bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 text-sm px-3 py-2 mb-4">
                {error}
              </div>
            )}
            {loading ? (
              <p className="text-muted-foreground">Loading…</p>
            ) : feedback.length === 0 ? (
              <p className="text-muted-foreground">No feedback yet.</p>
            ) : (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-zinc-50 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-700">
                      <th className="text-left py-2 px-3 font-medium">Date</th>
                      <th className="text-left py-2 px-3 font-medium">Outcome</th>
                      <th className="text-left py-2 px-3 font-medium">Score / Signal</th>
                      <th className="text-left py-2 px-3 font-medium min-w-[200px]">Contract address</th>
                      <th className="text-left py-2 px-3 font-medium">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedback.map((f) => (
                      <tr key={f.id} className="border-b border-zinc-100 dark:border-zinc-800">
                        <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">
                          {new Date(f.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 px-3">
                          <span className={f.outcome === "good" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                            {f.outcome === "good" ? "Worked well" : "Didn't work"}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          {f.score != null ? f.score : "—"} {f.signal ? `· ${f.signal}` : ""}
                        </td>
                        <td className="py-2 px-3 font-mono text-xs break-all">{f.contractAddress}</td>
                        <td className="py-2 px-3 text-muted-foreground max-w-[200px] truncate" title={f.note ?? undefined}>
                          {f.note || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
