import type { Message, MessageEvent } from '@line/bot-sdk';

export type ChatbotState =
  | '__INIT__'
  | 'ASKING_MEDIA_SOURCE'
  | 'ASKING_ADVANCED_DESCRIPTION'
  | 'CONTINUE' // quick reply from reply token collection
  | 'Error';

export type LegacyContext = {
  data: {
    /** Used to differientiate different search sessions (searched text or media) */
    sessionId: number;
  } & (
    | {
        /** Searched multi-media message that started this search session */
        messageId: MessageEvent['message']['id'];
        messageType: Extract<
          MessageEvent['message']['type'],
          'audio' | 'video' | 'image'
        >;
      }
    | {
        /** Searched text that started this search session */
        searchedText: string;
      }
  );
};

export type Context = {
  /** Used to differientiate different search sessions (searched text or media) */
  sessionId: number;
  msgs: ReadonlyArray<CooccurredMessage>;

  /**
   * Message to show when sending reply token collector before the current reply token expires.
   */
  replyTokenCollectorMsg?: string;

  /**
   * Set right after the user agrees to provide an advanced description for a report.
   * The next text message from the user is treated as the description for this issue
   * instead of a new report.
   */
  awaitingDescriptionForIssueId?: string;

  /**
   * Set when the reporter agrees to provide an image/video's original source.
   * The next text message must contain the source URL before the description
   * question is shown.
   */
  awaitingMediaSource?: {
    issueId: string;
    inputType: 'image' | 'video';
  };
};

/** Latest reply token in Redis that is not consumed yet */
export type ReplyTokenInfo = {
  token: string;
  receivedAt: number;
};

/** A single messages in the same co-occurrence */
export type CooccurredMessage = {
  id: MessageEvent['message']['id'];
} & (
  | {
      type: Extract<MessageEvent['message']['type'], 'video' | 'image'>;
      /** Present when a video was uploaded through LINE's file picker. */
      originalFileName?: string;
    }
  | {
      type: Extract<MessageEvent['message']['type'], 'text'>;
      /** Searched text that started this search session */
      text: string;
    }
);

/** Result of handler or processors */
export type Result = {
  /** The new context to set after processing the event */
  context: Context;

  /** The messages to send to the user as reply */
  replies: Message[];
};

/**
 * The data that postback action stores as JSON.
 */
export type PostbackActionData<T> = {
  input: T;
  sessionId: number;
  state: ChatbotState;
};

export type ChatbotPostbackHandlerParams<T = unknown> = {
  /** Chatbot context */
  context: Context;
  /** Data in postback payload */
  postbackData: PostbackActionData<T>;
  userId: string;
};

/**
 * For chatbot postback event handers
 */
export type ChatbotPostbackHandler<T = unknown> = (
  params: ChatbotPostbackHandlerParams<T>
) => Promise<Result>;
