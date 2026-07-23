"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_LOCALES, LOCALE_LABELS, type AppLocale } from "@/lib/i18n/locales";
import { useI18n } from "@/components/I18nProvider";

type Props = {
  /** Compact select for header; full label for mobile menu. */
  compact?: boolean;
  className?: string;
};

type LocalesResponse = {
  success: boolean;
  enabledLocales?: AppLocale[];
  defaultLocale?: AppLocale;
};

export default function LanguageSwitcher({ compact = true, className = "" }: Props) {
  const { locale, setLocale, t, enabledLocales } = useI18n();
  const [fetched, setFetched] = useState<AppLocale[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/locales")
      .then((r) => r.json())
      .then((data: LocalesResponse) => {
        if (cancelled || !data.success || !Array.isArray(data.enabledLocales)) return;
        setFetched(data.enabledLocales);
      })
      .catch(() => {
        /* keep provider defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(() => {
    const list = fetched ?? enabledLocales ?? [...APP_LOCALES];
    const allowed = new Set(list);
    const ordered = APP_LOCALES.filter((id) => allowed.has(id));
    return ordered.length > 0 ? ordered : (["en"] as AppLocale[]);
  }, [fetched, enabledLocales]);

  useEffect(() => {
    if (!options.includes(locale) && options[0]) {
      setLocale(options[0]);
    }
  }, [options, locale, setLocale]);

  if (options.length <= 1) {
    return null;
  }

  return (
    <div className={`flex items-center gap-2 ${className}`} role="group" aria-label={t("nav.language")}>
      {!compact && (
        <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 shrink-0">{t("nav.language")}</span>
      )}
      <select
        value={options.includes(locale) ? locale : options[0]}
        onChange={(e) => setLocale(e.target.value as typeof locale)}
        className={
          compact
            ? "h-8 max-w-[9.5rem] rounded-md border border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 px-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200"
            : "h-10 min-w-[12rem] max-w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 text-sm font-medium text-zinc-800 dark:text-zinc-100"
        }
        aria-label={t("nav.language")}
      >
        {options.map((id) => (
          <option key={id} value={id}>
            {LOCALE_LABELS[id]}
          </option>
        ))}
      </select>
    </div>
  );
}
