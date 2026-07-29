import { scrapeQueue } from '../queues';
import { scrapeIssue } from './index';
import Issue from 'src/database/models/issue';
import { ObjectId } from 'mongodb';
import { updateIssueRow } from '../sheets';

const CONCURRENCY = Number(process.env.SCRAPE_CONCURRENCY || 2);

export function startScrapeWorker() {
  scrapeQueue.process(CONCURRENCY, async (job: { data: unknown }) => {
    const { issueId } = job.data as { issueId: string };

    const issue = await Issue.findById(issueId);
    if (!issue) {
      console.warn(`[scrapeWorker] Issue ${issueId} not found`);
      return;
    }

    // Skip if already scraped
    if (issue.scrapeStatus === 'done') return;

    console.log(
      `[scrapeWorker] Scraping issue ${issueId}: ${issue.canonicalText}`
    );

    const result = await scrapeIssue(issue);

    const col = await (await import('src/database/mongoClient')).default
      .getInstance()
      .then((c) => c.collection('issues'));

    await col.updateOne(
      { _id: new ObjectId(issueId) },
      {
        $set: {
          scrapedText: result.scrapedText,
          scrapeStatus: result.scrapeStatus,
          scrapedAt: result.scrapedAt,
          updatedAt: new Date(),
        },
      }
    );

    // Backfill the sheet's Archive column now that the scraped content is available.
    Issue.findById(issueId)
      .then((updated) => updated && updateIssueRow(updated))
      .catch((err) => console.error('[sheets] Sync failed:', err));

    console.log(
      `[scrapeWorker] Done ${issueId} — status: ${result.scrapeStatus}`
    );
  });

  scrapeQueue.on('failed', (job: { id: string }, err: Error) => {
    console.error(`[scrapeWorker] Job ${job.id} failed:`, err.message);
  });

  console.log('[scrapeWorker] Started');
}
