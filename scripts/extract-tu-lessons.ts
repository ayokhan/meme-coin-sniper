import { writeFileSync } from "fs";
import { TRADING_UNIVERSITY_LESSONS } from "../lib/trading-university/content";
import { COMMON_MISTAKES_BY_LESSON } from "../lib/trading-university/common-mistakes";

const slim = TRADING_UNIVERSITY_LESSONS.map((l) => ({
  id: l.id,
  title: l.title,
  subtitle: l.subtitle,
  sections: l.sections.map((s) => ({
    heading: s.heading,
    body: s.body,
  })),
  keyTerms: l.keyTerms,
  workedExamples: l.workedExamples ?? [],
  relatedTools: l.relatedTools ?? [],
  mistakes: COMMON_MISTAKES_BY_LESSON[l.id] ?? [],
}));

writeFileSync("scripts/tu-lessons-en.json", JSON.stringify(slim, null, 2));
console.log("lessons", slim.length, "chars", JSON.stringify(slim).length);
