export type AdminSessionUser = {
  email?: string | null;
  walletAddress?: string | null;
  isOwner?: boolean;
  customersViewerAdmin?: boolean;
};

function isOwnerFromSession(session: { user?: AdminSessionUser } | null): boolean {
  return !!session?.user?.isOwner;
}

export function isCustomersViewerAdminSession(
  session: { user?: AdminSessionUser } | null
): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return false;
  return !!session.user.customersViewerAdmin;
}

/** Owner or read-only customers admin. */
export function canAccessAdminSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return !!session.user.customersViewerAdmin;
}

export function canViewAdminCustomersSession(session: { user?: AdminSessionUser } | null): boolean {
  return canAccessAdminSession(session);
}

/** Full admin: owner only (edit customers, other admin pages). */
export function canEditAdminCustomersSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  return isOwnerFromSession(session);
}

export function customersViewerAdminOnly(session: { user?: AdminSessionUser } | null): boolean {
  return canAccessAdminSession(session) && !canEditAdminCustomersSession(session);
}
