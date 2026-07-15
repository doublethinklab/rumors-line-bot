import { google } from 'googleapis';
import { Readable } from 'stream';

const FOLDER_ID = '1u2ePVuuFCUl9ofEoH8o8bTP_NJNGrf6p';

let _drive: ReturnType<typeof google.drive> | null = null;

async function getDrive() {
  if (_drive) return _drive;
  const auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  _drive = google.drive({ version: 'v3', auth });
  return _drive;
}

export async function uploadToDrive(
  filename: string,
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const drive = await getDrive();

  const res = await drive.files.create({
    supportsAllDrives: true,
    requestBody: {
      name: filename,
      parents: [FOLDER_ID],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id,webViewLink',
  });

  const fileId = res.data.id!;

  // Grant read access to anyone in doublethinklab.org with the link
  await drive.permissions.create({
    fileId,
    supportsAllDrives: true,
    requestBody: {
      type: 'domain',
      role: 'reader',
      domain: 'doublethinklab.org',
    },
  });

  return res.data.webViewLink!;
}
