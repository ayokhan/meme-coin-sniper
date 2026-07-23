import type { AppLocale } from "@/lib/i18n/locales";
import type { UniversityLesson } from "@/lib/trading-university/content";
import { COMMON_MISTAKES_BY_LESSON } from "@/lib/trading-university/common-mistakes";
import titlesJson from "@/lib/trading-university/locales/titles.json";
import frLessons from "@/lib/trading-university/locales/fr.json";
import yoLessons from "@/lib/trading-university/locales/yo.json";

export type LessonOverlay = {
  id: string;
  title?: string;
  subtitle?: string;
  sections?: { heading: string; body: string[] }[];
  keyTerms?: { term: string; definition: string }[];
  workedExamples?: {
    title: string;
    setup: string[];
    steps: string[];
    takeaway: string;
  }[];
  relatedTools?: { label: string; href: string }[];
  mistakes?: string[];
};

type TitlesPack = Record<string, Record<string, { title: string; subtitle: string }>>;

const TITLES = titlesJson as TitlesPack;
const FULL_LESSON_PACKS: Partial<Record<AppLocale, LessonOverlay[]>> = {
  fr: frLessons as LessonOverlay[],
  yo: yoLessons as LessonOverlay[],
};

function overlayById(pack: LessonOverlay[] | undefined): Map<string, LessonOverlay> {
  const map = new Map<string, LessonOverlay>();
  for (const row of pack ?? []) {
    if (row?.id) map.set(row.id, row);
  }
  return map;
}

const FULL_BY_LOCALE = new Map(
  (Object.keys(FULL_LESSON_PACKS) as AppLocale[]).map((locale) => [
    locale,
    overlayById(FULL_LESSON_PACKS[locale]),
  ])
);

/** Localized common mistakes for a lesson (falls back to English source). */
export function getLocalizedMistakes(lessonId: string, locale: AppLocale): string[] {
  const full = FULL_BY_LOCALE.get(locale)?.get(lessonId);
  if (full?.mistakes && full.mistakes.length > 0) return full.mistakes;
  return COMMON_MISTAKES_BY_LESSON[lessonId] ?? [];
}

/**
 * Apply locale overlays onto an English catalog lesson.
 * Full body packs (e.g. French) win over title-only packs.
 */
export function localizeLesson<T extends UniversityLesson>(lesson: T, locale: AppLocale): T {
  if (locale === "en") return lesson;

  const full = FULL_BY_LOCALE.get(locale)?.get(lesson.id);
  const titles = TITLES[locale]?.[lesson.id];

  const title = full?.title ?? titles?.title ?? lesson.title;
  const subtitle = full?.subtitle ?? titles?.subtitle ?? lesson.subtitle;

  if (!full && !titles) return lesson;

  return {
    ...lesson,
    title,
    subtitle,
    sections: full?.sections?.length ? full.sections : lesson.sections,
    keyTerms: full?.keyTerms?.length ? full.keyTerms : lesson.keyTerms,
    workedExamples: full?.workedExamples?.length
      ? full.workedExamples
      : lesson.workedExamples,
    relatedTools:
      full?.relatedTools?.length && lesson.relatedTools
        ? lesson.relatedTools.map((tool, i) => ({
            ...tool,
            label: full.relatedTools![i]?.label ?? tool.label,
          }))
        : lesson.relatedTools,
  };
}

export function localizeLessons<T extends UniversityLesson>(
  lessons: T[],
  locale: AppLocale
): T[] {
  return lessons.map((l) => localizeLesson(l, locale));
}
