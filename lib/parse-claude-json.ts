/** User-facing message when Claude returns malformed JSON. */
export const CLAUDE_JSON_PARSE_ERROR =
  "AI returned an invalid format. Please try again.";

function stripMarkdownFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .replace(/```json\s*/gi, "")
    .replace(/```/g, "")
    .trim();
}

function repairCommonJsonIssues(json: string): string {
  return json
    .replace(/,\s*([}\]])/g, "$1")
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'");
}

/** Build candidate strings to parse from a Claude text response. */
function jsonParseCandidates(text: string): string[] {
  const trimmed = stripMarkdownFences(text);
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (s: string) => {
    const t = s.trim();
    if (t && !seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  };

  push(trimmed);

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const slice = trimmed.slice(start, end + 1);
    push(slice);
    push(repairCommonJsonIssues(slice));
  }

  return out;
}

/** Parse Claude JSON output with fence stripping and common repairs. */
export function parseClaudeJsonResponse<T extends Record<string, unknown>>(text: string): T {
  for (const candidate of jsonParseCandidates(text)) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as T;
      }
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(CLAUDE_JSON_PARSE_ERROR);
}
