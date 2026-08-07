jest.mock('src/webhook/lineClient');

import Koa from 'koa';
import request from 'supertest';
import router from '../api';
import originalLineClient from 'src/webhook/lineClient';

const lineClient = originalLineClient as jest.Mocked<typeof originalLineClient>;
const originalToken = process.env.SOCIAL_BROADCAST_TOKEN;

const app = new Koa();
app.use(async (ctx, next) => {
  (ctx as any).session = {};
  await next();
});
app.use(router.routes());

beforeEach(() => {
  process.env.SOCIAL_BROADCAST_TOKEN = 'broadcast-test-token';
  lineClient.post.mockReset();
  lineClient.post.mockResolvedValue(undefined as never);
});

afterAll(() => {
  if (originalToken === undefined) {
    delete process.env.SOCIAL_BROADCAST_TOKEN;
  } else {
    process.env.SOCIAL_BROADCAST_TOKEN = originalToken;
  }
});

it('rejects an unauthenticated Facebook broadcast', async () => {
  await request(app.callback())
    .post('/facebook-broadcast')
    .send({ postUrl: 'https://www.facebook.com/dtl/posts/123' })
    .expect(401);

  expect(lineClient.post).not.toHaveBeenCalled();
});

it('rejects a non-Facebook broadcast URL', async () => {
  await request(app.callback())
    .post('/facebook-broadcast')
    .set('Authorization', 'Bearer broadcast-test-token')
    .send({ postUrl: 'https://example.com/posts/123' })
    .expect(400);

  expect(lineClient.post).not.toHaveBeenCalled();
});

it('broadcasts a published Facebook post to LINE friends', async () => {
  await request(app.callback())
    .post('/facebook-broadcast')
    .set('Authorization', 'Bearer broadcast-test-token')
    .send({ postUrl: 'https://www.facebook.com/dtl/posts/123' })
    .expect(202, { ok: true });

  expect(lineClient.post).toHaveBeenCalledWith('/message/broadcast', {
    messages: [
      expect.objectContaining({
        type: 'text',
        text: expect.stringContaining('https://www.facebook.com/dtl/posts/123'),
      }),
    ],
  });
});
