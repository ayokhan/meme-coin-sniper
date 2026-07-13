"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, RefreshCw, Download } from "lucide-react";
import { downloadTradingUniversityCertificate } from "@/lib/trading-university/certificate";
import UniversityDonationCard from "@/components/UniversityDonationCard";
import { FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

type StudentStatus = "not_started" | "in_progress" | "graduated";

type Student = {
  userId: string;
  email: string | null;
  name: string | null;
  enrolledAt: string;
  modulesCompleted: number;
  modulesTotal: number;
  quizPassed: boolean;
  quizBestScorePct: number | null;
  quizPassedAt: string | null;
  certificateCode: string | null;
  lastAttemptAt: string | null;
  attemptCount: number;
  examSetId: string | null;
  updatedAt: string;
  status?: StudentStatus;
};

type ExamKeySet = {
  setId: string;
  questionCount: number;
  questions: {
    id: string;
    lessonId: string;
    prompt: string;
    options: string[];
    correctIndex: number;
    correctAnswer: string;
  }[];
};

type Tab = "students" | "keys" | "certificate" | "donation";

export default function AdminTradingUniversityPage() {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>("students");
  const [enrolled, setEnrolled] = useState<Student[]>([]);
  const [graduated, setGraduated] = useState<Student[]>([]);
  const [counts, setCounts] = useState({
    progressRows: 0,
    enrolled: 0,
    notStarted: 0,
    inProgress: 0,
    graduated: 0,
  });
  const [examKeys, setExamKeys] = useState<ExamKeySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StudentStatus>("all");
  const [keySet, setKeySet] = useState("A");
  const [donationsEnabled, setDonationsEnabled] = useState(true);
  const [donationsSaving, setDonationsSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    Promise.all([
      fetch("/api/admin/trading-university").then((r) => r.json()),
      fetch("/api/admin/feature-flags").then((r) => r.json()),
    ])
      .then(([data, flagsData]) => {
        if (!data.success) {
          setError(data.error ?? "Failed to load");
          return;
        }
        setEnrolled(data.enrolled ?? []);
        setGraduated(data.graduated ?? []);
        setCounts(
          data.counts ?? {
            progressRows: 0,
            enrolled: 0,
            notStarted: 0,
            inProgress: 0,
            graduated: 0,
          }
        );
        setExamKeys(data.examKeys ?? []);
        if (flagsData?.success && flagsData.flags) {
          const v = flagsData.flags[FEATURE_FLAG_KEYS.TRADING_UNIVERSITY_DONATIONS];
          setDonationsEnabled(v !== false);
        }
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  const toggleDonations = async (enabled: boolean) => {
    setDonationsSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/feature-flags", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: FEATURE_FLAG_KEYS.TRADING_UNIVERSITY_DONATIONS,
          enabled,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not update donation flag.");
        return;
      }
      setDonationsEnabled(enabled);
    } catch {
      setError("Could not update donation flag.");
    } finally {
      setDonationsSaving(false);
    }
  };

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enrolled.filter((s) => {
      const status =
        s.status ??
        (s.quizPassed
          ? "graduated"
          : s.modulesCompleted === 0 && s.attemptCount === 0
            ? "not_started"
            : "in_progress");
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (!q) return true;
      return (
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q)
      );
    });
  }, [enrolled, search, statusFilter]);

  const activeKeys = examKeys.find((k) => k.setId === keySet) ?? examKeys[0];

  if (status === "loading") {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  }

  return (
    <div className="space-y-4 p-4 sm:p-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-amber-500" />
            Trading University
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enrollments, graduates, exam answer keys, certificate preview.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={load} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <button
          type="button"
          onClick={() => setStatusFilter("all")}
          className={`rounded-md px-3 py-1.5 ${
            statusFilter === "all"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-zinc-100 dark:bg-zinc-800"
          }`}
        >
          Enrolled <strong>{counts.enrolled}</strong>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("not_started")}
          className={`rounded-md px-3 py-1.5 ${
            statusFilter === "not_started"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-amber-500/15 text-amber-900 dark:text-amber-200"
          }`}
        >
          Not started <strong>{counts.notStarted ?? 0}</strong>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("in_progress")}
          className={`rounded-md px-3 py-1.5 ${
            statusFilter === "in_progress"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-sky-500/15 text-sky-900 dark:text-sky-200"
          }`}
        >
          In progress <strong>{counts.inProgress ?? 0}</strong>
        </button>
        <button
          type="button"
          onClick={() => setStatusFilter("graduated")}
          className={`rounded-md px-3 py-1.5 ${
            statusFilter === "graduated"
              ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
              : "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200"
          }`}
        >
          Graduated <strong>{counts.graduated}</strong>
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        Enrolled = opened University while signed in. Not started = enrolled but 0 chapters done.
      </p>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["students", "Students"],
            ["keys", "Exam Q&A"],
            ["certificate", "Certificate preview"],
            ["donation", "Donation"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            type="button"
            size="sm"
            variant={tab === id ? "default" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {loading && <p className="text-sm text-muted-foreground">Loading…</p>}

      {!loading && tab === "students" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Enrolled &amp; progress</CardTitle>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search email / name…"
              className="mt-2 w-full max-w-sm rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-1.5 text-sm"
            />
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground border-b border-zinc-200 dark:border-zinc-700">
                  <th className="py-2 pr-3">User</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Modules</th>
                  <th className="py-2 pr-3">Exam</th>
                  <th className="py-2 pr-3">Set</th>
                  <th className="py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const status =
                    s.status ??
                    (s.quizPassed
                      ? "graduated"
                      : s.modulesCompleted === 0 && s.attemptCount === 0
                        ? "not_started"
                        : "in_progress");
                  return (
                  <tr key={s.userId} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.email || s.userId}</div>
                    </td>
                    <td className="py-2 pr-3 text-xs">
                      {status === "graduated"
                        ? "Graduated"
                        : status === "not_started"
                          ? "Not started"
                          : "In progress"}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">
                      {s.modulesCompleted}/{s.modulesTotal}
                    </td>
                    <td className="py-2 pr-3">
                      {s.quizPassed ? (
                        <span className="text-emerald-600 dark:text-emerald-400">
                          Passed {s.quizBestScorePct != null ? `${s.quizBestScorePct}%` : ""}
                        </span>
                      ) : s.attemptCount > 0 ? (
                        <span className="text-amber-700 dark:text-amber-300">
                          Attempted ×{s.attemptCount}
                          {s.quizBestScorePct != null ? ` (best ${s.quizBestScorePct}%)` : ""}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Not started</span>
                      )}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{s.examSetId ?? "—"}</td>
                    <td className="py-2 text-xs text-muted-foreground">
                      {new Date(s.updatedAt ?? s.enrolledAt).toLocaleString()}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">
                {statusFilter === "not_started"
                  ? "No enrolled students still at 0 chapters."
                  : "No enrollments yet."}
              </p>
            )}
            {graduated.length > 0 && statusFilter === "all" && (
              <p className="text-xs text-muted-foreground mt-4">
                Graduates: {graduated.length} (included in table).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && tab === "keys" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Final exam answer keys</CardTitle>
            <div className="flex flex-wrap gap-2 mt-2">
              {examKeys.map((k) => (
                <Button
                  key={k.setId}
                  type="button"
                  size="sm"
                  variant={keySet === k.setId ? "default" : "outline"}
                  onClick={() => setKeySet(k.setId)}
                >
                  Set {k.setId} ({k.questionCount})
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 max-h-[70vh] overflow-y-auto">
            {activeKeys?.questions.map((q, i) => (
              <div
                key={q.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-sm space-y-1"
              >
                <p className="text-[11px] font-mono text-muted-foreground">
                  {q.id} · {q.lessonId} · Q{i + 1}
                </p>
                <p className="font-medium">{q.prompt}</p>
                <ol className="list-decimal pl-5 text-xs space-y-0.5 text-muted-foreground">
                  {q.options.map((o, oi) => (
                    <li
                      key={o}
                      className={oi === q.correctIndex ? "text-emerald-600 dark:text-emerald-400 font-semibold" : ""}
                    >
                      {o}
                      {oi === q.correctIndex ? " ✓" : ""}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && tab === "certificate" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Certificate preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Downloads a sample PNG using the live certificate template (sample graduate name).
            </p>
            <Button
              type="button"
              className="gap-2"
              onClick={() =>
                void downloadTradingUniversityCertificate({
                  graduateName: "Alex Rivera",
                  scorePct: 87.5,
                  certificateCode: "NS-TU-DEMO-PREV",
                  passedAtIso: new Date().toISOString(),
                })
              }
            >
              <Download className="h-4 w-4" />
              Download sample certificate
            </Button>
            <p className="text-xs text-muted-foreground">
              Live certificate text: NovaStaris · Trading University · Certificate of Completion ·
              graduate name · score with pass mark 32/40 · date · certificate ID · disclaimer.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link href="/?tab=trading-university">Open University tab</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {!loading && tab === "donation" && (
        <div className="space-y-4 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Donation prompt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Graduates see this after they <strong>pass</strong> the final exam (and again on the
                University home). It never blocks the certificate. Payments are card-only via Stripe
                (one-time or monthly). Toggle below or in{" "}
                <Link href="/admin/feature-flags" className="underline">
                  Feature flags
                </Link>
                .
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium">
                  Status:{" "}
                  <span
                    className={
                      donationsEnabled
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-zinc-500"
                    }
                  >
                    {donationsEnabled ? "ON" : "OFF"}
                  </span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant={donationsEnabled ? "outline" : "default"}
                  disabled={donationsSaving}
                  onClick={() => void toggleDonations(!donationsEnabled)}
                >
                  {donationsSaving
                    ? "Saving…"
                    : donationsEnabled
                      ? "Turn donations OFF"
                      : "Turn donations ON"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Live preview (what graduates see)
            </p>
            <UniversityDonationCard variant="full" />
            <p className="text-[11px] text-muted-foreground">
              Checkout still requires a passed exam on your account. Preview is visual only for the
              card layout and copy.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
