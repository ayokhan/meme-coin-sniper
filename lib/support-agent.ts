export const DEFAULT_SUPPORT_AGENT_NAME = 'Support Agent';

/** Display name shown to customers when this staff member replies in live chat. */
export function resolveSupportStaffDisplayName(supportStaffName?: string | null): string {
  const custom = supportStaffName?.trim();
  if (custom) return custom;
  return DEFAULT_SUPPORT_AGENT_NAME;
}
