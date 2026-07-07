export type AdminSessionUser = {
  email?: string | null;
  walletAddress?: string | null;
  isOwner?: boolean;
  customersViewerAdmin?: boolean;
  supportViewerAdmin?: boolean;
  liveChatAgentAdmin?: boolean;
  supportStaffName?: string | null;
};

function isOwnerFromSession(session: { user?: AdminSessionUser } | null): boolean {
  return !!session?.user?.isOwner;
}

/** null = full owner nav; [] = no delegated access; string[] = allowed admin paths. */
export function getDelegatedAdminNavHrefs(session: { user?: AdminSessionUser } | null): string[] | null {
  if (!session?.user || isOwnerFromSession(session)) return null;
  const hrefs: string[] = [];
  if (session.user.customersViewerAdmin) hrefs.push('/admin/customers');
  if (session.user.supportViewerAdmin) hrefs.push('/admin/support');
  if (session.user.liveChatAgentAdmin) hrefs.push('/admin/chat');
  if (hrefs.length > 0) hrefs.push('/admin/affiliates');
  return hrefs;
}

export function delegatedAdminOnly(session: { user?: AdminSessionUser } | null): boolean {
  const hrefs = getDelegatedAdminNavHrefs(session);
  return Array.isArray(hrefs) && hrefs.length > 0;
}

export function canAccessDelegatedAdminPath(
  session: { user?: AdminSessionUser } | null,
  pathname: string
): boolean {
  const hrefs = getDelegatedAdminNavHrefs(session);
  if (hrefs === null) return true;
  if (hrefs.length === 0) return false;
  return hrefs.some((h) => pathname === h || (h !== '/admin' && pathname.startsWith(h)));
}

export function isCustomersViewerAdminSession(
  session: { user?: AdminSessionUser } | null
): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return false;
  return !!session.user.customersViewerAdmin;
}

export function canAccessAdminSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return delegatedAdminOnly(session);
}

export function canViewAdminCustomersSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return !!session.user.customersViewerAdmin;
}

export function canEditAdminCustomersSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  return isOwnerFromSession(session);
}

export function customersViewerAdminOnly(session: { user?: AdminSessionUser } | null): boolean {
  const hrefs = getDelegatedAdminNavHrefs(session);
  return Array.isArray(hrefs) && hrefs.length === 1 && hrefs[0] === '/admin/customers';
}

export function canViewAdminSupportSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return !!session.user.supportViewerAdmin;
}

export function canUpdateAdminSupportSession(session: { user?: AdminSessionUser } | null): boolean {
  return canViewAdminSupportSession(session);
}

export function canDeleteAdminSupportSession(session: { user?: AdminSessionUser } | null): boolean {
  return isOwnerFromSession(session);
}

export function canAccessLiveChatAgentSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return !!session.user.liveChatAgentAdmin;
}

export function canDeleteAdminChatSession(session: { user?: AdminSessionUser } | null): boolean {
  return isOwnerFromSession(session);
}

/** Owner or any delegated admin can view affiliate payout records. */
export function canViewAdminAffiliateSession(session: { user?: AdminSessionUser } | null): boolean {
  if (!session?.user) return false;
  if (isOwnerFromSession(session)) return true;
  return delegatedAdminOnly(session);
}

/** Only owner can mark affiliate commissions as paid. */
export function canEditAdminAffiliateSession(session: { user?: AdminSessionUser } | null): boolean {
  return isOwnerFromSession(session);
}
