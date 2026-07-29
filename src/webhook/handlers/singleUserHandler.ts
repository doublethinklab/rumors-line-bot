import { Message, WebhookEvent } from '@line/bot-sdk';

import {
  CooccurredMessage,
  PostbackActionData,
  Result,
  LegacyContext,
  Context,
} from 'src/types/chatbotState';
import ga from 'src/lib/ga';
import redis from 'src/lib/redisClient';
import { sleep } from 'src/lib/sharedUtils';
import lineClient from 'src/webhook/lineClient';
import UserSettings from 'src/database/models/userSettings';
import Issue from 'src/database/models/issue';
import { updateIssueRow } from 'src/lib/sheets';

import askingAdvancedDescription from './askingAdvancedDescription';
import handleReportMessage from './handleReportMessage';
import processBatch from './processBatch';
import {
  createWelcomeMessages,
  createUnsupportedTypeReply,
  createDescriptionReceivedReply,
} from './reportFlow';
import {
  setReplyToken,
  consumeReplyTokenInfo,
  setNewContext,
  setReplyTokenCollectorMsg,
  getRedisBatchKey,
} from './utils';

const userIdBlacklist = (process.env.USERID_BLACKLIST || '').split(',');

/**
 * The amount of time to wait for the next message to arrive before processing the batch.
 */
const TIMEOUT_BEFORE_PROCESSING = 500; // ms

// A symbol that is used to prevent accidental return in singleUserHandler.
// It should only be used when timeout are correctly handled.
//
const PROCESSED = Symbol('Processed in singleUserHandler');

const singleUserHandler = async (
  userId: string,
  webhookEvent: WebhookEvent
): Promise<typeof PROCESSED> => {
  if (userIdBlacklist.indexOf(userId) !== -1) {
    // User blacklist
    console.log(
      `[LOG] Blocked user INPUT =\n${JSON.stringify({
        userId,
        ...webhookEvent,
      })}\n`
    );
    return PROCESSED;
  }

  /** Timeout handle for the reply token attached in this callback */
  let clearReplyTokenExpireTimer: () => void = () => undefined;

  // Add reply token to context if available
  if ('replyToken' in webhookEvent) {
    // Write reply token to Redis, which may be consumed in the handler functions below.
    //
    clearReplyTokenExpireTimer = await setReplyToken(
      userId,
      webhookEvent.replyToken
    );
  }

  const context = await getContextForUser(userId);
  const REDIS_BATCH_KEY = getRedisBatchKey(userId);

  /**
   * @param msg
   * @returns if the specified CooccurredMsg is the last one in the current batch of CooccurredMsgs.
   */
  async function isLastInBatch(msg: CooccurredMessage) {
    const lastMsgInBatch: CooccurredMessage | undefined = (
      await redis.range(REDIS_BATCH_KEY, -1, -1)
    )[0];
    return !!lastMsgInBatch && msg.id === lastMsgInBatch.id;
  }

  // Helper functions in singleUserHandler that indicates the end of processing.
  // If `forMsg` is provided, also check if the message is the latest in batch.
  //
  async function send(
    result: Result,

    /**
     * The msg that this result is for.
     * If provided, exercise extra check ensure `result` is up-to-date before sending replies.
     * */
    forMsg?: CooccurredMessage
  ): Promise<typeof PROCESSED> {
    // Check forMsg only when it is provided
    if (forMsg !== undefined && !(await isLastInBatch(forMsg))) {
      // The batch has new messages inside, thus the result is outdated and should be abandoned.
      // Leave the rest to the processor of the last msg in batch.
      //
      return cancel();
    }

    console.log(
      JSON.stringify({
        CONTEXT: result.context,
        INPUT: { userId, ...webhookEvent },
        OUTPUT: result,
      })
    );

    if (result.replies.length > 0) {
      // We are sending reply, stop timer countdown
      clearReplyTokenExpireTimer();
      // Read latest context from Redis.
      // The context may have been updated by reply token collection mechanism.
      //
      const latestReplyTokenInfo = await consumeReplyTokenInfo(userId);
      if (latestReplyTokenInfo) {
        // Use reply API if token is still valid
        await lineClient.post('/message/reply', {
          replyToken: latestReplyTokenInfo.token,
          messages: result.replies satisfies Message[],
        });
      } else {
        // Use push API if token expired
        await lineClient.post('/message/push', {
          to: userId,
          messages: result.replies satisfies Message[],
        });
      }

      await Promise.all([
        // The chatbot's reply cuts off the user's input streak, thus we end the current batch here.
        redis.del(REDIS_BATCH_KEY),
        // The chatbot's reply marks an end of previous process, thus we can clear the reply collector message.
        setReplyTokenCollectorMsg(userId, null),
      ]);
    }

    // Set context
    //
    await redis.set(userId, result.context);
    return PROCESSED;
  }

  // Does not reply and just exit processing.
  //
  function cancel(): typeof PROCESSED {
    clearReplyTokenExpireTimer(); // Avoid timeout after we exit
    return PROCESSED;
  }

  /**
   * Adds cooccurred message to batch.
   * After TIMEOUT_BEFORE_PROCESSING since the last message has been added, process the
   * batch of co-occurred messages (see processBatch.ts).
   */
  async function addMsgToBatch(
    msg: CooccurredMessage
  ): Promise<typeof PROCESSED> {
    await redis.push(REDIS_BATCH_KEY, msg);

    await sleep(TIMEOUT_BEFORE_PROCESSING);

    if (!(await isLastInBatch(msg))) {
      // New message appears during we sleep,
      // abort processing and let the new message's callback do the work.
      return cancel();
    }

    // Try processing the batch and calculate results
    //
    const messages: CooccurredMessage[] = await redis.range(
      REDIS_BATCH_KEY,
      0,
      -1
    );

    if (messages.length !== 1) {
      return send(await processBatch(messages, userId), msg);
    }

    // Now there is only one message in the batch;
    // messages[0] should be identical to msg.
    //
    return send(await handleReportMessage(msg, userId), msg);
  }

  switch (webhookEvent.type) {
    default: {
      // These events are not handled at all.
      return cancel();
    }

    case 'unfollow': {
      await UserSettings.setAllowNewReplyUpdate(userId, false);
      return cancel();
    }

    case 'follow': {
      await UserSettings.setAllowNewReplyUpdate(userId, true);

      // Create new context
      const newContext = await setNewContext(userId);

      ga(userId, 'FOLLOW')
        .event({ ec: 'Follow', ea: 'Step', el: 'ON_BOARDING' })
        .send();

      return send({
        context: newContext,
        replies: createWelcomeMessages(),
      });
    }

    case 'postback': {
      const postbackData = JSON.parse(
        webhookEvent.postback.data
      ) as PostbackActionData<unknown>;

      if (postbackData.sessionId !== context.sessionId) {
        // Postback data session ID != context session ID can happen when
        // (1) user context in redis is expired, or
        // (2) if other new messages have been sent before pressing buttons.
        //
        console.log('Previous button pressed.');

        return send({
          context, // Reuse existing context
          replies: [
            {
              type: 'text',
              text: '🚧 您目前有其他新的回報正在進行，這個按鈕已經失效囉。',
            },
          ],
        });
      }

      if (postbackData.state === 'ASKING_ADVANCED_DESCRIPTION') {
        return send(
          await askingAdvancedDescription({ context, postbackData, userId })
        );
      }

      return cancel();
    }

    case 'message': {
      break; // Handle message events later
    }
  }

  // We have message events left.
  //
  switch (webhookEvent.message.type) {
    default: {
      // Unsupported message type (sticker, file, location, audio, etc.) — Scenario 7
      ga(userId)
        .event({
          ec: 'UserInput',
          ea: 'MessageType',
          el: webhookEvent.message.type,
        })
        .send();
      return send({
        context: await setNewContext(userId),
        replies: createUnsupportedTypeReply(),
      });
    }

    case 'video':
    case 'image':
      return addMsgToBatch({
        type: webhookEvent.message.type,
        id: webhookEvent.message.id,
      });

    case 'text': {
      // Handle text events later
      break;
    }
  }

  // Handle text event messages
  //
  switch (webhookEvent.message.text) {
    // Debugging: type 'RESET' to reset user's context and start all over.
    //
    case 'RESET': {
      redis.del(userId);
      redis.del(REDIS_BATCH_KEY);
      return cancel();
    }

    default: {
      const trimmedInput = webhookEvent.message.text.trim();

      if (context.awaitingDescriptionForIssueId) {
        // The user is replying with the advanced description they agreed to provide.
        //
        const issueId = context.awaitingDescriptionForIssueId;
        await Issue.setReporterDescription(issueId, trimmedInput);
        Issue.findById(issueId)
          .then((issue) => issue && updateIssueRow(issue))
          .catch((err) => console.error('[sheets] Sync failed:', err));

        return send({
          context: await setNewContext(userId),
          replies: createDescriptionReceivedReply(),
        });
      }

      // The user is reporting a new message.
      //
      return addMsgToBatch({
        id: webhookEvent.message.id,
        type: 'text',
        text: trimmedInput,
      });
    }
  }
};

/**
 * Get user's context from redis or create a new one.
 * Automatically convert legacy context to new context.
 * Stores to Redis when needed.
 *
 * @param userId
 * @returns user's context from Redis, or newly created context
 */
async function getContextForUser(userId: string): Promise<Context> {
  const context = ((await redis.get(userId)) ||
    (await setNewContext(userId))) as LegacyContext | Context;

  if (!('data' in context)) {
    // New context
    return context;
  }

  // Converting legacy context to new context.
  // Audio was never supported by CooccurredMessage going forward, so a legacy
  // audio session has nothing to migrate to and just resets to an empty batch.
  return setNewContext(userId, {
    sessionId: context.data.sessionId,
    msgs:
      'searchedText' in context.data
        ? [
            {
              id: context.data.sessionId.toString(), // Original message ID is not available, use session id to differentiate
              type: 'text' as const,
              text: context.data.searchedText,
            },
          ]
        : context.data.messageType === 'audio'
        ? []
        : [
            {
              id: context.data.messageId,
              type: context.data.messageType,
            },
          ],
  });
}

export default singleUserHandler;
