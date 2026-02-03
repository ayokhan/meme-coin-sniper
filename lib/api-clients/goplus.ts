import axios from 'axios';

export interface GoPlusSecurityData {
  is_honeypot: string;
  is_mintable: string;
  holder_count: string;
  holders: Array<{ percent: string }>;
  lp_holders: Array<{ address: string; percent: string }>;
}

export async function checkSolanaTokenSecurity(mintAddress: string): Promise<GoPlusSecurityData | null> {
  try {
    const response = await axios.get('https://api.gopluslabs.io/api/v1/token_security/solana', {
      params: { contract_addresses: mintAddress.toLowerCase() },
      timeout: 10000,
    });
    return response.data.result?.[mintAddress.toLowerCase()] || null;
  } catch { return null; }
}

export function calculateSecurityScore(data: GoPlusSecurityData): number {
  let score = 100;
  if (data.is_honeypot === '1') return 0;
  if (data.is_mintable === '1') score -= 30;
  if (data.holders?.length) {
    const topPct = parseFloat(data.holders[0].percent) * 100;
    if (topPct > 50) score -= 30;
    else if (topPct > 30) score -= 15;
  }
  return Math.max(0, score);
}

export function getTopHolderPercentage(data: GoPlusSecurityData): number {
  return data.holders?.length ? parseFloat(data.holders[0].percent) * 100 : 0;
}

export function isLPLocked(data: GoPlusSecurityData): boolean {
  const topLP = data.lp_holders?.[0]?.address.toLowerCase() || '';
  return ['1111111111111111111111111111111', 'null'].some(addr => topLP.includes(addr));
}

export function getSecuritySummary(data: GoPlusSecurityData) {
  const issues: string[] = [];
  const warnings: string[] = [];
  if (data.is_honeypot === '1') issues.push('🚨 HONEYPOT');
  if (data.is_mintable === '1') warnings.push('⚠️ Mintable');
  const topPct = getTopHolderPercentage(data);
  if (topPct > 30) warnings.push(`⚠️ Top holder: ${topPct.toFixed(1)}%`);
  return { issues, warnings };
}
