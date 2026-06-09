import Router from 'koa-router';
import getRawBody from 'raw-body';
import Issue, { IssueStatus, Investigator } from 'src/database/models/issue';
import Account, { AccountStatus } from 'src/database/models/account';
import { syncAllIssues } from 'src/lib/sheets';
import { upsertFromMessage } from 'src/lib/issueService';

const router = new Router();

interface InvestigatorSession {
  userId: string;
  name: string;
  pictureUrl: string;
}

function requireAuth(ctx: any, next: () => Promise<void>) {
  if (!ctx.session.investigator) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized' };
    return;
  }
  return next();
}

function requireAdmin(ctx: any, next: () => Promise<void>) {
  if (!ctx.session.investigator) {
    ctx.status = 401;
    ctx.body = { error: 'Unauthorized' };
    return;
  }
  if (ctx.session.investigator.role !== 'admin') {
    ctx.status = 403;
    ctx.body = { error: 'Admin permission required' };
    return;
  }
  return next();
}

async function parseJsonBody(ctx: any): Promise<any> {
  const raw = await getRawBody(ctx.req, { encoding: 'utf-8' });
  return raw ? JSON.parse(raw) : {};
}

router.get('/me', requireAuth, (ctx: any) => {
  ctx.body = ctx.session.investigator;
});

router.get('/issues', requireAuth, async (ctx) => {
  const issues = await Issue.findAll();
  ctx.body = issues;
});

// Analyst manually submits an observation (URL or text) — admin only
router.post('/issues', requireAdmin, async (ctx: any) => {
  const body = await parseJsonBody(ctx);
  const { content, notes } = body as { content?: string; notes?: string };

  if (!content || !content.trim()) {
    ctx.status = 400;
    ctx.body = { error: 'content is required' };
    return;
  }

  const session: InvestigatorSession = ctx.session.investigator;
  const issue = await upsertFromMessage(content.trim(), session.userId);

  // Attach analyst note if provided
  if (notes?.trim() && issue._id) {
    const col = await (
      await import('src/database/mongoClient')
    ).default.getInstance().then((c: any) => c.collection('issues'));
    await col.updateOne(
      { _id: issue._id },
      { $set: { analystNotes: notes.trim(), updatedAt: new Date() } }
    );
    issue.analystNotes = notes.trim();
  }

  ctx.status = 201;
  ctx.body = issue;
});

router.patch('/issues/:id/status', requireAdmin, async (ctx: any) => {
  const body = await parseJsonBody(ctx);
  const { status } = body as { status: IssueStatus };

  if (!['new', 'processing', 'resolved'].includes(status)) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid status' };
    return;
  }

  const issue = await Issue.updateStatus(ctx.params.id, status);
  if (!issue) {
    ctx.status = 404;
    ctx.body = { error: 'Issue not found' };
    return;
  }
  ctx.body = issue;

  // Fire-and-forget full sync to keep sheet state current
  Issue.findAll()
    .then((all) => syncAllIssues(all))
    .catch((err) => console.error('[sheets] Sync failed:', err));
});

router.post('/issues/:id/investigators', requireAdmin, async (ctx: any) => {
  const session: InvestigatorSession = ctx.session.investigator;
  const investigator: Investigator = {
    userId: session.userId,
    name: session.name,
    pictureUrl: session.pictureUrl,
    claimedAt: new Date(),
  };

  const issue = await Issue.addInvestigator(ctx.params.id, investigator);
  if (!issue) {
    ctx.status = 409;
    ctx.body = { error: 'Already assigned or max investigators (5) reached' };
    return;
  }
  ctx.body = issue;
});

router.delete('/issues/:id/investigators', requireAdmin, async (ctx: any) => {
  const session: InvestigatorSession = ctx.session.investigator;
  const issue = await Issue.removeInvestigator(ctx.params.id, session.userId);
  if (!issue) {
    ctx.status = 404;
    ctx.body = { error: 'Issue not found' };
    return;
  }
  ctx.body = issue;
});

// ── Accounts ──────────────────────────────────────────────────────────────────

router.get('/accounts', requireAuth, async (ctx) => {
  const accounts = await Account.findAll();
  ctx.body = accounts;
});

router.patch('/accounts/:id', requireAdmin, async (ctx: any) => {
  const body = await parseJsonBody(ctx);
  const { status, notes } = body as { status?: AccountStatus; notes?: string };

  if (status && !['watching', 'discontinued', 'cleared'].includes(status)) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid status' };
    return;
  }

  const account = await Account.updateStatus(
    ctx.params.id,
    status ?? 'watching',
    notes
  );
  if (!account) {
    ctx.status = 404;
    ctx.body = { error: 'Account not found' };
    return;
  }
  ctx.body = account;
});

// Issues belonging to a specific account
router.get('/accounts/:id/issues', requireAdmin, async (ctx: any) => {
  const account = await Account.findById(ctx.params.id);
  if (!account) {
    ctx.status = 404;
    ctx.body = { error: 'Account not found' };
    return;
  }
  const issues = await Issue.findAll();
  ctx.body = issues.filter(
    (i) =>
      i.platform === account.platform && i.accountHandle === account.handle
  );
});

export default router;
