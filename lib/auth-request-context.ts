import { AsyncLocalStorage } from "async_hooks";

/** Holds the current HTTP Request for NextAuth events (sign-in geo/device capture). */
export const authRequestContext = new AsyncLocalStorage<Request>();

export function getAuthRequest(): Request | undefined {
  return authRequestContext.getStore();
}
