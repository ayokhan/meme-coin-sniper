/**
 * Resume-friendly TU lesson translator.
 * Packs many strings per request to reduce rate limits.
 * Usage: node scripts/translate-tu-lessons.mjs fr
 *        node scripts/translate-tu-lessons.mjs titles
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translate } from "@vitalets/google-translate-api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const enPath = path.join(root, "scripts", "tu-lessons-en.json");
const outDir = path.join(root, "lib", "trading-university", "locales");
const SEP = "\n⟦§⟧\n";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function trBatch(texts, to) {
  const clean = texts.map((t) => String(t ?? ""));
  if (clean.every((t) => !t.trim())) return clean;
  // Keep batches under ~3500 chars to stay under free limits
  const chunks = [];
  let cur = [];
  let curLen = 0;
  for (const t of clean) {
    const add = t.length + SEP.length;
    if (cur.length && curLen + add > 3200) {
      chunks.push(cur);
      cur = [];
      curLen = 0;
    }
    cur.push(t);
    curLen += add;
  }
  if (cur.length) chunks.push(cur);

  const out = [];
  for (const chunk of chunks) {
    const joined = chunk.join(SEP);
    let translated = null;
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const res = await translate(joined, { to });
        translated = res.text;
        await sleep(1500);
        break;
      } catch (e) {
        const wait = Math.min(60000, 2000 * 2 ** attempt);
        console.warn(`retry ${attempt + 1} (${to}):`, e?.message ?? e, `wait ${wait}ms`);
        await sleep(wait);
      }
    }
    if (translated == null) throw new Error("Failed batch translate");
    const parts = translated.split(/\n?⟦§⟧\n?/);
    // Fallback if separator mangled
    if (parts.length !== chunk.length) {
      console.warn(`sep mismatch ${parts.length} vs ${chunk.length} — translating one-by-one`);
      for (const one of chunk) {
        if (!one.trim()) {
          out.push(one);
          continue;
        }
        let ok = null;
        for (let attempt = 0; attempt < 8; attempt++) {
          try {
            ok = (await translate(one, { to })).text;
            await sleep(1200);
            break;
          } catch (e) {
            await sleep(Math.min(60000, 2000 * 2 ** attempt));
          }
        }
        if (ok == null) throw new Error("Failed single translate");
        out.push(ok);
      }
    } else {
      out.push(...parts);
    }
  }
  return out;
}

function collectStrings(lesson) {
  const paths = [];
  const texts = [];
  const push = (pathArr, text) => {
    paths.push(pathArr);
    texts.push(text);
  };
  push(["title"], lesson.title);
  push(["subtitle"], lesson.subtitle);
  (lesson.sections ?? []).forEach((sec, si) => {
    push(["sections", si, "heading"], sec.heading);
    (sec.body ?? []).forEach((p, pi) => push(["sections", si, "body", pi], p));
  });
  (lesson.keyTerms ?? []).forEach((kt, i) => {
    push(["keyTerms", i, "definition"], kt.definition);
  });
  (lesson.workedExamples ?? []).forEach((ex, ei) => {
    push(["workedExamples", ei, "title"], ex.title);
    (ex.setup ?? []).forEach((x, i) => push(["workedExamples", ei, "setup", i], x));
    (ex.steps ?? []).forEach((x, i) => push(["workedExamples", ei, "steps", i], x));
    push(["workedExamples", ei, "takeaway"], ex.takeaway);
  });
  (lesson.relatedTools ?? []).forEach((tool, i) => {
    push(["relatedTools", i, "label"], tool.label);
  });
  (lesson.mistakes ?? []).forEach((m, i) => push(["mistakes", i], m));
  return { paths, texts };
}

function applyStrings(lesson, paths, translated) {
  const out = structuredClone(lesson);
  // Keep English terms on keyTerms
  out.keyTerms = (lesson.keyTerms ?? []).map((kt) => ({ ...kt }));
  for (let i = 0; i < paths.length; i++) {
    const pathArr = paths[i];
    let cur = out;
    for (let j = 0; j < pathArr.length - 1; j++) cur = cur[pathArr[j]];
    cur[pathArr[pathArr.length - 1]] = translated[i];
  }
  // Drop estimatedMinutes etc. — keep overlay shape
  return {
    id: lesson.id,
    title: out.title,
    subtitle: out.subtitle,
    sections: out.sections,
    keyTerms: out.keyTerms,
    workedExamples: out.workedExamples ?? [],
    relatedTools: (out.relatedTools ?? []).map((t, i) => ({
      href: lesson.relatedTools[i].href,
      label: t.label,
    })),
    mistakes: out.mistakes ?? [],
  };
}

async function translateLesson(lesson, to) {
  const { paths, texts } = collectStrings(lesson);
  const translated = await trBatch(texts, to);
  return applyStrings(lesson, paths, translated);
}

const TITLE_TARGETS = [
  ["fr", "fr"],
  ["zh-CN", "zh"],
  ["hi", "hi"],
  ["de", "de"],
  ["es", "es"],
  ["ar", "ar"],
  ["bn", "bn"],
  ["sv", "sv"],
  ["sw", "sw"],
  ["fa", "fa"],
  ["yo", "yo"],
  ["ig", "ig"],
  ["ha", "ha"],
];

async function translateTitlesOnly(lessons) {
  const dest = path.join(outDir, "titles.json");
  let out = {};
  if (fs.existsSync(dest)) {
    try {
      out = JSON.parse(fs.readFileSync(dest, "utf8"));
    } catch {
      out = {};
    }
  }
  for (const [code, key] of TITLE_TARGETS) {
    out[key] = out[key] ?? {};
    console.log(`\n=== titles: ${key} ===`);
    for (const lesson of lessons) {
      if (out[key][lesson.id]?.title) {
        console.log(`  skip ${lesson.id}`);
        continue;
      }
      const [title, subtitle] = await trBatch([lesson.title, lesson.subtitle], code);
      out[key][lesson.id] = { title, subtitle };
      fs.writeFileSync(dest, JSON.stringify(out, null, 2));
      console.log(`  ${lesson.id}`);
    }
  }
  return out;
}

async function main() {
  const mode = process.argv[2] || "fr";
  fs.mkdirSync(outDir, { recursive: true });
  const lessons = JSON.parse(fs.readFileSync(enPath, "utf8"));

  if (mode === "titles") {
    await translateTitlesOnly(lessons);
    console.log("Done titles");
    return;
  }

  const to = mode;
  const dest = path.join(outDir, `${to}.json`);
  let out = [];
  if (fs.existsSync(dest)) {
    try {
      out = JSON.parse(fs.readFileSync(dest, "utf8"));
      if (!Array.isArray(out)) out = [];
    } catch {
      out = [];
    }
  }
  const done = new Set(out.map((x) => x.id));
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    if (done.has(lesson.id)) {
      console.log(`skip ${lesson.id}`);
      continue;
    }
    console.log(`\n[${i + 1}/${lessons.length}] ${lesson.id} → ${to}`);
    const translated = await translateLesson(lesson, to);
    out.push(translated);
    // keep syllabus order
    const byId = new Map(out.map((x) => [x.id, x]));
    out = lessons.map((l) => byId.get(l.id)).filter(Boolean);
    fs.writeFileSync(dest, JSON.stringify(out, null, 2));
  }
  console.log("Done", dest, "count", out.length);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
