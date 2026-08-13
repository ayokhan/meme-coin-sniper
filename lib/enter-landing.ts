/**
 * Owner-managed enter / desk landing copy + section visibility.
 * Master ON/OFF is feature flag `enter_landing_enabled`.
 * Configured in Admin → Landing.
 */

import { prisma } from "@/lib/db";

export const ENTER_LANDING_CONFIG_ID = "default";

export type EnterLandingDeskId = "meme" | "futures" | "forex" | "prop" | "polymarket";
export type EnterLandingGate = "open" | "vip" | "preview";

export type EnterLandingDesk = {
  id: EnterLandingDeskId;
  enabled: boolean;
  title: string;
  line: string;
  cta: string;
  href: string;
  gate: EnterLandingGate;
  path: "meme" | "futures" | "forex" | "polymarket" | null;
};

export type EnterLandingConfig = {
  heroEyebrow: string;
  heroTitle: string;
  heroBlurb: string;
  heroPrimaryCta: string;
  heroSecondaryCta: string;
  desksHeading: string;
  desksBlurb: string;
  desks: EnterLandingDesk[];
  university: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    blurb: string;
    cta: string;
    secondaryCta: string;
    pathSteps: string[];
  };
  /** Below-fold proof strip on /enter (also gated by page_tab_case_studies). */
  caseStudies: {
    enabled: boolean;
    eyebrow: string;
    title: string;
    blurb: string;
    cta: string;
    href: string;
    chips: Array<{ label: string; href: string }>;
  };
  instagram: {
    enabled: boolean;
    handle: string;
    url: string;
    stripBlurb: string;
    stripCta: string;
    marqueeText: string;
    showOnPublicFooters: boolean;
    publicFooterLabel: string;
  };
  footer: {
    showUniversity: boolean;
    universityLabel: string;
    universityHref: string;
    showStartHere: boolean;
    startHereLabel: string;
    startHereHref: string;
    showAffiliate: boolean;
    affiliateLabel: string;
    affiliateHref: string;
    showWins: boolean;
    winsLabel: string;
    winsHref: string;
    showCaseStudies: boolean;
    caseStudiesLabel: string;
    caseStudiesHref: string;
    showInstagram: boolean;
  };
};

export type EnterLandingAdmin = EnterLandingConfig & {
  usesDefault: boolean;
  updatedAt: string | null;
};

export const DEFAULT_ENTER_LANDING: EnterLandingConfig = {
  heroEyebrow: "AI trading intelligence",
  heroTitle: "NovaStaris",
  heroBlurb:
    "Trade intelligence for the desk you run — and a free University so you learn before you size up.",
  heroPrimaryCta: "Choose your desk",
  heroSecondaryCta: "Learn free",
  desksHeading: "Enter a desk",
  desksBlurb: "One job per room. Pick where you trade — we route you into that workflow, not a wall of tabs.",
  desks: [
    {
      id: "meme",
      enabled: true,
      title: "Meme desk",
      line: "Hunt early Solana & BSC momentum, then run AI contract analysis.",
      cta: "Enter Go Hunting",
      href: "/?tab=new",
      gate: "open",
      path: "meme",
    },
    {
      id: "futures",
      enabled: true,
      title: "Futures desk",
      line: "Upload a chart for AI structure — or pick a mover from the opportunity rail.",
      cta: "Open Chart AI",
      href: "/?tab=futures&futures=ai",
      gate: "open",
      path: "futures",
    },
    {
      id: "forex",
      enabled: true,
      title: "Forex desk",
      line: "Gold, FX, indices. Guests see a delayed Market Watch; live Agent is VIP.",
      cta: "Open Nova Forex",
      href: "/?tab=nova-forex",
      gate: "vip",
      path: "forex",
    },
    {
      id: "prop",
      enabled: false,
      title: "Prop firm desk",
      line: "Challenge workflows on your rules. Preview the room — VIP to run.",
      cta: "Preview Prop Firm",
      href: "/?tab=prop-firm-bot",
      gate: "preview",
      path: null,
    },
    {
      id: "polymarket",
      enabled: true,
      title: "Polymarket desk",
      line: "Prediction-market radar and wallet intel. Preview free — live is VIP.",
      cta: "Preview Polymarket",
      href: "/?tab=polymarket-bot",
      gate: "preview",
      path: "polymarket",
    },
  ],
  university: {
    enabled: true,
    eyebrow: "Free to enroll",
    title: "NovaStaris Trading University",
    blurb:
      "Learn meme coins, Solana & BSC, futures & perps, prediction markets, forex, and metals — then sit the final exam and earn a certificate. Preview as a guest; enroll free to track progress.",
    cta: "Enter Trading University",
    secondaryCta: "Or pick a desk first",
    pathSteps: ["Foundations", "Markets", "Applied", "Final exam", "Certificate"],
  },
  caseStudies: {
    enabled: true,
    eyebrow: "Proof",
    title: "See how traders use these desks",
    blurb: "Short member-style journeys for meme checks, futures structure, and forex — before you pick a path.",
    cta: "Read case studies",
    href: "/case-studies",
    chips: [
      { label: "Meme checks", href: "/case-studies#meme" },
      { label: "Futures structure", href: "/case-studies#forecast" },
      { label: "Forex desk", href: "/case-studies#forex" },
    ],
  },
  instagram: {
    enabled: true,
    handle: "novastaris",
    url: "https://www.instagram.com/novastaris/",
    stripBlurb: "Behind the desks — setups, wins, and product drops",
    stripCta: "Follow on Instagram",
    marqueeText: "Follow the desk · @novastaris · setups · desks · wins · Instagram",
    showOnPublicFooters: true,
    publicFooterLabel: "Follow @{handle} on Instagram",
  },
  footer: {
    showUniversity: true,
    universityLabel: "Trading University",
    universityHref: "/?tab=trading-university",
    showStartHere: true,
    startHereLabel: "Classic start guide",
    startHereHref: "/start-here",
    showAffiliate: true,
    affiliateLabel: "Affiliate",
    affiliateHref: "/affiliate",
    showWins: true,
    winsLabel: "Wins",
    winsHref: "/wins",
    showCaseStudies: true,
    caseStudiesLabel: "Case studies",
    caseStudiesHref: "/case-studies",
    showInstagram: true,
  },
};

type PrismaWithLanding = typeof prisma & {
  enterLandingConfig?: {
    findUnique: (args: { where: { id: string } }) => Promise<{ config: unknown; updatedAt: Date } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; config: EnterLandingConfig };
      update: { config: EnterLandingConfig };
    }) => Promise<{ config: unknown; updatedAt: Date }>;
    delete: (args: { where: { id: string } }) => Promise<unknown>;
  };
};

function db() {
  return (prisma as unknown as PrismaWithLanding).enterLandingConfig ?? null;
}

const DESK_IDS: EnterLandingDeskId[] = ["meme", "futures", "forex", "prop", "polymarket"];
const GATES = new Set<EnterLandingGate>(["open", "vip", "preview"]);

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback: boolean): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function normalizeDesk(raw: unknown, fallback: EnterLandingDesk): EnterLandingDesk {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const id = DESK_IDS.includes(r.id as EnterLandingDeskId) ? (r.id as EnterLandingDeskId) : fallback.id;
  const gate = GATES.has(r.gate as EnterLandingGate) ? (r.gate as EnterLandingGate) : fallback.gate;
  const pathRaw = r.path;
  const path =
    pathRaw === null
      ? null
      : pathRaw === "meme" || pathRaw === "futures" || pathRaw === "forex" || pathRaw === "polymarket"
        ? pathRaw
        : fallback.path;
  return {
    id,
    enabled: asBool(r.enabled, fallback.enabled),
    title: asString(r.title, fallback.title),
    line: asString(r.line, fallback.line),
    cta: asString(r.cta, fallback.cta),
    href: asString(r.href, fallback.href),
    gate,
    path,
  };
}

/** Merge partial/unknown JSON onto defaults (safe for public render). */
export function normalizeEnterLandingConfig(raw: unknown): EnterLandingConfig {
  const r = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const d = DEFAULT_ENTER_LANDING;
  const desksRaw = Array.isArray(r.desks) ? r.desks : null;
  const desks = d.desks.map((fallback, i) => {
    const fromList = desksRaw?.find((x) => x && typeof x === "object" && (x as { id?: string }).id === fallback.id);
    return normalizeDesk(fromList ?? desksRaw?.[i], fallback);
  });

  const uni = r.university && typeof r.university === "object" ? (r.university as Record<string, unknown>) : {};
  const cs = r.caseStudies && typeof r.caseStudies === "object" ? (r.caseStudies as Record<string, unknown>) : {};
  const ig = r.instagram && typeof r.instagram === "object" ? (r.instagram as Record<string, unknown>) : {};
  const ft = r.footer && typeof r.footer === "object" ? (r.footer as Record<string, unknown>) : {};

  const pathSteps = Array.isArray(uni.pathSteps)
    ? uni.pathSteps.filter((s): s is string => typeof s === "string" && s.trim().length > 0)
    : d.university.pathSteps;

  const chipsRaw = Array.isArray(cs.chips) ? cs.chips : null;
  const chips =
    chipsRaw
      ?.map((item) => {
        if (!item || typeof item !== "object") return null;
        const row = item as { label?: unknown; href?: unknown };
        const label = typeof row.label === "string" ? row.label.trim() : "";
        const href = typeof row.href === "string" ? row.href.trim() : "";
        if (!label || !href) return null;
        return { label, href };
      })
      .filter((x): x is { label: string; href: string } => !!x) ?? d.caseStudies.chips;

  return {
    heroEyebrow: asString(r.heroEyebrow, d.heroEyebrow),
    heroTitle: asString(r.heroTitle, d.heroTitle),
    heroBlurb: asString(r.heroBlurb, d.heroBlurb),
    heroPrimaryCta: asString(r.heroPrimaryCta, d.heroPrimaryCta),
    heroSecondaryCta: asString(r.heroSecondaryCta, d.heroSecondaryCta),
    desksHeading: asString(r.desksHeading, d.desksHeading),
    desksBlurb: asString(r.desksBlurb, d.desksBlurb),
    desks,
    university: {
      enabled: asBool(uni.enabled, d.university.enabled),
      eyebrow: asString(uni.eyebrow, d.university.eyebrow),
      title: asString(uni.title, d.university.title),
      blurb: asString(uni.blurb, d.university.blurb),
      cta: asString(uni.cta, d.university.cta),
      secondaryCta: asString(uni.secondaryCta, d.university.secondaryCta),
      pathSteps: pathSteps.length ? pathSteps : d.university.pathSteps,
    },
    caseStudies: {
      enabled: asBool(cs.enabled, d.caseStudies.enabled),
      eyebrow: asString(cs.eyebrow, d.caseStudies.eyebrow),
      title: asString(cs.title, d.caseStudies.title),
      blurb: asString(cs.blurb, d.caseStudies.blurb),
      cta: asString(cs.cta, d.caseStudies.cta),
      href: asString(cs.href, d.caseStudies.href),
      chips: chips.length ? chips : d.caseStudies.chips,
    },
    instagram: {
      enabled: asBool(ig.enabled, d.instagram.enabled),
      handle: asString(ig.handle, d.instagram.handle).replace(/^@/, ""),
      url: asString(ig.url, d.instagram.url),
      stripBlurb: asString(ig.stripBlurb, d.instagram.stripBlurb),
      stripCta: asString(ig.stripCta, d.instagram.stripCta),
      marqueeText: asString(ig.marqueeText, d.instagram.marqueeText),
      showOnPublicFooters: asBool(ig.showOnPublicFooters, d.instagram.showOnPublicFooters),
      publicFooterLabel: asString(ig.publicFooterLabel, d.instagram.publicFooterLabel),
    },
    footer: {
      showUniversity: asBool(ft.showUniversity, d.footer.showUniversity),
      universityLabel: asString(ft.universityLabel, d.footer.universityLabel),
      universityHref: asString(ft.universityHref, d.footer.universityHref),
      showStartHere: asBool(ft.showStartHere, d.footer.showStartHere),
      startHereLabel: asString(ft.startHereLabel, d.footer.startHereLabel),
      startHereHref: asString(ft.startHereHref, d.footer.startHereHref),
      showAffiliate: asBool(ft.showAffiliate, d.footer.showAffiliate),
      affiliateLabel: asString(ft.affiliateLabel, d.footer.affiliateLabel),
      affiliateHref: asString(ft.affiliateHref, d.footer.affiliateHref),
      showWins: asBool(ft.showWins, d.footer.showWins),
      winsLabel: asString(ft.winsLabel, d.footer.winsLabel),
      winsHref: asString(ft.winsHref, d.footer.winsHref),
      showCaseStudies: asBool(ft.showCaseStudies, d.footer.showCaseStudies),
      caseStudiesLabel: asString(ft.caseStudiesLabel, d.footer.caseStudiesLabel),
      caseStudiesHref: asString(ft.caseStudiesHref, d.footer.caseStudiesHref),
      showInstagram: asBool(ft.showInstagram, d.footer.showInstagram),
    },
  };
}

export async function getEnterLandingConfig(): Promise<EnterLandingAdmin> {
  const landingDb = db();
  if (!landingDb) {
    return { ...DEFAULT_ENTER_LANDING, usesDefault: true, updatedAt: null };
  }
  try {
    const row = await landingDb.findUnique({ where: { id: ENTER_LANDING_CONFIG_ID } });
    if (!row) {
      return { ...DEFAULT_ENTER_LANDING, usesDefault: true, updatedAt: null };
    }
    return {
      ...normalizeEnterLandingConfig(row.config),
      usesDefault: false,
      updatedAt: row.updatedAt.toISOString(),
    };
  } catch {
    return { ...DEFAULT_ENTER_LANDING, usesDefault: true, updatedAt: null };
  }
}

export async function setEnterLandingConfig(next: EnterLandingConfig): Promise<EnterLandingAdmin> {
  const landingDb = db();
  if (!landingDb) throw new Error("Enter landing storage unavailable. Run prisma migrate / db push.");
  const config = normalizeEnterLandingConfig(next);
  const row = await landingDb.upsert({
    where: { id: ENTER_LANDING_CONFIG_ID },
    create: { id: ENTER_LANDING_CONFIG_ID, config },
    update: { config },
  });
  return {
    ...normalizeEnterLandingConfig(row.config),
    usesDefault: false,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function resetEnterLandingConfig(): Promise<EnterLandingAdmin> {
  const landingDb = db();
  if (!landingDb) throw new Error("Enter landing storage unavailable.");
  try {
    await landingDb.delete({ where: { id: ENTER_LANDING_CONFIG_ID } });
  } catch {
    /* no row */
  }
  return { ...DEFAULT_ENTER_LANDING, usesDefault: true, updatedAt: null };
}

export function formatPublicInstagramFooterLabel(cfg: EnterLandingConfig["instagram"]): string {
  return cfg.publicFooterLabel.replace(/\{handle\}/g, cfg.handle).replace(/@+/g, "@");
}
