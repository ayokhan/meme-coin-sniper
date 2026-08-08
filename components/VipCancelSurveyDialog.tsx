"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { VIP_CANCEL_SURVEY_REASONS } from "@/lib/vip-trial-constants";

type Props = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (payload: { reasons: string[]; comment: string }) => void;
};

export default function VipCancelSurveyDialog({ open, loading, onClose, onConfirm }: Props) {
  const [reasons, setReasons] = useState<string[]>([]);
  const [comment, setComment] = useState("");

  if (!open) return null;

  const toggle = (id: string) => {
    setReasons((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl p-5">
        <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Cancel auto-renewal?</h2>
        <p className="mt-1.5 text-xs text-muted-foreground">
          You’ll keep VIP until the end of your current period or trial. After that we won’t charge you again.
          Tell us why you’re leaving — it helps us improve NovaStaris.
        </p>
        <div className="mt-3 space-y-2">
          {VIP_CANCEL_SURVEY_REASONS.map((r) => (
            <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                className="rounded"
                checked={reasons.includes(r.id)}
                onChange={() => toggle(r.id)}
              />
              {r.label}
            </label>
          ))}
        </div>
        <label className="mt-3 block text-xs text-muted-foreground">
          Anything else? (optional)
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="mt-1 w-full text-sm border rounded-md px-2 py-1.5 bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600"
            maxLength={2000}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" disabled={loading} onClick={onClose}>
            Keep VIP
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            className="border-rose-300 text-rose-800 dark:text-rose-200"
            onClick={() => onConfirm({ reasons, comment })}
          >
            {loading ? "Updating…" : "Confirm cancel"}
          </Button>
        </div>
      </div>
    </div>
  );
}
