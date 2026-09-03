/**
 * NovaScalper instrument parsing. Blofin: BTC-USDT. Coinbase: BTC_USDC-PERPETUAL.
 */
import { toCoinbaseInstrument } from "@/lib/coinbase";

export type ScalperExchange = "blofin" | "coinbase";

export type ParsedInstrument = { base: string; quote: "USDT" | "USDC"; instId: string };

function finalizeInstrument(p: ParsedInstrument, exchange: ScalperExchange): ParsedInstrument {
  if (exchange !== "coinbase" || !p.base || p.base === "XAU" || p.base === "XAG") return p;
  return { ...p, instId: toCoinbaseInstrument(p.base, p.quote) };
}

/** Parse user input: "BTC/USDT", "BTC-USDT", "BTC" + separate quote, or stored base only. */
export function parseScalperInstrument(
  symbolField: string,
  marginCurrencyFallback: string,
  exchange: ScalperExchange = "blofin"
): ParsedInstrument {
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
        return finalizeInstrument({ base: "XAU", quote: "USDT", instId: "XAU-USDT" }, exchange);
      }
      if (base === "XAG" || base === "SILVER") {
        return finalizeInstrument({ base: "XAG", quote: "USDT", instId: "XAG-USDT" }, exchange);
      }
      const quoteRaw = parts[1]!;
      const quote = quoteRaw === "USDC" ? "USDC" : "USDT";
      return finalizeInstrument({ base, quote, instId: `${base}-${quote}` }, exchange);
    }
  }
  const base = raw || "BTC";
  if (base === "XAU") return finalizeInstrument({ base: "XAU", quote: "USDT", instId: "XAU-USDT" }, exchange);
  if (base === "XAG") return finalizeInstrument({ base: "XAG", quote: "USDT", instId: "XAG-USDT" }, exchange);
  const quote = marginCurrencyFallback === "USDC" ? "USDC" : "USDT";
  return finalizeInstrument({ base, quote, instId: `${base}-${quote}` }, exchange);
}
