import axios from 'axios';

const GOPLUS_BASE = 'https://api.gopluslabs.io/api/v1';

export interface GoPlusSecurityData {
  is_honeypot: string;
  is_open_source: string;
  is_mintable: string;
  owner_address: string;
  creator_address: string;
  total_supply: string;
  holder_count: string;
  holders: Array<{
    address: string;
    balance: string;
    percent: string;
  }>;
  lp_holder_count: string;
  lp_holders: Array<{
    address: string;
    value: string;
    percent: string;
  }>;
}

export interface GoPlusResponse {
  code: number;
  message: string;
  result: {
    [address: string]: GoPlusSecurityData;
  };
}

export async function checkSolanaTokenSecurity(
  mintAddress: string
): Promise<GoPlusSecurityData | null> {
  try {
    const response = await axios.get<GoPlusResponse>(
      `${GOPLUS_BASE}/token_security/solana`,
      {
        params: {
          contract_addresses: mintAddress.toLowerCase(),
        },
        timeout: 10000,
      }
    );

    if (response.data.code === 1 && response.data.result) {
      return response.data.result[mintAddress.toLowerCase()] || null;
    }

    return null;
  } catch (error: any) {
    console.error('GoPlus API error:', error.message);
    return null;
  }
}

export function calculateSecurityScore(data: GoPlusSecurityData): number {
  let score = 100;

  if (data.is_honeypot === '1') return 0;
  if (data.is_mintable === '1') score -= 30;

  if (data.holders && data.holders.length > 0) {
    const topHolderPct = parseFloat(data.holders[0].percent) * 100;
    if (topHolderPct > 50) score -= 30;
    else if (topHolderPct > 40) score -= 20;
    else if (topHolderPct > 30) score -= 15;
    else if (topHolderPct > 20) score -= 10;
  }

  if (data.lp_holders && data.lp_holders.length > 0) {
    const topLPHolderPct = parseFloat(data.lp_holders[0].percent) * 100;
    if (topLPHolderPct > 90) score -= 25;
    else if (topLPHolderPct > 80) score -= 15;
  }

  const holderCount = parseInt(data.holder_count || '0');
  if (holderCount < 10) score -= 20;
  else if (holderCount < 50) score -= 10;
  else if (holderCount < 100) score -= 5;

  return Math.max(0, score);
}

export function getTopHolderPercentage(data: GoPlusSecurityData): number {
  if (!data.holders || data.holders.length === 0) return 0;
  return parseFloat(data.holders[0].percent) * 100;
}

export function isLPLocked(data: GoPlusSecurityData): boolean {
  if (!data.lp_holders || data.lp_holders.length === 0) return false;
  
  const topLPHolder = data.lp_holders[0].address.toLowerCase();
  const burnAddresses = [
    '1111111111111111111111111111111',
    'null',
    '0x0000000000000000000000000000000000000000',
  ];
  
  return burnAddresses.some(addr => topLPHolder.includes(addr));
}

export function getSecuritySummary(data: GoPlusSecurityData) {
  const issues: string[] = [];
  const warnings: string[] = [];
  const good: string[] = [];

  if (data.is_honeypot === '1') {
    issues.push('🚨 HONEYPOT - Cannot sell!');
  }

  if (data.is_mintable === '1') {
    warnings.push('⚠️ Mintable');
  }

  const topHolderPct = getTopHolderPercentage(data);
  if (topHolderPct > 30) {
    warnings.push(`⚠️ Top holder owns ${topHolderPct.toFixed(1)}%`);
  }

  if (!isLPLocked(data)) {
    warnings.push('⚠️ LP not locked');
  }

  if (data.is_honeypot === '0') good.push('✅ Not a honeypot');
  if (topHolderPct < 10) good.push('✅ Well distributed');
  if (isLPLocked(data)) good.push('✅ LP locked');
  
  const holderCount = parseInt(data.holder_count || '0');
  if (holderCount > 200) good.push(`✅ ${holderCount} holders`);

  return { issues, warnings, good };
}