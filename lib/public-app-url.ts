/**
 * Canonical public site URL for links in emails (password reset, etc.).
 * Never use VERCEL_URL here — it is per-deployment and may require Vercel login.
 */
export function getPublicAppUrl(request?: Request): string {
  const fromRequest = request ? originFromRequest(request) : null;
  if (fromRequest) return fromRequest;

  const nextAuth = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (nextAuth) return nextAuth;

  const publicApp = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (publicApp) return publicApp;

  if (process.env.NODE_ENV === "production") {
    return "https://novastaris.ai";
  }

  return "http://localhost:3000";
}

function originFromRequest(request: Request): string | null {
  const origin = request.headers.get("origin")?.trim().replace(/\/$/, "");
  if (origin && isAllowedPublicHost(origin)) return origin;

  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!host) return null;
  const hostname = host.split(",")[0]?.trim().split(":")[0]?.toLowerCase();
  if (!hostname || hostname.endsWith(".vercel.app")) return null;

  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const candidate = `${proto}://${hostname}`;
  return isAllowedPublicHost(candidate) ? candidate : null;
}

function isAllowedPublicHost(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:") return false;
    if (hostname === "localhost" || hostname === "127.0.0.1") return true;
    if (hostname === "novastaris.ai" || hostname === "www.novastaris.ai") return true;
    return false;
  } catch {
    return false;
  }
}
