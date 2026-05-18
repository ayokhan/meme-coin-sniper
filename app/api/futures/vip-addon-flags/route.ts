import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getFeatureFlag, FEATURE_FLAG_KEYS } from "@/lib/feature-flags";

export const dynamic = "force-dynamic";

/** Public-safe: whether VIP futures add-on tabs are enabled by admin flags. */
export async function GET() {
  try {
    // Session read kept for parity/auditing, but visibility is flag-driven for all users.
    await getServerSession(authOptions);
    const [novaEagle, cryptoBuddie, novaLiquidationMap, novaFuturesNarratives, novaMemeIntelligence, novaQMemes, novaSmartMemes, topMemeCoins, memePriceFactor, memeRunner, novaScalpAgent, novaQFib] = await Promise.all([
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_EAGLE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_CRYPTO_BUDDIE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_LIQUIDATION_MAP),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_FUTURES_NARRATIVES),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_INTELLIGENCE),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_Q_MEMES),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SMART_MEMES),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_TOP_MEME_COINS),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_PRICE_FACTOR),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_MEME_RUNNER),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_SCALP_AGENT),
      getFeatureFlag(FEATURE_FLAG_KEYS.NOVA_Q_FIB),
    ]);
    return NextResponse.json({ success: true, novaEagle, cryptoBuddie, novaLiquidationMap, novaFuturesNarratives, novaMemeIntelligence, novaQMemes, novaSmartMemes, topMemeCoins, memePriceFactor, memeRunner, novaScalpAgent, novaQFib });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to read flags";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
