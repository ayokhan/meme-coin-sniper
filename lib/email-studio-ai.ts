/** Email Studio copywriting: Claude writes the framing around data tables; numbers stay in the tables. */
import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import { buildStudioFacts, type StudioFacts } from "@/lib/email-studio-data";
import { STUDIO_DISCLAIMER, checkStudioCopy, type StudioAngle, type StudioDraft } from "@/lib/email-studio-types";

const STYLES = [
  "open with a sharp question the reader has probably asked themselves",
  "open with a short, vivid scene from the trading day",
  "contrarian: challenge a common belief retail traders hold",
  "punchy and minimal: short sentences, no fluff",
  "mentor tone: calm, experienced, slightly dry humour",
  "behind-the-scenes: what the scanner saw that most traders missed",
];

type AiCopy = {
  subjects?: unknown;
  preheader?: unknown;
  headline?: unknown;
  hook?: unknown;
  notes?: unknown;
  lesson?: { title?: unknown; body?: unknown } | null;
  ctaLabel?: unknown;
};

/** Digits outside $TICKER symbols mean the AI invented a number. */
function hasStrayDigits(text: string): boolean {
  return /\d/.test(text.replace(/\$[A-Za-z0-9_]+/g, ""));
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\s+\n/g, "\n").trim();
  if (!t || t.length > max || hasStrayDigits(t)) return null;
  return t;
}

async function writeCopy(facts: StudioFacts): Promise<AiCopy | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const anthropic = new Anthropic({ apiKey });
  const style = STYLES[Math.floor(Math.random() * STYLES.length)]!;
  const sectionList = facts.sections.map((s) => `- "${s.key}": ${s.title}`).join("\n");
  const prompt = `You write marketing emails for NovaStaris, an AI trading-tools app (crypto perps, forex, gold/silver, meme coins).
This email's angle: "${facts.eyebrow}". The data tables are already built and will be shown under each section. You write ONLY the words around them.

Facts (for your understanding only):
${facts.aiContext}

Sections that will appear, in order:
${sectionList}

Style for this version: ${style}.

Hard rules:
- Do NOT write any digits or numbers (no prices, percentages, counts, multiples, dates). The tables carry every number. Refer to things qualitatively ("the biggest runner", "a tough week").
- No promises or hype: never say guaranteed, risk-free, will pump, can't lose, easy money, get rich, or predict prices.
- If the results were bad, say so plainly. Honesty is the brand.
- Plain English, no jargon without a two-word explanation. Short paragraphs. No emojis.
- Token symbols may be written like $SYMBOL exactly as in the facts.

Return ONLY JSON:
{
  "subjects": [three different subject lines, each under 55 characters, curiosity-driven, not clickbait],
  "preheader": "inbox preview text, under 100 characters, complements the subject",
  "headline": "email headline, under 70 characters",
  "hook": "opening paragraph, 2-3 sentences",
  "notes": { ${facts.sections.map((s) => `"${s.key}": "1-2 sentences introducing that table"`).join(", ")} },
  "lesson": { "title": "short title", "body": "2-3 sentences teaching: ${facts.lessonTopic}" },
  "ctaLabel": "button text, 2-5 words"
}`;
  try {
    const message = await anthropic.messages.create(
      {
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1200,
        temperature: 1,
        messages: [{ role: "user", content: prompt }],
      },
      { timeout: 45_000, maxRetries: 1 }
    );
    const text = message.content[0]?.type === "text" ? message.content[0].text : "";
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    return JSON.parse(cleaned.slice(start, end + 1)) as AiCopy;
  } catch (e) {
    console.error("[email-studio] AI copy failed:", e instanceof Error ? e.message : e);
    return null;
  }
}

export async function generateStudioDraft(angle: StudioAngle): Promise<StudioDraft> {
  const facts = await buildStudioFacts(angle);
  const ai = await writeCopy(facts);
  const fb = facts.fallback;

  const aiSubjects = Array.isArray(ai?.subjects)
    ? ai!.subjects.map((s) => cleanText(s, 90)).filter((s): s is string => !!s)
    : [];
  const subjects = [...aiSubjects, ...fb.subjects].slice(0, Math.max(3, aiSubjects.length));
  const notes = ai?.notes && typeof ai.notes === "object" ? (ai.notes as Record<string, unknown>) : {};
  const lessonTitle = cleanText(ai?.lesson?.title, 80);
  const lessonBody = cleanText(ai?.lesson?.body, 600);

  const draft: StudioDraft = {
    angle,
    generatedAt: new Date().toISOString(),
    aiUsed: !!ai,
    subjects,
    subject: subjects[0]!,
    preheader: cleanText(ai?.preheader, 140) ?? fb.preheader,
    eyebrow: facts.eyebrow,
    headline: cleanText(ai?.headline, 100) ?? fb.headline,
    hook: cleanText(ai?.hook, 700) ?? fb.hook,
    sections: facts.sections.map((s) => ({
      key: s.key,
      title: s.title,
      note: cleanText(notes[s.key], 400) ?? s.fallbackNote,
      table: s.table,
    })),
    lesson: lessonTitle && lessonBody ? { title: lessonTitle, body: lessonBody } : fb.lesson,
    cta: { label: cleanText(ai?.ctaLabel, 40) ?? facts.cta.label, url: facts.cta.url },
    disclaimer: STUDIO_DISCLAIMER,
  };

  // Any AI field that trips a hard guardrail falls back to the safe template copy.
  if (checkStudioCopy(draft).some((i) => i.level === "block")) {
    return {
      ...draft,
      aiUsed: false,
      subjects: fb.subjects,
      subject: fb.subjects[0]!,
      preheader: fb.preheader,
      headline: fb.headline,
      hook: fb.hook,
      sections: facts.sections.map((s) => ({ key: s.key, title: s.title, note: s.fallbackNote, table: s.table })),
      lesson: fb.lesson,
      cta: facts.cta,
    };
  }
  return draft;
}
