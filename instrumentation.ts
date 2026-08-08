/**
 * Next.js instrumentation — capture unhandled server request errors into SystemErrorLog.
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // No-op bootstrap; onRequestError below does the work.
}

export async function onRequestError(
  err: { digest?: string } & Error,
  request: {
    path: string;
    method: string;
    headers: { [key: string]: string | string[] | undefined };
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: string;
    renderSource?: string;
  }
) {
  // Avoid logging auth noise / expected client aborts if digest-only.
  const message = err?.message || "Unhandled request error";
  if (/NEXT_NOT_FOUND|NEXT_REDIRECT/i.test(message)) return;

  try {
    const { logSystemError } = await import("@/lib/system-error-log");
    await logSystemError({
      source: `route.${context.routeType || "unknown"}`,
      message,
      detail: err?.stack ?? null,
      meta: {
        digest: err?.digest ?? null,
        path: request.path,
        method: request.method,
        routePath: context.routePath,
        routerKind: context.routerKind,
        renderSource: context.renderSource ?? null,
      },
    });
  } catch {
    console.error("[instrumentation] onRequestError log failed", message);
  }
}
