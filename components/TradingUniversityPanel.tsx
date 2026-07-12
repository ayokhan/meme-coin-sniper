"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import {
  certificateShareText,
  certificateToBlob,
  downloadTradingUniversityCertificate,
  nativeShareCertificate,
  shareUrlFacebook,
  shareUrlLinkedIn,
  shareUrlTelegram,
  shareUrlWhatsApp,
  shareUrlX,
  TRADING_UNIVERSITY_SHARE_URL,
  type CertificatePayload,
} from "@/lib/trading-university/certificate";
import {
  UniversityCandlesDiagram,
  UniversityFeesDiagram,
  UniversityMarginDiagram,
  UniversitySessionsDiagram,
} from "@/components/UniversityConceptDiagrams";
import {
  buildGlossary,
  TRADING_UNIVERSITY_MAX_TAB_LEAVES,
  type UniversityLesson,
} from "@/lib/trading-university/content";

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
  examInProgress?: boolean;
  examExpiresAt?: string | null;
};

type CatalogLesson = UniversityLesson & { locked?: boolean; relatedTools?: UniversityLesson["relatedTools"]; diagram?: UniversityLesson["diagram"] };

type PublicQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
};

type View = "home" | "lesson" | "quiz" | "result";

const LOCAL_LESSONS_KEY = "novastaris_tu_lessons_v1";
const LOCAL_CHAPTER_QUIZ_KEY = "novastaris_tu_chapter_quiz_v1";

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

function readChapterQuizDone(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_CHAPTER_QUIZ_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as string[];
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function markChapterQuizDone(lessonId: string) {
  const next = Array.from(new Set([...readChapterQuizDone(), lessonId]));
  try {
    localStorage.setItem(LOCAL_CHAPTER_QUIZ_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}

export default function TradingUniversityPanel() {
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessons, setLessons] = useState<CatalogLesson[]>([]);
  const [passPct, setPassPct] = useState(80);
  const [passCorrect, setPassCorrect] = useState(32);
  const [quizSize, setQuizSize] = useState(40);
  const [fullAccess, setFullAccess] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [localCompleted, setLocalCompleted] = useState<string[]>([]);
  const [view, setView] = useState<View>("home");
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizIndex, setQuizIndex] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);
  const [examExpiresAt, setExamExpiresAt] = useState<string | null>(null);
  const [examSecondsLeft, setExamSecondsLeft] = useState<number | null>(null);
  const [tabLeaveCount, setTabLeaveCount] = useState(0);
  const [proctorWarning, setProctorWarning] = useState<string | null>(null);
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [graduates, setGraduates] = useState<
    { displayName: string; scorePct: number | null; passedAt: string | null }[]
  >([]);
  const [practiceQs, setPracticeQs] = useState<
    { id: string; prompt: string; options: string[] }[] | null
  >(null);
  const [practiceAnswers, setPracticeAnswers] = useState<Record<string, number>>({});
  const [practiceResult, setPracticeResult] = useState<{
    correct: number;
    total: number;
    results: { id: string; correct: boolean; correctIndex: number }[];
  } | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [chapterQuizDone, setChapterQuizDone] = useState<string[]>([]);
  const [result, setResult] = useState<{
    passed: boolean;
    scorePct: number;
    correct: number;
    total: number;
    timedOut?: boolean;
    tabLeaveFail?: boolean;
  } | null>(null);
  const answersRef = useRef(answers);
  const submittingRef = useRef(false);
  const viewRef = useRef(view);

  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);
  useEffect(() => {
    submittingRef.current = submitting;
  }, [submitting]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const completedSet = useMemo(() => {
    const fromServer = progress?.completedLessons ?? [];
    return new Set([...fromServer, ...localCompleted]);
  }, [progress, localCompleted]);

  const completedCount = lessons.filter((l) => completedSet.has(l.id)).length;
  const allComplete =
    fullAccess && lessons.length > 0 && lessons.every((l) => completedSet.has(l.id));

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
      setPassPct(data.catalog?.passPct ?? 80);
      setPassCorrect(data.catalog?.passCorrect ?? 32);
      setQuizSize(data.catalog?.quizSize ?? 40);
      setFullAccess(!!data.catalog?.fullAccess);
      setProgress(data.progress ?? null);
      if (data.authenticated) {
        setLocalCompleted(readLocalLessons());
        setChapterQuizDone(readChapterQuizDone());
      } else {
        setLocalCompleted([]);
        setChapterQuizDone([]);
      }
    } catch {
      setError("Network error loading Trading University.");
    } finally {
      setLoading(false);
    }
  }, []);

  const syncLessonsToServer = useCallback(
    async (ids: string[]) => {
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
    },
    [authenticated]
  );

  useEffect(() => {
    void load();
  }, [load, status]);

  useEffect(() => {
    fetch("/api/trading-university/graduates")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setGraduates(data.graduates ?? []);
      })
      .catch(() => {});
  }, []);

  const glossary = useMemo(() => {
    const all = buildGlossary();
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 24);
    return all.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        e.lessonTitle.toLowerCase().includes(q)
    );
  }, [glossaryQuery]);

  useEffect(() => {
    if (!authenticated) return;
    const local = readLocalLessons();
    if (local.length === 0) return;
    void syncLessonsToServer(local);
  }, [authenticated, syncLessonsToServer]);

  const markLearned = async (lessonId: string) => {
    if (!authenticated) {
      setError("Create a free account to enroll and track course progress.");
      return;
    }
    if (!chapterQuizDone.includes(lessonId) && !practiceResult) {
      setError("Complete this module’s chapter check (practice quiz) before marking it complete.");
      setProctorWarning(null);
      // start chapter check
      setPracticeLoading(true);
      setPracticeResult(null);
      setPracticeAnswers({});
      try {
        const res = await fetch(
          `/api/trading-university/practice?lessonId=${encodeURIComponent(lessonId)}`,
          { credentials: "include" }
        );
        const data = await res.json();
        if (data.success) setPracticeQs(data.questions ?? []);
        else setError(data.error || "Could not load chapter check.");
      } catch {
        setError("Could not load chapter check.");
      } finally {
        setPracticeLoading(false);
      }
      return;
    }
    if (!chapterQuizDone.includes(lessonId) && practiceResult) {
      setChapterQuizDone(markChapterQuizDone(lessonId));
    }
    const next = Array.from(new Set([...readLocalLessons(), lessonId]));
    writeLocalLessons(next);
    setLocalCompleted(next);
    await syncLessonsToServer([lessonId]);
  };

  const openLesson = (lesson: CatalogLesson) => {
    setError(null);
    setPracticeQs(null);
    setPracticeResult(null);
    setPracticeAnswers({});
    setActiveLessonId(lesson.id);
    setView("lesson");
  };

  const startQuiz = async () => {
    setError(null);
    if (!authenticated) {
      setError("Register and sign in to take the final exam.");
      return;
    }
    if (!allComplete) {
      setError("Complete every module (mark as complete) before the final exam.");
      return;
    }
    setSubmitting(true);
    try {
      await syncLessonsToServer(Array.from(completedSet));
      const res = await fetch("/api/trading-university/quiz", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || "Could not start the exam.");
        if (data.nextAttemptAt) {
          setProgress((p) =>
            p ? { ...p, canAttemptQuiz: false, nextAttemptAt: data.nextAttemptAt } : p
          );
        }
        return;
      }
      setQuestions(data.questions ?? []);
      setAnswers({});
      setQuizIndex(0);
      setResult(null);
      setExamExpiresAt(data.examExpiresAt ?? null);
      setTabLeaveCount(data.examTabLeaveCount ?? 0);
      setProctorWarning(
        data.resumed
          ? "Resumed your timed exam — the clock did not reset."
          : "Timed exam: 60 minutes. Stay on this tab — leaving repeatedly will end the attempt."
      );
      setView("quiz");
    } catch {
      setError("Network error starting the exam.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitQuiz = useCallback(
    async (opts?: { reason?: "submit" | "timeout" | "tab_leaves" }) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setSubmitting(true);
      setError(null);
      const reason = opts?.reason ?? "submit";
      try {
        const res = await fetch("/api/trading-university/quiz", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answers: answersRef.current,
            reason,
            tabLeaveCount,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || "Could not grade the exam.");
          return;
        }
        if (data.progress) setProgress(data.progress);
        setExamExpiresAt(null);
        setExamSecondsLeft(null);
        setResult({
          passed: !!data.passed,
          scorePct: data.scorePct,
          correct: data.correct,
          total: data.total,
          timedOut: !!data.timedOut,
          tabLeaveFail: !!data.tabLeaveFail,
        });
        setView("result");
      } catch {
        setError("Network error submitting the exam.");
      } finally {
        submittingRef.current = false;
        setSubmitting(false);
      }
    },
    [tabLeaveCount]
  );

  useEffect(() => {
    if (view !== "quiz" || !examExpiresAt) {
      setExamSecondsLeft(null);
      return;
    }
    const tick = () => {
      const left = Math.max(0, Math.floor((Date.parse(examExpiresAt) - Date.now()) / 1000));
      setExamSecondsLeft(left);
      if (left <= 0 && viewRef.current === "quiz") {
        void submitQuiz({ reason: "timeout" });
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [view, examExpiresAt, submitQuiz]);

  useEffect(() => {
    if (view !== "quiz") return;

    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      if (viewRef.current !== "quiz") return;
      void fetch("/api/trading-university/quiz", {
        method: "PATCH",
        credentials: "include",
      })
        .then((r) => r.json())
        .then((data) => {
          if (!data.success) return;
          const n = data.examTabLeaveCount ?? 0;
          setTabLeaveCount(n);
          if (n >= TRADING_UNIVERSITY_MAX_TAB_LEAVES) {
            setProctorWarning("Too many tab leaves — submitting your exam.");
            void submitQuiz({ reason: "tab_leaves" });
          } else {
            setProctorWarning(
              `Stay on this exam tab. Leaves: ${n}/${TRADING_UNIVERSITY_MAX_TAB_LEAVES}. Another browser or tab can end your attempt.`
            );
          }
        })
        .catch(() => {
          setProctorWarning("Stay on this exam tab. Leaving may end your attempt.");
        });
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [view, submitQuiz]);

  const formatExamClock = (secs: number | null) => {
    if (secs == null) return "—";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const certPayload = (): CertificatePayload | null => {
    if (!progress?.quizPassed || !progress.certificateCode || !progress.quizPassedAt) return null;
    return {
      graduateName: progress.displayName || "Graduate",
      scorePct: progress.quizBestScorePct ?? result?.scorePct ?? 0,
      certificateCode: progress.certificateCode,
      passedAtIso: progress.quizPassedAt,
    };
  };

  const onDownloadCert = async () => {
    const payload = certPayload();
    if (!payload) return;
    try {
      await downloadTradingUniversityCertificate(payload);
    } catch {
      setError("Could not download certificate.");
    }
  };

  const openShare = (href: string) => {
    window.open(href, "_blank", "noopener,noreferrer");
  };

  const onNativeShare = async () => {
    const payload = certPayload();
    if (!payload || shareBusy) return;
    setShareBusy(true);
    try {
      const blob = await certificateToBlob(payload);
      const ok = await nativeShareCertificate(payload, blob);
      if (!ok) await downloadTradingUniversityCertificate(payload);
    } catch {
      setError("Could not share certificate.");
    } finally {
      setShareBusy(false);
    }
  };

  const onCopyShare = async () => {
    const payload = certPayload();
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(certificateShareText(payload));
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setError("Could not copy share text.");
    }
  };

  const shareButtons = (payload: CertificatePayload) => {
    const text = certificateShareText(payload);
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" onClick={() => void onDownloadCert()} className="gap-2">
            <Download className="h-4 w-4" />
            Download certificate
          </Button>
          {typeof navigator !== "undefined" && "share" in navigator && (
            <Button type="button" variant="outline" disabled={shareBusy} onClick={() => void onNativeShare()}>
              Share…
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Share your achievement</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => openShare(shareUrlLinkedIn(text))}>
            LinkedIn
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openShare(shareUrlX(text))}>
            X
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openShare(shareUrlFacebook())}>
            Facebook
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openShare(shareUrlTelegram(text))}>
            Telegram
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openShare(shareUrlWhatsApp(text))}>
            WhatsApp
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void onCopyShare()}>
            {shareCopied ? "Copied" : "Copy text"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground max-w-md mx-auto">
          Tip: download the PNG for Instagram or LinkedIn image posts, then attach it with your caption.
          Course link: {TRADING_UNIVERSITY_SHARE_URL}
        </p>
      </div>
    );
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
              A free course covering meme coins, Solana &amp; BSC, crypto futures &amp; perps,
              prediction markets, and forex — then a final exam to earn your certificate.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm backdrop-blur-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wide">
              {fullAccess ? "Course progress" : "Preview"}
            </p>
            <p className="mt-1 font-mono text-lg text-cyan-200">
              {fullAccess ? (
                <>
                  {completedCount}/{lessons.length} modules
                </>
              ) : (
                <>{lessons.length} modules</>
              )}
            </p>
            {progress?.quizPassed ? (
              <p className="mt-1 text-emerald-300 text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Course completed
              </p>
            ) : (
              <p className="mt-1 text-slate-400 text-xs">
                Final exam: {passCorrect}/{quizSize} to pass ({passPct}%)
              </p>
            )}
          </div>
        </div>
      </header>

      {!fullAccess && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Preview mode — enroll free to take the full course
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Browse the syllabus and open the free sample module. Register to unlock all modules,
              track progress, sit the final exam, and download your certificate.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm">
              <Link href="/register">Enroll free</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/signin">Sign in</Link>
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {error}
        </p>
      )}

      {view === "home" && (
        <>
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 mb-3">
              Course syllabus
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {lessons.map((lesson, i) => {
                const done = completedSet.has(lesson.id);
                const locked = !!lesson.locked;
                return (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => openLesson(lesson)}
                    className="group text-left rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-white/80 dark:bg-zinc-900/60 p-4 transition hover:border-cyan-500/50 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11px] font-mono text-zinc-500">
                        Module {String(i + 1).padStart(2, "0")}
                      </span>
                      {locked ? (
                        <Lock className="h-4 w-4 text-zinc-400 shrink-0" />
                      ) : done ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <BookOpen className="h-4 w-4 text-zinc-400 group-hover:text-cyan-500 shrink-0" />
                      )}
                    </div>
                    <h3 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">{lesson.title}</h3>
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{lesson.subtitle}</p>
                    <p className="mt-3 text-[11px] text-zinc-500">
                      {locked ? "Enroll to unlock" : `~${lesson.estimatedMinutes} min`}
                      {!locked && !fullAccess ? " · Free preview" : ""}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Glossary</h2>
            <input
              value={glossaryQuery}
              onChange={(e) => setGlossaryQuery(e.target.value)}
              placeholder="Search terms (pip, liquidation, USDT…)"
              className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
            <ul className="grid sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
              {glossary.map((g) => (
                <li key={`${g.lessonId}-${g.term}`} className="text-xs">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{g.term}</span>
                  <span className="text-muted-foreground"> — {g.definition}</span>
                </li>
              ))}
            </ul>
          </section>

          {graduates.length > 0 && (
            <section className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                Recent graduates
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {graduates.map((g) => g.displayName).join(" · ")}
              </p>
            </section>
          )}

          <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-900/50 p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Ready for the final exam?
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              After you finish learning, take a timed {quizSize}-question final exam (60 minutes). You
              need {passCorrect} correct answers ({passPct}%) to pass. One attempt per day if you do
              not pass. Stay on the exam tab — switching away repeatedly ends the attempt. Graduates
              receive a personalized, downloadable certificate.
            </p>

            {progress?.quizPassed ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 text-center sm:text-left">
                <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                  Congratulations{progress.displayName ? `, ${progress.displayName}` : ""} — you
                  completed NovaStaris Trading University
                  {progress.quizBestScorePct != null ? ` with ${progress.quizBestScorePct}%` : ""}.
                </p>
                {certPayload() && shareButtons(certPayload()!)}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {!authenticated ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Lock className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-muted-foreground">
                      Enroll free to unlock the course and exam.
                    </span>
                    <Button asChild size="sm">
                      <Link href="/register">Enroll free</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/signin">Sign in</Link>
                    </Button>
                  </div>
                ) : !allComplete ? (
                  <p className="text-sm text-muted-foreground">
                    Mark all {lessons.length} modules complete to unlock the exam ({completedCount}/
                    {lessons.length}).
                  </p>
                ) : progress && !progress.canAttemptQuiz && progress.nextAttemptAt ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Daily attempt used. Next attempt after{" "}
                    {new Date(progress.nextAttemptAt).toLocaleString()} (UTC day reset).
                  </p>
                ) : (
                  <Button type="button" disabled={submitting} onClick={() => void startQuiz()}>
                    {submitting
                      ? "Starting…"
                      : progress?.examInProgress
                        ? "Resume timed final exam"
                        : `Start ${quizSize}-question final exam (60 min)`}
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
            Course syllabus
          </Button>

          {activeLesson.locked ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4 text-center">
              <Lock className="h-8 w-8 mx-auto text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {activeLesson.title}
              </h2>
              <p className="text-sm text-muted-foreground">{activeLesson.subtitle}</p>
              <p className="text-sm text-muted-foreground">
                This module is part of the full course. Create a free account to enroll and continue
                learning.
              </p>
              <div className="flex justify-center gap-2">
                <Button asChild>
                  <Link href="/register">Enroll free</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/signin">Sign in</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {activeLesson.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeLesson.subtitle}</p>
                {!fullAccess && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Free preview module — enroll to unlock the rest of the course.
                  </p>
                )}
              </div>
              {activeLesson.sections.map((s) => (
                <section key={s.heading} className="space-y-2">
                  <h3 className="text-base font-semibold text-cyan-700 dark:text-cyan-300">
                    {s.heading}
                  </h3>
                  {s.body.map((p) => (
                    <p
                      key={p.slice(0, 48)}
                      className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300"
                    >
                      {p}
                    </p>
                  ))}
                </section>
              ))}
              {activeLesson.diagram === "fees" && <UniversityFeesDiagram />}
              {activeLesson.diagram === "margin" && <UniversityMarginDiagram />}
              {activeLesson.diagram === "candles" && <UniversityCandlesDiagram />}
              {activeLesson.diagram === "sessions" && <UniversitySessionsDiagram />}
              <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                <h3 className="text-sm font-semibold">Key terms</h3>
                <dl className="space-y-2">
                  {activeLesson.keyTerms.map((t) => (
                    <div key={t.term}>
                      <dt className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                        {t.term}
                      </dt>
                      <dd className="text-xs text-muted-foreground">{t.definition}</dd>
                    </div>
                  ))}
                </dl>
              </section>
              {activeLesson.relatedTools && activeLesson.relatedTools.length > 0 && (
                <section className="space-y-2">
                  <h3 className="text-sm font-semibold">Try next on NovaStaris</h3>
                  <div className="flex flex-wrap gap-2">
                    {activeLesson.relatedTools.map((t) => (
                      <Button key={t.href + t.label} asChild size="sm" variant="outline">
                        <Link href={t.href}>{t.label}</Link>
                      </Button>
                    ))}
                  </div>
                </section>
              )}
              {fullAccess && (
                <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">Chapter check (required)</h3>
                  <p className="text-xs text-muted-foreground">
                    Complete 3 practice questions before you can mark this module complete. Untimed —
                    does not count toward the final exam.
                  </p>
                  {chapterQuizDone.includes(activeLesson.id) && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      Chapter check completed for this module.
                    </p>
                  )}
                  {!practiceQs ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={practiceLoading}
                      onClick={() => {
                        setPracticeLoading(true);
                        setPracticeResult(null);
                        setPracticeAnswers({});
                        setError(null);
                        void fetch(
                          `/api/trading-university/practice?lessonId=${encodeURIComponent(activeLesson.id)}`,
                          { credentials: "include" }
                        )
                          .then((r) => r.json())
                          .then((data) => {
                            if (data.success) setPracticeQs(data.questions ?? []);
                            else setError(data.error || "Could not load chapter check.");
                          })
                          .catch(() => setError("Could not load chapter check."))
                          .finally(() => setPracticeLoading(false));
                      }}
                    >
                      {practiceLoading ? "Loading…" : "Start chapter check"}
                    </Button>
                  ) : (
                    <div className="space-y-4">
                      {practiceQs.map((q) => (
                        <div key={q.id} className="space-y-2">
                          <p className="text-sm font-medium">{q.prompt}</p>
                          {q.options.map((opt, oi) => (
                            <button
                              key={opt}
                              type="button"
                              disabled={!!practiceResult}
                              onClick={() => setPracticeAnswers((a) => ({ ...a, [q.id]: oi }))}
                              className={`block w-full text-left text-xs rounded-md border px-2 py-1.5 ${
                                practiceAnswers[q.id] === oi
                                  ? "border-cyan-500 bg-cyan-500/10"
                                  : "border-zinc-200 dark:border-zinc-700"
                              }`}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ))}
                      {!practiceResult ? (
                        <Button
                          type="button"
                          size="sm"
                          disabled={practiceQs.some((q) => practiceAnswers[q.id] == null)}
                          onClick={() => {
                            void fetch("/api/trading-university/practice", {
                              method: "POST",
                              credentials: "include",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ answers: practiceAnswers }),
                            })
                              .then((r) => r.json())
                              .then((data) => {
                                if (data.success) {
                                  setPracticeResult(data);
                                  setChapterQuizDone(markChapterQuizDone(activeLesson.id));
                                  setError(null);
                                }
                              });
                          }}
                        >
                          Check answers
                        </Button>
                      ) : (
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          Chapter check: {practiceResult.correct}/{practiceResult.total}. You can now
                          mark the module complete.
                        </p>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPracticeQs(null);
                          setPracticeResult(null);
                          setPracticeAnswers({});
                        }}
                      >
                        Close chapter check
                      </Button>
                    </div>
                  )}
                </section>
              )}
              <div className="flex flex-wrap gap-2">
                {fullAccess ? (
                  <Button
                    type="button"
                    onClick={() => void markLearned(activeLesson.id)}
                    variant={completedSet.has(activeLesson.id) ? "outline" : "default"}
                    className="gap-2"
                    disabled={
                      !completedSet.has(activeLesson.id) &&
                      !chapterQuizDone.includes(activeLesson.id)
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    {completedSet.has(activeLesson.id)
                      ? "Marked complete"
                      : chapterQuizDone.includes(activeLesson.id)
                        ? "Mark module complete"
                        : "Finish chapter check first"}
                  </Button>
                ) : (
                  <Button asChild className="gap-2">
                    <Link href="/register">
                      <Lock className="h-4 w-4" />
                      Enroll free to continue
                    </Link>
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setView("home")}>
                  Back to syllabus
                </Button>
              </div>
            </>
          )}
        </article>
      )}

      {view === "quiz" && questions.length > 0 && (
        <div className="max-w-2xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Leave the exam screen? The 60-minute timer keeps running. Closing or switching tabs may end your attempt."
                  )
                ) {
                  setView("home");
                }
              }}
            >
              Leave screen
            </Button>
            <div className="text-right">
              <p
                className={`text-sm font-mono font-semibold ${
                  examSecondsLeft != null && examSecondsLeft <= 300
                    ? "text-rose-500"
                    : "text-zinc-800 dark:text-zinc-100"
                }`}
              >
                Time left {formatExamClock(examSecondsLeft)}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                Question {quizIndex + 1} / {questions.length}
                {tabLeaveCount > 0
                  ? ` · Tab leaves ${tabLeaveCount}/${TRADING_UNIVERSITY_MAX_TAB_LEAVES}`
                  : ""}
              </p>
            </div>
          </div>
          {proctorWarning && (
            <p className="text-xs text-amber-800 dark:text-amber-200 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              {proctorWarning}
            </p>
          )}
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
                      disabled={submitting || questions.some((qq) => answers[qq.id] == null)}
                      onClick={() => void submitQuiz({ reason: "submit" })}
                    >
                      {submitting ? "Grading…" : "Submit exam"}
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
              {certPayload() && shareButtons(certPayload()!)}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {result.timedOut
                  ? "Time’s up"
                  : result.tabLeaveFail
                    ? "Attempt ended"
                    : "Not quite yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {result.timedOut
                  ? `The 60-minute limit ended. You scored ${result.correct}/${result.total} (${result.scorePct}%). Timed-out attempts do not pass.`
                  : result.tabLeaveFail
                    ? `The exam ended after too many tab/window leaves. You scored ${result.correct}/${result.total} (${result.scorePct}%).`
                    : `You scored ${result.correct}/${result.total} (${result.scorePct}%). Pass mark is ${passCorrect}/${quizSize} (${passPct}%).`}{" "}
                Review the modules and try again tomorrow (one attempt per UTC day).
              </p>
              {progress?.nextAttemptAt && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Next attempt after {new Date(progress.nextAttemptAt).toLocaleString()}
                </p>
              )}
            </>
          )}
          <Button type="button" variant="outline" onClick={() => setView("home")}>
            Back to Trading University
          </Button>
        </div>
      )}
    </div>
  );
}
