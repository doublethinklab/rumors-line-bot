import { google, sheets_v4 } from 'googleapis';
import type { IssueDocument } from 'src/database/models/issue';

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;

// Sheet names
export const SHEET = {
  ISSUES: 'Issues',
  ACCOUNTS: 'Accounts',
} as const;

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

const INPUT_TYPE_LABEL: Record<IssueDocument['inputType'], string> = {
  text: '文字',
  link: '連結',
  image: '圖片',
  video: '影片',
};

function buildIssueRow(issue: IssueDocument): (string | number)[] {
  const createdAt = new Date(issue.createdAt);
  const content =
    issue.inputType === 'image' || issue.inputType === 'video'
      ? `[${INPUT_TYPE_LABEL[issue.inputType]}]`
      : issue.canonicalText;
  const archive =
    issue.inputType === 'image' || issue.inputType === 'video'
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
    createdAt.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' }),
    createdAt.toLocaleTimeString('zh-TW', { timeZone: 'Asia/Taipei' }),
    archive,
    issue.reporterDescription ?? '',
  ];
}

/**
 * Append a single issue row to the Issues sheet.
 * Columns: 回報者LINE ID | 類型 | 平台 | 帳號 | 內容/URL | 建立日期 | 建立時間 | Archive | 進階描述
 */
export async function appendIssueRow(issue: IssueDocument): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A:I`,
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values: [buildIssueRow(issue)] },
  });
}

/**
 * Overwrite the Issues sheet with all current issues (full sync).
 */
export async function syncAllIssues(issues: IssueDocument[]): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();

  const header = [
    '回報者LINE ID',
    '類型',
    '平台',
    '帳號',
    '內容/URL',
    '建立日期',
    '建立時間',
    'Archive',
    '進階描述',
  ];

  const rows = issues.map(buildIssueRow);

  // Clear then rewrite
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A:I`,
  });

  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A1`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [header, ...rows] },
  });
}

/**
 * Read all rows from the Issues sheet (for reference / import).
 */
export async function readIssuesSheet(): Promise<string[][]> {
  if (!SPREADSHEET_ID) return [];
  const sheets = await getSheets();

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A:I`,
  });

  return (res.data.values as string[][]) ?? [];
}
