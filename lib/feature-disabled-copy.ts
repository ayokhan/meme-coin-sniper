/** User-facing copy when a VIP add-on flag is off (never mention admin). */
export function featureNotAvailableError(featureName: string): string {
  return `${featureName} is not available on your account yet. Contact support if you need access.`;
}
