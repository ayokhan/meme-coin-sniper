"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_HTML_LANG,
  LOCALE_STORAGE_KEY,
  RTL_LOCALES,
  parseAppLocale,
  type AppLocale,
} from "@/lib/i18n/locales";
import { translate, type MessageKey } from "@/lib/i18n";

type I18nContextValue = {
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
  t: (key: MessageKey | string, vars?: Record<string, string | number>) => string;
  enabledLocales: AppLocale[];
  defaultLocale: AppLocale;
};

const I18nContext = createContext<I18nContextValue | null>(null);

const FALLBACK_ENABLED: AppLocale[] = ["en", "fr", "yo"];

function readStoredLocale(): AppLocale {
  try {
    return parseAppLocale(localStorage.getItem(LOCALE_STORAGE_KEY)) ?? DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<AppLocale>(DEFAULT_LOCALE);
  const [ready, setReady] = useState(false);
  const [enabledLocales, setEnabledLocales] = useState<AppLocale[]>(FALLBACK_ENABLED);
  const [defaultLocale, setDefaultLocale] = useState<AppLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(readStoredLocale());
    setReady(true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/locales")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data?.success) return;
        const enabled = Array.isArray(data.enabledLocales)
          ? (data.enabledLocales as unknown[])
              .map((x) => parseAppLocale(x))
              .filter((x): x is AppLocale => x != null)
          : FALLBACK_ENABLED;
        const nextEnabled = enabled.length > 0 ? enabled : FALLBACK_ENABLED;
        const nextDefault =
          parseAppLocale(data.defaultLocale) && nextEnabled.includes(parseAppLocale(data.defaultLocale)!)
            ? (parseAppLocale(data.defaultLocale) as AppLocale)
            : DEFAULT_LOCALE;
        setEnabledLocales(nextEnabled);
        setDefaultLocale(nextDefault);
        setLocaleState((prev) => (nextEnabled.includes(prev) ? prev : nextDefault));
      })
      .catch(() => {
        /* keep fallbacks */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = LOCALE_HTML_LANG[locale];
    document.documentElement.dir = RTL_LOCALES.has(locale) ? "rtl" : "ltr";
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore */
    }
  }, [locale, ready]);

  const setLocale = useCallback(
    (next: AppLocale) => {
      if (enabledLocales.length > 0 && !enabledLocales.includes(next)) return;
      setLocaleState(next);
    },
    [enabledLocales]
  );

  const t = useCallback(
    (key: MessageKey | string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale]
  );

  const value = useMemo(
    () => ({ locale, setLocale, t, enabledLocales, defaultLocale }),
    [locale, setLocale, t, enabledLocales, defaultLocale]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: DEFAULT_LOCALE,
      setLocale: () => undefined,
      t: (key, vars) => translate(DEFAULT_LOCALE, key, vars),
      enabledLocales: FALLBACK_ENABLED,
      defaultLocale: DEFAULT_LOCALE,
    };
  }
  return ctx;
}
