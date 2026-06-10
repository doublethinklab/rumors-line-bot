export type Platform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'threads'
  | 'weibo'
  | 'unknown';

export interface ParsedUrl {
  originalUrl: string;
  platform: Platform;
  accountHandle: string | null;
  isUnknownSite: boolean;
}

const URL_REGEX = /https?:\/\/[^\s　，、・。！？」』】〕]+/gi;

const KNOWN_HOSTS: Record<string, Platform> = {
  'facebook.com': 'facebook',
  'fb.com': 'facebook',
  'fb.watch': 'facebook',
  'm.facebook.com': 'facebook',
  'twitter.com': 'twitter',
  'x.com': 'twitter',
  'instagram.com': 'instagram',
  'www.instagram.com': 'instagram',
  'youtube.com': 'youtube',
  'www.youtube.com': 'youtube',
  'youtu.be': 'youtube',
  'm.youtube.com': 'youtube',
  'tiktok.com': 'tiktok',
  'www.tiktok.com': 'tiktok',
  'vm.tiktok.com': 'tiktok',
  'threads.net': 'threads',
  'www.threads.net': 'threads',
  'weibo.com': 'weibo',
  'www.weibo.com': 'weibo',
  'weibo.cn': 'weibo',
  'm.weibo.cn': 'weibo',
};

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

export function parseUrl(rawUrl: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return {
      originalUrl: rawUrl,
      platform: 'unknown',
      accountHandle: null,
      isUnknownSite: true,
    };
  }

  const hostname = url.hostname.toLowerCase();
  const platform = KNOWN_HOSTS[hostname];

  if (!platform) {
    return {
      originalUrl: rawUrl,
      platform: 'unknown',
      accountHandle: null,
      isUnknownSite: true,
    };
  }

  const parts = url.pathname.split('/').filter(Boolean);

  let accountHandle: string | null = null;

  switch (platform) {
    case 'facebook':
      if (url.searchParams.get('id')) {
        accountHandle = `id:${url.searchParams.get('id')}`;
      } else if (parts[0] && parts[0] !== 'watch' && parts[0] !== 'groups') {
        accountHandle = parts[0];
      }
      break;

    case 'twitter':
      if (parts[0] && parts[0] !== 'i') {
        accountHandle = `@${parts[0]}`;
      }
      break;

    case 'instagram':
      if (parts[0] && !['p', 'reel', 'stories', 'explore'].includes(parts[0])) {
        accountHandle = `@${parts[0]}`;
      }
      break;

    case 'youtube':
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
      } else if (parts[0] === 'channel' && parts[1]) {
        accountHandle = parts[1];
      } else if (parts[0] === 'c' && parts[1]) {
        accountHandle = `@${parts[1]}`;
      } else if (parts[0] === 'user' && parts[1]) {
        accountHandle = `@${parts[1]}`;
      }
      break;

    case 'tiktok':
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
      }
      break;

    case 'threads':
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
      }
      break;

    case 'weibo':
      if (parts[0] && !['p', 'status', 'tv'].includes(parts[0])) {
        accountHandle = parts[0];
      }
      break;
  }

  return {
    originalUrl: rawUrl,
    platform,
    accountHandle,
    isUnknownSite: false,
  };
}
