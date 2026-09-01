/** Best-effort IPv4 egress address for GMGN IP whitelist (Vercel/serverless). */
export async function getServerEgressIpv4(): Promise<string | null> {
  const urls = ["https://api.ipify.org?format=json", "https://ip.me/ip"];
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
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

export function formatGmgnIpBlockedError(blockedIp: string | null, egressIp: string | null): string {
  const ip = blockedIp ?? egressIp ?? "your server IP";
  return `GMGN blocked this server IP (${ip}). In GMGN → API Management, add ${ip} to your API key IP whitelist, then try Approve again.`;
}

export function parseGmgnBlockedIp(message: string): string | null {
  const m = message.match(/source ip blocked\s+(\d+\.\d+\.\d+\.\d+)/i);
  return m?.[1] ?? null;
}
