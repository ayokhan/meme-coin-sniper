import Image from "next/image";

type Props = {
  className?: string;
  size?: "sm" | "md";
  /** Light parent background (e.g. in-app modal on white). */
  onLightBackground?: boolean;
};

export function PartnerLogosStrip({ className = "", size = "md", onLightBackground = false }: Props) {
  const h = size === "sm" ? "h-6" : "h-8";
  const blofinSrc = onLightBackground ? "/partners/blofin-logo-dark.png" : "/partners/blofin-logo-light.png";

  return (
    <div
      className={`inline-flex flex-wrap items-center justify-center gap-3 sm:gap-4 rounded-xl border px-4 py-2.5 ${
        onLightBackground
          ? "border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/80"
          : "border-cyan-500/20 bg-zinc-950/90"
      } ${className}`}
    >
      <Image
        src="/partners/novastaris-logo.svg"
        alt="NovaStaris"
        width={168}
        height={40}
        className={`${h} w-auto`}
        priority
      />
      <span
        className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
          onLightBackground ? "text-zinc-400 dark:text-zinc-500" : "text-cyan-400/70"
        }`}
        aria-hidden
      >
        ×
      </span>
      <Image
        src={blofinSrc}
        alt="Blofin"
        width={140}
        height={40}
        className={`${h} w-auto object-contain`}
        priority
      />
    </div>
  );
}
