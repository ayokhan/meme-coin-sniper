"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Copy, ExternalLink } from "lucide-react";

export type MemeRowMoreItem =
  | { type: "link"; label: string; href: string }
  | { type: "action"; label: string; onClick: () => void | Promise<void> };

type Props = {
  items: MemeRowMoreItem[];
  /** Optional label on the trigger */
  label?: string;
};

type MenuPos = { top: number; left: number; openUp: boolean; width: number };

/**
 * Compact “More” menu for Go Hunting row links — keeps Analyze loud, tuck the rest.
 * Portaled to document.body so the hunting table overflow does not clip or trap scroll.
 */
export default function MemeRowMoreMenu({ items, label = "More" }: Props) {
  const [open, setOpen] = useState(false);
  const [copiedFlash, setCopiedFlash] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const place = () => {
      const btn = btnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuH = menuEl?.offsetHeight ?? 260;
      const menuW = Math.max(menuEl?.offsetWidth ?? 176, 176);
      const gap = 6;
      const spaceBelow = window.innerHeight - r.bottom;
      const spaceAbove = r.top;
      const openUp = spaceBelow < menuH + gap + 8 && spaceAbove > spaceBelow;
      const top = openUp ? r.top - gap : r.bottom + gap;
      const left = Math.min(Math.max(8, r.right - menuW), window.innerWidth - menuW - 8);
      setPos({ top, left, openUp, width: menuW });
    };
    place();
    const id = window.requestAnimationFrame(place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.cancelAnimationFrame(id);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
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

  const menu = open && mounted && (
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      style={
        pos
          ? {
              position: "fixed",
              top: pos.openUp ? undefined : pos.top,
              bottom: pos.openUp ? window.innerHeight - pos.top : undefined,
              left: pos.left,
              width: pos.width,
              zIndex: 80,
            }
          : { position: "fixed", top: -9999, left: -9999, zIndex: 80 }
      }
      className="max-h-[min(70vh,22rem)] min-w-[11rem] overflow-y-auto overscroll-contain rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg shadow-black/30"
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
              className="flex items-center justify-between gap-2 px-3 py-2.5 text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-900 dark:hover:text-teal-100"
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
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-teal-50 dark:hover:bg-teal-950/40 hover:text-teal-900 dark:hover:text-teal-100"
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
  );

  return (
    <div className="relative inline-flex">
      <button
        ref={btnRef}
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
      {mounted && menu ? createPortal(menu, document.body) : null}
    </div>
  );
}
