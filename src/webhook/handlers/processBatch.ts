import { Message } from '@line/bot-sdk';

import { Context, CooccurredMessage, Result } from 'src/types/chatbotState';
import handleReportMessage from './handleReportMessage';

/** LINE reply/push API allows at most 5 messages per call. */
const MAX_REPLIES = 5;

/**
 * Processes a batch of messages that arrived within the debounce window
 * (requirements.md asks users to send one message at a time, but this keeps
 * handling robust if they don't). Each message is reported independently, in
 * order; only the last message's reply may carry the advanced-description
 * prompt, since only one such prompt can be pending per user at a time.
 */
async function processBatch(
  messages: CooccurredMessage[],
  userId: string
): Promise<Result> {
  let context: Context | undefined;
  const replies: Message[] = [];

  for (let index = 0; index < messages.length; index += 1) {
    const isLast = index === messages.length - 1;
    const result = await handleReportMessage(messages[index], userId);
    context = result.context;
    replies.push(...(isLast ? result.replies : result.replies.slice(0, 1)));
  }

  return {
    context: context as Context,
    replies: replies.slice(0, MAX_REPLIES),
  };
}

export default processBatch;
