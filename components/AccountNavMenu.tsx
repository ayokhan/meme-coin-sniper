"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Gift, BookOpen, User, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/I18nProvider";

type Props = {
  className?: string;
  onNavigate?: () => void;
};

export default function AccountNavMenu({ className = "", onNavigate }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [winsEnabled, setWinsEnabled] = useState(true);
  const [caseStudiesEnabled, setCaseStudiesEnabled] = useState(true);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/feature-flags-public")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setWinsEnabled(data?.flags?.page_tab_wins !== false);
        setCaseStudiesEnabled(data?.flags?.page_tab_case_studies !== false);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const close = () => {
    setOpen(false);
    onNavigate?.();
  };

  return (
    <div className={`relative ${className}`} ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="font-normal border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 inline-flex items-center gap-1"
      >
        {t("nav.account")}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-50 min-w-[200px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
          <Link
            href="/account"
            onClick={close}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <User className="h-4 w-4 shrink-0 text-zinc-500" />
            {t("nav.profileBilling")}
          </Link>
          <Link
            href="/affiliate"
            onClick={close}
            className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Gift className="h-4 w-4 shrink-0 text-amber-500" />
            {t("nav.affiliate")}
          </Link>
          {caseStudiesEnabled && (
            <Link
              href="/case-studies"
              onClick={close}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <BookOpen className="h-4 w-4 shrink-0 text-cyan-500" />
              {t("nav.caseStudies")}
            </Link>
          )}
          {winsEnabled && (
            <Link
              href="/wins"
              onClick={close}
              className="flex items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <Zap className="h-4 w-4 shrink-0 text-amber-500" />
              Wins
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
