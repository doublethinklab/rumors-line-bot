import stringSimilarity from 'string-similarity';
import Issue, { IssueDocument } from 'src/database/models/issue';
import Account from 'src/database/models/account';
import { extractUrls, parseUrl } from './urlParser';
import { checkUrlSafety } from './urlSafety';
import { scrapeQueue } from './queues';
import { appendIssueRow, updateIssueRow } from './sheets';

const SIMILARITY_THRESHOLD = 0.7;

/** Re-reads an issue and pushes its current fields to its sheet row (add-reporter/dedup paths). */
async function resyncIssueRow(id: import('mongodb').ObjectId): Promise<void> {
  const issue = await Issue.findById(String(id));
  if (issue) await updateIssueRow(issue);
}

export async function upsertFromMessage(
  text: string,
  reporterUserId: string
): Promise<IssueDocument> {
  const urls = extractUrls(text);

  if (urls.length > 0) {
    // Capture any free text the reporter typed alongside the URL — it used to
    // be silently discarded since only the URL was kept as canonicalText.
    const messageText = text.replace(urls[0], '').trim();
    return upsertFromLink(urls[0], reporterUserId, messageText || undefined);
  }

  return upsertFromText(text, reporterUserId);
}

async function upsertFromLink(
  rawUrl: string,
  reporterUserId: string,
  messageText?: string
): Promise<IssueDocument> {
  // 1. Exact URL match
  const existing = await Issue.findByUrl(rawUrl);
  if (existing) {
    const id = existing._id!;
    await Issue.addReporter(id, reporterUserId);
    resyncIssueRow(id).catch((err) =>
      console.error('[sheets] Sync failed:', err)
    );
    return existing;
  }

  const parsed = parseUrl(rawUrl);

  // 2. Safety check (whitelisted sites skip the API call)
  const safety = await checkUrlSafety(rawUrl).catch((err) => {
    console.error('[issueService] URL safety check failed:', err);
    return { safe: true, whitelisted: false }; // Fail open
  });

  // 3. Resolve account record for known social platforms
  let accountId: import('mongodb').ObjectId | undefined;
  let accountDiscontinued = false;

  if (
    !parsed.isUnknownSite &&
    parsed.platform !== 'unknown' &&
    parsed.accountHandle
  ) {
    const { account, isNew } = await Account.upsert(
      parsed.platform,
      parsed.accountHandle
    );
    accountId = account._id;

    if (!isNew && account.status === 'discontinued') {
      accountDiscontinued = true;
    }
  }

  // 4. Same account already has an issue — bump reporter count
  // Skip for account page URLs: they should create their own issue even if an article issue exists
  if (
    !parsed.isUnknownSite &&
    parsed.platform &&
    parsed.accountHandle &&
    !parsed.isAccountPage
  ) {
    const sameAccount = await Issue.findByAccount(
      parsed.platform,
      parsed.accountHandle
    );
    if (sameAccount) {
      const id = sameAccount._id!;
      await Issue.addReporter(id, reporterUserId);
      resyncIssueRow(id).catch((err) =>
        console.error('[sheets] Sync failed:', err)
      );
      return sameAccount;
    }
  }

  // 5. Create new issue
  // Scrape when: not discontinued AND URL is safe (both known platforms and whitelisted/safe unknown sites)
  const shouldScrape = !accountDiscontinued && safety.safe;

  const newIssue = await Issue.createLink(
    {
      canonicalText: rawUrl,
      platform: parsed.platform,
      accountHandle: parsed.accountHandle ?? undefined,
      accountId,
      isUnknownSite: parsed.isUnknownSite,
      accountDiscontinued,
      scrapeStatus: shouldScrape ? 'pending' : undefined,
      isUnsafe: !safety.safe ? true : undefined,
      messageText,
    },
    reporterUserId
  );

  if (shouldScrape && newIssue._id) {
    await scrapeQueue.add({ issueId: String(newIssue._id) }, { delay: 2000 });
  }

  appendIssueRow(newIssue).catch((err) =>
    console.error('[sheets] Failed to append link issue:', err)
  );

  return newIssue;
}

export async function upsertFromMedia(
  inputType: 'image' | 'video',
  driveUrl: string,
  reporterUserId: string
): Promise<IssueDocument> {
  const newIssue = await Issue.createMedia(
    { inputType, canonicalText: driveUrl },
    reporterUserId
  );

  appendIssueRow(newIssue).catch((err) =>
    console.error('[sheets] Failed to append media issue:', err)
  );

  return newIssue;
}

async function upsertFromText(
  text: string,
  reporterUserId: string
): Promise<IssueDocument> {
  const issues = await Issue.findAll();
  const textIssues = issues.filter((i) => i.inputType === 'text');

  if (textIssues.length > 0) {
    const canonicalTexts = textIssues.map((i) => i.canonicalText);
    const { bestMatch, bestMatchIndex } = stringSimilarity.findBestMatch(
      text,
      canonicalTexts
    );

    if (bestMatch.rating >= SIMILARITY_THRESHOLD) {
      const match = textIssues[bestMatchIndex];
      const id = match._id!;
      await Issue.addReporter(id, reporterUserId);
      resyncIssueRow(id).catch((err) =>
        console.error('[sheets] Sync failed:', err)
      );
      return match;
    }
  }

  const newIssue = await Issue.createText(text, reporterUserId);

  appendIssueRow(newIssue).catch((err) =>
    console.error('[sheets] Failed to append text issue:', err)
  );

  return newIssue;
}
