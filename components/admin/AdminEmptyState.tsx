import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

type Props = {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

export default function AdminEmptyState({ icon: Icon, title, description, actionLabel, actionHref }: Props) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 bg-zinc-50/50 dark:bg-zinc-900/50 px-6 py-10 text-center">
      <Icon className="h-10 w-10 mx-auto text-zinc-400 dark:text-zinc-500 mb-3" />
      <p className="font-semibold text-zinc-800 dark:text-zinc-200">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
