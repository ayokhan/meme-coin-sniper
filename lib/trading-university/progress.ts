import { prisma } from "@/lib/db";
import {
  TRADING_UNIVERSITY_EXAM_MINUTES,
  allLessonIds,
} from "@/lib/trading-university/content";

export const EXAM_DURATION_MS = TRADING_UNIVERSITY_EXAM_MINUTES * 60_000;

export type TradingUniversityProgressRow = {
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
  quizExamStartedAt: string | null;
  examExpiresAt: string | null;
  examInProgress: boolean;
  examTabLeaveCount: number;
};

export type DbProgress = {
  completedLessons: unknown;
  quizPassed: boolean;
  quizBestScorePct: number | null;
  quizPassedAt: Date | null;
  certificateCode: string | null;
  lastAttemptAt: Date | null;
  lastFailedAt: Date | null;
  attemptCount: number;
  quizExamStartedAt?: Date | null;
  examTabLeaveCount?: number;
  examSetId?: string | null;
};

function parseLessonIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const allowed = new Set(allLessonIds());
  return raw.filter((x): x is string => typeof x === "string" && allowed.has(x));
}

/** UTC calendar day key YYYY-MM-DD */
export function utcDayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export function nextUtcMidnightIso(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const day = from.getUTCDate();
  return new Date(Date.UTC(y, m, day + 1, 0, 0, 0, 0)).toISOString();
}

export function examExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + EXAM_DURATION_MS);
}

export function isExamInProgress(row: {
  quizExamStartedAt?: Date | null;
  lastAttemptAt: Date | null;
}): boolean {
  const started = row.quizExamStartedAt ?? null;
  if (!started) return false;
  if (row.lastAttemptAt && row.lastAttemptAt.getTime() >= started.getTime()) return false;
  return true;
}

export function isExamExpired(row: { quizExamStartedAt?: Date | null }, now = new Date()): boolean {
  const started = row.quizExamStartedAt ?? null;
  if (!started) return false;
  return now.getTime() > examExpiresAt(started).getTime();
}

/** One graded attempt per UTC day until passed. Active timed sessions can resume. */
export function canAttemptQuizToday(row: {
  quizPassed: boolean;
  lastAttemptAt: Date | null;
  quizExamStartedAt?: Date | null;
}): { allowed: boolean; nextAttemptAt: string | null; resume: boolean } {
  if (row.quizPassed) return { allowed: false, nextAttemptAt: null, resume: false };
  if (isExamInProgress(row) && !isExamExpired(row)) {
    return { allowed: true, nextAttemptAt: null, resume: true };
  }
  if (!row.lastAttemptAt) return { allowed: true, nextAttemptAt: null, resume: false };
  if (utcDayKey(row.lastAttemptAt) === utcDayKey()) {
    return { allowed: false, nextAttemptAt: nextUtcMidnightIso(), resume: false };
  }
  return { allowed: true, nextAttemptAt: null, resume: false };
}

function progressDelegate() {
  return (prisma as unknown as {
    tradingUniversityProgress: {
      findUnique: (args: { where: { userId: string } }) => Promise<DbProgress | null>;
      upsert: (args: {
        where: { userId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => Promise<DbProgress>;
    };
  }).tradingUniversityProgress;
}

export async function getOrCreateProgress(userId: string): Promise<DbProgress> {
  const db = progressDelegate();
  const existing = await db.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.upsert({
    where: { userId },
    create: { userId, completedLessons: [] },
    update: {},
  });
}

export function serializeProgress(
  row: DbProgress,
  displayName: string | null
): TradingUniversityProgressRow {
  const completedLessons = parseLessonIds(row.completedLessons);
  const required = allLessonIds();
  const allLessonsComplete = required.every((id) => completedLessons.includes(id));
  const attempt = canAttemptQuizToday(row);
  const inProgress = isExamInProgress(row) && !isExamExpired(row);
  const started = row.quizExamStartedAt ?? null;
  return {
    completedLessons,
    quizPassed: row.quizPassed,
    quizBestScorePct: row.quizBestScorePct,
    quizPassedAt: row.quizPassedAt?.toISOString() ?? null,
    certificateCode: row.certificateCode,
    lastAttemptAt: row.lastAttemptAt?.toISOString() ?? null,
    lastFailedAt: row.lastFailedAt?.toISOString() ?? null,
    attemptCount: row.attemptCount,
    canAttemptQuiz: allLessonsComplete && attempt.allowed,
    nextAttemptAt: attempt.nextAttemptAt,
    allLessonsComplete,
    displayName,
    quizExamStartedAt: started?.toISOString() ?? null,
    examExpiresAt: inProgress && started ? examExpiresAt(started).toISOString() : null,
    examInProgress: inProgress,
    examTabLeaveCount: row.examTabLeaveCount ?? 0,
  };
}

export async function markLessonComplete(userId: string, lessonId: string): Promise<DbProgress> {
  const allowed = new Set(allLessonIds());
  if (!allowed.has(lessonId)) throw new Error("Unknown lesson");
  const row = await getOrCreateProgress(userId);
  const set = new Set(parseLessonIds(row.completedLessons));
  set.add(lessonId);
  const db = progressDelegate();
  return db.upsert({
    where: { userId },
    create: { userId, completedLessons: Array.from(set) },
    update: { completedLessons: Array.from(set) },
  });
}

export function makeCertificateCode(): string {
  const part = () => Math.random().toString(36).slice(2, 6).toUpperCase();
  return `NS-TU-${part()}-${part()}`;
}

/** Close an expired exam session as a failed daily attempt. */
export async function finalizeExpiredExam(userId: string, row: DbProgress): Promise<DbProgress> {
  if (!isExamInProgress(row) || !isExamExpired(row)) return row;
  const now = new Date();
  const db = progressDelegate();
  return db.upsert({
    where: { userId },
    create: {
      userId,
      completedLessons: parseLessonIds(row.completedLessons),
      lastAttemptAt: now,
      lastFailedAt: now,
      attemptCount: 1,
      quizExamStartedAt: null,
      examTabLeaveCount: 0,
    },
    update: {
      lastAttemptAt: now,
      lastFailedAt: now,
      attemptCount: (row.attemptCount ?? 0) + 1,
      quizExamStartedAt: null,
      examTabLeaveCount: 0,
      quizBestScorePct: row.quizBestScorePct ?? 0,
    },
  });
}
