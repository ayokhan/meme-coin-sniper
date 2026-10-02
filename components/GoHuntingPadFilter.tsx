"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Filter } from "lucide-react";

export type GoHuntingPadOption = { key: string; label: string; count: number };
export type GoHuntingPadGroup = {
  chain: string;
  chainLabel: string;
  badgeLabel: string;
  badgeClass: string;
  pads: GoHuntingPadOption[];
};

/** Column-header picklist: multi-select launchpads / DEXes grouped by chain. Empty selection = show all. */
export function GoHuntingPadFilter({
  groups,
  selected,
  onChange,
  shown,
  total,
  className,
}: {
  groups: GoHuntingPadGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  shown: number;
  total: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const allKeys = groups.flatMap((g) => g.pads.map((p) => p.key));
  const isChecked = (key: string) => selected.length === 0 || selected.includes(key);
  const active = selected.length > 0;

  const commit = useCallback(
    (next: string[]) => {
      const unique = [...new Set(next)];
      if (unique.length === 0) return;
      onChange(allKeys.every((k) => unique.includes(k)) ? [] : unique);
    },
    [allKeys, onChange]
  );

  const toggle = (key: string) => {
    const base = selected.length === 0 ? allKeys : selected;
    commit(base.includes(key) ? base.filter((k) => k !== key) : [...base, key]);
  };

  const toggleGroup = (group: GoHuntingPadGroup) => {
    const keys = group.pads.map((p) => p.key);
    const base = selected.length === 0 ? allKeys : selected;
    const allOn = keys.every((k) => base.includes(k));
    commit(allOn ? base.filter((k) => !keys.includes(k)) : [...base, ...keys]);
  };

  const place = useCallback(() => {
    const r = buttonRef.current?.getBoundingClientRect();
    if (!r) return;
    const width = 288;
    setPos({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || buttonRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place]);

  const panel =
    open && pos
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Filter by launchpad or DEX"
            style={{ position: "fixed", top: pos.top, left: pos.left, width: 288 }}
            className="z-[80] overflow-hidden rounded-xl border border-zinc-200 bg-white text-zinc-800 shadow-2xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
              <span className="text-xs font-semibold">Launchpad / DEX</span>
              <div className="flex items-center gap-3 text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => onChange([])}
                  disabled={!active}
                  className="text-teal-700 hover:underline disabled:cursor-default disabled:text-zinc-400 disabled:no-underline dark:text-teal-300 dark:disabled:text-zinc-600"
                >
                  Select all
                </button>
              </div>
            </div>
            <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
              {groups.length === 0 && <p className="px-3 py-3 text-xs text-zinc-500">No launchpads in this view.</p>}
              {groups.map((g) => {
                const groupOn = g.pads.every((p) => isChecked(p.key));
                const groupSome = !groupOn && g.pads.some((p) => isChecked(p.key));
                return (
                  <div key={g.chain} className="py-1">
                    {groups.length > 1 && (
                      <label className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                        <input
                          type="checkbox"
                          checked={groupOn}
                          ref={(el) => {
                            if (el) el.indeterminate = groupSome;
                          }}
                          onChange={() => toggleGroup(g)}
                          className="h-3.5 w-3.5 accent-teal-600"
                        />
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${g.badgeClass}`}>{g.badgeLabel}</span>
                        <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">{g.chainLabel}</span>
                      </label>
                    )}
                    {g.pads.map((p) => (
                      <div
                        key={p.key}
                        className={`group flex items-center gap-2 py-1.5 pr-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 ${groups.length > 1 ? "pl-8" : "pl-3"}`}
                      >
                        <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked(p.key)}
                            onChange={() => toggle(p.key)}
                            className="h-3.5 w-3.5 accent-teal-600"
                          />
                          <span className={`truncate text-xs ${p.count === 0 ? "text-zinc-400 dark:text-zinc-500" : ""}`}>{p.label}</span>
                        </label>
                        <button
                          type="button"
                          onClick={() => onChange([p.key])}
                          className="text-[10px] font-semibold uppercase tracking-wide text-teal-700 opacity-0 transition-opacity hover:underline focus:opacity-100 group-hover:opacity-100 dark:text-teal-300"
                        >
                          Only
                        </button>
                        <span className="w-7 text-right text-[11px] tabular-nums text-zinc-400 dark:text-zinc-500">{p.count}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
            <div className="border-t border-zinc-200 px-3 py-2 text-[11px] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Showing {shown} of {total} coins
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Filter by launchpad / DEX"
        className={`-mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-1 uppercase transition-colors hover:bg-zinc-100 hover:text-teal-700 dark:hover:bg-zinc-800 dark:hover:text-teal-300 ${
          active || open ? "text-teal-700 dark:text-teal-300" : ""
        } ${className ?? ""}`}
      >
        <Filter className={`h-3 w-3 ${active ? "fill-current" : ""}`} aria-hidden />
        Chain / Pad
        {active && (
          <span className="rounded-full bg-teal-600 px-1.5 py-px text-[9px] font-bold tracking-normal text-white dark:bg-teal-500">
            {selected.length}
          </span>
        )}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>
      {panel}
    </>
  );
}
