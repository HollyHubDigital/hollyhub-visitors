// Use global fetch if available (Vercel Node 18+ has it), otherwise provide a fallback
let fetchFn = typeof fetch !== 'undefined' ? fetch : null;
if (!fetchFn) {
  // Fallback for older Node.js versions - attempt to use node-fetch if installed
  try {
    fetchFn = require('node-fetch');
    if (fetchFn && fetchFn.default) fetchFn = fetchFn.default;
  } catch(e) {
    // If node-fetch not available, create a minimal HTTP client
    const https = require('https');
    const http = require('http');
    const url = require('url');
    fetchFn = (uri, options = {}) => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new url.URL(uri);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const opts = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: options.method || 'GET',
          headers: options.headers || {}
        };
        const req = protocol.request(opts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)) }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
      });
    };
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
    // Force HTTPS for OAuth - req.protocol may be 'http' behind reverse proxy but OAuth always uses https
    const host = req.get('host') || 'hollyhubdigitals.vercel.app';
    const origin = 'https://' + host;
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
        try{
          fs.writeFileSync(usersJson, JSON.stringify(users, null, 2), 'utf8');
        }catch(writeErr){
          if(!(writeErr && (writeErr.code === 'EROFS' || writeErr.code === 'EACCES'))){
            throw writeErr;
          }
          console.warn('[github] Read-only filesystem, user not persisted', writeErr.code);
          // Continue anyway - user gets authenticated for this session
        }
      }
      const token = makeToken(user);
      // redirect back to site with token
      return res.redirect('/?token=' + encodeURIComponent(token));
    }

    return res.status(404).send('Not found');
  }catch(e){ console.error(e); return res.status(500).send(e.message); }
};
