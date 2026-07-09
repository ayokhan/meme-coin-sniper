import Image from "next/image";

type Props = {
  className?: string;
  size?: "sm" | "md";
};

export function PartnerLogosStrip({ className = "", size = "md" }: Props) {
  const h = size === "sm" ? "h-6" : "h-7";
  return (
    <div className={`flex flex-wrap items-center justify-center gap-3 ${className}`}>
      <Image src="/partners/novastaris-logo.svg" alt="NovaStaris" width={120} height={32} className={`${h} w-auto`} />
      <span className="text-xs font-semibold text-cyan-300/80 uppercase tracking-widest">×</span>
      <Image src="/partners/blofin-logo.svg" alt="Blofin" width={120} height={32} className={`${h} w-auto`} />
    </div>
  );
}
