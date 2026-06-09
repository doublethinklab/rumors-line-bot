import Router from 'koa-router';
import crypto from 'crypto';
import fetch from 'node-fetch';
import querystring from 'querystring';

const ALLOWED_DOMAIN = 'doublethinklab.org';

const router = new Router();

router.get('/issues-google-login', (ctx: any) => {
  const state = crypto.randomBytes(16).toString('hex');
  ctx.session.googleOauthState = state;

  const params = querystring.stringify({
    client_id: process.env.GOOGLE_LOGIN_CLIENT_ID,
    redirect_uri: `${process.env.RUMORS_LINE_BOT_URL}/issues-google-callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    hd: ALLOWED_DOMAIN, // hint: only show @doublethinklab.org accounts
    access_type: 'online',
  });

  ctx.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/issues-google-callback', async (ctx: any) => {
  const { code, state, error } = ctx.query as {
    code?: string;
    state?: string;
    error?: string;
  };

  if (error) {
    ctx.status = 400;
    ctx.body = `Google 登入失敗：${error}`;
    return;
  }

  if (!state || state !== ctx.session.googleOauthState) {
    ctx.status = 400;
    ctx.body = 'Invalid OAuth state';
    return;
  }
  ctx.session.googleOauthState = undefined;

  // Exchange code for token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: querystring.stringify({
      code,
      client_id: process.env.GOOGLE_LOGIN_CLIENT_ID,
      client_secret: process.env.GOOGLE_LOGIN_CLIENT_SECRET,
      redirect_uri: `${process.env.RUMORS_LINE_BOT_URL}/issues-google-callback`,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    ctx.status = 502;
    ctx.body = '無法取得 Google access token';
    return;
  }

  const tokenData = (await tokenRes.json()) as { access_token: string };

  // Fetch user profile
  const profileRes = await fetch(
    'https://www.googleapis.com/oauth2/v3/userinfo',
    { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
  );

  if (!profileRes.ok) {
    ctx.status = 502;
    ctx.body = '無法取得 Google 使用者資料';
    return;
  }

  const profile = (await profileRes.json()) as {
    sub: string;
    email: string;
    name: string;
    picture: string;
    hd?: string;
  };

  // Enforce @doublethinklab.org domain
  if (!profile.email?.endsWith(`@${ALLOWED_DOMAIN}`)) {
    ctx.status = 403;
    ctx.body = `僅限 @${ALLOWED_DOMAIN} 帳號登入。您的帳號：${profile.email}`;
    return;
  }

  ctx.session.investigator = {
    userId: `google:${profile.sub}`,
    name: profile.name,
    pictureUrl: profile.picture,
    email: profile.email,
    loginMethod: 'google',
    role: 'admin',
  };

  ctx.redirect('/issues');
});

export default router;
