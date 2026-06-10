import redis from './redisClient';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const safeBrowse = require('safe-browse-url-lookup');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { detectSuspiciousLink } = require('link-shield');

const CACHE_TTL_SECONDS = 86400; // 24 hours

// Hosts that bypass safety checks (trusted social media + Taiwan news)
const SAFE_HOSTS = new Set([
  // Social media
  'facebook.com', 'fb.com', 'fb.watch', 'm.facebook.com', 'l.facebook.com',
  'twitter.com', 'x.com', 'mobile.twitter.com',
  'instagram.com', 'www.instagram.com',
  'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
  'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com',
  'threads.net', 'www.threads.net',
  'weibo.com', 'www.weibo.com', 'weibo.cn', 'm.weibo.cn',
  'linkedin.com', 'www.linkedin.com',
  'liff.line.me',
  // Taiwan news
  'udn.com', 'www.udn.com',
  'ltn.com.tw', 'news.ltn.com.tw', 'www.ltn.com.tw',
  'chinatimes.com', 'www.chinatimes.com',
  'ettoday.net', 'www.ettoday.net',
  'setn.com', 'www.setn.com',
  'tvbs.com.tw', 'news.tvbs.com.tw', 'www.tvbs.com.tw',
  'cts.com.tw', 'news.cts.com.tw', 'www.cts.com.tw',
  'pts.org.tw', 'news.pts.org.tw', 'www.pts.org.tw',
  'cna.com.tw', 'www.cna.com.tw',
  'storm.mg', 'www.storm.mg',
  'newtalk.tw', 'www.newtalk.tw',
  'yahoo.com', 'tw.yahoo.com', 'tw.news.yahoo.com',
  'pchome.com.tw', 'www.pchome.com.tw',
  'nownews.com', 'www.nownews.com',
  'mirrormedia.mg', 'www.mirrormedia.mg',
  'businessweekly.com.tw', 'www.businessweekly.com.tw',
  'wealth.com.tw', 'www.wealth.com.tw',
  'commonwealthmag.com', 'www.commonwealthmag.com',
  'dcard.tw', 'www.dcard.tw',
  'ptt.cc', 'www.ptt.cc', 'disp.cc',
  'bnext.com.tw', 'www.bnext.com.tw',
  'technews.tw', 'technews.com.tw',
  'ithome.com.tw', 'www.ithome.com.tw',
  'inside.com.tw', 'www.inside.com.tw',
  'thenewslens.com', 'www.thenewslens.com',
  'twreporter.org', 'www.twreporter.org',
  'cw.com.tw', 'www.cw.com.tw',
]);

export interface SafetyResult {
  safe: boolean;
  whitelisted: boolean;
  reason?: string;
}

function getCacheKey(url: string): string {
  return `safebrowsing:${url}`;
}

export function isWhitelisted(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return SAFE_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export async function checkUrlSafety(url: string): Promise<SafetyResult> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return { safe: false, whitelisted: false, reason: 'invalid URL' };
  }

  // Whitelist: skip all checks for trusted sites
  if (SAFE_HOSTS.has(hostname)) {
    return { safe: true, whitelisted: true };
  }

  // Redis cache
  const cacheKey = getCacheKey(url);
  try {
    const cached = await redis.get(cacheKey);
    if (cached && typeof cached === 'object' && 'safe' in (cached as object)) {
      return cached as SafetyResult;
    }
  } catch {
    // Cache miss — continue
  }

  // Google Safe Browsing API
  if (process.env.SAFE_BROWSING_API_KEY) {
    try {
      const client = safeBrowse({ apiKey: process.env.SAFE_BROWSING_API_KEY });
      const match = await client.checkSingle(url);
      if (match) {
        const result: SafetyResult = {
          safe: false,
          whitelisted: false,
          reason: `Google Safe Browsing: ${match.threatType ?? 'threat detected'}`,
        };
        await redis.setex(cacheKey, CACHE_TTL_SECONDS, result).catch(() => {});
        return result;
      }
    } catch (err) {
      console.error('[urlSafety] Safe Browsing API error:', err);
      // Fail open: API error does not block the URL
    }
  }

  // link-shield heuristic (secondary, high threshold to reduce false positives)
  const heuristic = detectSuspiciousLink(url, { threshold: 70 });
  if (heuristic.suspicious) {
    const result: SafetyResult = {
      safe: false,
      whitelisted: false,
      reason: `Suspicious pattern: ${heuristic.reasons.join(', ')}`,
    };
    // Heuristic results are deterministic — no need to cache
    return result;
  }

  const result: SafetyResult = { safe: true, whitelisted: false };
  await redis.setex(cacheKey, CACHE_TTL_SECONDS, result).catch(() => {});
  return result;
}
