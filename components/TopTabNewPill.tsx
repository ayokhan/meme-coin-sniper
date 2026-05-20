/** Green "NEW" pill shown on main navigation tabs when enabled in admin. */
export function TopTabNewPill({ show }: { show: boolean }) {
  if (!show) return null;
  return (
    <span className="ml-0.5 inline-flex shrink-0 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
      NEW
    </span>
  );
}
