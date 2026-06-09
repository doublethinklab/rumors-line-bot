import Router from 'koa-router';
import crypto from 'crypto';
import fetch from 'node-fetch';
import querystring from 'querystring';

const router = new Router();

router.get('/issues-line-login', (ctx: any) => {
  const state = crypto.randomBytes(16).toString('hex');
  ctx.session.oauthState = state;

  const params = querystring.stringify({
    response_type: 'code',
    client_id: process.env.LINE_LOGIN_CHANNEL_ID,
    redirect_uri: `${process.env.RUMORS_LINE_BOT_URL}/issues-authcallback`,
    state,
    scope: 'profile',
  });

  ctx.redirect(`https://access.line.me/oauth2/v2.1/authorize?${params}`);
});

router.get('/issues-authcallback', async (ctx: any) => {
  const { code, state } = ctx.query as { code: string; state: string };

  if (!state || state !== ctx.session.oauthState) {
    ctx.status = 400;
    ctx.body = 'Invalid OAuth state';
    return;
  }
  ctx.session.oauthState = undefined;

  const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      grant_type: 'authorization_code',
      code,
      redirect_uri: `${process.env.RUMORS_LINE_BOT_URL}/issues-authcallback`,
      client_id: process.env.LINE_LOGIN_CHANNEL_ID,
      client_secret: process.env.LINE_LOGIN_CHANNEL_SECRET,
    }),
  });

  if (!tokenRes.ok) {
    ctx.status = 502;
    ctx.body = 'Failed to obtain access token from LINE';
    return;
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  const profileRes = await fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  if (!profileRes.ok) {
    ctx.status = 502;
    ctx.body = 'Failed to fetch LINE profile';
    return;
  }

  const profile = (await profileRes.json()) as {
    userId: string;
    displayName: string;
    pictureUrl: string;
  };

  ctx.session.investigator = {
    userId: profile.userId,
    name: profile.displayName,
    pictureUrl: profile.pictureUrl,
    loginMethod: 'line',
    role: 'viewer',
  };

  ctx.redirect('/issues');
});

router.get('/issues-logout', (ctx: any) => {
  ctx.session.investigator = undefined;
  ctx.session.oauthState = undefined;
  ctx.session.googleOauthState = undefined;
  ctx.redirect('/issues');
});

export default router;
