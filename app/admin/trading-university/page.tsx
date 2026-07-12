"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, RefreshCw, Download } from "lucide-react";
import { downloadTradingUniversityCertificate } from "@/lib/trading-university/certificate";

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

type Tab = "students" | "keys" | "certificate";

export default function AdminTradingUniversityPage() {
  const { status } = useSession();
  const [tab, setTab] = useState<Tab>("students");
  const [enrolled, setEnrolled] = useState<Student[]>([]);
  const [graduated, setGraduated] = useState<Student[]>([]);
  const [counts, setCounts] = useState({ progressRows: 0, enrolled: 0, graduated: 0 });
  const [examKeys, setExamKeys] = useState<ExamKeySet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [keySet, setKeySet] = useState("A");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    fetch("/api/admin/trading-university")
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.error ?? "Failed to load");
          return;
        }
        setEnrolled(data.enrolled ?? []);
        setGraduated(data.graduated ?? []);
        setCounts(data.counts ?? { progressRows: 0, enrolled: 0, graduated: 0 });
        setExamKeys(data.examKeys ?? []);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (status === "authenticated") load();
  }, [status, load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = enrolled;
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.email ?? "").toLowerCase().includes(q) ||
        (s.name ?? "").toLowerCase().includes(q) ||
        s.userId.toLowerCase().includes(q)
    );
  }, [enrolled, search]);

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

      <div className="flex flex-wrap gap-4 text-sm">
        <span className="rounded-md bg-zinc-100 dark:bg-zinc-800 px-3 py-1.5">
          Enrolled <strong>{counts.enrolled}</strong>
        </span>
        <span className="rounded-md bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 px-3 py-1.5">
          Graduated <strong>{counts.graduated}</strong>
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["students", "Students"],
            ["keys", "Exam Q&A"],
            ["certificate", "Certificate preview"],
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
                  <th className="py-2 pr-3">Modules</th>
                  <th className="py-2 pr-3">Exam</th>
                  <th className="py-2 pr-3">Set</th>
                  <th className="py-2">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s.userId} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="py-2 pr-3">
                      <div className="font-medium">{s.name || "—"}</div>
                      <div className="text-xs text-muted-foreground">{s.email || s.userId}</div>
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
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6">No enrollments yet.</p>
            )}
            {graduated.length > 0 && (
              <p className="text-xs text-muted-foreground mt-4">
                Graduates: {graduated.length} (included in table with Passed status).
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
    </div>
  );
}
