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
  Pause,
  Play,
  Sparkles,
  Volume2,
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
import { downloadTrackCheatSheet } from "@/lib/trading-university/cheat-sheets";
import {
  UniversityAdvancedTrioDiagram,
  UniversityBacktestDiagram,
  UniversityBondingCurveDiagram,
  UniversityBscCheckDiagram,
  UniversityCandleAtlasDiagram,
  UniversityCandlesDiagram,
  UniversityCexDexDiagram,
  UniversityChartPatternsDiagram,
  UniversityEthL2Diagram,
  UniversityFeesDiagram,
  UniversityFibDiagram,
  UniversityForexPipDiagram,
  UniversityFundingDiagram,
  UniversityGoldPipDiagram,
  UniversityIsolatedCrossDiagram,
  UniversityInstitutionalFlowDiagram,
  UniversityJournalDiagram,
  UniversityLifecycleDiagram,
  UniversityLiquidationPathDiagram,
  UniversityLiquidityGrabDiagram,
  UniversityLongShortDiagram,
  UniversityMarginDiagram,
  UniversityMarkVsLastDiagram,
  UniversityMarketRegimesDiagram,
  UniversityMetalsRailsDiagram,
  UniversityNarrativeDiagram,
  UniversityOptionsVolDiagram,
  UniversityOrdersDiagram,
  UniversityPhishingDiagram,
  UniversityProbabilityDiagram,
  UniversityRiskDiagram,
  UniversitySessionsDiagram,
  UniversitySolanaDiagram,
  UniversityStructureDiagram,
  UniversityTradingStylesDiagram,
  UniversityVolumeVwapDiagram,
  UniversityWalletDiagram,
  UniversityWorkflowDiagram,
} from "@/components/UniversityConceptDiagrams";
import UniversityDonationCard from "@/components/UniversityDonationCard";
import { useI18n } from "@/components/I18nProvider";
import {
  getLessonTrack,
  TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT,
  TRADING_UNIVERSITY_MAX_TAB_LEAVES,
  type CourseTrack,
  type UniversityLesson,
} from "@/lib/trading-university/content";
import {
  getLocalizedMistakes,
  localizeLessons,
} from "@/lib/trading-university/localize";

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

type TradingUniversityPanelProps = {
  /** Same-page tab links must call this — Next Link only changes the URL, not dashboard tab state. */
  onOpenToolHref?: (href: string) => void;
  /** Hide Try-next links when the target tab is feature-flagged off. */
  isToolHrefAvailable?: (href: string) => boolean;
};

type PublicQuestion = {
  id: string;
  lessonId: string;
  prompt: string;
  options: string[];
};

type View = "home" | "lesson" | "quiz" | "result" | "flashcards";

const LOCAL_LESSONS_KEY = "novastaris_tu_lessons_v1";
const LOCAL_CHAPTER_QUIZ_KEY = "novastaris_tu_chapter_quiz_v1";
const LOCAL_RESUME_KEY = "novastaris_tu_resume_v1";

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

function readResumeLessonId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(LOCAL_RESUME_KEY);
  } catch {
    return null;
  }
}

function writeResumeLessonId(lessonId: string) {
  try {
    localStorage.setItem(LOCAL_RESUME_KEY, lessonId);
  } catch {
    /* ignore */
  }
}

function stopSpeech() {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
}

export default function TradingUniversityPanel({
  onOpenToolHref,
  isToolHrefAvailable,
}: TradingUniversityPanelProps = {}) {
  const { t, locale } = useI18n();
  const { status } = useSession();
  const authenticated = status === "authenticated";

  const trackUi = useCallback(
    (track: CourseTrack) => {
      if (track === "foundations") {
        return {
          label: t("uni.trackFoundations"),
          level: t("uni.trackFoundationsLevel"),
          blurb: t("uni.trackFoundationsBlurb"),
        };
      }
      if (track === "markets") {
        return {
          label: t("uni.trackMarkets"),
          level: t("uni.trackMarketsLevel"),
          blurb: t("uni.trackMarketsBlurb"),
        };
      }
      return {
        label: t("uni.trackApplied"),
        level: t("uni.trackAppliedLevel"),
        blurb: t("uni.trackAppliedBlurb"),
      };
    },
    [t]
  );

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lessonsRaw, setLessons] = useState<CatalogLesson[]>([]);
  const lessons = useMemo(
    () => localizeLessons(lessonsRaw, locale) as CatalogLesson[],
    [lessonsRaw, locale]
  );
  const [passPct, setPassPct] = useState(75);
  const [passCorrect, setPassCorrect] = useState(45);
  const [quizSize, setQuizSize] = useState(60);
  const [examMinutes, setExamMinutes] = useState(70);
  const [fullAccess, setFullAccess] = useState(false);
  const [donationsEnabled, setDonationsEnabled] = useState(true);
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
  const [speechSupported, setSpeechSupported] = useState(false);
  const [speechPlaying, setSpeechPlaying] = useState(false);
  const [resumeLessonId, setResumeLessonId] = useState<string | null>(null);
  const [flashIndex, setFlashIndex] = useState(0);
  const [flashRevealed, setFlashRevealed] = useState(false);
  const [donationNote, setDonationNote] = useState<string | null>(null);
  const [result, setResult] = useState<{
    passed: boolean;
    scorePct: number;
    correct: number;
    total: number;
    timedOut?: boolean;
    tabLeaveFail?: boolean;
    missedLessonIds?: string[];
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
  const progressPct =
    lessons.length > 0 ? Math.round((completedCount / lessons.length) * 100) : 0;
  const minutesRemaining = lessons
    .filter((l) => !completedSet.has(l.id))
    .reduce((sum, l) => sum + (l.estimatedMinutes || 0), 0);
  const allComplete =
    fullAccess && lessons.length > 0 && lessons.every((l) => completedSet.has(l.id));
  const resumeLesson = lessons.find((l) => l.id === resumeLessonId) ?? null;

  const activeLesson = lessons.find((l) => l.id === activeLessonId) ?? null;

  const flashCards = useMemo(() => {
    const out: { term: string; definition: string; lessonId: string; lessonTitle: string }[] = [];
    for (const lesson of lessons) {
      if (lesson.locked) continue;
      for (const kt of lesson.keyTerms) {
        out.push({
          term: kt.term,
          definition: kt.definition,
          lessonId: lesson.id,
          lessonTitle: lesson.title,
        });
      }
    }
    return out.sort((a, b) => a.term.localeCompare(b.term));
  }, [lessons]);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== "undefined" && "speechSynthesis" in window && !!window.speechSynthesis
    );
    setResumeLessonId(readResumeLessonId());
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const donation = params.get("donation");
      if (donation === "success") {
        setDonationNote(t("uni.donateThanks"));
      } else if (donation === "canceled") {
        setDonationNote(t("uni.donateCanceled"));
      }
      if (donation) {
        params.delete("donation");
        const next = params.toString();
        const url = next ? `${window.location.pathname}?${next}` : window.location.pathname;
        window.history.replaceState({}, "", url);
      }
    }
    return () => stopSpeech();
  }, [t]);

  useEffect(() => {
    stopSpeech();
    setSpeechPlaying(false);
  }, [activeLessonId, view]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/trading-university", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t("uni.loadFailed"));
        return;
      }
      setLessons(data.catalog?.lessons ?? []);
      setPassPct(data.catalog?.passPct ?? 75);
      setPassCorrect(data.catalog?.passCorrect ?? 45);
      setQuizSize(data.catalog?.quizSize ?? 60);
      setExamMinutes(data.catalog?.examMinutes ?? 70);
      setFullAccess(!!data.catalog?.fullAccess);
      setDonationsEnabled(data.catalog?.donationsEnabled !== false);
      setProgress(data.progress ?? null);
      if (data.authenticated) {
        setLocalCompleted(readLocalLessons());
        setChapterQuizDone(readChapterQuizDone());
      } else {
        setLocalCompleted([]);
        setChapterQuizDone([]);
      }
    } catch {
      setError(t("uni.networkError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    const all = flashCards;
    const q = glossaryQuery.trim().toLowerCase();
    if (!q) return all.slice(0, 24);
    return all.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        e.lessonTitle.toLowerCase().includes(q)
    );
  }, [glossaryQuery, flashCards]);

  useEffect(() => {
    if (!authenticated) return;
    const local = readLocalLessons();
    if (local.length === 0) return;
    void syncLessonsToServer(local);
  }, [authenticated, syncLessonsToServer]);

  const markLearned = async (lessonId: string) => {
    if (!authenticated) {
      setError(t("uni.enrollTrackProgress"));
      return;
    }
    if (!chapterQuizDone.includes(lessonId) && !practiceResult) {
      setError(t("uni.chapterBeforeMark", { pass: TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT }));
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
        else setError(data.error || t("uni.chapterCheckFailed"));
      } catch {
        setError(t("uni.chapterCheckFailed"));
      } finally {
        setPracticeLoading(false);
      }
      return;
    }
    if (!chapterQuizDone.includes(lessonId) && practiceResult) {
      if (practiceResult.correct < TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT) {
        setError(
          t("uni.chapterCheckNeedMark", {
            pass: TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT,
            total: practiceResult.total,
          })
        );
        return;
      }
      setChapterQuizDone(markChapterQuizDone(lessonId));
    }
    const next = Array.from(new Set([...readLocalLessons(), lessonId]));
    writeLocalLessons(next);
    setLocalCompleted(next);
    await syncLessonsToServer([lessonId]);
  };

  const openLesson = (lesson: CatalogLesson) => {
    setError(null);
    stopSpeech();
    setSpeechPlaying(false);
    setPracticeQs(null);
    setPracticeResult(null);
    setPracticeAnswers({});
    setActiveLessonId(lesson.id);
    writeResumeLessonId(lesson.id);
    setResumeLessonId(lesson.id);
    setView("lesson");
  };

  const playLessonAudio = (lesson: CatalogLesson) => {
    if (!speechSupported) {
      setError(t("uni.speechUnsupported"));
      return;
    }
    stopSpeech();
    const parts = [
      lesson.title,
      lesson.subtitle,
      ...lesson.sections.flatMap((s) => [s.heading, ...s.body]),
      ...(lesson.workedExamples ?? []).flatMap((ex) => [
        `Example: ${ex.title}`,
        ...ex.setup,
        ...ex.steps,
        ex.takeaway,
      ]),
      ...getLocalizedMistakes(lesson.id, locale).map((m) =>
        t("uni.commonMistakePrefix", { text: m })
      ),
    ];
    const text = parts.join(". ");
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate = 1;
    utter.onend = () => setSpeechPlaying(false);
    utter.onerror = () => setSpeechPlaying(false);
    setSpeechPlaying(true);
    window.speechSynthesis.speak(utter);
  };

  const toggleLessonAudio = (lesson: CatalogLesson) => {
    if (!speechSupported) return;
    const synth = window.speechSynthesis;
    if (synth.speaking && !synth.paused) {
      synth.pause();
      setSpeechPlaying(false);
      return;
    }
    if (synth.paused) {
      synth.resume();
      setSpeechPlaying(true);
      return;
    }
    playLessonAudio(lesson);
  };

  const startQuiz = async () => {
    setError(null);
    if (!authenticated) {
      setError(t("uni.examSignIn"));
      return;
    }
    if (!allComplete) {
      setError(t("uni.completeModulesBeforeExam"));
      return;
    }
    setSubmitting(true);
    try {
      await syncLessonsToServer(Array.from(completedSet));
      const res = await fetch("/api/trading-university/quiz", { credentials: "include" });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || t("uni.examStartFailed"));
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
          ? t("uni.examResumed")
          : t("uni.timedExamStart", { min: examMinutes })
      );
      setView("quiz");
    } catch {
      setError(t("uni.examNetwork"));
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
          setError(data.error || t("uni.examGradeFailed"));
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
          missedLessonIds: Array.isArray(data.missedLessonIds) ? data.missedLessonIds : [],
        });
        setView("result");
      } catch {
        setError(t("uni.examSubmitNetwork"));
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
            setProctorWarning(t("uni.proctorSubmit"));
            void submitQuiz({ reason: "tab_leaves" });
          } else {
            setProctorWarning(
              t("uni.proctorLeaves", {
                count: n,
                max: TRADING_UNIVERSITY_MAX_TAB_LEAVES,
              })
            );
          }
        })
        .catch(() => {
          setProctorWarning(t("uni.proctorStay"));
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
      graduateName: progress.displayName || t("uni.graduate"),
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
      setError(t("uni.certDownloadFailed"));
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
      setError(t("uni.certShareFailed"));
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
      setError(t("uni.copyFailed"));
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
            {shareCopied ? t("uni.copied") : t("uni.copyText")}
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
        {t("uni.loading")}
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
    /* Solid paints only — translucent cards + GPU layer hacks smear on Android tablet Chrome (and other WebViews). */
    <div className="px-3 sm:px-6 pb-16 space-y-6 overflow-x-clip">
      <header className="relative rounded-2xl border border-cyan-500/25 bg-slate-950 px-5 py-8 sm:px-8 sm:py-10 text-slate-50">
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2 max-w-2xl">
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300/90">
              <GraduationCap className="h-4 w-4" />
              NovaStaris
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight text-white">
              {t("uni.heroTitle")}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
              {t("uni.heroBlurb")}
            </p>
          </div>
          <div className="rounded-xl border border-white/15 bg-slate-900 px-4 py-3 text-sm">
            <p className="text-slate-400 text-xs uppercase tracking-wide">
              {fullAccess ? t("uni.courseProgress") : t("uni.preview")}
            </p>
            <p className="mt-1 font-mono text-lg text-cyan-200">
              {fullAccess ? (
                <>{t("uni.modulesDone", { done: completedCount, total: lessons.length })}</>
              ) : (
                <>{t("uni.modulesTotal", { total: lessons.length })}</>
              )}
            </p>
            {progress?.quizPassed ? (
              <p className="mt-1 text-emerald-300 text-xs flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> {t("uni.courseCompletedBadge")}
              </p>
            ) : (
              <p className="mt-1 text-slate-400 text-xs">
                {t("uni.finalExamLine", { pass: passCorrect, total: quizSize, pct: passPct })}
              </p>
            )}
          </div>
        </div>
      </header>

      {!fullAccess && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {t("uni.previewModeTitle")}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {t("uni.previewModeBody")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button asChild size="sm">
              <Link href="/register">{t("uni.enrollFree")}</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/signin">{t("uni.signIn")}</Link>
            </Button>
          </div>
        </div>
      )}

      {fullAccess && !progress?.quizPassed && lessons[0] && (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              {completedCount === 0
                ? t("uni.startModule01")
                : allComplete
                  ? t("uni.modulesComplete")
                  : t("uni.continueLeftOff")}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {completedCount === 0
                ? t("uni.openToBegin", { title: lessons[0].title })
                : allComplete
                  ? t("uni.scrollToExam")
                  : t("uni.nextUp", { title: resumeLesson?.title ?? lessons[0].title })}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {completedCount === 0 ? (
              <Button type="button" size="sm" onClick={() => openLesson(lessons[0]!)} className="gap-1">
                {t("uni.startCourse")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : allComplete ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  document.getElementById("tu-final-exam")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                {t("uni.goToFinalExam")}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={() => openLesson(resumeLesson ?? lessons[0]!)}
                className="gap-1"
              >
                {t("uni.continue")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-amber-600 dark:text-amber-400 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
          {error}
        </p>
      )}
      {donationNote && (
        <p className="text-sm text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
          {donationNote}
        </p>
      )}

      {view === "home" && (
        <>
          {fullAccess && progress?.quizPassed && donationsEnabled && (
            <UniversityDonationCard variant="compact" />
          )}
          {fullAccess && (
            <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    {t("uni.progressPct", { pct: progressPct })}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("uni.modulesDone", { done: completedCount, total: lessons.length })}
                    {minutesRemaining > 0
                      ? t("uni.minRemaining", { min: minutesRemaining })
                      : progress?.quizPassed
                        ? t("uni.courseCompleteShort")
                        : t("uni.readyForExam")}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {resumeLesson && !progress?.quizPassed && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openLesson(resumeLesson)}
                      className="gap-1"
                    >
                      {t("uni.continueNamed", { title: resumeLesson.title })}
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setFlashIndex(0);
                      setFlashRevealed(false);
                      setView("flashcards");
                    }}
                  >
                    {t("uni.glossaryFlashcards")}
                  </Button>
                </div>
              </div>
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-cyan-500 transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <p className="text-xs text-muted-foreground w-full sm:w-auto sm:mr-2 self-center">
                  {t("uni.cheatSheets")}
                </p>
                {(["foundations", "markets", "applied"] as CourseTrack[]).map((track) => (
                  <Button
                    key={track}
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8 text-xs"
                    onClick={() => {
                      try {
                        downloadTrackCheatSheet(track, lessons);
                      } catch {
                        setError(t("uni.cheatFailed"));
                      }
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    {trackUi(track).label}
                  </Button>
                ))}
              </div>
            </section>
          )}

          <div className="space-y-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              {t("uni.syllabus")}
            </h2>
            {(["foundations", "markets", "applied"] as CourseTrack[]).map((track) => {
              const trackLessons = lessons.filter((l) => getLessonTrack(l) === track);
              if (trackLessons.length === 0) return null;
              const meta = trackUi(track);
              return (
                <div key={track}>
                  <div className="mb-3">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      {meta.label}
                      <span className="ml-2 text-[11px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300">
                        {meta.level}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{meta.blurb}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {trackLessons.map((lesson) => {
                      const i = lessons.findIndex((l) => l.id === lesson.id);
                      const done = completedSet.has(lesson.id);
                      const locked = !!lesson.locked;
                      return (
                        <button
                          key={lesson.id}
                          type="button"
                          onClick={() => openLesson(lesson)}
                          className="group text-left rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 transition hover:border-cyan-500/50 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="text-[11px] font-mono text-zinc-500">
                              {t("uni.moduleN", { n: String(i + 1).padStart(2, "0") })}
                            </span>
                            {locked ? (
                              <Lock className="h-4 w-4 text-zinc-400 shrink-0" />
                            ) : done ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                            ) : (
                              <BookOpen className="h-4 w-4 text-zinc-400 group-hover:text-cyan-500 shrink-0" />
                            )}
                          </div>
                          <h3 className="mt-2 font-semibold text-zinc-900 dark:text-zinc-50">
                            {lesson.title}
                          </h3>
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                            {lesson.subtitle}
                          </p>
                          <p className="mt-3 text-[11px] text-zinc-500">
                            {locked ? t("uni.enrollUnlock") : t("uni.minutes", { min: lesson.estimatedMinutes })}
                            {!locked && !fullAccess ? t("uni.freePreview") : ""}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <section className="rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 p-4 sm:p-5 space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{t("uni.glossary")}</h2>
            <div className="flex flex-wrap gap-2">
              <input
              value={glossaryQuery}
              onChange={(e) => setGlossaryQuery(e.target.value)}
              placeholder={t("uni.searchTerms")}
              className="flex-1 min-w-[12rem] rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm"
            />
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setFlashIndex(0);
                  setFlashRevealed(false);
                  setView("flashcards");
                }}
              >
                {t("uni.flashcards")}
              </Button>
            </div>
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

          <section
            id="tu-final-exam"
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                {t("uni.readyForExamTitle")}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {t("uni.examIntro", {
                quizSize,
                examMinutes,
                passCorrect,
                passPct,
              })}
            </p>

            {progress?.quizPassed ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3 text-center sm:text-left">
                <p className="text-emerald-800 dark:text-emerald-200 font-medium">
                  {t("uni.passedLine", {
                    name: progress.displayName
                      ? t("uni.congratulationsName", { name: progress.displayName })
                      : "",
                    course: t("uni.completedCourse"),
                    score:
                      progress.quizBestScorePct != null
                        ? t("uni.passedWithScore", { pct: progress.quizBestScorePct })
                        : "",
                  })}
                </p>
                {certPayload() && shareButtons(certPayload()!)}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                {!authenticated ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Lock className="h-4 w-4 text-zinc-500" />
                    <span className="text-sm text-muted-foreground">
                      {t("uni.enrollUnlockCourse")}
                    </span>
                    <Button asChild size="sm">
                      <Link href="/register">{t("uni.enrollFree")}</Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/signin">{t("uni.signIn")}</Link>
                    </Button>
                  </div>
                ) : !allComplete ? (
                  <p className="text-sm text-muted-foreground">
                    {t("uni.markAllModules", { total: lessons.length, done: completedCount })}
                  </p>
                ) : progress && !progress.canAttemptQuiz && progress.nextAttemptAt ? (
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    {t("uni.dailyAttemptUsed", {
                      when: `${new Date(progress.nextAttemptAt).toLocaleString()} (UTC)`,
                    })}
                  </p>
                ) : (
                  <Button type="button" disabled={submitting} onClick={() => void startQuiz()}>
                    {submitting
                      ? t("uni.starting")
                      : progress?.examInProgress
                        ? t("uni.resumeExam")
                        : t("uni.startExamSized", { count: quizSize, min: examMinutes })}
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
            {t("uni.courseSyllabusNav")}
          </Button>

          {activeLesson.locked ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 space-y-4 text-center">
              <Lock className="h-8 w-8 mx-auto text-zinc-400" />
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {activeLesson.title}
              </h2>
              <p className="text-sm text-muted-foreground">{activeLesson.subtitle}</p>
              <p className="text-sm text-muted-foreground">{t("uni.lockedModuleBody")}</p>
              <div className="flex justify-center gap-2">
                <Button asChild>
                  <Link href="/register">{t("uni.enrollFree")}</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href="/signin">{t("uni.signIn")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-700 dark:text-cyan-300 mb-1">
                  {trackUi(getLessonTrack(activeLesson)).label} ·{" "}
                  {trackUi(getLessonTrack(activeLesson)).level}
                </p>
                <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                  {activeLesson.title}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">{activeLesson.subtitle}</p>
                {!fullAccess && (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    {t("uni.freePreviewBanner")}
                  </p>
                )}
                {speechSupported && !activeLesson.locked && activeLesson.sections.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => toggleLessonAudio(activeLesson)}
                    >
                      {speechPlaying ? (
                        <Pause className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {speechPlaying ? t("uni.pauseAudio") : t("uni.playAudio")}
                    </Button>
                    {speechPlaying && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="gap-1.5"
                        onClick={() => {
                          stopSpeech();
                          setSpeechPlaying(false);
                        }}
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        Stop
                      </Button>
                    )}
                    <p className="text-[11px] text-muted-foreground self-center">
                      Uses your device’s free read-aloud voice
                    </p>
                  </div>
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
              {activeLesson.id === "crypto-futures" && (
                <>
                  <UniversityLongShortDiagram />
                  <UniversityIsolatedCrossDiagram />
                  <UniversityFundingDiagram />
                  <UniversityMarkVsLastDiagram />
                  <UniversityLiquidationPathDiagram />
                </>
              )}
              {activeLesson.diagram === "candles" && <UniversityCandlesDiagram />}
              {activeLesson.id === "chart-basics" && (
                <>
                  <UniversityCandleAtlasDiagram />
                  <UniversityFibDiagram />
                  <UniversityChartPatternsDiagram />
                </>
              )}
              {activeLesson.diagram === "sessions" && <UniversitySessionsDiagram />}
              {activeLesson.id === "forex" && <UniversityForexPipDiagram />}
              {activeLesson.diagram === "metals" && (
                <div className="space-y-3">
                  <UniversityMetalsRailsDiagram />
                  <UniversityGoldPipDiagram />
                </div>
              )}
              {activeLesson.diagram === "journal" && <UniversityJournalDiagram />}
              {activeLesson.diagram === "structure" && (
                <div className="space-y-3">
                  <UniversityMarketRegimesDiagram />
                  <UniversityStructureDiagram />
                  <UniversityLiquidityGrabDiagram />
                  <UniversityInstitutionalFlowDiagram />
                </div>
              )}
              {activeLesson.diagram === "styles" && <UniversityTradingStylesDiagram />}
              {activeLesson.diagram === "volume" && <UniversityVolumeVwapDiagram />}
              {activeLesson.diagram === "eth-l2" && <UniversityEthL2Diagram />}
              {activeLesson.diagram === "options" && <UniversityOptionsVolDiagram />}
              {activeLesson.diagram === "backtest" && <UniversityBacktestDiagram />}
              {activeLesson.diagram === "workflow" && <UniversityWorkflowDiagram />}
              {activeLesson.diagram === "cex-dex" && <UniversityCexDexDiagram />}
              {activeLesson.diagram === "wallet" && (
                <>
                  <UniversityWalletDiagram />
                  <UniversityPhishingDiagram />
                </>
              )}
              {activeLesson.diagram === "risk" && <UniversityRiskDiagram />}
              {activeLesson.diagram === "narrative" && <UniversityNarrativeDiagram />}
              {activeLesson.diagram === "solana" && <UniversitySolanaDiagram />}
              {activeLesson.diagram === "lifecycle" && (
                <>
                  <UniversityLifecycleDiagram />
                  <UniversityBondingCurveDiagram />
                </>
              )}
              {activeLesson.diagram === "bsc-check" && <UniversityBscCheckDiagram />}
              {activeLesson.diagram === "probability" && <UniversityProbabilityDiagram />}
              {activeLesson.diagram === "funding" && (
                <>
                  <UniversityFundingDiagram />
                  <UniversityAdvancedTrioDiagram />
                </>
              )}
              {activeLesson.diagram === "orders" && <UniversityOrdersDiagram />}
              {activeLesson.diagram === "fib" && <UniversityFibDiagram />}
              {(activeLesson.workedExamples?.length ?? 0) > 0 && (
                <section className="space-y-3">
                  <h3 className="text-sm font-semibold text-violet-700 dark:text-violet-300">
                    {t("uni.workedExamples")}
                  </h3>
                  <p className="text-[11px] text-muted-foreground -mt-1">
                    {t("uni.workedExamplesHint")}
                  </p>
                  {activeLesson.workedExamples!.map((ex) => (
                    <div
                      key={ex.title}
                      className="rounded-xl border border-violet-400/40 bg-violet-500/10 dark:bg-violet-950/40 p-4 space-y-3"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-violet-600 text-white text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5">
                          {t("uni.exampleNotSignal")}
                        </span>
                        <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                          {ex.title}
                        </h4>
                      </div>
                      <ul className="space-y-1 text-xs text-zinc-700 dark:text-zinc-300 list-disc pl-4">
                        {ex.setup.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                      <ol className="space-y-1.5 text-sm text-zinc-800 dark:text-zinc-200 list-decimal pl-5">
                        {ex.steps.map((step) => (
                          <li key={step.slice(0, 40)}>{step}</li>
                        ))}
                      </ol>
                      <p className="text-xs font-medium text-violet-800 dark:text-violet-200 border-t border-violet-400/20 pt-2">
                        {t("uni.takeaway", { text: ex.takeaway })}
                      </p>
                    </div>
                  ))}
                </section>
              )}
              {getLocalizedMistakes(activeLesson.id, locale).length > 0 && (
                <section className="rounded-lg border border-amber-500/25 bg-amber-500/5 p-4 space-y-2">
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                    {t("uni.commonMistakes")}
                  </h3>
                  <ul className="space-y-1.5 text-sm text-zinc-700 dark:text-zinc-300 list-disc pl-5">
                    {getLocalizedMistakes(activeLesson.id, locale).map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </section>
              )}
              <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-2">
                <h3 className="text-sm font-semibold">{t("uni.keyTerms")}</h3>
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
              {(() => {
                const tools = (activeLesson.relatedTools ?? []).filter((t) =>
                  isToolHrefAvailable ? isToolHrefAvailable(t.href) : true
                );
                if (tools.length === 0) return null;
                return (
                  <section className="space-y-2">
                    <h3 className="text-sm font-semibold">{t("uni.tryNext")}</h3>
                    <div className="flex flex-wrap gap-2">
                      {tools.map((t) => (
                        <Button
                          key={t.href + t.label}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            if (onOpenToolHref) {
                              onOpenToolHref(t.href);
                              return;
                            }
                            window.location.assign(t.href);
                          }}
                        >
                          {t.label}
                        </Button>
                      ))}
                    </div>
                  </section>
                );
              })()}
              {fullAccess && (
                <section className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                  <h3 className="text-sm font-semibold">{t("uni.chapterCheck")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("uni.chapterCheckBlurb", { pass: TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT })}
                  </p>
                  {chapterQuizDone.includes(activeLesson.id) && (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">
                      {t("uni.chapterCheckDone")}
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
                            else setError(data.error || t("uni.chapterCheckFailed"));
                          })
                          .catch(() => setError(t("uni.chapterCheckFailed")))
                          .finally(() => setPracticeLoading(false));
                      }}
                    >
                      {practiceLoading ? t("common.loading") : t("uni.startChapterCheck")}
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
                                  if (data.correct >= TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT) {
                                    setChapterQuizDone(markChapterQuizDone(activeLesson.id));
                                    setError(null);
                                  } else {
                                    setError(
                                      t("uni.chapterCheckNeed", {
                                        pass: TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT,
                                        total: data.total,
                                      })
                                    );
                                  }
                                }
                              });
                          }}
                        >
                          {t("uni.checkAnswers")}
                        </Button>
                      ) : practiceResult.correct >= TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT ? (
                        <p className="text-sm text-emerald-700 dark:text-emerald-300">
                          {t("uni.chapterCheckPassed", {
                            correct: practiceResult.correct,
                            total: practiceResult.total,
                          })}
                        </p>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-sm text-amber-700 dark:text-amber-300">
                            {t("uni.chapterCheckRetryNeed", {
                              correct: practiceResult.correct,
                              total: practiceResult.total,
                              pass: TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT,
                            })}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setPracticeQs(null);
                              setPracticeResult(null);
                              setPracticeAnswers({});
                              setError(null);
                            }}
                          >
                            {t("uni.retryChapterCheck")}
                          </Button>
                        </div>
                      )}
                      {practiceResult &&
                        practiceResult.correct >= TRADING_UNIVERSITY_CHAPTER_PASS_CORRECT && (
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
                            {t("uni.closeChapterCheck")}
                          </Button>
                        )}
                      {!practiceResult && (
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
                          {t("uni.closeChapterCheck")}
                        </Button>
                      )}
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
                      ? t("uni.markedComplete")
                      : chapterQuizDone.includes(activeLesson.id)
                        ? t("uni.markComplete")
                        : t("uni.finishChapterFirst")}
                  </Button>
                ) : (
                  <Button asChild className="gap-2">
                    <Link href="/register">
                      <Lock className="h-4 w-4" />
                      {t("uni.enrollContinue")}
                    </Link>
                  </Button>
                )}
                <Button type="button" variant="ghost" onClick={() => setView("home")}>
                  {t("uni.backToSyllabus")}
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
                  window.confirm(t("uni.leaveExamConfirm", { min: examMinutes }))
                ) {
                  setView("home");
                }
              }}
            >
              {t("uni.leaveExamScreen")}
            </Button>
            <div className="text-right">
              <p
                className={`text-sm font-mono font-semibold ${
                  examSecondsLeft != null && examSecondsLeft <= 300
                    ? "text-rose-500"
                    : "text-zinc-800 dark:text-zinc-100"
                }`}
              >
                {t("uni.timeLeft", { clock: formatExamClock(examSecondsLeft) })}
              </p>
              <p className="text-xs font-mono text-muted-foreground">
                {t("uni.questionOf", { n: quizIndex + 1, total: questions.length })}
                {tabLeaveCount > 0
                  ? t("uni.tabLeaves", {
                      count: tabLeaveCount,
                      max: TRADING_UNIVERSITY_MAX_TAB_LEAVES,
                    })
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
                    <ChevronLeft className="h-4 w-4" /> {t("uni.prev")}
                  </Button>
                  {quizIndex < questions.length - 1 ? (
                    <Button
                      type="button"
                      size="sm"
                      disabled={answers[q.id] == null}
                      onClick={() => setQuizIndex((i) => i + 1)}
                      className="gap-1"
                    >
                      {t("uni.next")} <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting || questions.some((qq) => answers[qq.id] == null)}
                      onClick={() => void submitQuiz({ reason: "submit" })}
                    >
                      {submitting ? t("uni.grading") : t("uni.submitExam")}
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
                {t("uni.congratulations", {
                  name: progress?.displayName
                    ? t("uni.congratulationsName", { name: progress.displayName })
                    : "",
                })}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t("uni.youScoredEarned", {
                  correct: result.correct,
                  total: result.total,
                  pct: result.scorePct,
                })}
                {t("uni.certificate")}
              </p>
              {donationsEnabled && <UniversityDonationCard variant="full" />}
              {certPayload() && shareButtons(certPayload()!)}
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
                {result.timedOut
                  ? t("uni.timesUp")
                  : result.tabLeaveFail
                    ? t("uni.attemptEnded")
                    : t("uni.notQuite")}
              </h2>
              <p className="text-sm text-muted-foreground">
                {result.timedOut
                  ? t("uni.timedOutScore", {
                      min: examMinutes,
                      correct: result.correct,
                      total: result.total,
                      pct: result.scorePct,
                    })
                  : result.tabLeaveFail
                    ? t("uni.tabLeaveScore", {
                        correct: result.correct,
                        total: result.total,
                        pct: result.scorePct,
                      })
                    : t("uni.failedScore", {
                        correct: result.correct,
                        total: result.total,
                        pct: result.scorePct,
                        pass: passCorrect,
                        quizSize,
                        passPct,
                      })}{" "}
                {t("uni.reviewTryTomorrow")}
              </p>
              {progress?.nextAttemptAt && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {t("uni.nextAttemptAfter", {
                    when: new Date(progress.nextAttemptAt).toLocaleString(),
                  })}
                </p>
              )}
              {result.missedLessonIds && result.missedLessonIds.length > 0 && (
                <div className="text-left rounded-xl border border-zinc-200 dark:border-zinc-700 p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 text-center">
                    {t("uni.reviewModules")}
                  </h3>
                  <p className="text-xs text-muted-foreground text-center">
                    {t("uni.reviewModulesHint")}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {result.missedLessonIds.map((id) => {
                      const lesson = lessons.find((l) => l.id === id);
                      if (!lesson) return null;
                      return (
                        <Button
                          key={id}
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openLesson(lesson)}
                        >
                          {lesson.title}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
          <Button type="button" variant="outline" onClick={() => setView("home")}>
            {t("uni.backToUniversity")}
          </Button>
        </div>
      )}

      {view === "flashcards" && (
        <div className="max-w-lg mx-auto space-y-4 py-4">
          <Button type="button" variant="ghost" size="sm" className="gap-1 -ml-2" onClick={() => setView("home")}>
            <ChevronLeft className="h-4 w-4" />
            {t("uni.backToSyllabus")}
          </Button>
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">{t("uni.glossaryFlashcards")}</h2>
          {flashCards.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("uni.noGlossary")}</p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                {t("uni.flashCardOf", { n: flashIndex + 1, total: flashCards.length })}
              </p>
              <button
                type="button"
                onClick={() => setFlashRevealed((v) => !v)}
                className="w-full min-h-[160px] rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 text-left space-y-3"
              >
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {flashCards[flashIndex]?.term}
                </p>
                {flashRevealed ? (
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {flashCards[flashIndex]?.definition}
                    <span className="block mt-2 text-[11px] text-zinc-500">
                      {t("uni.fromLesson", { title: flashCards[flashIndex]?.lessonTitle ?? "" })}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-cyan-700 dark:text-cyan-300">{t("uni.tapReveal")}</p>
                )}
              </button>
              <div className="flex justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={flashIndex <= 0}
                  onClick={() => {
                    setFlashIndex((i) => Math.max(0, i - 1));
                    setFlashRevealed(false);
                  }}
                >
                  {t("uni.flashPrev")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={flashIndex >= flashCards.length - 1}
                  onClick={() => {
                    setFlashIndex((i) => Math.min(flashCards.length - 1, i + 1));
                    setFlashRevealed(false);
                  }}
                >
                  {t("uni.flashNext")}
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
