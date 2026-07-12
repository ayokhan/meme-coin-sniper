import { prisma } from "@/lib/db";
import { allLessonIds } from "@/lib/trading-university/content";

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
};

type DbProgress = {
  completedLessons: unknown;
  quizPassed: boolean;
  quizBestScorePct: number | null;
  quizPassedAt: Date | null;
  certificateCode: string | null;
  lastAttemptAt: Date | null;
  lastFailedAt: Date | null;
  attemptCount: number;
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

/** One graded attempt per UTC day until passed. */
export function canAttemptQuizToday(row: {
  quizPassed: boolean;
  lastAttemptAt: Date | null;
}): { allowed: boolean; nextAttemptAt: string | null } {
  if (row.quizPassed) return { allowed: false, nextAttemptAt: null };
  if (!row.lastAttemptAt) return { allowed: true, nextAttemptAt: null };
  if (utcDayKey(row.lastAttemptAt) === utcDayKey()) {
    return { allowed: false, nextAttemptAt: nextUtcMidnightIso() };
  }
  return { allowed: true, nextAttemptAt: null };
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
