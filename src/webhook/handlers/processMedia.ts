import { CooccurredMessage, Result } from 'src/types/chatbotState';
import ga from 'src/lib/ga';
import lineClient from 'src/webhook/lineClient';
import { uploadToDrive } from 'src/lib/driveUpload';
import { upsertFromMedia } from 'src/lib/issueService';

import {
  createMediaReceivedAck,
  createAdvancedDescriptionPrompt,
} from './reportFlow';
import { setNewContext, displayLoadingAnimation } from './utils';

/**
 * Handles a reported image or video message (Scenario 5/6): uploads the media to
 * Google Drive, records it as an Issue, and replies with an ack + advanced-description
 * prompt. Runs synchronously (not fire-and-forget) so the prompt's postback can carry
 * a real issue id.
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
  const contentType =
    res.headers.get('content-type') ??
    (message.type === 'image' ? 'image/jpeg' : 'video/mp4');
  const buffer = Buffer.from(await res.arrayBuffer());
  const ext =
    contentType.split('/')[1]?.split(';')[0] ??
    (message.type === 'image' ? 'jpg' : 'mp4');
  const filename = `${new Date().toISOString().replace(/[:.]/g, '-')}_${
    message.id
  }.${ext}`;

  const driveUrl = await uploadToDrive(filename, buffer, contentType);
  const issue = await upsertFromMedia(message.type, driveUrl, userId);

  return {
    context,
    replies: [
      createMediaReceivedAck(message.type),
      createAdvancedDescriptionPrompt(
        String(issue._id),
        context.sessionId,
        message.type === 'image' ? '圖片內容' : '影片內容'
      ),
    ],
  };
}
