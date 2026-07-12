"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  GraduationCap,
  Lock,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadTradingUniversityCertificate } from "@/lib/trading-university/certificate";
import type { UniversityLesson } from "@/lib/trading-university/content";

type Progress = {
  completedLessons: string[];
  quizPassed: boolean;
  quizBestScorePct: number | null;
  quizPassedAt: string | null;
  certificateCode: string | null;
  lastAttemptAt: string | null;
  lastFailedAt: string | null;
  attemptCount: number;
  canAttemptQuiz: boolean;
  nextAttemptAt: string | null;
  allLessonsComplete: boolean;
  displayName: string | null;
};

type CatalogLesson = UniversityLesson;

type PublicQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
};

type View = "home" | "lesson" | "quiz" | "result";

const LOCAL_LESSONS_KEY = "novastaris_tu_lessons_v1";

function readLocalLessons(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_LESSONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocalLessons(ids: string[]) {
  try {
    localStorage.setItem(LOCAL_LESSONS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export default function TradingUniversityPanel() {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<CatalogLesson[]>([]);
  const [passPct, setPassPct] = useState(85);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [view, setView] = useState<View>("home");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    passed: boolean;
    scorePct: number;
    correct: number;
    total: number;
  } | null>(null);

  const completedSet = useMemo(() => {
    const fromServer = progress?.completedLessons ?? [];
    return new Set([...fromServer, ...localCompleted]);
  }, [progress, localCompleted]);

  const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;
  const allComplete =
    lessons.length > 0 && lessons.every((l) => completedSet.has(l.id));

  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading-university", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not load Trading University.");
        return;
      }
      setLessons(data.catalog?.lessons ?? []);
      setPassPct(data.catalog?.passPct ?? 85);
      setProgress(data.progress ?? null);
      setLocalCompleted(readLocalLessons());
    } catch {
      setError("Network error loading Trading University.");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncLessonsToServer = useCallback(async (ids: string[]) => {
    if (!authenticated || ids.length === 0) return null;
    let lastProgress: Progress | null = null;
    for (const lessonId of ids) {
      try {
        const res = await fetch("/api/trading-university/lessons", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId }),
        });
        const data = await res.json();
        if (res.ok && data.progress) lastProgress = data.progress;
      } catch {
        /* continue */
      }
    }
    if (lastProgress) setProgress(lastProgress);
    return lastProgress;
  }, [authenticated]);

  useEffect(() => {
    void load();
  }, [load, status]);

  useEffect(() => {
    if (!authenticated) return;
    const local = readLocalLessons();
    if (local.length === 0) return;
    void syncLessonsToServer(local);
  }, [authenticated, syncLessonsToServer]);

  const markLearned = async (lessonId: string) => {
    const next = Array.from(new Set([...readLocalLessons(), lessonId]));
    writeLocalLessons(next);
    setLocalCompleted(next);

    if (!authenticated) return;
    await syncLessonsToServer([lessonId]);
  };

  const startQuiz = async () => {
    setError(null);
    if (!authenticated) {
      setError("Register and sign in to take the graduate quiz.");
      return;
    }
    if (!allComplete) {
      setError("Mark every chapter as learned before the quiz.");
      return;
    }
    setSubmitting(true);
    try {
      await syncLessonsToServer(Array.from(completedSet));
      const res = await fetch("/api/trading-university/quiz", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not start quiz.");
        if (data.nextAttemptAt) {
          setProgress((p) =>
            p
              ? { ...p, canAttemptQuiz: false, nextAttemptAt: data.nextAttemptAt }
              : p
          );
        }
        return;
      }
      setQuestions(data.questions ?? []);
      setAnswers({});
      setQuizIndex(0);
      setResult(null);
      setView("quiz");
    } catch {
      setError("Network error starting quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuiz = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/trading-university/quiz", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not grade quiz.");
        return;
      }
      if (data.progress) setProgress(data.progress);
      setResult({
        passed: !!data.passed,
        scorePct: data.scorePct,
        correct: data.correct,
        total: data.total,
      });
      setView("result");
    } catch {
      setError("Network error submitting quiz.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDownloadCert = async () => {
    if (!progress?.quizPassed || !progress.certificateCode || !progress.quizPassedAt) return;
    try {
      await downloadTradingUniversityCertificate({
        graduateName: progress.displayName || "Graduate",
        scorePct: progress.quizBestScorePct ?? result?.scorePct ?? 0,
        certificateCode: progress.certificateCode,
        passedAtIso: progress.quizPassedAt,
      });
    } catch {
      setError("Could not download certificate.");
    }
  };

  if (loading) {
    return (
      <div className="px-3 sm:px-6 py-12 text-center text-sm text-muted-foreground">
        Loading NovaStaris Trading University…
      </div>
    );
  }

  if (error && lessons.length === 0) {
    return (
      <div className="px-3 sm:px-6 py-12 text-center text-sm text-amber-600 dark:text-amber-400">
        {error}
      </div>
    );
  }

  return (
    <div className="px-3 sm:px-6 pb-16 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 px-5 py-8 sm:px-8 sm:py-10 text-slate-50">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, rgba(34,211,238,0.25), transparent 45%), radial-gradient(circle at 80% 0%, rgba(250,204,21,0.12), transparent 40%)",
          }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300/90">
              <GraduationCap className="h-4 w-4" />
              NovaStaris
            </p>
            <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              Trading University
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              A living dictionary of our markets — meme coins, Solana & BSC, crypto perps, prediction
              markets, and forex — then prove it with a graduate quiz.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wide">Progress</p>
            <p className="mt-1 font-mono text-lg text-cyan-200">
              {completedCount}/{lessons.length} chapters
            </p>
            {progress?.quizPassed ? (
              <p className="mt-1 text-emerald-300 text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Graduated
              </p>
            ) : (
              <p className="mt-1 text-slate-400 text-xs">Pass mark {passPct}%</p>
            )}
          </div>
        </div>
      </header>

      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {view === "home" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {lessons.map((lesson, i) => {
              const done = completedSet.has(lesson.id);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  onClick={() => {
                    setActiveLessonId(lesson.id);
                    setView("lesson");
                    setError(null);
                  }}
                  className="group text-left rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 p-4 transition hover:border-cyan-500/50 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11px] font-mono text-zinc-500">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-zinc-400 group-hover:text-cyan-500 shrink-0" />
                    )}
                  </div>
                  <h2 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">{lesson.title}</h2>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lesson.subtitle}</p>
                  <p className="mt-3 text-[11px] text-zinc-500">~{lesson.estimatedMinutes} min</p>
                </button>
              );
            })}
          </div>

          <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-900/50 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Ready to test your knowledge?
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {TRADING_QUIZ_BLURB(passPct)}
            </p>

            {progress?.quizPassed ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                  Congratulations{progress.displayName ? `, ${progress.displayName}` : ""} — you
                  graduated NovaStaris Trading University
                  {progress.quizBestScorePct != null ? ` with ${progress.quizBestScorePct}%` : ""}.
                </p>
                <Button type="button" onClick={() => void onDownloadCert()} className="gap-2">
                  <Download className="h-4 w-4" />
                  Download certificate
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {!authenticated ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Lock className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-muted-foreground">Sign in to unlock the quiz.</span>
                    <Button asChild size="sm" variant="default">
                      <Link href="/signin">Sign in</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/register">Register</Link>
                    </Button>
                  </div>
                ) : !allComplete ? (
                  <p className="text-sm text-muted-foreground">
                    Mark all {lessons.length} chapters as learned to unlock the quiz ({completedCount}/
                    {lessons.length}).
                  </p>
                ) : progress && !progress.canAttemptQuiz && progress.nextAttemptAt ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Daily attempt used. Next try after{" "}
                    {new Date(progress.nextAttemptAt).toLocaleString()} (UTC day reset).
                  </p>
                ) : (
                  <Button type="button" disabled={submitting} onClick={() => void startQuiz()}>
                    {submitting ? "Starting…" : "Start 20-question quiz"}
                  </Button>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {view === "lesson" && activeLesson && (
        <article className="max-w-3xl space-y-6">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 -ml-2"
            onClick={() => setView("home")}
          >
            <ChevronLeft className="h-4 w-4" />
            All chapters
          </Button>
          <div>
            <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              {activeLesson.title}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{activeLesson.subtitle}</p>
          </div>
          {activeLesson.sections.map((s) => (
            <section key={s.heading} className="space-y-2">
              <h3 className="text-base font-semibold text-cyan-700 dark:text-cyan-300">{s.heading}</h3>
              {s.body.map((p) => (
                <p key={p.slice(0, 40)} className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {p}
                </p>
              ))}
            </section>
          ))}
          <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
            <h3 className="text-sm font-semibold">Key terms</h3>
            <dl className="space-y-2">
              {activeLesson.keyTerms.map((t) => (
                <div key={t.term}>
                  <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{t.term}</dt>
                  <dd className="text-xs text-muted-foreground">{t.definition}</dd>
                </div>
              ))}
            </dl>
          </section>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                void markLearned(activeLesson.id);
              }}
              variant={completedSet.has(activeLesson.id) ? "outline" : "default"}
              className="gap-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              {completedSet.has(activeLesson.id) ? "Marked as learned" : "Mark as learned"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setView("home")}>
              Back to dictionary
            </Button>
          </div>
        </article>
      )}

      {view === "quiz" && questions.length > 0 && (
        <div className="max-w-2xl space-y-5">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setView("home")}>
              Exit quiz
            </Button>
            <p className="text-xs font-mono text-muted-foreground">
              Question {quizIndex + 1} / {questions.length}
            </p>
          </div>
          <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 transition-all"
              style={{ width: `${((quizIndex + 1) / questions.length) * 100}%` }}
            />
          </div>
          {(() => {
            const q = questions[quizIndex];
            return (
              <div className="space-y-4 rounded-xl border border-zinc-200 dark:border-zinc-700 p-5">
                <p className="text-base font-medium text-zinc-900 dark:text-zinc-50">{q.prompt}</p>
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const selected = answers[q.id] === oi;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        className={`w-full text-left rounded-lg border px-3 py-2.5 text-sm transition ${
                          selected
                            ? "border-cyan-500 bg-cyan-500/10 text-zinc-900 dark:text-zinc-50"
                            : "border-zinc-200 dark:border-zinc-700 hover:border-cyan-500/40"
                        }`}
                      >
                        <span className="font-mono text-[11px] text-zinc-500 mr-2">
                          {String.fromCharCode(65 + oi)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>
                <div className="flex justify-between gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={quizIndex === 0}
                    onClick={() => setQuizIndex((i) => Math.max(0, i - 1))}
                    className="gap-1"
                  >
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </Button>
                  {quizIndex < questions.length - 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={answers[q.id] == null}
                      onClick={() => setQuizIndex((i) => i + 1)}
                      className="gap-1"
                    >
                      Next <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        submitting || questions.some((qq) => answers[qq.id] == null)
                      }
                      onClick={() => void submitQuiz()}
                    >
                      {submitting ? "Grading…" : "Submit quiz"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {view === "result" && result && (
        <div className="max-w-xl mx-auto space-y-5 text-center py-6">
          {result.passed ? (
            <>
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
                <GraduationCap className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                Congratulations{progress?.displayName ? `, ${progress.displayName}` : ""}!
              </h2>
              <p className="text-sm text-muted-foreground">
                You scored {result.correct}/{result.total} ({result.scorePct}%) and earned your
                NovaStaris Trading University certificate.
              </p>
              <Button type="button" onClick={() => void onDownloadCert()} className="gap-2">
                <Download className="h-4 w-4" />
                Download certificate
              </Button>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Not quite yet</h2>
              <p className="text-sm text-muted-foreground">
                You scored {result.correct}/{result.total} ({result.scorePct}%). Pass mark is {passPct}
                %. Review the chapters and try again tomorrow (one attempt per UTC day).
              </p>
              {progress?.nextAttemptAt && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Next attempt after {new Date(progress.nextAttemptAt).toLocaleString()}
                </p>
              )}
            </>
          )}
          <Button type="button" variant="outline" onClick={() => setView("home")}>
            Back to University
          </Button>
        </div>
      )}
    </div>
  );
}

function TRADING_QUIZ_BLURB(passPct: number) {
  return `After you finish the dictionary, take a ${20}-question exam. You need ${passPct}% to pass. One attempt per day if you fail. Graduates get a personalized, downloadable certificate.`;
}
