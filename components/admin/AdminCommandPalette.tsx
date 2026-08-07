"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, Search, CornerDownLeft } from "lucide-react";
import { ADMIN_NAV_GROUPS, type AdminNavItem } from "@/lib/admin-nav-config";
import { FEATURE_FLAG_KEYS } from "@/lib/feature-flag-keys";
import {
  PRODUCT_VISIBILITY_FLAG_ROWS,
  PRODUCT_VISIBILITY_SUBTAB_FLAGS,
} from "@/lib/product-visibility";

type CommandItem = {
  id: string;
  kind: "nav" | "flag";
  label: string;
  hint: string;
  href: string;
  keywords: string;
};

function humanizeFlagKey(key: string): string {
  return key
    .split("_")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function productVisibilityHrefForFlag(key: string): string | null {
  if (!key.startsWith("page_tab_")) return null;
  const row =
    PRODUCT_VISIBILITY_FLAG_ROWS.find((r) => r.flagKey === key) ??
    PRODUCT_VISIBILITY_SUBTAB_FLAGS.find((r) => r.flagKey === key);
  return row ? `/admin/tab-visibility#vis-${row.tabId}` : "/admin/tab-visibility";
}

function dedupeNav(items: AdminNavItem[]): AdminNavItem[] {
  const seen = new Set<string>();
  const out: AdminNavItem[] = [];
  for (const item of items) {
    if (seen.has(item.href)) continue;
    seen.add(item.href);
    out.push(item);
  }
  return out;
}

function scoreMatch(query: string, item: CommandItem): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const hay = `${item.label} ${item.hint} ${item.keywords}`.toLowerCase();
  if (hay === q) return 100;
  if (item.label.toLowerCase().startsWith(q)) return 90;
  if (item.keywords.toLowerCase().startsWith(q)) return 85;
  if (hay.includes(q)) return 70;
  const parts = q.split(/\s+/).filter(Boolean);
  if (parts.every((p) => hay.includes(p))) return 55;
  return 0;
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Nav items already filtered for this session (owner vs delegated). */
  navItems: AdminNavItem[];
  /** Owner sees feature-flag jumps; delegated does not. */
  includeFlags: boolean;
};

export default function AdminCommandPalette({ open, onOpenChange, navItems, includeFlags }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const catalog = useMemo(() => {
    const groupLabel = Object.fromEntries(ADMIN_NAV_GROUPS.map((g) => [g.id, g.label]));
    const nav: CommandItem[] = dedupeNav(navItems).map((item) => ({
      id: `nav:${item.href}`,
      kind: "nav" as const,
      label: item.label,
      hint: item.description || groupLabel[item.group] || "Admin",
      href: item.href,
      keywords: `${item.href} ${item.group}`,
    }));

    const flags: CommandItem[] = includeFlags
      ? Object.values(FEATURE_FLAG_KEYS).map((key) => {
          const visHref = productVisibilityHrefForFlag(key);
          return {
            id: `flag:${key}`,
            kind: "flag" as const,
            label: humanizeFlagKey(key),
            hint: visHref ? `Product visibility · ${key}` : `Feature flag · ${key}`,
            href: visHref ?? `/admin/feature-flags?flag=${encodeURIComponent(key)}`,
            keywords: key,
          };
        })
      : [];

    return [...nav, ...flags];
  }, [navItems, includeFlags]);

  const results = useMemo(() => {
    const scored = catalog
      .map((item) => ({ item, score: scoreMatch(query, item) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
    return scored.slice(0, 40).map((r) => r.item);
  }, [catalog, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  const run = useCallback(
    (item: CommandItem) => {
      onOpenChange(false);
      router.push(item.href);
    },
    [onOpenChange, router]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(0, results.length - 1)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = results[activeIndex];
        if (item) run(item);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, onOpenChange, run]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-3 pt-[12vh] sm:pt-[15vh]">
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        aria-label="Close command palette"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Admin command palette"
        className="relative w-full max-w-xl overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 px-3 py-2.5">
          <Search className="h-4 w-4 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={includeFlags ? "Jump to page or flag…" : "Jump to page…"}
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none"
          />
          <kbd className="hidden sm:inline rounded border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-500">
            Esc
          </kbd>
        </div>
        <ul className="max-h-[min(50vh,380px)] overflow-y-auto py-1" role="listbox">
          {results.length === 0 ? (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">No matches.</li>
          ) : (
            results.map((item, i) => {
              const active = i === activeIndex;
              const Icon = item.kind === "flag" ? Flag : Search;
              return (
                <li key={item.id} role="option" aria-selected={active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => run(item)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "bg-cyan-500/15 text-cyan-950 dark:text-cyan-50"
                        : "text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800/80"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        item.kind === "flag"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-zinc-400"
                      }`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium truncate">{item.label}</span>
                      <span className="block text-[11px] text-muted-foreground truncate">{item.hint}</span>
                    </span>
                    {active && <CornerDownLeft className="h-3.5 w-3.5 text-zinc-400 shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 py-2 text-[10px] text-zinc-500 flex flex-wrap gap-x-3 gap-y-1">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          {includeFlags && <span>Flags open Feature Flags and highlight the key</span>}
        </div>
      </div>
    </div>
  );
}

/** Global ⌘K / Ctrl+K listener for admin shell. */
export function useAdminCommandPaletteHotkey(onToggle: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod || e.key.toLowerCase() !== "k") return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable) {
        // Still allow ⌘K from inputs inside admin — that's the point.
      }
      e.preventDefault();
      onToggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onToggle]);
}
