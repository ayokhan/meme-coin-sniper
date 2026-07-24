import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function improveResumeText(args: {
  resumeText: string;
  jobTitles: string[];
  notes?: string;
  /** When set, tailor the resume to this specific job description. */
  jobDescription?: string | null;
  jobTitle?: string | null;
  company?: string | null;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const titles = args.jobTitles.length ? args.jobTitles.join(", ") : "general professional roles";
  const jd = (args.jobDescription || "").trim();
  const targetBlock = jd
    ? `Tailor this resume specifically for the following role. Emphasize matching skills and keywords from the job description without inventing experience.
Job title: ${args.jobTitle || "n/a"}
Company: ${args.company || "n/a"}
Job description:
${jd.slice(0, 8000)}
`
    : `Improve the resume below for roles like: ${titles}.`;

  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert resume editor. ${targetBlock}
Keep facts truthful — do not invent employers, degrees, or metrics.
Use clear bullet points, strong action verbs, and ATS-friendly plain text (no markdown tables).
${args.notes?.trim() ? `Extra guidance: ${args.notes.trim()}\n` : ""}
Return ONLY the improved resume text.

RESUME:
${args.resumeText.slice(0, 24000)}`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  if (!text) throw new Error("Empty resume rewrite from AI.");
  return text;
}

/** Tune resume for one job using its description (alias of improveResumeText with JD). */
export async function tuneResumeForJob(args: {
  resumeText: string;
  jobTitle: string;
  company: string;
  jobDescription?: string | null;
  notes?: string;
}): Promise<string> {
  return improveResumeText({
    resumeText: args.resumeText,
    jobTitles: args.jobTitle ? [args.jobTitle] : [],
    jobTitle: args.jobTitle,
    company: args.company,
    jobDescription: args.jobDescription,
    notes: args.notes,
  });
}

export async function generateCoverLetter(args: {
  resumeText: string;
  jobTitle: string;
  company: string;
  location?: string | null;
  jobDescription?: string | null;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 1800,
    messages: [
      {
        role: "user",
        content: `Write a concise, professional cover letter (250–400 words) for this application.
Tone: confident, specific, no fluff. Plain text only.
Job title: ${args.jobTitle}
Company: ${args.company}
Location: ${args.location || "n/a"}
${args.jobDescription ? `Job notes/description:\n${args.jobDescription.slice(0, 4000)}\n` : ""}
Candidate resume:
${args.resumeText.slice(0, 18000)}`,
      },
    ],
  });
  const block = msg.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text.trim() : "";
  if (!text) throw new Error("Empty cover letter from AI.");
  return text;
}
