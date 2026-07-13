import {
  COURSE_TRACK_META,
  getLessonTrack,
  TRADING_UNIVERSITY_LESSONS,
  type CourseTrack,
  type UniversityLesson,
} from "@/lib/trading-university/content";
import { getCommonMistakes } from "@/lib/trading-university/common-mistakes";

/** One-page canvas cheat sheet per track (Foundations / Markets / Applied). */
export function downloadTrackCheatSheet(
  track: CourseTrack,
  lessons: UniversityLesson[] = TRADING_UNIVERSITY_LESSONS
) {
  const meta = COURSE_TRACK_META[track];
  const trackLessons = lessons.filter((l) => getLessonTrack(l) === track);
  const w = 1100;
  const lineH = 22;
  const pad = 48;
  let yEstimate = 160;
  for (const lesson of trackLessons) {
    yEstimate += lineH + 8;
    yEstimate += Math.min(getCommonMistakes(lesson.id).length, 3) * lineH;
    yEstimate += 16;
  }
  const h = Math.max(1400, yEstimate + 80);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, "#0c1222");
  grad.addColorStop(1, "#132038");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(34, 211, 238, 0.45)";
  ctx.lineWidth = 3;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.fillStyle = "rgba(34, 211, 238, 0.95)";
  ctx.font = "600 20px system-ui, sans-serif";
  ctx.fillText("NOVASTARIS TRADING UNIVERSITY", pad, 64);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "700 36px Georgia, serif";
  ctx.fillText(`${meta.label} cheat sheet`, pad, 110);

  ctx.fillStyle = "rgba(148, 163, 184, 0.95)";
  ctx.font = "400 16px system-ui, sans-serif";
  ctx.fillText(`${meta.level} · ${meta.blurb}`, pad, 140);

  let y = 180;
  for (const lesson of trackLessons) {
    ctx.fillStyle = "#67e8f9";
    ctx.font = "600 18px system-ui, sans-serif";
    ctx.fillText(lesson.title, pad, y);
    y += lineH;

    ctx.fillStyle = "rgba(226, 232, 240, 0.9)";
    ctx.font = "400 14px system-ui, sans-serif";
    const mistakes = getCommonMistakes(lesson.id).slice(0, 3);
    if (mistakes.length === 0) {
      ctx.fillText(`• ${lesson.subtitle}`, pad + 8, y);
      y += lineH;
    } else {
      for (const m of mistakes) {
        const text = `• Avoid: ${m}`;
        const maxW = w - pad * 2;
        // simple wrap
        const words = text.split(" ");
        let line = "";
        for (const word of words) {
          const test = line ? `${line} ${word}` : word;
          if (ctx.measureText(test).width > maxW) {
            ctx.fillText(line, pad + 8, y);
            y += lineH;
            line = word;
          } else {
            line = test;
          }
        }
        if (line) {
          ctx.fillText(line, pad + 8, y);
          y += lineH;
        }
      }
    }
    y += 14;
  }

  ctx.fillStyle = "rgba(100, 116, 139, 0.95)";
  ctx.font = "400 12px system-ui, sans-serif";
  ctx.fillText("novastaris.ai · Educational only · Not financial advice", pad, h - 40);

  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = `novastaris-${track}-cheat-sheet.png`;
  a.click();
}
