// Ensure a usable `fetch` in server context: prefer global, then node-fetch (CJS/ESM-safe)
let fetchFn;
if (typeof fetch === 'function') {
  fetchFn = fetch;
} else {
  try {
    fetchFn = require('node-fetch');
    if (fetchFn && fetchFn.default) fetchFn = fetchFn.default;
  }catch(e){
    fetchFn = (...args) => import('node-fetch').then(m => m.default(...args));
  }
}
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const usersJson = path.join(process.cwd(), 'data', 'users.json');

function makeToken(user){
  const payload = { id: user.id, email: user.email, fullname: user.fullname };
  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
}

async function exchangeCode(code, clientId, clientSecret, redirectUri){
  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type':'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri })
  });
  return resp.json();
}

async function getUserProfile(token, f){
  const _fetch = f || fetchFn || fetch;
  const resp = await _fetch('https://api.github.com/user', { headers: { Authorization: 'token ' + token, 'User-Agent': 'hollyhub' } });
  const profile = await resp.json();
  // fetch emails
  const emailsResp = await _fetch('https://api.github.com/user/emails', { headers: { Authorization: 'token ' + token, 'User-Agent': 'hollyhub' } });
  const emails = await emailsResp.json();
  const primary = Array.isArray(emails) ? emails.find(e=>e.primary && e.verified) || emails[0] : null;
  return { profile, email: primary && primary.email ? primary.email : (profile.email || null) };
}

module.exports = async (req, res) => {
  try{
    const url = req.path || '';
    const pathParts = url.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length-1] || '';
    const action = req.query.action || (req.query.code ? 'callback' : lastPart);
    const origin = (req.protocol || 'http') + '://' + (req.get('host') || 'localhost:3000');
    const clientId = process.env.GITHUB_CLIENT_ID || '';
    const clientSecret = process.env.GITHUB_CLIENT_SECRET || '';
    console.log('github auth handler hit; env:', { GITHUB_CLIENT_ID: !!clientId, GITHUB_CLIENT_SECRET: !!clientSecret, NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET });

    if(action === 'start'){
      if(!clientId) return res.status(500).send('GitHub OAuth not configured (GITHUB_CLIENT_ID missing)');
      // Use the base handler URL as redirect so providers return to /api/auth/github?code=...
      const redirect = encodeURIComponent(origin + '/api/auth/github');
      const state = Date.now().toString(36);
      const scope = encodeURIComponent('read:user user:email');
      return res.redirect(`https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&state=${state}`);
    }

    if(action === 'callback'){
      const code = req.query.code;
      if(!code) return res.status(400).send('Missing code');
      if(!clientId || !clientSecret) return res.status(500).send('GitHub OAuth not configured — set GITHUB_CLIENT_ID in your .env');
      const tokenResp = await exchangeCode(code, clientId, clientSecret, origin + '/api/auth/github');
      console.log('github tokenResp keys:', tokenResp && Object.keys(tokenResp || {}));
      const accessToken = tokenResp && tokenResp.access_token;
      if(!accessToken) return res.status(400).send('Failed to obtain access token');
      const { profile, email } = await getUserProfile(accessToken, fetchFn);

      if(!email) return res.status(400).send('Email not available from GitHub');

      // load users
      let users = [];
      if(fs.existsSync(usersJson)) users = JSON.parse(fs.readFileSync(usersJson,'utf8')||'[]');
      let user = users.find(u=>u.email===email.toLowerCase());
      if(!user){
        // create user
        user = { id: Date.now().toString(), email: email.toLowerCase(), fullname: profile.name || profile.login || '', passwordHash: bcrypt.hashSync(Math.random().toString(36), 10), createdAt: new Date().toISOString(), oauthProvider: 'github' };
        users.unshift(user);
        fs.writeFileSync(usersJson, JSON.stringify(users, null, 2), 'utf8');
      }
      const token = makeToken(user);
      // redirect back to site with token
      return res.redirect('/?token=' + encodeURIComponent(token));
    }

    return res.status(404).send('Not found');
  }catch(e){ console.error(e); return res.status(500).send(e.message); }
};
