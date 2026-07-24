import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function improveResumeText(args: {
  resumeText: string;
  jobTitles: string[];
  notes?: string;
}): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  const titles = args.jobTitles.length ? args.jobTitles.join(", ") : "general professional roles";
  const msg = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: `You are an expert resume editor. Improve the resume below for roles like: ${titles}.
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
