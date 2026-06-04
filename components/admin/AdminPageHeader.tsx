import Link from "next/link";

type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
};

export default function AdminPageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div>
        <p className="text-xs text-muted-foreground mb-1">
          <Link href="/admin" className="hover:underline">
            Admin
          </Link>
          <span className="mx-1">/</span>
          <span className="text-zinc-700 dark:text-zinc-300">{title}</span>
        </p>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 shrink-0">{actions}</div> : null}
    </div>
  );
}
