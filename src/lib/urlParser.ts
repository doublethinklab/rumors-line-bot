export type Platform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'threads'
  | 'weibo'
  | 'bilibili'
  | 'dcard'
  | 'ptt'
  | 'douyin'
  | 'unknown';

export interface ParsedUrl {
  originalUrl: string;
  platform: Platform;
  accountHandle: string | null;
  isUnknownSite: boolean;
  /** True when URL points to a profile/account page rather than a specific post */
  isAccountPage: boolean;
}

const URL_REGEX = /https?:\/\/[^\s　，、・。！？」』】〕]+/gi;

const KNOWN_HOSTS: Record<string, Platform> = {
  'facebook.com': 'facebook',
  'www.facebook.com': 'facebook',
  'm.facebook.com': 'facebook',
  'l.facebook.com': 'facebook',
  'fb.com': 'facebook',
  'fb.watch': 'facebook',
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
  'l.threads.net': 'threads',
  // Meta migrated Threads links from threads.net to threads.com in 2024
  'threads.com': 'threads',
  'www.threads.com': 'threads',
  'l.threads.com': 'threads',
  'weibo.com': 'weibo',
  'www.weibo.com': 'weibo',
  'weibo.cn': 'weibo',
  'm.weibo.cn': 'weibo',
  'bilibili.com': 'bilibili',
  'www.bilibili.com': 'bilibili',
  'm.bilibili.com': 'bilibili',
  'space.bilibili.com': 'bilibili',
  'dcard.tw': 'dcard',
  'www.dcard.tw': 'dcard',
  'ptt.cc': 'ptt',
  'www.ptt.cc': 'ptt',
  'disp.cc': 'ptt',
  'douyin.com': 'douyin',
  'www.douyin.com': 'douyin',
  'v.douyin.com': 'douyin',
  'iesdouyin.com': 'douyin',
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
      isAccountPage: false,
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
      isAccountPage: false,
    };
  }

  const parts = url.pathname.split('/').filter(Boolean);

  let accountHandle: string | null = null;
  let isAccountPage = false;

  const FACEBOOK_NON_ACCOUNT_PATHS = new Set([
    'watch', 'groups', 'sharer', 'photo', 'video', 'events', 'pages',
    'story.php', 'permalink.php', 'share', 'login', 'home.php', 'reel',
    'marketplace', 'gaming', 'ads', 'l.php',
  ]);

  switch (platform) {
    case 'facebook':
      // l.facebook.com is a link redirect — no account info in the path
      if (url.hostname === 'l.facebook.com') break;
      if (url.searchParams.get('id')) {
        accountHandle = `id:${url.searchParams.get('id')}`;
      } else if (parts[0] && !FACEBOOK_NON_ACCOUNT_PATHS.has(parts[0])) {
        accountHandle = parts[0];
        isAccountPage = parts.length === 1;
      }
      break;

    case 'twitter':
      if (parts[0] && !['i', 'home', 'explore', 'notifications', 'messages', 'settings', 'search'].includes(parts[0])) {
        accountHandle = `@${parts[0]}`;
        isAccountPage = parts.length === 1;
      }
      break;

    case 'instagram':
      if (parts[0] && !['p', 'reel', 'stories', 'explore', 'tv', 'accounts', 'direct'].includes(parts[0])) {
        accountHandle = `@${parts[0]}`;
        isAccountPage = parts.length === 1;
      }
      break;

    case 'youtube':
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
        isAccountPage = parts.length === 1;
      } else if (parts[0] === 'channel' && parts[1]) {
        accountHandle = parts[1];
        isAccountPage = parts.length === 2;
      } else if (parts[0] === 'c' && parts[1]) {
        accountHandle = `@${parts[1]}`;
        isAccountPage = parts.length === 2;
      } else if (parts[0] === 'user' && parts[1]) {
        accountHandle = `@${parts[1]}`;
        isAccountPage = parts.length === 2;
      }
      break;

    case 'tiktok':
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
        isAccountPage = parts.length === 1;
      }
      break;

    case 'threads':
      // l.threads.net / l.threads.com are link redirects — no account info
      if (url.hostname === 'l.threads.net' || url.hostname === 'l.threads.com')
        break;
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
        isAccountPage = parts.length === 1;
      }
      break;

    case 'weibo':
      if (parts[0] && !['p', 'status', 'tv'].includes(parts[0])) {
        accountHandle = parts[0];
        isAccountPage = parts.length === 1;
      }
      break;

    case 'bilibili':
      // space.bilibili.com/UID — user profile
      if (url.hostname === 'space.bilibili.com' && parts[0]) {
        accountHandle = parts[0];
        isAccountPage = true;
      }
      break;

    case 'dcard':
      // /f/boardname — forum board
      if (parts[0] === 'f' && parts[1]) {
        accountHandle = parts[1];
        isAccountPage = parts.length === 2;
      } else if (parts[0] === 'profile' && parts[1] === 'u' && parts[2]) {
        accountHandle = parts[2];
        isAccountPage = true;
      }
      break;

    case 'ptt':
      // /bbs/BOARDNAME/...
      if (parts[0] === 'bbs' && parts[1]) {
        accountHandle = parts[1];
        isAccountPage = parts.length === 2 || (parts.length === 3 && parts[2].startsWith('index'));
      }
      break;

    case 'douyin':
      // v.douyin.com is a short-link redirect — no account info in the path
      if (url.hostname === 'v.douyin.com') break;
      if (parts[0] === 'user' && parts[1]) {
        accountHandle = parts[1];
        isAccountPage = parts.length === 2;
      }
      break;
  }

  return {
    originalUrl: rawUrl,
    platform,
    accountHandle,
    isUnknownSite: false,
    isAccountPage,
  };
}
