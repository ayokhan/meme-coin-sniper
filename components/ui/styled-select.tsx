"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type StyledSelectOption<T extends string> = { value: T; label: string };

export type StyledSelectProps<T extends string> = {
  value: T;
  options: StyledSelectOption<T>[];
  onChange: (v: T) => void;
  title?: string;
  className?: string;
  /** Optional. Forces a fixed height (defaults to h-10 to match form inputs.) */
  heightClass?: string;
};

/**
 * Themed dropdown that matches the rest of the form (dark/light), since native
 * `<select>` option panels inherit OS styling and look unreadable in dark mode.
 */
export function StyledSelect<T extends string>({
  value,
  options,
  onChange,
  title,
  className,
  heightClass = "h-10",
}: StyledSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const current = options.find((p) => p.value === value);
  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className={`w-full ${heightClass} rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 text-sm flex items-center justify-between gap-2 text-zinc-900 dark:text-zinc-100`}
      >
        <span className="truncate">{current?.label ?? value}</span>
        <ChevronDown className={`h-4 w-4 opacity-70 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl overflow-hidden">
          {options.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                onChange(p.value);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors ${
                p.value === value
                  ? "bg-cyan-50 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 font-medium"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default StyledSelect;
