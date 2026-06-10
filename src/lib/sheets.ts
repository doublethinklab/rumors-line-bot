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

/**
 * Append a single issue row to the Issues sheet.
 * Columns: ID | 狀態 | 類型 | 平台 | 帳號 | 內容/URL | 回報人數 | 調查員 | AI摘要 | 建立時間
 */
export async function appendIssueRow(issue: IssueDocument): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();

  const investigators = issue.investigators.map((i) => i.name).join(', ');
  const row = [
    String(issue._id),
    issue.status === 'new' ? '新議題' : issue.status === 'processing' ? '處理中' : '已處理',
    issue.inputType === 'link' ? '連結' : '文字',
    issue.platform ?? '',
    issue.accountHandle ?? '',
    issue.canonicalText,
    issue.reporterIds.length,
    investigators,
    issue.aiSummary ?? '',
    new Date(issue.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A:J`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [row] },
  });
}

/**
 * Overwrite the Issues sheet with all current issues (full sync).
 */
export async function syncAllIssues(issues: IssueDocument[]): Promise<void> {
  if (!SPREADSHEET_ID) return;
  const sheets = await getSheets();

  const header = [
    'ID', '狀態', '類型', '平台', '帳號', '內容/URL',
    '回報人數', '調查員', 'AI摘要', '建立時間',
  ];

  const rows = issues.map((issue) => [
    String(issue._id),
    issue.status === 'new' ? '新議題' : issue.status === 'processing' ? '處理中' : '已處理',
    issue.inputType === 'link' ? '連結' : '文字',
    issue.platform ?? '',
    issue.accountHandle ?? '',
    issue.canonicalText,
    issue.reporterIds.length,
    issue.investigators.map((i) => i.name).join(', '),
    issue.aiSummary ?? '',
    new Date(issue.createdAt).toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' }),
  ]);

  // Clear then rewrite
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${SHEET.ISSUES}!A:J`,
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
    range: `${SHEET.ISSUES}!A:J`,
  });

  return (res.data.values as string[][]) ?? [];
}
