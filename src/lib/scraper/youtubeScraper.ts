import fetch from 'node-fetch';

const YT_API_BASE = 'https://www.googleapis.com/youtube/v3';

interface YtVideoSnippet {
  title: string;
  description: string;
  channelTitle: string;
  publishedAt: string;
}

interface YtCaptionTrack {
  languageCode: string;
  trackKind: string;
  baseUrl?: string;
}

function extractVideoId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === 'youtu.be') return u.pathname.slice(1);
    return u.searchParams.get('v');
  } catch {
    return null;
  }
}

export async function scrapeYouTube(url: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_DATA_API_KEY;
  if (!apiKey) return null;

  const videoId = extractVideoId(url);
  if (!videoId) return null;

  // Fetch video metadata
  const snippetRes = await fetch(
    `${YT_API_BASE}/videos?part=snippet&id=${videoId}&key=${apiKey}`
  );
  if (!snippetRes.ok) return null;

  const snippetData = (await snippetRes.json()) as {
    items?: Array<{ snippet: YtVideoSnippet }>;
  };
  const snippet = snippetData.items?.[0]?.snippet;
  if (!snippet) return null;

  let text = `[YouTube] ${snippet.channelTitle}\n${snippet.title}\n\n${snippet.description}`.slice(
    0,
    4000
  );

  // Attempt to fetch auto-captions (zh-TW or en)
  const captionRes = await fetch(
    `${YT_API_BASE}/captions?part=snippet&videoId=${videoId}&key=${apiKey}`
  );
  if (captionRes.ok) {
    const captionData = (await captionRes.json()) as {
      items?: Array<{ snippet: YtCaptionTrack }>;
    };
    const tracks: YtCaptionTrack[] =
      captionData.items?.map((i) => i.snippet) ?? [];
    const preferred = tracks.find(
      (t) => t.languageCode === 'zh-TW' || t.languageCode === 'zh-Hans'
    ) ?? tracks.find((t) => t.languageCode === 'en');

    if (preferred?.baseUrl) {
      const captionTextRes = await fetch(preferred.baseUrl);
      if (captionTextRes.ok) {
        const raw = await captionTextRes.text();
        // Strip XML tags from caption file
        const captionText = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        text += `\n\n[字幕]\n${captionText}`.slice(0, 8000);
      }
    }
  }

  return text;
}
