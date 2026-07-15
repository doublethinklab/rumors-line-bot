import Router from 'koa-router';

import checkSignatureAndParse from './checkSignatureAndParse';
import singleUserHandler from './handlers/singleUserHandler';
import { WebhookEvent } from '@line/bot-sdk';

const router = new Router();

// Routes that is after protection of checkSignature
//
router.use('/', checkSignatureAndParse);
router.post('/', (ctx) => {
  // Allow free-form request handling.
  // Don't wait for anything before returning 200.

  (ctx.request.body as { events: WebhookEvent[] }).events.forEach(
    async (webhookEvent: WebhookEvent) => {
      if (webhookEvent.source.type === 'user') {
        singleUserHandler(webhookEvent.source.userId, webhookEvent);
      }
      // Group/room events are not supported — this bot only handles 1-on-1 reports.
    }
  );
  ctx.status = 200;
});

export default router;
