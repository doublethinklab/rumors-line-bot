import type { IssueDocument } from 'src/database/models/issue';
import { scrapeWebPage } from './webScraper';
import { scrapeYouTube } from './youtubeScraper';

export type ScrapeResult = {
  scrapedText: string | null;
  scrapeStatus: 'done' | 'failed';
  scrapedAt: Date;
};

export async function scrapeIssue(issue: IssueDocument): Promise<ScrapeResult> {
  const url = issue.canonicalText;
  let scrapedText: string | null = null;

  if (issue.platform === 'youtube') {
    scrapedText = await scrapeYouTube(url);
  }

  // Fall back to generic web scrape when platform scrape failed or for safe unknown sites
  // TikTok is excluded (scraping is blocked), unsafe URLs are never scraped
  if (!scrapedText && issue.platform !== 'tiktok' && !issue.isUnsafe) {
    scrapedText = await scrapeWebPage(url);
  }

  return {
    scrapedText,
    scrapeStatus: scrapedText ? 'done' : 'failed',
    scrapedAt: new Date(),
  };
}
