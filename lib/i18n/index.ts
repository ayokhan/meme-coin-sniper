import type { AppLocale } from "./locales";
import { DEFAULT_LOCALE } from "./locales";
import { en, type MessageDict } from "./messages/en";
import { fr } from "./messages/fr";
import { zh } from "./messages/zh";
import { hi } from "./messages/hi";
import { yo } from "./messages/yo";
import { ig } from "./messages/ig";

const CATALOG: Record<AppLocale, MessageDict> = {
  en: en as unknown as MessageDict,
  fr,
  zh,
  hi,
  yo,
  ig,
};

export type MessageKey =
  | `brand.${keyof MessageDict["brand"]}`
  | `nav.${keyof MessageDict["nav"]}`
  | `workspace.${keyof MessageDict["workspace"]}`
  | `focus.${keyof MessageDict["focus"]}`
  | `common.${keyof MessageDict["common"]}`
  | `tabs.${keyof MessageDict["tabs"]}`
  | `lock.${keyof MessageDict["lock"]}`
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
export type { MessageDict };
