/** Email Studio: client-safe types, guardrails and the HTML renderer (preview and send use the same code). */
import { NOVASTARIS_SOCIAL, PLAY_STORE_BADGE_IMG, PLAY_STORE_URL } from "@/lib/app-distribution";

export type StudioAngle = "levels" | "scanner" | "memes";

export const STUDIO_ANGLES: { id: StudioAngle; label: string; markets: string; description: string }[] = [
  {
    id: "levels",
    label: "Levels to watch",
    markets: "Gold, silver, forex, BTC / ETH",
    description: "Untouched Asia, London and New York session highs and lows from Nova Session Sweep.",
  },
  {
    id: "scanner",
    label: "What our scanner caught",
    markets: "Perps, forex, metals",
    description: "Last 7 days of Session Sweep signals with honest results, losses included.",
  },
  {
    id: "memes",
    label: "Meme runner of the week",
    markets: "Solana, BSC, Robinhood memes",
    description: "Strong Runners picks from the last 7 days: best runner, biggest fade and the hit rate.",
  },
];

export type StudioSegment = "newsletter" | "vip" | "free" | "inactive7d" | "all";

export const STUDIO_SEGMENTS: { id: StudioSegment; label: string }[] = [
  { id: "newsletter", label: "Newsletter subscribers" },
  { id: "vip", label: "VIP subscribers" },
  { id: "free", label: "Free users" },
  { id: "inactive7d", label: "Inactive 7+ days" },
  { id: "all", label: "All registered users" },
];

/** Studio emails per person per rolling 7 days. */
export const STUDIO_WEEKLY_CAP = 2;

export type StudioTone = "good" | "bad" | "muted" | "accent";
export type StudioCell = { text: string; tone?: StudioTone };
export type StudioTable = { columns: string[]; rows: StudioCell[][]; footnote?: string };

export type StudioSection = {
  key: string;
  title: string;
  /** AI-written context (no numbers); the table carries the data. */
  note: string;
  table: StudioTable | null;
};

export type StudioDraft = {
  angle: StudioAngle;
  generatedAt: string;
  aiUsed: boolean;
  subjects: string[];
  subject: string;
  preheader: string;
  eyebrow: string;
  headline: string;
  hook: string;
  sections: StudioSection[];
  lesson: { title: string; body: string } | null;
  cta: { label: string; url: string };
  disclaimer: string;
};

export const STUDIO_DISCLAIMER =
  "Educational content, not financial advice. Trading crypto, forex and metals, especially with leverage, carries a high risk of losing money. Past results do not guarantee future results.";

const BANNED: RegExp[] = [
  /\bguarantee(d|s)?\b/i,
  /\brisk[- ]free\b/i,
  /\bsure (thing|win|bet)\b/i,
  /\bcan'?t (lose|miss)\b/i,
  /\bwill (pump|moon|explode|skyrocket|10x|100x)\b/i,
  /\b(easy|free) money\b/i,
  /\bget rich\b/i,
  /\b100% (win|accurate|accuracy)\b/i,
  /\bno[- ]brainer\b/i,
];

/** Problems with the copy. "block" stops sending; "warn" asks the owner to double-check. */
export function checkStudioCopy(draft: StudioDraft): { level: "block" | "warn"; message: string }[] {
  const issues: { level: "block" | "warn"; message: string }[] = [];
  const fields: [string, string][] = [
    ["Subject", draft.subject],
    ["Preview text", draft.preheader],
    ["Headline", draft.headline],
    ["Intro", draft.hook],
    ...draft.sections.map((s): [string, string] => [`Section "${s.title}"`, s.note]),
    ...(draft.lesson ? ([["Lesson", `${draft.lesson.title} ${draft.lesson.body}`]] as [string, string][]) : []),
  ];
  for (const [label, text] of fields) {
    for (const re of BANNED) {
      const m = text.match(re);
      if (m) issues.push({ level: "block", message: `${label}: "${m[0]}" is not allowed (promises or hype).` });
    }
    if (/\d/.test(text)) {
      issues.push({ level: "warn", message: `${label} contains a number. Numbers should come from the data tables; check it is correct.` });
    }
  }
  if (!draft.subject.trim()) issues.push({ level: "block", message: "Subject is empty." });
  if (draft.subject.length > 90) issues.push({ level: "warn", message: "Subject is long; under 60 characters reads best on phones." });
  if (!/^https:\/\//.test(draft.cta.url)) issues.push({ level: "block", message: "Button link must start with https://." });
  return issues;
}

const APP_ORIGIN = (process.env.NEXT_PUBLIC_APP_URL ?? "https://novastaris.ai").replace(/\/$/, "");
const ACCENT = "#14b8a6";
const TONE_COLOR: Record<StudioTone, string> = { good: "#34d399", bad: "#fb7185", muted: "#71717a", accent: ACCENT };

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraphs(text: string, style: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p style="${style}">${esc(p).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

function tableHtml(t: StudioTable): string {
  const head = t.columns
    .map(
      (c, i) =>
        `<th align="${i === 0 ? "left" : "right"}" style="padding:8px 10px;font-size:10px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:#71717a;border-bottom:1px solid #27272a;">${esc(c)}</th>`
    )
    .join("");
  const body = t.rows
    .map(
      (r) =>
        `<tr>${r
          .map(
            (cell, i) =>
              `<td align="${i === 0 ? "left" : "right"}" style="padding:8px 10px;font-size:13px;line-height:1.4;color:${cell.tone ? TONE_COLOR[cell.tone] : "#e4e4e7"};${i === 0 ? "font-weight:600;" : ""}border-bottom:1px solid #1f1f23;">${esc(cell.text)}</td>`
          )
          .join("")}</tr>`
    )
    .join("");
  const foot = t.footnote
    ? `<p style="margin:8px 2px 0 2px;font-size:11px;line-height:1.5;color:#71717a;">${esc(t.footnote)}</p>`
    : "";
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;background:#111113;border:1px solid #27272a;border-radius:10px;"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>${foot}`;
}

export type StudioRenderOptions = {
  /** Wraps outgoing links (click tracking). Identity in previews. */
  link?: (url: string) => string;
  unsubscribeUrl?: string | null;
  pixelUrl?: string | null;
};

export function renderStudioEmail(draft: StudioDraft, opts: StudioRenderOptions = {}): string {
  const link = opts.link ?? ((u: string) => u);
  const sections = draft.sections
    .map(
      (s) => `
    <tr><td style="padding:18px 28px 0 28px;">
      <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};">${esc(s.title)}</p>
      ${s.note ? paragraphs(s.note, "margin:0 0 10px 0;font-size:14px;line-height:1.6;color:#d4d4d8;") : ""}
      ${s.table && s.table.rows.length ? tableHtml(s.table) : ""}
    </td></tr>`
    )
    .join("");
  const lesson = draft.lesson
    ? `
    <tr><td style="padding:20px 28px 0 28px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0f172a;border:1px solid #1e293b;border-radius:12px;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${ACCENT};">${esc(draft.lesson.title)}</p>
          ${paragraphs(draft.lesson.body, "margin:0 0 8px 0;font-size:14px;line-height:1.6;color:#cbd5e1;")}
        </td></tr>
      </table>
    </td></tr>`
    : "";
  const ig = NOVASTARIS_SOCIAL.instagram;
  const x = NOVASTARIS_SOCIAL.x;
  const unsubscribe = opts.unsubscribeUrl
    ? ` · <a href="${esc(opts.unsubscribeUrl)}" style="color:#71717a;text-decoration:underline;">Unsubscribe</a>`
    : "";
  const pixel = opts.pixelUrl
    ? `<img src="${esc(opts.pixelUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><title>${esc(draft.subject)}</title></head>
<body style="margin:0;padding:0;background:#09090b;font-family:Arial,Helvetica,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#09090b;">${esc(draft.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#0a0a0b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
        <tr><td style="padding:28px 28px 0 28px;">
          <p style="margin:0 0 10px 0;font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#a1a1aa;">NovaStaris · ${esc(draft.eyebrow)}</p>
          <p style="margin:0 0 12px 0;font-size:24px;line-height:1.25;font-weight:700;color:#fafafa;letter-spacing:-0.02em;">${esc(draft.headline)}</p>
          ${paragraphs(draft.hook, "margin:0 0 4px 0;font-size:15px;line-height:1.6;color:#d4d4d8;")}
        </td></tr>
        ${sections}
        ${lesson}
        <tr><td align="center" style="padding:24px 28px 8px 28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr>
            <td align="center" bgcolor="${ACCENT}" style="border-radius:10px;background:${ACCENT};">
              <a href="${esc(link(draft.cta.url))}" target="_blank" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:700;color:#0a0a0b;text-decoration:none;border-radius:10px;">${esc(draft.cta.label)}</a>
            </td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:16px 28px 0 28px;">
          <p style="margin:0;font-size:11px;line-height:1.55;color:#71717a;">${esc(draft.disclaimer)}</p>
        </td></tr>
        <tr><td style="padding:20px 28px 28px 28px;border-top:1px solid #27272a;margin-top:16px;">
          <p style="margin:12px 0 10px 0;text-align:center;">
            <a href="${esc(link(PLAY_STORE_URL))}" target="_blank" style="text-decoration:none;"><img src="${PLAY_STORE_BADGE_IMG}" alt="Get it on Google Play" width="140" style="width:140px;height:auto;border:0;" /></a>
          </p>
          <p style="margin:0 0 6px 0;font-size:12px;line-height:1.6;color:#71717a;text-align:center;">
            <a href="${esc(link(ig.url))}" style="color:#5eead4;text-decoration:underline;">Instagram @${esc(ig.handle)}</a> ·
            <a href="${esc(link(x.url))}" style="color:#5eead4;text-decoration:underline;">X @${esc(x.handle)}</a>
          </p>
          <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;text-align:center;">
            You get this because you have a NovaStaris account.
            <a href="${esc(link(`${APP_ORIGIN}/account`))}" style="color:#71717a;text-decoration:underline;">Email settings</a>${unsubscribe}
          </p>
        </td></tr>
      </table>
      ${pixel}
    </td></tr>
  </table>
</body>
</html>`;
}

export function studioPlainText(draft: StudioDraft): string {
  const lines = [draft.headline, "", draft.hook, ""];
  for (const s of draft.sections) {
    lines.push(s.title.toUpperCase());
    if (s.note) lines.push(s.note);
    if (s.table) {
      for (const r of s.table.rows) lines.push(`• ${r.map((c) => c.text).join(" · ")}`);
      if (s.table.footnote) lines.push(s.table.footnote);
    }
    lines.push("");
  }
  if (draft.lesson) lines.push(draft.lesson.title.toUpperCase(), draft.lesson.body, "");
  lines.push(`${draft.cta.label}: ${draft.cta.url}`, "", draft.disclaimer);
  return lines.join("\n");
}
