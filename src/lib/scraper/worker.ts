import { scrapeQueue } from '../queues';
import { scrapeIssue } from './index';
import Issue from 'src/database/models/issue';
import { ObjectId } from 'mongodb';

const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 2);

export function startScrapeWorker() {
  scrapeQueue.process(CONCURRENCY, async (job) => {
    const { issueId } = job.data as { issueId: string };

    const issue = await Issue.findById(issueId);
    if (!issue) {
      console.warn(`[scrapeWorker] Issue ${issueId} not found`);
      return;
    }

    // Skip if already scraped
    if (issue.scrapeStatus === 'done') return;

    console.log(`[scrapeWorker] Scraping issue ${issueId}: ${issue.canonicalText}`);

    const result = await scrapeIssue(issue);

    const col = await (
      await import('src/database/mongoClient')
    ).default.getInstance().then((c) => c.collection('issues'));

    await col.updateOne(
      { _id: new ObjectId(issueId) },
      {
        $set: {
          scrapedText: result.scrapedText,
          aiSummary: result.aiSummary,
          scrapeStatus: result.scrapeStatus,
          scrapedAt: result.scrapedAt,
          updatedAt: new Date(),
        },
      }
    );

    console.log(`[scrapeWorker] Done ${issueId} — status: ${result.scrapeStatus}`);
  });

  scrapeQueue.on('failed', (job, err) => {
    console.error(`[scrapeWorker] Job ${job.id} failed:`, err.message);
  });

  console.log('[scrapeWorker] Started');
}
