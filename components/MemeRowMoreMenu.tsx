"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";

export type MemeRowMoreItem =
  | { type: "link"; label: string; href: string }
  | { type: "action"; label: string; onClick: () => void | Promise<void> };

type Props = {
  items: MemeRowMoreItem[];
  /** Optional label on the trigger */
  label?: string;
};

/**
 * Compact “More” menu for Go Hunting row links — keeps Analyze loud, tuck the rest.
 */
export default function MemeRowMoreMenu({ items, label = "More" }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return null;

  return (
    <div className="relative inline-flex" ref={rootRef}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-0.5 rounded-md border border-zinc-200/90 dark:border-zinc-700/80 bg-zinc-50/80 dark:bg-zinc-800/60 px-2 py-1 text-[11px] font-medium text-zinc-600 dark:text-zinc-300 hover:border-teal-500/40 hover:text-teal-800 dark:hover:text-teal-200 transition-colors"
      >
        {label}
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[9.5rem] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg shadow-black/20"
        >
          {items.map((item, i) => {
            if (item.type === "link") {
              return (
                <a
                  key={`${item.label}-${i}`}
                  role="menuitem"
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-900 dark:hover:text-teal-100"
                  onClick={() => setOpen(false)}
                >
                  {item.label}
                  <ExternalLink className="h-3 w-3 opacity-50" />
                </a>
              );
            }
            return (
              <button
                key={`${item.label}-${i}`}
                type="button"
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-900 dark:hover:text-teal-100"
                onClick={() => {
                  void (async () => {
                    await item.onClick();
                    if (item.label.toLowerCase().includes("copy")) {
                      setCopiedFlash(true);
                      window.setTimeout(() => setCopiedFlash(false), 1200);
                    }
                    setOpen(false);
                  })();
                }}
              >
                {item.label.toLowerCase().includes("copy") ? (
                  copiedFlash ? (
                    <Check className="h-3 w-3 text-emerald-500" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-60" />
                  )
                ) : null}
                {copiedFlash && item.label.toLowerCase().includes("copy") ? "Copied" : item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
