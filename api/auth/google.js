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
  const params = new URLSearchParams();
  params.append('code', code);
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('redirect_uri', redirectUri);
  params.append('grant_type', 'authorization_code');

  const resp = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
  return resp.json();
}

async function getUserInfo(accessToken, f){
  const _fetch = f || fetchFn || fetch;
  const resp = await _fetch('https://www.googleapis.com/oauth2/v2/userinfo', { headers: { Authorization: 'Bearer ' + accessToken } });
  return resp.json();
}

module.exports = async (req, res) => {
  try{
    const url = req.path || '';
    const pathParts = url.split('/').filter(Boolean);
    const lastPart = pathParts[pathParts.length-1] || '';
    const action = req.query.action || (req.query.code ? 'callback' : lastPart);
    // Force HTTPS for OAuth - req.protocol may be 'http' behind reverse proxy but OAuth always uses https
    const host = req.get('host') || 'hollyhubdigital.onrender.com';
    const origin = 'https://' + host;
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
    console.log('google auth handler hit; env:', { GOOGLE_CLIENT_ID: !!clientId, GOOGLE_CLIENT_SECRET: !!clientSecret, NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET });

    if(action === 'start'){
      if(!clientId) return res.status(500).send('Google OAuth not configured — set GOOGLE_CLIENT_ID in your .env');
      const redirect = encodeURIComponent(origin + '/api/auth/callback/google');
      const scope = encodeURIComponent('openid email profile');
      const state = Date.now().toString(36);
      return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirect}&response_type=code&scope=${scope}&state=${state}`);
    }

    if(action === 'callback'){
      const code = req.query.code;
      if(!code) return res.status(400).send('Missing code');
      if(!clientId || !clientSecret) return res.status(500).send('Google OAuth not configured — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env');
      const tokenResp = await exchangeCode(code, clientId, clientSecret, origin + '/api/auth/callback/google');
      console.log('google tokenResp keys:', tokenResp && Object.keys(tokenResp || {}));
      const accessToken = tokenResp && tokenResp.access_token;
      if(!accessToken) return res.status(400).send('Failed to obtain access token');
      const info = await getUserInfo(accessToken, fetchFn);
      const email = info && info.email;
      if(!email) return res.status(400).send('Email not available from Google');

      let users = [];
      if(fs.existsSync(usersJson)) users = JSON.parse(fs.readFileSync(usersJson,'utf8')||'[]');
      let user = users.find(u=>u.email===email.toLowerCase());
      if(!user){
        user = { id: Date.now().toString(), email: email.toLowerCase(), fullname: info.name || info.email.split('@')[0], passwordHash: bcrypt.hashSync(Math.random().toString(36), 10), createdAt: new Date().toISOString(), oauthProvider: 'google' };
        users.unshift(user);
        fs.writeFileSync(usersJson, JSON.stringify(users, null, 2), 'utf8');
      }
      const token = makeToken(user);
      return res.redirect('/?token=' + encodeURIComponent(token));
    }

    return res.status(404).send('Not found');
  }catch(e){ console.error(e); return res.status(500).send(e.message); }
};
