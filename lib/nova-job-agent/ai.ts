import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MIN_COPIED_WORDS = 6;

const RESUME_SYSTEM = `You are a senior resume writer. You rewrite a candidate's EXISTING resume so it is a stronger, more professional fit for a target role.

Hard rules:
- The candidate resume is the only source of facts. Never invent employers, job titles, dates, degrees, tools, certifications, or metrics.
- NEVER copy the job description into the resume. Do not paste responsibilities, requirements, qualifications, nice-to-haves, or "about the company/role" text. Do not reuse sentences or distinctive 5+ word phrases from the posting.
- Do not keyword-stuff. Do not dump the posting's skills list into Skills unless those skills already appear in the candidate's resume.
- Tailoring means reorder, tighten, and rephrase the candidate's real work so relevant strengths are obvious. Write in the candidate's voice: action verb + what they actually did + a result only when the source resume supports it.
- Professional summary: 3–4 original lines about the candidate. It must not read like a job posting or a paraphrase of "we are looking for…".
- Bullets are candidate-owned achievements, not employer duty lists.
- If the posting asks for something the resume does not evidence, omit it. Gaps stay gaps.
- ATS-friendly plain text only (no markdown tables, no emoji). Return ONLY the resume text.`;

const COVER_SYSTEM = `You are a senior career coach writing cover letters.

Hard rules:
- Ground every claim in the candidate resume. Never invent experience.
- NEVER copy or closely paraphrase the job description. Do not quote requirements or paste posting language.
- Write in a confident, specific, human voice. Show 2–3 relevant achievements from the resume and why they matter for this role.
- Do not open with "I am writing to apply" or restate the job posting.
- Plain text only. Return ONLY the letter.`;

function wordTokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9+#\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

function normalizePhrase(text: string): string {
  return ` ${wordTokens(text).join(" ")} `;
}

/** Longest spans of JD language that appear in `generated` but not in the source resume. */
export function copiedJdSpans(args: {
  jobDescription: string;
  sourceResume: string;
  generated: string;
  minWords?: number;
}): string[] {
  const minWords = args.minWords ?? MIN_COPIED_WORDS;
  const jdWords = wordTokens(args.jobDescription);
  if (jdWords.length < minWords) return [];
  const generatedNorm = normalizePhrase(args.generated);
  const sourceNorm = normalizePhrase(args.sourceResume);
  const spans: string[] = [];
  let i = 0;
  while (i < jdWords.length) {
    let bestLen = 0;
    const maxLen = Math.min(40, jdWords.length - i);
    for (let len = maxLen; len >= minWords; len--) {
      const phrase = jdWords.slice(i, i + len).join(" ");
      if (generatedNorm.includes(` ${phrase} `)) {
        bestLen = len;
        break;
      }
    }
    if (bestLen) {
      const phrase = jdWords.slice(i, i + bestLen).join(" ");
      if (!sourceNorm.includes(` ${phrase} `)) {
        spans.push(phrase);
      }
      i += bestLen;
    } else {
      i += 1;
    }
  }
  return spans;
}

function copyWeight(spans: string[]): number {
  return spans.reduce((n, s) => n + s.split(/\s+/).length, 0);
}

function contactLines(args: {
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}): string[] {
  return [
    args.contactName?.trim() ? `Name: ${args.contactName.trim()}` : null,
    args.contactEmail?.trim() ? `Email: ${args.contactEmail.trim()}` : null,
    args.contactPhone?.trim() ? `Phone: ${args.contactPhone.trim()}` : null,
  ].filter((line): line is string => Boolean(line));
}

function requireAnthropic(): void {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
}

function textFromMessage(msg: { content: Array<{ type: string; text?: string }> }): string {
  const block = msg.content.find((b) => b.type === "text");
  return block && block.type === "text" ? (block.text || "").trim() : "";
}

async function complete(args: {
  system: string;
  user: string;
  maxTokens: number;
  temperature: number;
}): Promise<string> {
  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: args.maxTokens,
    temperature: args.temperature,
    system: args.system,
    messages: [{ role: "user", content: args.user }],
  });
  const text = textFromMessage(msg);
  if (!text) throw new Error("Empty response from AI.");
  return text;
}

function resumeUserPrompt(args: {
  resumeText: string;
  jobTitles: string[];
  notes?: string;
  jobDescription?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  forbiddenPhrases?: string[];
}): string {
  const titles = args.jobTitles.length ? args.jobTitles.join(", ") : "general professional roles";
  const jd = (args.jobDescription || "").trim();
  const bits = contactLines(args);
  const contactBlock = bits.length
    ? `Use this contact block in the resume header (do not invent other emails):\n${bits.join("\n")}\n`
    : "";

  const targetBlock = jd
    ? `Target role (use only to decide emphasis — do not copy this text):
Job title: ${args.jobTitle || "n/a"}
Company: ${args.company || "n/a"}
Job description:
${jd.slice(0, 8000)}
`
    : `Improve the resume below for roles like: ${titles}.`;

  const forbidden =
    args.forbiddenPhrases && args.forbiddenPhrases.length
      ? `The previous draft copied these phrases from the job description. Rewrite so NONE of them appear:\n- ${args.forbiddenPhrases.slice(0, 12).join("\n- ")}\n`
      : "";

  return `${targetBlock}
${contactBlock}${args.notes?.trim() ? `Extra guidance from the candidate: ${args.notes.trim()}\n` : ""}
${forbidden}
Rewrite the resume below. Keep the same career history. Make it professional, specific, and original.

CANDIDATE RESUME:
${args.resumeText.slice(0, 24000)}`;
}

export async function improveResumeText(args: {
  resumeText: string;
  jobTitles: string[];
  notes?: string;
  /** When set, tailor the resume to this specific job description. */
  jobDescription?: string | null;
  jobTitle?: string | null;
  company?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}): Promise<string> {
  requireAnthropic();
  const jd = (args.jobDescription || "").trim();
  const user = resumeUserPrompt(args);
  let text = await complete({
    system: RESUME_SYSTEM,
    user,
    maxTokens: 4096,
    temperature: 0.35,
  });

  if (!jd) return text;

  const firstSpans = copiedJdSpans({
    jobDescription: jd,
    sourceResume: args.resumeText,
    generated: text,
  });
  if (firstSpans.length === 0 || copyWeight(firstSpans) < 12) return text;

  const rewritten = await complete({
    system: RESUME_SYSTEM,
    user: resumeUserPrompt({ ...args, forbiddenPhrases: firstSpans }),
    maxTokens: 4096,
    temperature: 0.2,
  });
  const secondSpans = copiedJdSpans({
    jobDescription: jd,
    sourceResume: args.resumeText,
    generated: rewritten,
  });
  return copyWeight(secondSpans) <= copyWeight(firstSpans) ? rewritten : text;
}

/** Tune resume for one job using its description (alias of improveResumeText with JD). */
export async function tuneResumeForJob(args: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription?: string | null;
  notes?: string;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}): Promise<string> {
  return improveResumeText({
    resumeText: args.resumeText,
    jobTitles: args.jobTitle ? [args.jobTitle] : [],
    jobTitle: args.jobTitle,
    company: args.company,
    jobDescription: args.jobDescription,
    notes: args.notes,
    contactEmail: args.contactEmail,
    contactName: args.contactName,
    contactPhone: args.contactPhone,
  });
}

export async function generateCoverLetter(args: {
  resumeText: string;
  jobTitle: string;
  company: string;
  location?: string | null;
  jobDescription?: string | null;
  contactEmail?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
}): Promise<string> {
  requireAnthropic();
  const bits = contactLines(args);
  const contactBlock = bits.length
    ? `Sign with this contact info (use exactly this email — do not invent another):\n${bits.join("\n")}\n`
    : "If an email appears in the resume, use that in the signature; otherwise omit email.\n";
  const jd = (args.jobDescription || "").trim();

  const user = `Write a concise, professional cover letter (250–400 words) for this application.
Job title: ${args.jobTitle}
Company: ${args.company}
Location: ${args.location || "n/a"}
${contactBlock}${jd ? `Job posting (for context only — do not copy):\n${jd.slice(0, 4000)}\n` : ""}
Candidate resume:
${args.resumeText.slice(0, 18000)}`;

  let text = await complete({
    system: COVER_SYSTEM,
    user,
    maxTokens: 1800,
    temperature: 0.4,
  });

  if (!jd) return text;

  const firstSpans = copiedJdSpans({
    jobDescription: jd,
    sourceResume: args.resumeText,
    generated: text,
    minWords: 7,
  });
  if (firstSpans.length === 0 || copyWeight(firstSpans) < 14) return text;

  const rewritten = await complete({
    system: COVER_SYSTEM,
    user: `${user}

The previous draft copied these phrases from the job posting. Rewrite so NONE of them appear:
- ${firstSpans.slice(0, 10).join("\n- ")}`,
    maxTokens: 1800,
    temperature: 0.25,
  });
  const secondSpans = copiedJdSpans({
    jobDescription: jd,
    sourceResume: args.resumeText,
    generated: rewritten,
    minWords: 7,
  });
  return copyWeight(secondSpans) <= copyWeight(firstSpans) ? rewritten : text;
}
