import Anthropic from "@anthropic-ai/sdk";
import { CLAUDE_SONNET_MODEL } from "@/lib/anthropic-models";
import type { RealtorOsConfig } from "@/lib/realtor-os-config";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export type DraftResult = {
  draftBody: string;
  intent: "buyer" | "seller" | "rent" | "unknown";
  area: string | null;
  summary: string;
};

export async function draftRealtorReply(opts: {
  config: RealtorOsConfig;
  fromName: string | null;
  fromAddress: string;
  subject: string;
  bodyText: string;
}): Promise<DraftResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured on the server.");
  }

  const agentName = opts.config.clientName?.trim() || "the agent";
  const booking = opts.config.bookingLink?.trim();
  const bookingLine = booking
    ? `If appropriate, invite them to book here: ${booking}`
    : "If they want a call/showing, offer 2–3 time windows and ask which works.";

  const prompt = `You are an AI assistant for a real estate agent named "${agentName}".
Write a short, professional email reply to this inbound lead email.

Rules:
- Be warm, clear, and concise (120–180 words max).
- Do NOT invent listings, prices, or legal advice.
- Do NOT promise outcomes you cannot guarantee.
- Avoid fair-housing sensitive assumptions (family status, race, religion, etc.).
- Sign as ${agentName} (no fake credentials).
- ${bookingLine}

Also classify the lead.

Inbound from: ${opts.fromName ? `${opts.fromName} <${opts.fromAddress}>` : opts.fromAddress}
Subject: ${opts.subject}
Body:
"""
${opts.bodyText.slice(0, 6000)}
"""

Respond ONLY with valid JSON (no markdown):
{
  "draftBody": "<full email body text, no subject line>",
  "intent": "buyer" | "seller" | "rent" | "unknown",
  "area": "<neighborhood/city if mentioned, else null>",
  "summary": "<one short line for the CRM card>"
}`;

  const message = await anthropic.messages.create({
    model: CLAUDE_SONNET_MODEL,
    max_tokens: 900,
    messages: [{ role: "user", content: prompt }],
  });
  const text = message.content[0]?.type === "text" ? message.content[0].text : "{}";
  const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  let parsed: Partial<DraftResult> = {};
  try {
    parsed = JSON.parse(cleaned) as Partial<DraftResult>;
  } catch {
    parsed = { draftBody: cleaned.slice(0, 4000), intent: "unknown", area: null, summary: "Draft generated" };
  }

  const intentRaw = typeof parsed.intent === "string" ? parsed.intent.toLowerCase() : "unknown";
  const intent =
    intentRaw === "buyer" || intentRaw === "seller" || intentRaw === "rent" ? intentRaw : "unknown";

  return {
    draftBody: (typeof parsed.draftBody === "string" ? parsed.draftBody : "").trim().slice(0, 8000) ||
      "Thanks for reaching out — I received your message and will follow up shortly.",
    intent,
    area: typeof parsed.area === "string" && parsed.area.trim() ? parsed.area.trim().slice(0, 120) : null,
    summary: typeof parsed.summary === "string" ? parsed.summary.trim().slice(0, 240) : "New inquiry",
  };
}
