import Image from "next/image";
import type { PartnerBrand } from "@/lib/partner-brand";

export type { PartnerBrand };

type Props = {
  className?: string;
  size?: "sm" | "md";
  /** Light parent background (e.g. in-app modal on white). */
  onLightBackground?: boolean;
  /** Which broker/exchange logo to show next to NovaStaris. Default: Blofin. */
  partner?: PartnerBrand;
};

const PARTNER_ALT: Record<PartnerBrand, string> = {
  blofin: "Blofin",
  vantage: "Vantage",
  tiomarkets: "TIOmarkets",
  assexmarkets: "Assexmarkets",
};

function partnerSrc(partner: PartnerBrand, onLightBackground: boolean): string {
  if (partner === "vantage") return "/partners/vantage-logo.png";
  if (partner === "tiomarkets") return "/partners/tiomarkets-logo.png";
  if (partner === "assexmarkets") return "/partners/assexmarkets-logo.png";
  return onLightBackground ? "/partners/blofin-logo-dark.png" : "/partners/blofin-logo-light.png";
}

export function PartnerLogosStrip({
  className = "",
  size = "md",
  onLightBackground = false,
  partner = "blofin",
}: Props) {
  const h = size === "sm" ? "h-6" : "h-8";
  const partnerImage = partnerSrc(partner, onLightBackground);
  /** TIOmarkets logo ships on black; keep a dark chip so orange wordmark stays readable on light modals. */
  const partnerNeedsDarkChip = partner === "tiomarkets" && onLightBackground;

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
      <span
        className={
          partnerNeedsDarkChip
            ? "inline-flex items-center rounded-md bg-zinc-950 px-2 py-1"
            : "inline-flex items-center"
        }
      >
        <Image
          src={partnerImage}
          alt={PARTNER_ALT[partner]}
          width={partner === "vantage" ? 160 : partner === "assexmarkets" ? 48 : 140}
          height={40}
          className={`${h} w-auto object-contain`}
          priority
        />
      </span>
    </div>
  );
}
