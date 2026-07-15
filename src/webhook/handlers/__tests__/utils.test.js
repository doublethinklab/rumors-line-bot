jest.mock('src/webhook/lineClient');

import {
  createPostbackAction,
  setNewContext,
  setReplyToken,
  consumeReplyTokenInfo,
} from '../utils';
import { sleep } from 'src/lib/sharedUtils';
import redis from 'src/lib/redisClient';
import lineClient from 'src/webhook/lineClient';

describe('createPostbackAction()', () => {
  it('should return postback message body', () => {
    expect(
      createPostbackAction(
        '閱讀此回應',
        3,
        'I chose this',
        1519019701265,
        'some-id'
      )
    ).toMatchSnapshot();
  });
});

describe('setReplyToken()', () => {
  beforeEach(() => {
    lineClient.post.mockClear();
  });

  it(
    'should only send one timeout reply token collector when called multiple times',
    async () => {
      const userId = 'userId';
      await setNewContext(userId, { sessionId: 2 * 2 * 3 * 3 * 3 * 83 });
      await setReplyToken(userId, 'replyToken1'); // This reply token should be replaced by the next one
      await sleep(1000);
      await setReplyToken(userId, 'replyToken2');
      await sleep(60 * 1000); // Wait until timeout

      // Expect no more reply token in Redis
      const nonExistToken = await consumeReplyTokenInfo(userId);
      expect(nonExistToken).toBeNull();

      // Expect replyToken2 is used in the timeout reply token collector message
      expect(lineClient.post.mock.calls).toHaveLength(1);
      expect(lineClient.post.mock.calls[0]).toMatchInlineSnapshot(`
        Array [
          "/message/reply",
          Object {
            "messages": Array [
              Object {
                "altText": "I am still processing your request. Please wait.",
                "contents": Object {
                  "body": Object {
                    "contents": Array [
                      Object {
                        "text": "I am still processing your request. Please wait.",
                        "type": "text",
                        "wrap": true,
                      },
                    ],
                    "layout": "vertical",
                    "type": "box",
                  },
                  "type": "bubble",
                },
                "quickReply": Object {
                  "items": Array [
                    Object {
                      "action": Object {
                        "data": "{\\"state\\":\\"CONTINUE\\",\\"sessionId\\":8964}",
                        "displayText": "OK, proceed.",
                        "label": "OK, proceed.",
                        "type": "postback",
                      },
                      "type": "action",
                    },
                  ],
                },
                "type": "flex",
              },
            ],
            "replyToken": "replyToken2",
          },
        ]
      `);

      // Cleanup
      await redis.del(userId);
    },
    70 * 1000 /* Must be longer than reply token timeout */
  );
});
