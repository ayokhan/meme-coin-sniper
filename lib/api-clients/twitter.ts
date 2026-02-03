import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { ALL_CT_INFLUENCERS, getAccountWeight, MONITORED_CT_LIMIT } from '@/lib/config/ct-influencers';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

export interface Tweet {
  id: string;
  text: string;
  author: {
    username: string;
    verified: boolean;
    followers: number;
  };
  created_at: string;
  metrics: {
    likes: number;
    retweets: number;
    replies: number;
  };
}

export interface TokenMention {
  token: string;
  contractAddress?: string;
  mentions: Tweet[];
  totalEngagement: number;
  avgEngagement: number;
  uniqueAccounts: number;
  topAccounts: string[];
  firstSeenAt: Date;
}

const APIFY_ACTOR_ID = 'apidojo~tweet-scraper'; // apidojo/tweet-scraper on Apify Store

export async function monitorCTAccounts(
  accounts: string[] = ALL_CT_INFLUENCERS,
  hours: number = 1
): Promise<Tweet[]> {
  try {
    console.log(`🐦 Monitoring ${accounts.length} CT accounts...`);

    if (!APIFY_API_TOKEN) {
      console.warn('CT monitoring: APIFY_API_TOKEN not set, skipping Apify call');
      return [];
    }

    const response = await axios.post(
      `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items`,
      {
        twitterHandles: accounts.slice(0, MONITORED_CT_LIMIT),
        maxItems: 50,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        params: {
          token: APIFY_API_TOKEN,
        },
        timeout: 120000,
      }
    );

    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    const rawItems = Array.isArray(response.data) ? response.data : [];
    
    const tweets = rawItems
      .filter((tweet: any) => tweet && new Date(tweet.created_at || tweet.createdAt || 0) > cutoffTime)
      .map((tweet: any) => ({
        id: String(tweet.id || tweet.tweetId || ''),
        text: tweet.text || tweet.full_text || tweet.fullText || '',
        author: {
          username: tweet.author?.userName || tweet.user?.screen_name || tweet.user?.userName || tweet.username || 'unknown',
          verified: tweet.author?.isVerified ?? tweet.user?.verified ?? false,
          followers: tweet.author?.followers ?? tweet.user?.followers ?? 0,
        },
        created_at: tweet.created_at || tweet.createdAt || tweet.postedAt,
        metrics: {
          likes: tweet.favoriteCount ?? tweet.likeCount ?? tweet.metrics?.likes ?? 0,
          retweets: tweet.retweetCount ?? tweet.retweetCount ?? tweet.metrics?.retweets ?? 0,
          replies: tweet.replyCount ?? tweet.replyCount ?? tweet.metrics?.replies ?? 0,
        },
      }));

    console.log(`Found ${tweets.length} recent tweets`);
    return tweets;

  } catch (error: any) {
    const msg = error.response?.status === 404
      ? 'Apify actor or URL not found (404). Check APIFY_API_TOKEN and actor ID.'
      : error.message;
    console.error('CT monitoring error:', msg);
    return [];
  }
}

export function extractTokensFromTweets(tweets: Tweet[]): Map<string, TokenMention> {
  const tokenMap = new Map<string, TokenMention>();

  tweets.forEach(tweet => {
    const text = tweet.text;

    const tickerMatches = text.match(/\$([A-Z]{2,10})(?:\s|$|[.,!?])/g);
    const solanaCAMatches = text.match(/\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g);

    const processToken = (tokenIdentifier: string, ca?: string) => {
      const existing = tokenMap.get(tokenIdentifier);
      
      if (existing) {
        existing.mentions.push(tweet);
        existing.totalEngagement += tweet.metrics.likes + tweet.metrics.retweets;
        if (!existing.topAccounts.includes(tweet.author.username)) {
          existing.topAccounts.push(tweet.author.username);
          existing.uniqueAccounts++;
        }
      } else {
        tokenMap.set(tokenIdentifier, {
          token: tokenIdentifier,
          contractAddress: ca,
          mentions: [tweet],
          totalEngagement: tweet.metrics.likes + tweet.metrics.retweets,
          avgEngagement: 0,
          uniqueAccounts: 1,
          topAccounts: [tweet.author.username],
          firstSeenAt: new Date(tweet.created_at),
        });
      }
    };

    tickerMatches?.forEach(match => {
      const ticker = match.replace(/\$/g, '').trim();
      processToken(`$${ticker}`);
    });
    
    solanaCAMatches?.forEach(match => {
      processToken(match, match);
    });
  });

  tokenMap.forEach((mention) => {
    mention.avgEngagement = mention.totalEngagement / mention.mentions.length;
  });

  return tokenMap;
}

export async function analyzeSentiment(
  tokenMention: TokenMention
): Promise<{
  isOrganic: boolean;
  confidence: number;
  reasoning: string;
  viralPotential: number;
}> {
  try {
    const tweetTexts = tokenMention.mentions
      .slice(0, 5)
      .map((t, i) => `Tweet ${i + 1} (@${t.author.username}, ${t.author.followers} followers): ${t.text}`)
      .join('\n\n');

    const prompt = `Analyze these tweets about "${tokenMention.token}" to determine if it's organic hype or paid promotion.

Mentions: ${tokenMention.mentions.length}
Unique accounts: ${tokenMention.uniqueAccounts}
Avg engagement: ${tokenMention.avgEngagement.toFixed(0)}
Accounts: ${tokenMention.topAccounts.join(', ')}

Tweets:
${tweetTexts}

Respond ONLY with valid JSON (no markdown):
{
  "isOrganic": true or false,
  "confidence": 0-100,
  "reasoning": "brief explanation",
  "viralPotential": 0-10
}`;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = message.content[0].type === 'text' ? message.content[0].text : '{}';
    const cleaned = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const result = JSON.parse(cleaned);

    return {
      isOrganic: result.isOrganic || false,
      confidence: result.confidence || 0,
      reasoning: result.reasoning || 'No analysis',
      viralPotential: result.viralPotential || 0,
    };

  } catch (error: any) {
    console.error('Sentiment analysis error:', error.message);
    return {
      isOrganic: false,
      confidence: 0,
      reasoning: 'Analysis failed',
      viralPotential: 0,
    };
  }
}

export async function detectViralTokens(): Promise<Array<{
  token: string;
  contractAddress?: string;
  mentions: number;
  uniqueAccounts: number;
  avgEngagement: number;
  sentiment: any;
  twitterScore: number;
}>> {
  console.log('🐦 Starting CT monitoring...');
  
  const tweets = await monitorCTAccounts(ALL_CT_INFLUENCERS, 1);
  console.log(`Found ${tweets.length} tweets`);

  const tokenMentions = extractTokensFromTweets(tweets);
  console.log(`Detected ${tokenMentions.size} unique tokens`);

  const viralTokens = [];

  for (const [token, mention] of tokenMentions.entries()) {
    if (mention.uniqueAccounts >= 3) {
      console.log(`🔥 Analyzing ${token} (${mention.uniqueAccounts} accounts)`);
      
      const sentiment = await analyzeSentiment(mention);
      
      let twitterScore = 0;
      
      if (mention.uniqueAccounts >= 10) twitterScore += 15;
      else if (mention.uniqueAccounts >= 7) twitterScore += 12;
      else if (mention.uniqueAccounts >= 5) twitterScore += 10;
      else twitterScore += 7;
      
      const weightedScore = mention.topAccounts.reduce((sum, acc) => 
        sum + getAccountWeight(acc), 0
      ) / mention.topAccounts.length;
      twitterScore += Math.min(10, Math.floor(weightedScore * 3));
      
      if (mention.avgEngagement > 100) twitterScore += 10;
      else if (mention.avgEngagement > 50) twitterScore += 7;
      else if (mention.avgEngagement > 20) twitterScore += 5;
      else twitterScore += 2;

      if (!sentiment.isOrganic) {
        twitterScore = Math.floor(twitterScore * 0.5);
      }

      viralTokens.push({
        token,
        contractAddress: mention.contractAddress,
        mentions: mention.mentions.length,
        uniqueAccounts: mention.uniqueAccounts,
        avgEngagement: mention.avgEngagement,
        sentiment,
        twitterScore,
      });
    }
  }

  return viralTokens.sort((a, b) => b.twitterScore - a.twitterScore);
}
