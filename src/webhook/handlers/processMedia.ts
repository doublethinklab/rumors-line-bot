import { CooccurredMessage, Result } from 'src/types/chatbotState';
import ga from 'src/lib/ga';
import lineClient from 'src/webhook/lineClient';
import { uploadToDrive } from 'src/lib/driveUpload';
import { upsertFromMedia } from 'src/lib/issueService';

import { createMediaReceivedAck, createMediaSourcePrompt } from './reportFlow';
import { setNewContext, displayLoadingAnimation } from './utils';

const VIDEO_CONTENT_TYPES: Record<string, string> = {
  avi: 'video/x-msvideo',
  m4v: 'video/x-m4v',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  mp4: 'video/mp4',
  mpeg: 'video/mpeg',
  mpg: 'video/mpeg',
  webm: 'video/webm',
};

/**
 * Handles a reported image or video message (Scenario 5/6): uploads the media to
 * Google Drive, records it as an Issue, and replies with an ack + original-source
 * prompt. Runs synchronously (not fire-and-forget) so the prompt's postback can
 * carry a real issue id.
 */
export default async function handleMediaReport(
  message: Extract<CooccurredMessage, { type: 'image' | 'video' }>,
  userId: string
): Promise<Result> {
  const visitor = ga(userId, '__PROCESS_MEDIA__', message.id);
  visitor
    .event({ ec: 'UserInput', ea: 'MessageType', el: message.type })
    .send();

  const context = await setNewContext(userId, { msgs: [message] });
  await displayLoadingAnimation(userId);

  const res = await lineClient.getContent(message.id);
  const originalExtension = message.originalFileName
    ?.split('.')
    .pop()
    ?.toLowerCase();
  const responseContentType = res.headers.get('content-type');
  const contentType =
    responseContentType && responseContentType !== 'application/octet-stream'
      ? responseContentType
      : message.type === 'image'
      ? 'image/jpeg'
      : VIDEO_CONTENT_TYPES[originalExtension ?? ''] ?? 'video/mp4';
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext =
    contentType.split('/')[1]?.split(';')[0] ??
    (message.type === 'image' ? 'jpg' : 'mp4');
  const safeOriginalFileName = message.originalFileName?.replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}_${
    message.id
  }_${safeOriginalFileName ?? `upload.${ext}`}`;

  const driveUrl = await uploadToDrive(filename, buffer, contentType);
  const issue = await upsertFromMedia(message.type, driveUrl, userId);

  return {
    context,
    replies: [
      createMediaReceivedAck(message.type),
      createMediaSourcePrompt(
        String(issue._id),
        message.type,
        context.sessionId
      ),
    ],
  };
}
