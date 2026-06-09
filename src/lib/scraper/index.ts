import type { IssueDocument } from 'src/database/models/issue';
import { scrapeWebPage } from './webScraper';
import { scrapeYouTube } from './youtubeScraper';
import { generateSummary } from '../aiSummary';

export type ScrapeResult = {
  scrapedText: string | null;
  aiSummary: string | null;
  scrapeStatus: 'done' | 'failed';
  scrapedAt: Date;
};

export async function scrapeIssue(issue: IssueDocument): Promise<ScrapeResult> {
  const url = issue.canonicalText;
  let scrapedText: string | null = null;

  if (issue.platform === 'youtube') {
    scrapedText = await scrapeYouTube(url);
  }

  // Fall back to generic web scrape for non-social or if platform scrape failed
  if (!scrapedText && issue.platform !== 'tiktok' && !issue.isUnknownSite) {
    scrapedText = await scrapeWebPage(url);
  }

  const aiSummary = scrapedText
    ? await generateSummary(scrapedText, url)
    : null;

  return {
    scrapedText,
    aiSummary,
    scrapeStatus: scrapedText ? 'done' : 'failed',
    scrapedAt: new Date(),
  };
}
