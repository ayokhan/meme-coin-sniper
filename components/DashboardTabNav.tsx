"use client";

import type { ReactNode } from "react";
import { Flame, Lock, Star } from "lucide-react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TopTabNewPill } from "@/components/TopTabNewPill";
import type { DashboardNavGroup } from "@/lib/dashboard-nav";

export type DashboardNavTool = {
  id: string;
  label: string;
  hot?: boolean;
  isNew?: boolean;
  pinned?: boolean;
  /** Shown when the user can't open the tool yet. Empty label = lock icon only. */
  lock?: { label: string; title: string } | null;
  extra?: ReactNode;
};

type Props = {
  groups: { id: DashboardNavGroup; label: string }[];
  activeGroup: DashboardNavGroup;
  onGroupChange: (group: DashboardNavGroup) => void;
  tools: DashboardNavTool[];
  pin?: { pinned: boolean; label: string; onToggle: () => void } | null;
  trailing?: ReactNode;
};

const TOOLS_LIST_CLASS =
  "!flex !h-auto !min-h-0 w-full flex-nowrap md:flex-wrap justify-start overflow-x-auto md:overflow-visible snap-x content-start items-center gap-2 p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-700/80 bg-gradient-to-br from-zinc-50/95 via-white/90 to-zinc-100/80 dark:from-zinc-900/95 dark:via-zinc-800/90 dark:to-zinc-900/80 shadow-inner [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const TOOL_TRIGGER_CLASS =
  "!h-auto flex-none grow-0 shrink-0 snap-start inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border border-zinc-200 dark:border-zinc-600 px-3 py-2 min-h-[38px] text-sm font-medium transition-all duration-150 data-[state=inactive]:bg-white/70 data-[state=inactive]:text-zinc-700 dark:data-[state=inactive]:bg-zinc-700/70 dark:data-[state=inactive]:text-zinc-200 data-[state=inactive]:hover:bg-zinc-200/80 dark:data-[state=inactive]:hover:bg-zinc-600/80 data-[state=active]:border-transparent data-[state=active]:bg-cyan-500 data-[state=active]:text-white dark:data-[state=active]:bg-cyan-600 data-[state=active]:shadow-md";

export function DashboardTabNav({ groups, activeGroup, onGroupChange, tools, pin, trailing }: Props) {
  return (
    <div className="flex flex-col gap-2 w-full min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <div
          role="toolbar"
          aria-label="Tool groups"
          className="flex min-w-0 flex-nowrap md:flex-wrap gap-1.5 overflow-x-auto md:overflow-visible -mx-1 px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {groups.map((g) => {
            const active = g.id === activeGroup;
            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onGroupChange(g.id)}
                aria-pressed={active}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                  active
                    ? "bg-zinc-900 text-white shadow-sm dark:bg-white dark:text-zinc-900"
                    : "bg-white/80 text-zinc-600 border border-zinc-200/80 hover:border-cyan-400/60 hover:text-zinc-900 dark:bg-zinc-800/80 dark:text-zinc-300 dark:border-zinc-600/80 dark:hover:text-white"
                }`}
              >
                {g.label}
              </button>
            );
          })}
        </div>
        {trailing ? <div className="ml-auto shrink-0">{trailing}</div> : null}
      </div>
      <TabsList className={TOOLS_LIST_CLASS}>
        {tools.map((tool) => (
          <TabsTrigger key={tool.id} value={tool.id} className={TOOL_TRIGGER_CLASS} title={tool.lock?.title}>
            {tool.hot ? <Flame className="h-4 w-4 shrink-0 flame-hot-tab animate-flame-flicker" aria-hidden /> : null}
            <span>{tool.label}</span>
            {tool.pinned ? <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" aria-label="Pinned" /> : null}
            {tool.extra}
            <TopTabNewPill show={!!tool.isNew} />
            {tool.lock ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold leading-none bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                <Lock className="h-2.5 w-2.5" aria-hidden />
                {tool.lock.label}
              </span>
            ) : null}
          </TabsTrigger>
        ))}
      </TabsList>
      {pin ? (
        <button
          type="button"
          onClick={pin.onToggle}
          className="self-start inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400"
        >
          <Star className={`h-3 w-3 ${pin.pinned ? "fill-amber-400 text-amber-400" : ""}`} aria-hidden />
          {pin.label}
        </button>
      ) : null}
    </div>
  );
}
