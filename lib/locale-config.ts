/**
 * Owner-managed UI language availability.
 * Admin → Languages. Public clients read enabled list for the language switcher.
 */
import { prisma } from "@/lib/db";
import {
  APP_LOCALES,
  DEFAULT_LOCALE,
  parseAppLocale,
  type AppLocale,
} from "@/lib/i18n/locales";

export const LOCALE_CONFIG_ID = "default";

/** Default for new installs / missing row: English + French + Yoruba. */
export const DEFAULT_ENABLED_LOCALES: AppLocale[] = ["en", "fr", "yo"];

export type LocaleConfigPublic = {
  enabledLocales: AppLocale[];
  defaultLocale: AppLocale;
};

export type LocaleConfigAdmin = LocaleConfigPublic & {
  updatedAt: string | null;
  allLocales: AppLocale[];
};

type PrismaWithLocaleConfig = typeof prisma & {
  localeConfig?: {
    findUnique: (args: {
      where: { id: string };
    }) => Promise<{
      enabledLocales: unknown;
      defaultLocale: string;
      updatedAt: Date;
    } | null>;
    upsert: (args: {
      where: { id: string };
      create: { id: string; enabledLocales: AppLocale[]; defaultLocale: string };
      update: { enabledLocales?: AppLocale[]; defaultLocale?: string };
    }) => Promise<{
      enabledLocales: unknown;
      defaultLocale: string;
      updatedAt: Date;
    }>;
  };
};

function normalizeEnabled(raw: unknown): AppLocale[] {
  const list = Array.isArray(raw) ? raw : [];
  const parsed = list
    .map((x) => parseAppLocale(x))
    .filter((x): x is AppLocale => x != null);
  const unique = Array.from(new Set(parsed));
  if (!unique.includes(DEFAULT_LOCALE)) unique.unshift(DEFAULT_LOCALE);
  // Preserve APP_LOCALES order for stable UI
  return APP_LOCALES.filter((id) => unique.includes(id));
}

function normalizeDefault(raw: string, enabled: AppLocale[]): AppLocale {
  const parsed = parseAppLocale(raw) ?? DEFAULT_LOCALE;
  return enabled.includes(parsed) ? parsed : DEFAULT_LOCALE;
}

function rowToPublic(row: {
  enabledLocales: unknown;
  defaultLocale: string;
} | null): LocaleConfigPublic {
  const enabledLocales = row
    ? normalizeEnabled(row.enabledLocales)
    : [...DEFAULT_ENABLED_LOCALES];
  const defaultLocale = row
    ? normalizeDefault(row.defaultLocale, enabledLocales)
    : DEFAULT_LOCALE;
  return { enabledLocales, defaultLocale };
}

/** Public read — safe for LanguageSwitcher. */
export async function getLocaleConfigPublic(): Promise<LocaleConfigPublic> {
  try {
    const db = prisma as unknown as PrismaWithLocaleConfig;
    if (!db.localeConfig) {
      return {
        enabledLocales: [...DEFAULT_ENABLED_LOCALES],
        defaultLocale: DEFAULT_LOCALE,
      };
    }
    const row = await db.localeConfig.findUnique({ where: { id: LOCALE_CONFIG_ID } });
    return rowToPublic(row);
  } catch {
    return {
      enabledLocales: [...DEFAULT_ENABLED_LOCALES],
      defaultLocale: DEFAULT_LOCALE,
    };
  }
}

export async function getLocaleConfigForAdmin(): Promise<LocaleConfigAdmin> {
  const pub = await getLocaleConfigPublic();
  let updatedAt: string | null = null;
  try {
    const db = prisma as unknown as PrismaWithLocaleConfig;
    const row = await db.localeConfig?.findUnique({ where: { id: LOCALE_CONFIG_ID } });
    updatedAt = row?.updatedAt?.toISOString() ?? null;
  } catch {
    /* ignore */
  }
  return { ...pub, updatedAt, allLocales: [...APP_LOCALES] };
}

export async function setLocaleConfig(patch: {
  enabledLocales?: AppLocale[];
  defaultLocale?: AppLocale;
}): Promise<LocaleConfigAdmin> {
  const db = prisma as unknown as PrismaWithLocaleConfig;
  if (!db.localeConfig) {
    throw new Error("LocaleConfig model is unavailable. Run prisma migrate.");
  }

  const current = await getLocaleConfigPublic();
  let enabledLocales = patch.enabledLocales
    ? normalizeEnabled(patch.enabledLocales)
    : current.enabledLocales;
  if (enabledLocales.length === 0) enabledLocales = [DEFAULT_LOCALE];

  const defaultLocale = normalizeDefault(
    patch.defaultLocale ?? current.defaultLocale,
    enabledLocales
  );

  const row = await db.localeConfig.upsert({
    where: { id: LOCALE_CONFIG_ID },
    create: {
      id: LOCALE_CONFIG_ID,
      enabledLocales,
      defaultLocale,
    },
    update: {
      enabledLocales,
      defaultLocale,
    },
  });

  const pub = rowToPublic(row);
  return {
    ...pub,
    updatedAt: row.updatedAt.toISOString(),
    allLocales: [...APP_LOCALES],
  };
}
