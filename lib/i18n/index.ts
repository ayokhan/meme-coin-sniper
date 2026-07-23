import type { AppLocale } from "./locales";
import { DEFAULT_LOCALE } from "./locales";
import { en, type DeepPartialMessages, type MessageDict } from "./messages/en";
import { fr } from "./messages/fr";
import { zh } from "./messages/zh";
import { hi } from "./messages/hi";
import { yo } from "./messages/yo";
import { ig } from "./messages/ig";
import { de } from "./messages/de";
import { es } from "./messages/es";
import { pcm } from "./messages/pcm";
import { ar } from "./messages/ar";
import { bn } from "./messages/bn";
import { sv } from "./messages/sv";
import { ha } from "./messages/ha";
import { bin } from "./messages/bin";
import { ish } from "./messages/ish";
import { ak } from "./messages/ak";
import { sw } from "./messages/sw";
import { fa } from "./messages/fa";

const enDict = en as unknown as MessageDict;

function mergeMessages(base: MessageDict, patch: DeepPartialMessages): MessageDict {
  return {
    brand: { ...base.brand, ...(patch.brand ?? {}) },
    nav: { ...base.nav, ...(patch.nav ?? {}) },
    workspace: { ...base.workspace, ...(patch.workspace ?? {}) },
    focus: { ...base.focus, ...(patch.focus ?? {}) },
    more: typeof patch.more === "string" ? patch.more : base.more,
    common: { ...base.common, ...(patch.common ?? {}) },
    ui: { ...base.ui, ...(patch.ui ?? {}) },
    tabs: { ...base.tabs, ...(patch.tabs ?? {}) },
    lock: { ...base.lock, ...(patch.lock ?? {}) },
    forex: { ...base.forex, ...(patch.forex ?? {}) },
    lockDesc: { ...base.lockDesc, ...(patch.lockDesc ?? {}) },
    uni: { ...base.uni, ...(patch.uni ?? {}) },
  };
}

const CATALOG: Record<AppLocale, MessageDict> = {
  en: enDict,
  fr: mergeMessages(enDict, fr),
  zh: mergeMessages(enDict, zh),
  hi: mergeMessages(enDict, hi),
  yo: mergeMessages(enDict, yo),
  ig: mergeMessages(enDict, ig),
  de: mergeMessages(enDict, de),
  es: mergeMessages(enDict, es),
  pcm: mergeMessages(enDict, pcm),
  ar: mergeMessages(enDict, ar),
  bn: mergeMessages(enDict, bn),
  sv: mergeMessages(enDict, sv),
  ha: mergeMessages(enDict, ha),
  bin: mergeMessages(enDict, bin),
  ish: mergeMessages(enDict, ish),
  ak: mergeMessages(enDict, ak),
  sw: mergeMessages(enDict, sw),
  fa: mergeMessages(enDict, fa),
};

export type MessageKey =
  | `brand.${keyof MessageDict["brand"]}`
  | `nav.${keyof MessageDict["nav"]}`
  | `workspace.${keyof MessageDict["workspace"]}`
  | `focus.${keyof MessageDict["focus"]}`
  | `common.${keyof MessageDict["common"]}`
  | `ui.${keyof MessageDict["ui"]}`
  | `tabs.${keyof MessageDict["tabs"]}`
  | `lock.${keyof MessageDict["lock"]}`
  | `forex.${keyof MessageDict["forex"]}`
  | `lockDesc.${keyof MessageDict["lockDesc"]}`
  | `uni.${keyof MessageDict["uni"]}`
  | "more";

function lookup(dict: MessageDict, key: string): string | undefined {
  if (key === "more") return dict.more;
  const [group, leaf] = key.split(".", 2);
  if (!group || !leaf) return undefined;
  const section = dict[group as keyof MessageDict];
  if (!section || typeof section === "string") return undefined;
  return (section as Record<string, string>)[leaf];
}

export function translate(locale: AppLocale, key: MessageKey | string, vars?: Record<string, string | number>): string {
  const primary = lookup(CATALOG[locale] ?? CATALOG[DEFAULT_LOCALE], key);
  const fallback = locale === DEFAULT_LOCALE ? undefined : lookup(CATALOG[DEFAULT_LOCALE], key);
  let out = primary ?? fallback ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replaceAll(`{${k}}`, String(v));
    }
  }
  return out;
}

export { en };
export type { MessageDict, DeepPartialMessages };
