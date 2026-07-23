/** Supported UI languages for NovaStaris. */
export const APP_LOCALES = [
  "en",
  "fr",
  "zh",
  "hi",
  "yo",
  "ig",
  "de",
  "es",
  "pcm",
  "ar",
  "bn",
  "sv",
  "ha",
  "bin",
  "ish",
  "ak",
  "sw",
  "fa",
] as const;

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
  de: "Deutsch",
  es: "Español",
  pcm: "Pidgin",
  ar: "العربية",
  bn: "বাংলা",
  sv: "Svenska",
  ha: "Hausa",
  bin: "Ẹ̀dó (Bini)",
  ish: "Esan",
  ak: "Akan",
  sw: "Kiswahili",
  fa: "فارسی",
};

/** BCP 47 tags for <html lang> and number/date formatting. */
export const LOCALE_HTML_LANG: Record<AppLocale, string> = {
  en: "en",
  fr: "fr",
  zh: "zh-Hans",
  hi: "hi",
  yo: "yo",
  ig: "ig",
  de: "de",
  es: "es",
  pcm: "pcm",
  ar: "ar",
  bn: "bn",
  sv: "sv",
  ha: "ha",
  bin: "bin",
  ish: "ish",
  ak: "ak",
  sw: "sw",
  fa: "fa",
};

/** Right-to-left scripts. */
export const RTL_LOCALES: ReadonlySet<AppLocale> = new Set(["ar", "fa"]);

export function parseAppLocale(raw: unknown): AppLocale | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  if ((APP_LOCALES as readonly string[]).includes(s)) return s as AppLocale;
  if (s === "zh-cn" || s === "zh-hans" || s === "cn" || s === "chinese") return "zh";
  if (s === "fr-fr" || s === "french") return "fr";
  if (s === "hi-in" || s === "hindi") return "hi";
  if (s === "yoruba") return "yo";
  if (s === "de-de" || s === "german" || s === "deutsch") return "de";
  if (s === "es-es" || s === "es-mx" || s === "spanish" || s === "español" || s === "espanol") return "es";
  if (s === "pidgin" || s === "naija" || s === "ng-pidgin") return "pcm";
  if (s === "arabic" || s === "ar-sa" || s === "ar-eg") return "ar";
  if (s === "bangla" || s === "bengali" || s === "bn-bd" || s === "bn-in") return "bn";
  if (s === "swedish" || s === "sv-se") return "sv";
  if (s === "hausa") return "ha";
  if (s === "bini" || s === "edo" || s === "ẹdo") return "bin";
  if (s === "esan" || s === "ishan") return "ish";
  if (s === "akan" || s === "twi" || s === "fante") return "ak";
  if (s === "swahili" || s === "kiswahili") return "sw";
  if (s === "farsi" || s === "persian" || s === "fa-ir") return "fa";
  return null;
}
