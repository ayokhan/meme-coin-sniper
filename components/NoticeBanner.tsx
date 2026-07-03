import type { ReactNode } from "react";

type Variant = "limit" | "info" | "caution";

const box: Record<Variant, string> = {
  limit:
    "rounded-lg border border-cyan-500/30 dark:border-cyan-600/40 bg-gradient-to-r from-slate-50/95 via-cyan-50/30 to-slate-50/95 dark:from-slate-900/95 dark:via-cyan-950/20 dark:to-slate-900/95",
  info:
    "rounded-lg border border-slate-200/90 dark:border-slate-700/80 bg-slate-50/90 dark:bg-slate-900/70",
  caution:
    "rounded-lg border border-violet-400/40 dark:border-violet-600/45 bg-gradient-to-r from-slate-50/95 to-violet-50/35 dark:from-slate-900/95 dark:to-violet-950/25",
};

const titleCls: Record<Variant, string> = {
  limit: "font-semibold text-slate-900 dark:text-slate-100",
  info: "font-semibold text-slate-800 dark:text-slate-200",
  caution: "font-semibold text-slate-900 dark:text-slate-100",
};

const bodyCls: Record<Variant, string> = {
  limit: "text-slate-600 dark:text-slate-300",
  info: "text-slate-600 dark:text-slate-400",
  caution: "text-slate-600 dark:text-slate-300",
};

type Props = {
  variant?: Variant;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
};

/** App-wide notice banner — slate/cyan/violet only (no amber/brown). */
export default function NoticeBanner({
  variant = "info",
  title,
  children,
  className = "",
  compact = false,
}: Props) {
  const padding = compact ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm";
  return (
    <div className={`${box[variant]} ${padding} ${className}`.trim()}>
      {title && <p className={titleCls[variant]}>{title}</p>}
      {children && (
        <div className={`${title ? "mt-1 " : ""}${bodyCls[variant]} leading-relaxed`}>{children}</div>
      )}
    </div>
  );
}

export function NoticeInline({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <p
      className={`text-xs text-slate-600 dark:text-slate-300 rounded-md border border-cyan-500/25 dark:border-cyan-600/35 bg-slate-50/90 dark:bg-slate-900/60 px-2 py-1.5 ${className}`.trim()}
    >
      {children}
    </p>
  );
}
