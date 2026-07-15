import { CooccurredMessage, Result } from 'src/types/chatbotState';
import { extractUrls, parseUrl } from 'src/lib/urlParser';
import { upsertFromMessage } from 'src/lib/issueService';
import { setNewContext } from './utils';
import {
  createTextReceivedReply,
  createLinkReceivedAck,
  createAdvancedDescriptionPrompt,
} from './reportFlow';
import handleMediaReport from './processMedia';

/**
 * Handles a single reported message (Scenario 2/3/4/5/6): creates/dedups the
 * Issue, appends it to the sheet, and builds the ack (+ advanced-description
 * prompt for links/media) reply.
 */
export default async function handleReportMessage(
  message: CooccurredMessage,
  userId: string
): Promise<Result> {
  if (message.type !== 'text') {
    return handleMediaReport(message, userId);
  }

  const context = await setNewContext(userId, { msgs: [message] });
  const urls = extractUrls(message.text);
  const issue = await upsertFromMessage(message.text, userId);

  if (urls.length === 0) {
    return { context, replies: createTextReceivedReply() };
  }

  const { platform } = parseUrl(urls[0]);
  return {
    context,
    replies: [
      createLinkReceivedAck(platform),
      createAdvancedDescriptionPrompt(String(issue._id), context.sessionId),
    ],
  };
}
