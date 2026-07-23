/** Supported UI languages for NovaStaris. */
export const APP_LOCALES = ["en", "fr", "zh", "hi", "yo", "ig"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

export const LOCALE_STORAGE_KEY = "novastaris-locale-v1";

export const LOCALE_LABELS: Record<AppLocale, string> = {
  en: "English",
  fr: "Français",
  zh: "中文",
  hi: "हिन्दी",
  yo: "Yorùbá",
  ig: "Igbo",
};

/** BCP 47 tags for <html lang> and number/date formatting. */
export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  en: "en",
  fr: "fr",
  zh: "zh-Hans",
  hi: "hi",
  yo: "yo",
  ig: "ig",
};

export function parseAppLocale(raw: unknown): AppLocale | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if ((APP_LOCALES as readonly string[]).includes(s)) return s as AppLocale;
  if (s === "zh-cn" || s === "zh-hans" || s === "cn" || s === "chinese") return "zh";
  if (s === "fr-fr" || s === "french") return "fr";
  if (s === "hi-in" || s === "hindi") return "hi";
  if (s === "yoruba") return "yo";
  return null;
}
