import { google, sheets_v4 } from 'googleapis';
import Issue, { IssueDocument } from 'src/database/models/issue';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Sheet names
export const SHEET = {
  ISSUES: 'Issues',
  ACCOUNTS: 'Accounts',
} as const;

/** Columns A:J of the Issues sheet. */
const ISSUES_RANGE = `${SHEET.ISSUES}!A:J`;

const HEADER = [
  '回報者LINE ID',
  '類型',
  '平台',
  '帳號',
  '內容',
  'URL',
  '建立日期',
  '建立時間',
  'Archive',
  '進階描述',
];

let _sheets: sheets_v4.Sheets | null = null;

async function getSheets(): Promise<sheets_v4.Sheets> {
  if (_sheets) return _sheets;

  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  _sheets = google.sheets({ version: 'v4', auth });
  return _sheets;
}

/**
 * Row 1 is only ever written by this function (and by syncAllIssues) — appendIssueRow
 * and updateIssueRow only ever touch data rows below it. If the sheet's header was
 * last written by an older version of this schema (or never written by this code at
 * all), it will silently keep showing stale column names forever. Each process
 * self-heals it once, the first time it writes to the sheet.
 */
let headerSynced = false;

async function ensureHeader(sheets: sheets_v4.Sheets): Promise<void> {
  if (headerSynced || !SPREADSHEET_ID) return;
  headerSynced = true; // optimistic, so concurrent callers don't all re-send it

  await sheets.spreadsheets.values
    .update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET.ISSUES}!A1:J1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [HEADER] },
    })
    .catch((err) => {
      headerSynced = false; // let the next write retry
      throw err;
    });
}

const INPUT_TYPE_LABEL: Record<IssueDocument['inputType'], string> = {
  text: '文字',
  link: '連結',
  image: '圖片',
  video: '影片',
};

function buildIssueRow(issue: IssueDocument): (string | number)[] {
  const createdAt = new Date(issue.createdAt);
  const isMedia = issue.inputType === 'image' || issue.inputType === 'video';

  const content = isMedia
    ? `[${INPUT_TYPE_LABEL[issue.inputType]}]`
    : issue.inputType === 'link'
    ? issue.messageText ?? ''
    : issue.canonicalText;
  const url =
    issue.inputType === 'link'
      ? issue.canonicalText
      : isMedia
      ? issue.originalSourceUrl ?? ''
      : '';
  const archive = isMedia
    ? issue.canonicalText
    : issue.inputType === 'link'
    ? issue.scrapedText ?? ''
    : '';

  return [
    issue.reporterIds.join(', '),
    INPUT_TYPE_LABEL[issue.inputType],
    issue.platform ?? '',
    issue.accountHandle ?? '',
    content,
    url,
    createdAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
    createdAt.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' }),
    archive,
    issue.reporterDescription ?? '',
  ];
}

/** Parses the 1-indexed row number out of a Sheets API range like "Issues!A5:J5". */
function parseRowFromRange(
  range: string | null | undefined
): number | undefined {
  const match = range?.match(/![A-Z]+(\d+):/);
  return match ? Number(match[1]) : undefined;
}

/**
 * Append a single issue row to the Issues sheet, and remember the resulting
 * row number on the issue so later updates (reporter count, description,
 * archive backfill, ...) can target that exact row instead of doing a full
 * sheet resync — full resyncs race with concurrent appends and can wipe out
 * rows that were appended after the resync's snapshot was read.
 */
export async function appendIssueRow(issue: IssueDocument): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();
  await ensureHeader(sheets);

  const res = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: ISSUES_RANGE,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [buildIssueRow(issue)] },
  });

  const row = parseRowFromRange(res.data.updates?.updatedRange);
  if (row && issue._id) {
    await Issue.setSheetRow(issue._id, row);
  }
}

/**
 * Overwrite the sheet row previously assigned to this issue (see appendIssueRow)
 * with its current field values. Falls back to appending a new row if the issue
 * was never successfully appended before.
 */
export async function updateIssueRow(issue: IssueDocument): Promise<void> {
  if (!SPREADSHEET_ID) return;

  if (!issue.sheetRow) {
    return appendIssueRow(issue);
  }

  const sheets = await getSheets();
  await ensureHeader(sheets);
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A${issue.sheetRow}:J${issue.sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [buildIssueRow(issue)] },
  });
}

/**
 * Overwrite the whole Issues sheet with all current issues, and re-assign every
 * issue's sheetRow to match. This is a full resync — only safe to run when no
 * concurrent appendIssueRow/updateIssueRow calls can be in flight (e.g. a manual
 * maintenance script), since it clears the sheet before rewriting it.
 */
export async function syncAllIssues(issues: IssueDocument[]): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();

  const rows = issues.map(buildIssueRow);

  // Clear then rewrite
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: ISSUES_RANGE,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [HEADER, ...rows] },
  });

  await Promise.all(
    issues.map((issue, index) =>
      issue._id ? Issue.setSheetRow(issue._id, index + 2) : Promise.resolve()
    )
  );
}

/**
 * Read all rows from the Issues sheet (for reference / import).
 */
export async function readIssuesSheet(): Promise<string[][]> {
  if (!SPREADSHEET_ID) return [];
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: ISSUES_RANGE,
  });

  return (res.data.values as string[][]) ?? [];
}
