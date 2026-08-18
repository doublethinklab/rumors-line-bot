import type {
  Action,
  FlexMessage,
  FlexSpan,
  FlexText,
  FlexComponent,
} from '@line/bot-sdk';
import { t } from 'ttag';

import {
  ChatbotState,
  Context,
  PostbackActionData,
  ReplyTokenInfo,
} from 'src/types/chatbotState';
import redis from 'src/lib/redisClient';

import type { AdvancedDescriptionInput } from './askingAdvancedDescription';
import type { MediaSourceInput } from './askingMediaSource';
import lineClient from '../lineClient';

/**
 * Maps ChatbotState to the postback action data
 */
type StateInputMap = {
  __INIT__: never;
  ASKING_MEDIA_SOURCE: MediaSourceInput;
  ASKING_ADVANCED_DESCRIPTION: AdvancedDescriptionInput;
  CONTINUE: never;
  Error: unknown;
};

/**
 * Generate a postback action with a payload that the state handler can process properly.
 *
 * @param label - Postback action button text, max 20 words
 * @param input - Input when pressed. The format must match the postback data type for that state.
 * @param displayText - Text to display in chat window.
 * @param sessionId - Current session ID
 * @param state - the state that processes the postback
 */
export function createPostbackAction<S extends ChatbotState>(
  label: string,
  input: StateInputMap[S],
  displayText: string,
  sessionId: number,
  state: S
): Action {
  // Ensure the data type before stringification
  const data: PostbackActionData<StateInputMap[S]> = {
    input,
    sessionId,
    state,
  };

  return {
    type: 'postback',
    label,
    displayText,
    data: JSON.stringify(data),
  };
}

/**
 * Omit<> breaks FlexText's discriminated union, thus we Omit<> separately and then union back
 */
type FlexTextWithoutType =
  | Omit<
      FlexText & {
        /* Discriminator */ text?: never;
        contents: FlexSpan[];
        /* Must be supplied in this case */ altText: string;
      },
      'type'
    >
  | Omit<FlexText & { text: string; contents?: never }, 'type'>;

/**
 * Creates a single flex bubble message that acts identical to text message, but cannot be copied
 * nor forwarded by the user.
 *
 * @param textProps - https://developers.line.biz/en/reference/messaging-api/#f-text.
 *   type & wrap is specified by default.
 * @returns A single flex bubble message
 */
export function createTextMessage(textProps: FlexTextWithoutType): FlexMessage {
  const altText = 'altText' in textProps ? textProps.altText : textProps.text;

  const content: FlexComponent = {
    type: 'text',
    wrap: true,
    // Exclude altText from FlexComponent content
    ...(() => {
      if (!('altText' in textProps)) {
        return textProps;
      }
      const {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        altText,
        ...other
      } = textProps;
      return other;
    })(),
  };

  return {
    type: 'flex',
    altText,
    contents: {
      type: 'bubble',
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [content],
      },
    },
  };
}

/**
 * Creates a new context that represents a new search session.
 * Stores to Redis and returns the new context.
 *
 * @param userId
 * @param contextData - part of the context data to be set in the new context
 * @returns the new context.
 */
export async function setNewContext<T extends Context>(
  userId: string,
  contextData: Partial<T> = {}
) {
  const defaultContext: Context = {
    sessionId: Date.now(),
    msgs: [],
  };
  const mergedContext = {
    ...defaultContext,
    ...contextData,
  } as T;

  await redis.set(userId, mergedContext);
  return mergedContext;
}

/**
 * Show a display indicator
 * @ref https://developers.line.biz/en/reference/messaging-api/#display-a-loading-indicator
 */
export function displayLoadingAnimation(userId: string, loadingSeconds = 60) {
  return lineClient.post('/chat/loading/start', {
    chatId: userId,
    loadingSeconds,
  });
}

/**
 * On REPLT_TIMEOUT, we consume the existing (about-to-expire) reply token
 * to send a collector to user, hoping to get new reply tokens.
 *
 * Reply tokens must be used within one minute after receiving the webhook.
 * @ref https://developers.line.biz/en/reference/messaging-api/#send-reply-message
 */
const REPLY_TIMEOUT = 50000;
const TOKEN_TIMEOUT = 60000;

function getRedisReplyTokenKey(userId: string) {
  return `${userId}:replyToken`;
}

/**
 * Stores the reply token in Redis and sends a reply token collector before the reply token expires.
 * Returns a function that can be called to cancel the token expire collector.
 */
export async function setReplyToken(userId: string, replyToken: string) {
  const tokenInfo: ReplyTokenInfo = {
    token: replyToken,
    receivedAt: Date.now(),
  };

  await redis.set(getRedisReplyTokenKey(userId), tokenInfo);

  // Send reply token collector before the reply token expires
  //
  const timer = setTimeout(async function () {
    console.log(
      `[LOG] Reply token timeout ${JSON.stringify({ userId, tokenInfo })}\n`
    );

    const latestReplyTokenInfo = (await redis.get(
      getRedisReplyTokenKey(userId)
    )) as ReplyTokenInfo | null;

    // The reply token has been consumed, or there is a new reply token set in Redis as latest.
    // In this case, we don't send the reply token collector for this old replyToken.
    //
    if (!latestReplyTokenInfo || latestReplyTokenInfo.token !== replyToken)
      return;

    await sendReplyTokenCollector(userId);
  }, REPLY_TIMEOUT);

  return () => clearTimeout(timer);
}

/**
 * Take the reply token info from Redis and delete it from Redis.
 *
 * @param userId
 * @returns the token info
 */
export async function consumeReplyTokenInfo(
  userId: string
): Promise<ReplyTokenInfo | null> {
  const tokenInfo = (await redis.get(
    getRedisReplyTokenKey(userId)
  )) as ReplyTokenInfo | null;
  redis.del(getRedisReplyTokenKey(userId));
  return tokenInfo;
}

/**
 * The redis key for message batch information for the given user.
 */
export function getRedisBatchKey(userId: string) {
  return `${userId}:batch`;
}

const DEFAULT_REPLY_TOKEN_COLLECTOR_MSG = t`I am still processing your request. Please wait.`;

/**
 * Sends a message with quick reply to collect new reply token.
 * Does nothing if the current token is already expired.
 */
async function sendReplyTokenCollector(userId: string): Promise<void> {
  const tokenInfo = await consumeReplyTokenInfo(userId);

  // Token is already consumed or not set
  if (!tokenInfo) return;

  // If the token is already expired, do nothing.
  //
  // Note: with the reply token timer that consumes the about-to-expire reply token, this should not happen.
  // It's just a fail-safe mechanism.
  //
  const tokenAge = Date.now() - tokenInfo.receivedAt;
  if (tokenAge >= TOKEN_TIMEOUT) return;

  const latestContext = (await redis.get(userId)) as Context;
  const messages = [
    {
      ...createTextMessage({
        text:
          latestContext.replyTokenCollectorMsg ??
          DEFAULT_REPLY_TOKEN_COLLECTOR_MSG,
      }),
      quickReply: {
        items: [
          {
            type: 'action' as const,
            action: {
              type: 'postback' as const,
              label: t`OK, proceed.`,
              data: JSON.stringify({
                state: 'CONTINUE',
                sessionId: latestContext.sessionId,
              }),
              displayText: t`OK, proceed.`,
            },
          },
        ],
      },
    },
  ];

  await lineClient.post('/message/reply', {
    replyToken: tokenInfo.token,
    messages,
  });
}

/**
 * Setup the message to show when reply token collector is sent to the user.
 */
export async function setReplyTokenCollectorMsg(
  userId: string,
  /** The mesage to show. Set to null or empty string to use the default message */
  msg: string | null
) {
  const context = (await redis.get(userId)) as Context;
  if (msg) {
    context.replyTokenCollectorMsg = msg;
  } else {
    delete context.replyTokenCollectorMsg;
  }
  await redis.set(userId, context);
}
