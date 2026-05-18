/**
 * NovaScalper: Blofin instId is BASE-QUOTE (e.g. BTC-USDT). Entry/exit/stop are always the coin price in that quote (USDT or USDC).
 */

export type ParsedInstrument = { base: string; quote: "USDT" | "USDC"; instId: string };

/** Parse user input: "BTC/USDT", "BTC-USDT", "BTC" + separate quote, or stored base only. */
export function parseScalperInstrument(symbolField: string, marginCurrencyFallback: string): ParsedInstrument {
  let raw = String(symbolField ?? "")
    .trim()
    .toUpperCase()
    .replace(/-/g, "/");
  if (raw === "GOLD") raw = "XAU";
  if (raw === "SILVER") raw = "XAG";
  if (!raw) {
    const quote = marginCurrencyFallback === "USDC" ? "USDC" : "USDT";
    return { base: "", quote, instId: "" };
  }
  if (raw.includes("/")) {
    const parts = raw.split("/").map((p) => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
      const base = parts[0]!;
      if (base === "XAU" || base === "GOLD") {
        return { base: "XAU", quote: "USDT", instId: "XAU-USDT" };
      }
      if (base === "XAG" || base === "SILVER") {
        return { base: "XAG", quote: "USDT", instId: "XAG-USDT" };
      }
      const quoteRaw = parts[1]!;
      const quote = quoteRaw === "USDC" ? "USDC" : "USDT";
      return { base, quote, instId: `${base}-${quote}` };
    }
  }
  const base = raw || "BTC";
  if (base === "XAU") return { base: "XAU", quote: "USDT", instId: "XAU-USDT" };
  if (base === "XAG") return { base: "XAG", quote: "USDT", instId: "XAG-USDT" };
  const quote = marginCurrencyFallback === "USDC" ? "USDC" : "USDT";
  return { base, quote, instId: `${base}-${quote}` };
}
