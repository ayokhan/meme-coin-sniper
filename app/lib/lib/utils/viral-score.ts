export interface ViralScoreInput {
    liquidity: number;
    volume24h: number;
    priceChange24h: number;
    ageMinutes: number;
    hasWebsite: boolean;
    hasTwitter: boolean;
    hasTelegram: boolean;
    securityScore: number;
    topHolderPct: number;
    holderCount: number;
    isHoneypot: boolean;
    twitterScore?: number;
    twitterMentions?: number;
    viralPotential?: number;
  }
  
  export interface ViralScoreBreakdown {
    total: number;
    twitter: number;
    security: number;
    liquidity: number;
    social: number;
    timing: number;
    details: {
      twitterNotes: string[];
      securityNotes: string[];
      warnings: string[];
      strengths: string[];
    };
  }
  
  export function calculateViralScore(input: ViralScoreInput): ViralScoreBreakdown {
    const breakdown: ViralScoreBreakdown = {
      total: 0,
      twitter: 0,
      security: 0,
      liquidity: 0,
      social: 0,
      timing: 0,
      details: {
        twitterNotes: [],
        securityNotes: [],
        warnings: [],
        strengths: [],
      },
    };
  
    if (input.isHoneypot) {
      breakdown.details.warnings.push('🚨 HONEYPOT');
      return breakdown;
    }
  
    if (input.twitterScore !== undefined) {
      breakdown.twitter = input.twitterScore;
      if (input.twitterScore >= 30) {
        breakdown.details.strengths.push(`🔥 VIRAL (${input.twitterMentions} mentions)`);
      }
    }
  
    breakdown.security = Math.min(25, input.securityScore * 0.25);
    if (input.securityScore >= 80) {
      breakdown.details.strengths.push('✅ Strong security');
    } else if (input.securityScore < 60) {
      breakdown.details.warnings.push('🚨 Poor security');
    }
  
    if (input.topHolderPct > 30) {
      breakdown.details.warnings.push(`⚠️ Top holder: ${input.topHolderPct.toFixed(1)}%`);
      breakdown.security -= 5;
    }
  
    if (input.liquidity > 100000) {
      breakdown.liquidity = 20;
      breakdown.details.strengths.push(`💰 $${(input.liquidity / 1000).toFixed(0)}k`);
    } else if (input.liquidity > 50000) {
      breakdown.liquidity = 15;
    } else if (input.liquidity > 20000) {
      breakdown.liquidity = 10;
    } else if (input.liquidity > 10000) {
      breakdown.liquidity = 7;
    } else if (input.liquidity > 5000) {
      breakdown.liquidity = 5;
      breakdown.details.warnings.push('⚠️ Low liquidity');
    }
  
    let socialScore = 0;
    if (input.hasWebsite) socialScore += 3;
    if (input.hasTwitter) socialScore += 4;
    if (input.hasTelegram) socialScore += 3;
    breakdown.social = socialScore;
  
    if (input.ageMinutes >= 10 && input.ageMinutes <= 120) {
      breakdown.timing = 10;
      breakdown.details.strengths.push('⏰ Optimal entry');
    } else if (input.ageMinutes < 10) {
      breakdown.timing = 6;
      breakdown.details.securityNotes.push('⚠️ Very new');
    } else if (input.ageMinutes <= 240) {
      breakdown.timing = 7;
    } else {
      breakdown.timing = 4;
    }
  
    breakdown.total = Math.round(
      breakdown.twitter +
      breakdown.security +
      breakdown.liquidity +
      breakdown.social +
      breakdown.timing
    );
  
    return breakdown;
  }