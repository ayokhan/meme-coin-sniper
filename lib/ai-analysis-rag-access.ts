import type { Tier } from '@/lib/subscription';
import { isOwnerSession } from '@/lib/auth';
import { getFeatureFlag, FEATURE_FLAG_KEYS } from '@/lib/feature-flags';

/** VIP or owner, when Admin feature flag ai_analysis_rag is ON. */
export async function canUseAiAnalysisRag(
  session: { user?: { email?: string | null; walletAddress?: string | null } } | null,
  tier: Tier | null,
): Promise<boolean> {
  const flagOn = await getFeatureFlag(FEATURE_FLAG_KEYS.AI_ANALYSIS_RAG);
  if (!flagOn) return false;
  if (isOwnerSession(session)) return true;
  return tier === 'vip';
}
