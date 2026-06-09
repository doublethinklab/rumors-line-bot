import stringSimilarity from 'string-similarity';
import Issue, { IssueDocument } from 'src/database/models/issue';
import Account from 'src/database/models/account';
import { extractUrls, parseUrl } from './urlParser';
import { scrapeQueue } from './queues';

const SIMILARITY_THRESHOLD = 0.7;

export async function upsertFromMessage(
  text: string,
  reporterUserId: string
): Promise<IssueDocument> {
  const urls = extractUrls(text);

  if (urls.length > 0) {
    return upsertFromLink(urls[0], reporterUserId);
  }

  return upsertFromText(text, reporterUserId);
}

async function upsertFromLink(
  rawUrl: string,
  reporterUserId: string
): Promise<IssueDocument> {
  // 1. Exact URL match
  const existing = await Issue.findByUrl(rawUrl);
  if (existing) {
    await Issue.addReporter(existing._id!, reporterUserId);
    return existing;
  }

  const parsed = parseUrl(rawUrl);

  // 2. Resolve account record (upsert) when we have a known platform + handle
  let accountId: import('mongodb').ObjectId | undefined;
  let accountDiscontinued = false;

  if (!parsed.isUnknownSite && parsed.platform !== 'unknown' && parsed.accountHandle) {
    const { account, isNew } = await Account.upsert(
      parsed.platform,
      parsed.accountHandle
    );
    accountId = account._id;

    if (!isNew && account.status === 'discontinued') {
      // Account already flagged by an analyst — note the submission but skip scraping
      accountDiscontinued = true;
    }
  }

  // 3. Same account already has an issue — bump reporter count on that issue
  if (!parsed.isUnknownSite && parsed.platform && parsed.accountHandle) {
    const sameAccount = await Issue.findByAccount(
      parsed.platform,
      parsed.accountHandle
    );
    if (sameAccount) {
      await Issue.addReporter(sameAccount._id!, reporterUserId);
      return sameAccount;
    }
  }

  // 4. New link — create issue and conditionally enqueue scrape
  const shouldScrape = !parsed.isUnknownSite && !accountDiscontinued;
  const newIssue = await Issue.createLink(
    {
      canonicalText: rawUrl,
      platform: parsed.platform,
      accountHandle: parsed.accountHandle ?? undefined,
      accountId,
      isUnknownSite: parsed.isUnknownSite,
      defangedUrl: parsed.defangedUrl ?? undefined,
      accountDiscontinued,
      scrapeStatus: shouldScrape ? 'pending' : undefined,
    },
    reporterUserId
  );

  if (shouldScrape && newIssue._id) {
    await scrapeQueue.add({ issueId: String(newIssue._id) }, { delay: 2000 });
  }

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
      await Issue.addReporter(textIssues[bestMatchIndex]._id!, reporterUserId);
      return textIssues[bestMatchIndex];
    }
  }

  return Issue.createText(text, reporterUserId);
}
