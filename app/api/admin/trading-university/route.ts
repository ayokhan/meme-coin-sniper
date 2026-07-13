import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions, isOwnerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { allLessonIds } from "@/lib/trading-university/content";
import { getAdminExamKeys } from "@/lib/trading-university/quiz";

export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function parseLessons(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string");
}

/** GET — owner: enrollments, graduates, exam keys. */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!isOwnerSession(session)) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 403 });
    }

    const rows = (await db.tradingUniversityProgress.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
    })) as Array<{
      userId: string;
      completedLessons: unknown;
      quizPassed: boolean;
      quizBestScorePct: number | null;
      quizPassedAt: Date | null;
      certificateCode: string | null;
      lastAttemptAt: Date | null;
      attemptCount: number;
      examSetId: string | null;
      createdAt: Date;
      updatedAt: Date;
      user: { id: string; email: string | null; name: string | null; createdAt: Date };
    }>;

    const required = allLessonIds();
    const students = rows.map((r) => {
      const completed = parseLessons(r.completedLessons);
      return {
        userId: r.userId,
        email: r.user.email,
        name: r.user.name,
        enrolledAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        modulesCompleted: completed.length,
        modulesTotal: required.length,
        quizPassed: r.quizPassed,
        quizBestScorePct: r.quizBestScorePct,
        quizPassedAt: r.quizPassedAt?.toISOString() ?? null,
        certificateCode: r.certificateCode,
        lastAttemptAt: r.lastAttemptAt?.toISOString() ?? null,
        attemptCount: r.attemptCount,
        examSetId: r.examSetId,
        /** Progress row exists = opened University while signed in (enrollment). */
        status:
          r.quizPassed
            ? ("graduated" as const)
            : completed.length === 0 && r.attemptCount === 0
              ? ("not_started" as const)
              : ("in_progress" as const),
      };
    });

    const enrolled = students;
    const notStarted = students.filter((s) => s.status === "not_started");
    const inProgress = students.filter((s) => s.status === "in_progress");
    const graduated = students.filter((s) => s.status === "graduated");

    return NextResponse.json({
      success: true,
      counts: {
        progressRows: students.length,
        enrolled: enrolled.length,
        notStarted: notStarted.length,
        inProgress: inProgress.length,
        graduated: graduated.length,
      },
      enrolled,
      notStarted,
      inProgress,
      graduated,
      examKeys: getAdminExamKeys(),
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
