import { Instagram } from "lucide-react";

export const NOVASTARIS_INSTAGRAM_HANDLE = "novastaris";
export const NOVASTARIS_INSTAGRAM_URL = "https://www.instagram.com/novastaris/";

/** Quiet Instagram follow link for public page footers (no marquee). */
export default function SiteInstagramFooter({ className = "" }: { className?: string }) {
  return (
    <div
      className={`mt-auto border-t border-zinc-200/80 dark:border-zinc-800/80 pt-6 pb-8 ${className}`}
    >
      <a
        href={NOVASTARIS_INSTAGRAM_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-300"
      >
        <Instagram className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Follow <span className="font-medium text-zinc-700 dark:text-zinc-300">@{NOVASTARIS_INSTAGRAM_HANDLE}</span> on
          Instagram
        </span>
      </a>
    </div>
  );
}
