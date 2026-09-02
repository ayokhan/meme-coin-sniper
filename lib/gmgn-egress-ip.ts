/** Best-effort IPv4 egress address (uses GMGN proxy when configured). */
export async function getServerEgressIpv4(): Promise<string | null> {
  const { gmgnFetch } = await import("@/lib/gmgn-fetch");
  const urls = ["https://api.ipify.org?format=json", "https://ip.me/ip"];
  for (const url of urls) {
    try {
      const res = await gmgnFetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      if (url.includes("ipify")) {
        const json = (await res.json()) as { ip?: string };
        if (json.ip?.match(/^\d+\.\d+\.\d+\.\d+$/)) return json.ip;
      } else {
        const text = (await res.text()).trim();
        if (/^\d+\.\d+\.\d+\.\d+$/.test(text)) return text;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

const IP_RE = /\d+\.\d+\.\d+\.\d+/g;

export function isGmgnIpBlockReason(reason: string | null | undefined): boolean {
  if (!reason) return false;
  return /ip blocked|blocked server ip|blocked novastaris server ip/i.test(reason);
}

export function extractIpsFromGmgnBlockReason(reason: string | null | undefined): string[] {
  if (!reason || !isGmgnIpBlockReason(reason)) return [];
  const ips = reason.match(IP_RE) ?? [];
  return [...new Set(ips)];
}

export function parseGmgnBlockedIp(message: string): string | null {
  const patterns = [
    /source ip blocked\s+(\d+\.\d+\.\d+\.\d+)/i,
    /blocked server IP\s+(\d+\.\d+\.\d+\.\d+)/i,
    /blocked NovaStaris server IP\s+(\d+\.\d+\.\d+\.\d+)/i,
  ];
  for (const p of patterns) {
    const m = message.match(p);
    if (m?.[1]) return m[1];
  }
  return null;
}

export function formatGmgnIpBlockedError(blockedIp: string | null, egressIp: string | null): string {
  const ip = blockedIp ?? egressIp ?? "server IP";
  return `GMGN blocked IP ${ip}. Add it to Trusted IP in GMGN API Management (max 5).`;
}

export function mergeWhitelistIps(...groups: (string | null | undefined)[][]): string[] {
  const out = new Set<string>();
  for (const g of groups) {
    for (const ip of g) {
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) out.add(ip);
    }
  }
  return [...out];
}
