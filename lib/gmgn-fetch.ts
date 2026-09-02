import { fetch as undiciFetch, ProxyAgent } from "undici";

/** GMGN-only proxy URL (do not use global HTTPS_PROXY — other APIs stay on Vercel). */
export function getGmgnProxyUrl(): string | undefined {
  const url = process.env.GMGN_HTTPS_PROXY?.trim() || process.env.GMGN_HTTP_PROXY?.trim();
  return url || undefined;
}

export function isGmgnProxyConfigured(): boolean {
  return !!getGmgnProxyUrl();
}

export async function gmgnFetch(url: string, init?: RequestInit): Promise<Response> {
  const proxy = getGmgnProxyUrl();
  if (!proxy) return fetch(url, init);

  const res = await undiciFetch(url, {
    ...init,
    dispatcher: new ProxyAgent(proxy),
  } as Parameters<typeof undiciFetch>[1]);
  return res as unknown as Response;
}
