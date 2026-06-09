export type Platform =
  | 'facebook'
  | 'twitter'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'threads'
  | 'unknown';

export interface ParsedUrl {
  originalUrl: string;
  platform: Platform;
  accountHandle: string | null;
  isUnknownSite: boolean;
  defangedUrl: string | null;
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
};

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

export function defangUrl(url: string): string {
  return url.replace(/\./g, '[.]');
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
      defangedUrl: defangUrl(rawUrl),
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
      defangedUrl: defangUrl(rawUrl),
    };
  }

  const parts = url.pathname.split('/').filter(Boolean);

  let accountHandle: string | null = null;

  switch (platform) {
    case 'facebook':
      // facebook.com/<page>/posts/<id> or facebook.com/profile.php?id=...
      if (url.searchParams.get('id')) {
        accountHandle = `id:${url.searchParams.get('id')}`;
      } else if (parts[0] && parts[0] !== 'watch' && parts[0] !== 'groups') {
        accountHandle = parts[0];
      }
      break;

    case 'twitter':
      // x.com/<account>/status/<id>
      if (parts[0] && parts[0] !== 'i') {
        accountHandle = `@${parts[0]}`;
      }
      break;

    case 'instagram':
      // instagram.com/<account>/ or instagram.com/p/<id>/ or instagram.com/reel/<id>/
      if (parts[0] && !['p', 'reel', 'stories', 'explore'].includes(parts[0])) {
        accountHandle = `@${parts[0]}`;
      }
      break;

    case 'youtube':
      // youtube.com/@handle or youtube.com/channel/<id> or youtube.com/c/<name>
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
      // tiktok.com/@<account>/video/<id>
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
      }
      break;

    case 'threads':
      // threads.net/@<account>/post/<id>
      if (parts[0]?.startsWith('@')) {
        accountHandle = parts[0];
      }
      break;
  }

  return {
    originalUrl: rawUrl,
    platform,
    accountHandle,
    isUnknownSite: false,
    defangedUrl: null,
  };
}
