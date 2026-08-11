/**
 * Owner-managed Case Studies page copy. Single DB row id "default".
 * Master show/hide remains page_tab_case_studies (Product visibility).
 */

import { prisma } from "@/lib/db";

export const CASE_STUDIES_CONFIG_ID = "default";

export type CaseStudyAccent = "cyan" | "violet" | "emerald";

export type CaseStudyStory = {
  id: string;
  enabled: boolean;
  eyebrow: string;
  name: string;
  role: string;
  headline: string;
  accent: CaseStudyAccent;
  problem: string;
  solution: string;
  outcome: string;
  tools: string[];
  ctaHref: string;
  ctaLabel: string;
  imageSrc: string;
  imageAlt: string;
};

export type CaseStudiesPageConfig = {
  heroEyebrow: string;
  heroTitleBefore: string;
  heroTitleAccent: string;
  heroBlurb: string;
  footerDisclaimer: string;
  ctaPrimaryLabel: string;
  ctaPrimaryHref: string;
  ctaSecondaryLabel: string;
  ctaSecondaryHref: string;
  ctaTertiaryLabel: string;
  ctaTertiaryHref: string;
  studies: CaseStudyStory[];
};

export type CaseStudiesPageAdmin = CaseStudiesPageConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

const ACCENTS = new Set<CaseStudyAccent>(["cyan", "violet", "emerald"]);

export const DEFAULT_CASE_STUDIES_PAGE: CaseStudiesPageConfig = {
  heroEyebrow: "Case studies",
  heroTitleBefore: "How traders use",
  heroTitleAccent: "NovaStaris",
  heroBlurb:
    "Real product workflows — meme safety checks, futures structure, and forex automation — shown as member-style journeys. Built from how the tools are used on the desk.",
  footerDisclaimer:
    "Stories are illustrative member journeys based on product workflows — not guaranteed returns. Trading involves risk. Screenshots show NovaStaris product surfaces for context.",
  ctaPrimaryLabel: "Start here",
  ctaPrimaryHref: "/enter",
  ctaSecondaryLabel: "Upgrade VIP",
  ctaSecondaryHref: "/subscribe",
  ctaTertiaryLabel: "See Wins",
  ctaTertiaryHref: "/wins",
  studies: [
    {
      id: "meme",
      enabled: true,
      eyebrow: "Meme coins",
      name: "Jordan M.",
      role: "Solana meme trader",
      headline: "From rugs to a check-first habit",
      accent: "cyan",
      problem:
        "After getting rugged on multiple launches, Jordan stopped trusting CT hype and random Telegram calls. Entries were emotional — and expensive.",
      solution:
        "Before sizing into a new pair, Jordan runs the contract through NovaStaris AI Agent: liquidity, holder concentration, and social checks in one pass — then only continues if the score and flags look acceptable.",
      outcome:
        "Fewer impulse entries. Clearer skip decisions. The habit shifted from “ape first” to “check first, then size.”",
      tools: ["NovaStaris AI Agent", "Go Hunting", "Watchlist"],
      ctaHref: "/?tab=ai-analysis&agent=meme",
      ctaLabel: "Open AI Agent",
      imageSrc: "/case-studies/meme-ai-agent.jpg",
      imageAlt: "NovaStaris AI Agent meme token analysis screen",
    },
    {
      id: "forecast",
      enabled: true,
      eyebrow: "Crypto futures",
      name: "Sam R.",
      role: "Perp swing trader",
      headline: "From candle-chasing to structured prep",
      accent: "violet",
      problem:
        "Sam had strong opinions on BTC and alts but weak structure — chasing candles without a clear high/low plan or multi-timeframe read.",
      solution:
        "Sam starts sessions in NovaForecast Agent for range highs/lows, then confirms with NovaQ and NovaRadar before placing risk. For short-horizon plans, Nova Pulse → Futures (Nova Scalp Agent) frames entry, exit, and stop.",
      outcome:
        "More repeatable prep. Trades start from a written structure bias instead of a gut feel on the last 5-minute candle.",
      tools: ["NovaForecast Agent", "NovaQ", "NovaRadar", "Nova Pulse"],
      ctaHref: "/?tab=nova-forecast",
      ctaLabel: "Open NovaForecast",
      imageSrc: "/case-studies/nova-forecast.jpg",
      imageAlt: "NovaForecast Agent crypto futures structure screen",
    },
    {
      id: "forex",
      enabled: true,
      eyebrow: "Forex & metals",
      name: "Ava K.",
      role: "XAUUSD / FX trader",
      headline: "From scattered charts to one forex desk",
      accent: "emerald",
      problem:
        "Ava traded gold and majors across MT4/MT5 but jumped between charts, Telegram ideas, and manual rules — with no single desk for structure and automation.",
      solution:
        "Ava uses Nova Forex Agent for Market Watch + NovaQ Forex structure, Nova Pulse → Forex for short-horizon plans, and Nova Forex Bots on a connected MT account when ready to automate a defined setup.",
      outcome:
        "One workflow from watchlist → structure → plan → optional bot handoff, without leaving NovaStaris.",
      tools: ["Nova Forex Agent", "Nova Pulse", "Nova Forex Bots"],
      ctaHref: "/?tab=nova-forex",
      ctaLabel: "Open Nova Forex",
      imageSrc: "/case-studies/nova-forex.jpg",
      imageAlt: "Nova Forex Bots connected MT account screen",
    },
  ],
};

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" && v.trim() ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function asAccent(v: unknown, fallback: CaseStudyAccent): CaseStudyAccent {
  return typeof v === "string" && ACCENTS.has(v as CaseStudyAccent) ? (v as CaseStudyAccent) : fallback;
}

function normalizeStudy(raw: unknown, fallback: CaseStudyStory): CaseStudyStory {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const toolsRaw = Array.isArray(r.tools) ? r.tools : null;
  const tools =
    toolsRaw?.filter((t): t is string => typeof t === "string" && t.trim().length > 0).map((t) => t.trim()) ??
    fallback.tools;
  return {
    id: asString(r.id, fallback.id).trim() || fallback.id,
    enabled: asBool(r.enabled, fallback.enabled),
    eyebrow: asString(r.eyebrow, fallback.eyebrow),
    name: asString(r.name, fallback.name),
    role: asString(r.role, fallback.role),
    headline: asString(r.headline, fallback.headline),
    accent: asAccent(r.accent, fallback.accent),
    problem: asString(r.problem, fallback.problem),
    solution: asString(r.solution, fallback.solution),
    outcome: asString(r.outcome, fallback.outcome),
    tools: tools.length ? tools : fallback.tools,
    ctaHref: asString(r.ctaHref, fallback.ctaHref),
    ctaLabel: asString(r.ctaLabel, fallback.ctaLabel),
    imageSrc: asString(r.imageSrc, fallback.imageSrc),
    imageAlt: asString(r.imageAlt, fallback.imageAlt),
  };
}

export function normalizeCaseStudiesPageConfig(raw: unknown): CaseStudiesPageConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_CASE_STUDIES_PAGE;
  const studiesRaw = Array.isArray(r.studies) ? r.studies : null;

  // Prefer matching by id so reordering in admin is preserved when present.
  let studies: CaseStudyStory[];
  if (studiesRaw && studiesRaw.length > 0) {
    const byId = new Map(
      studiesRaw
        .filter((x) => x && typeof x === "object")
        .map((x) => {
          const id = String((x as { id?: unknown }).id ?? "");
          return [id, x] as const;
        })
        .filter(([id]) => id)
    );
    // Keep default order for known ids, then append any extra custom studies.
    const known = d.studies.map((fb) => normalizeStudy(byId.get(fb.id) ?? fb, fb));
    const knownIds = new Set(known.map((s) => s.id));
    const extras = studiesRaw
      .map((item, i) => {
        if (!item || typeof item !== "object") return null;
        const id = String((item as { id?: unknown }).id ?? `custom-${i}`);
        if (knownIds.has(id)) return null;
        const fallback: CaseStudyStory = {
          ...d.studies[0]!,
          id,
          name: "New member",
          role: "Trader",
          headline: "New case study",
          eyebrow: "Custom",
        };
        return normalizeStudy(item, fallback);
      })
      .filter((x): x is CaseStudyStory => !!x);
    studies = [...known, ...extras];
  } else {
    studies = d.studies.map((s) => ({ ...s, tools: [...s.tools] }));
  }

  return {
    heroEyebrow: asString(r.heroEyebrow, d.heroEyebrow),
    heroTitleBefore: asString(r.heroTitleBefore, d.heroTitleBefore),
    heroTitleAccent: asString(r.heroTitleAccent, d.heroTitleAccent),
    heroBlurb: asString(r.heroBlurb, d.heroBlurb),
    footerDisclaimer: asString(r.footerDisclaimer, d.footerDisclaimer),
    ctaPrimaryLabel: asString(r.ctaPrimaryLabel, d.ctaPrimaryLabel),
    ctaPrimaryHref: asString(r.ctaPrimaryHref, d.ctaPrimaryHref),
    ctaSecondaryLabel: asString(r.ctaSecondaryLabel, d.ctaSecondaryLabel),
    ctaSecondaryHref: asString(r.ctaSecondaryHref, d.ctaSecondaryHref),
    ctaTertiaryLabel: asString(r.ctaTertiaryLabel, d.ctaTertiaryLabel),
    ctaTertiaryHref: asString(r.ctaTertiaryHref, d.ctaTertiaryHref),
    studies,
  };
}

type PrismaWithCaseStudies = typeof prisma & {
  caseStudiesConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<{ config: unknown; updatedAt: Date } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; config: CaseStudiesPageConfig };
      update: { config: CaseStudiesPageConfig };
    }) => Promise<{ config: unknown; updatedAt: Date }>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithCaseStudies).caseStudiesConfig ?? null;
}

export async function getCaseStudiesPageConfig(): Promise<CaseStudiesPageAdmin> {
  const cfgDb = db();
  if (!cfgDb) {
    return { ...DEFAULT_CASE_STUDIES_PAGE, usesDefault: true, updatedAt: null };
  }
  try {
    const row = await cfgDb.findUnique({ where: { id: CASE_STUDIES_CONFIG_ID } });
    if (!row) {
      return { ...DEFAULT_CASE_STUDIES_PAGE, usesDefault: true, updatedAt: null };
    }
    return {
      ...normalizeCaseStudiesPageConfig(row.config),
      usesDefault: false,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return { ...DEFAULT_CASE_STUDIES_PAGE, usesDefault: true, updatedAt: null };
  }
}

export async function setCaseStudiesPageConfig(next: CaseStudiesPageConfig): Promise<CaseStudiesPageAdmin> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Case studies storage unavailable. Run prisma db push.");
  const config = normalizeCaseStudiesPageConfig(next);
  const row = await cfgDb.upsert({
    where: { id: CASE_STUDIES_CONFIG_ID },
    create: { id: CASE_STUDIES_CONFIG_ID, config },
    update: { config },
  });
  return {
    ...normalizeCaseStudiesPageConfig(row.config),
    usesDefault: false,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resetCaseStudiesPageConfig(): Promise<CaseStudiesPageAdmin> {
  const cfgDb = db();
  if (!cfgDb) throw new Error("Case studies storage unavailable.");
  try {
    await cfgDb.delete({ where: { id: CASE_STUDIES_CONFIG_ID } });
  } catch {
    /* no row */
  }
  return { ...DEFAULT_CASE_STUDIES_PAGE, usesDefault: true, updatedAt: null };
}
