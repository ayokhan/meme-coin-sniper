"use client";

import { NOVA_UI_TIMEFRAME_IDS, sortNovaTimeframeIds } from "@/lib/nova-timeframes";

type Props = {
  selected: string[];
  onChange: (ids: string[]) => void;
  idPrefix?: string;
};

export default function NovaTimeframeCheckboxPicker({ selected, onChange, idPrefix = "nova-tf" }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-muted-foreground whitespace-nowrap">Timeframes:</span>
      {NOVA_UI_TIMEFRAME_IDS.map((tf) => (
        <label key={`${idPrefix}-${tf}`} className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={selected.includes(tf)}
            onChange={() => {
              const next = selected.includes(tf) ? selected.filter((t) => t !== tf) : [...selected, tf];
              onChange(sortNovaTimeframeIds(next));
            }}
            className="rounded border-zinc-400 dark:border-zinc-500"
          />
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{tf}</span>
        </label>
      ))}
    </div>
  );
}
