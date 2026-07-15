import MockDate from 'mockdate';
import UserSettings from 'src/database/models/userSettings';
import originalIssue from 'src/database/models/issue';
import { syncAllIssues as originalSyncAllIssues } from 'src/lib/sheets';
import originalLineClient from 'src/webhook/lineClient';
import originalGa from 'src/lib/ga';
import { sleep } from 'src/lib/sharedUtils';
import type { MockedGa } from 'src/lib/__mocks__/ga';
import redis from 'src/lib/redisClient';

import { getRedisBatchKey } from '../utils';
import singleUserHandler from '../singleUserHandler';
import originalHandleReportMessage from '../handleReportMessage';
import originalProcessBatch from '../processBatch';
import originalAskingAdvancedDescription from '../askingAdvancedDescription';
import { WELCOME_MESSAGE } from '../reportFlow';

import { MessageEvent, PostbackEvent, TextEventMessage } from '@line/bot-sdk';

jest.mock('src/webhook/lineClient');
jest.mock('src/lib/ga');
jest.mock('src/database/models/issue');
jest.mock('src/lib/sheets');

jest.mock('../handleReportMessage', () => jest.fn());
jest.mock('../processBatch', () => jest.fn());
jest.mock('../askingAdvancedDescription', () => jest.fn());

const redisGet = jest.spyOn(redis, 'get');

const handleReportMessage = originalHandleReportMessage as jest.MockedFunction<
  typeof originalHandleReportMessage
>;
const processBatch = originalProcessBatch as jest.MockedFunction<
  typeof originalProcessBatch
>;
const askingAdvancedDescription =
  originalAskingAdvancedDescription as jest.MockedFunction<
    typeof originalAskingAdvancedDescription
  >;
const Issue = originalIssue as jest.Mocked<typeof originalIssue>;
const syncAllIssues = originalSyncAllIssues as jest.MockedFunction<
  typeof originalSyncAllIssues
>;

const lineClient = originalLineClient as jest.Mocked<typeof originalLineClient>;
const ga = originalGa as MockedGa;

// If session is renewed, sessionId will become this value
const NOW = 1561982400000;

beforeEach(() => {
  handleReportMessage.mockClear();
  processBatch.mockClear();
  askingAdvancedDescription.mockClear();
  Issue.setReporterDescription.mockClear();
  Issue.findAll.mockClear();
  syncAllIssues.mockClear();
  redisGet.mockClear();
  lineClient.post.mockClear();
  ga.clearAllMocks();

  MockDate.set(NOW);
});

afterEach(() => {
  MockDate.reset();
});

afterAll(async () => {
  await redis.quit();
});

const userId = 'U4af4980629';

it('handles follow and unfollow event', async () => {
  const followEvent = {
    replyToken: 'nHuyWiB7yP5Zw52FIkcQobQuGDXCTA',
    type: 'follow',
    mode: 'active',
    timestamp: 1462629479859,
    source: {
      type: 'user',
      userId,
    },
  } as const;

  await singleUserHandler(userId, followEvent);

  // singleUserHandler does not wait for reply, thus we wait here
  await sleep(500);

  expect(
    (await UserSettings.find({ userId })).map((e) => ({ ...e, _id: '_id' }))
  ).toMatchSnapshot('User settings should have notification turned on');

  expect(lineClient.post.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        "/message/reply",
        Object {
          "messages": Array [
            Object {
              "text": ${JSON.stringify(WELCOME_MESSAGE)},
              "type": "text",
            },
          ],
          "replyToken": "nHuyWiB7yP5Zw52FIkcQobQuGDXCTA",
        },
      ],
    ]
  `);

  expect(ga.eventMock.mock.calls).toMatchInlineSnapshot(`
      Array [
        Array [
          Object {
            "ea": "Step",
            "ec": "Follow",
            "el": "ON_BOARDING",
          },
        ],
      ]
    `);
  expect(ga.sendMock).toHaveBeenCalledTimes(1);

  const unfollowEvent = {
    ...followEvent,
    type: 'unfollow',
  } as const;

  await singleUserHandler(userId, unfollowEvent);

  // singleUserHandler does not wait for reply, thus we wait here
  await sleep(500);

  await expect(UserSettings.find({ userId })).resolves.toHaveProperty(
    [0, 'allowNewReplyUpdate'],
    false
  );
});

it('replies with the unsupported-type message for sticker events', async () => {
  const event: MessageEvent & { message: { type: 'sticker' } } = {
    replyToken: 'nHuyWiB7yP5Zw52FIkcQobQuGDXCTA',
    type: 'message',
    mode: 'active',
    timestamp: 1462629479859,
    source: {
      type: 'user',
      userId,
    },
    message: {
      id: '325708',
      type: 'sticker',
      packageId: '1',
      stickerId: '1',
      stickerResourceType: 'STATIC',
      keywords: [],
    },
  };

  await singleUserHandler(userId, event);

  // singleUserHandler does not wait for reply, thus we wait here
  await sleep(500);

  // Expect ga records the event
  expect(ga.eventMock.mock.calls).toMatchInlineSnapshot(`
    Array [
      Array [
        Object {
          "ea": "MessageType",
          "ec": "UserInput",
          "el": "sticker",
        },
      ],
    ]
  `);
  expect(ga.sendMock).toHaveBeenCalledTimes(1);

  expect(lineClient.post.mock.calls).toMatchSnapshot();
});

it('dispatches ASKING_ADVANCED_DESCRIPTION postbacks with a matching session id', async () => {
  const sessionId = NOW;

  redisGet.mockImplementationOnce(() =>
    Promise.resolve({ sessionId, msgs: [] })
  );

  const event: PostbackEvent = {
    type: 'postback',
    postback: {
      data: JSON.stringify({
        sessionId,
        state: 'ASKING_ADVANCED_DESCRIPTION',
        input: { choice: 'yes', issueId: 'issue-1' },
      }),
    },
    mode: 'active',
    timestamp: 0,
    source: {
      type: 'user',
      userId,
    },
    replyToken: 'reply-token',
  };

  askingAdvancedDescription.mockImplementationOnce((params) => {
    return Promise.resolve({
      context: params.context,
      replies: [{ type: 'text', text: '請用「文字」描述您回傳之訊息。' }],
    });
  });

  await singleUserHandler(userId, event);
  await sleep(500);

  expect(askingAdvancedDescription).toHaveBeenCalledTimes(1);
  expect(lineClient.post.mock.calls).toMatchSnapshot();
});

it('rejects postbacks whose session id no longer matches', async () => {
  redisGet.mockImplementationOnce(() =>
    Promise.resolve({ sessionId: NOW, msgs: [] })
  );

  const event: PostbackEvent = {
    type: 'postback',
    postback: {
      data: JSON.stringify({
        sessionId: 123, // Does not match the freshly-created context's session id
        state: 'ASKING_ADVANCED_DESCRIPTION',
        input: { choice: 'yes', issueId: 'issue-1' },
      }),
    },
    mode: 'active',
    timestamp: 0,
    source: {
      type: 'user',
      userId,
    },
    replyToken: 'reply-token',
  };

  await singleUserHandler(userId, event);
  await sleep(500);

  expect(askingAdvancedDescription).not.toHaveBeenCalled();
  expect(lineClient.post.mock.calls).toMatchSnapshot();
});

function createTextMessageEvent(
  input: string
): MessageEvent & { message: Pick<TextEventMessage, 'type' | 'text'> } {
  return {
    type: 'message',
    message: {
      id: Buffer.from(input).toString('base64'),
      type: 'text',
      text: input,
    },
    mode: 'active',
    timestamp: 0,
    source: {
      type: 'user',
      userId: '',
    },
    replyToken: '',
  };
}

it('reports a single text message via handleReportMessage', async () => {
  const input = 'Newly forwarded message';
  const event = createTextMessageEvent(input);

  handleReportMessage.mockImplementationOnce((message) => {
    return Promise.resolve({
      context: { sessionId: NOW, msgs: [message] },
      replies: [{ type: 'text', text: 'Replies here' }],
    });
  });

  const REDIS_BATCH_KEY = getRedisBatchKey('user-id');
  const processingPromise = singleUserHandler('user-id', event);
  await sleep(100); // Wait for async redis to be processed

  // Expect the message is added to batch
  await expect(redis.range(REDIS_BATCH_KEY, 0, -1)).resolves
    .toMatchInlineSnapshot(`
    Array [
      Object {
        "id": "TmV3bHkgZm9yd2FyZGVkIG1lc3NhZ2U=",
        "text": "Newly forwarded message",
        "type": "text",
      },
    ]
  `);

  // Wait for the whole batch process to finish
  await processingPromise;

  // Expect batch is cleared
  await expect(
    redis.range(REDIS_BATCH_KEY, 0, -1)
  ).resolves.toMatchInlineSnapshot(`Array []`);

  expect(handleReportMessage).toHaveBeenCalledTimes(1);
  expect(handleReportMessage).toHaveBeenCalledWith(
    {
      id: 'TmV3bHkgZm9yd2FyZGVkIG1lc3NhZ2U=',
      text: 'Newly forwarded message',
      type: 'text',
    },
    'user-id'
  );

  expect(lineClient.post.mock.calls).toMatchSnapshot();
});

it('treats the reply as an advanced description when one is pending', async () => {
  redisGet.mockImplementationOnce(() =>
    Promise.resolve({
      sessionId: NOW,
      msgs: [],
      awaitingDescriptionForIssueId: 'issue-42',
    })
  );

  Issue.findAll.mockResolvedValueOnce([]);

  const event = createTextMessageEvent('這是我的補充說明');

  await singleUserHandler(userId, event);
  await sleep(500);

  expect(Issue.setReporterDescription).toHaveBeenCalledWith(
    'issue-42',
    '這是我的補充說明'
  );
  expect(handleReportMessage).not.toHaveBeenCalled();
  expect(processBatch).not.toHaveBeenCalled();
  expect(lineClient.post.mock.calls).toMatchSnapshot();
});
