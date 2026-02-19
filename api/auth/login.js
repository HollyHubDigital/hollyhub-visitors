const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getFile } = require('../gh');
const { getRepoConfig } = require('../utils');

function makeToken(user){
  const payload = { id: user.id, email: user.email, fullname: user.fullname };
  return jwt.sign(payload, process.env.JWT_SECRET || 'devsecret', { expiresIn: '7d' });
}

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const body = req.body || {};
    const email = (body.email||'').toLowerCase().trim();
    const password = body.password || '';
    if(!email || !password) return res.status(400).json({ error: 'Missing email or password' });

    const repoOpts = await getRepoConfig(req) || {};
    let users = [];
    const dataPath = 'data/users.json';
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{ const f = await getFile(dataPath, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); users = JSON.parse(f.content||'[]'); }catch(e){ users = []; }
    } else {
      const fp = path.join(process.cwd(),'data','users.json'); if(fs.existsSync(fp)) users = JSON.parse(fs.readFileSync(fp,'utf8')||'[]');
    }

    // If Cloudflare Turnstile is enabled, verify token server-side
    try{
      const appsCfgPath = path.join(process.cwd(),'data','apps-config.json');
      if(fs.existsSync(appsCfgPath)){
        const appsCfg = JSON.parse(fs.readFileSync(appsCfgPath,'utf8')||'{}');
        const cf = appsCfg.enabled && appsCfg.enabled.cloudflare;
        if(cf && cf.secretKey){
          const cfToken = body.cfToken || '';
          if(!cfToken) return res.status(403).json({ error: 'Captcha required' });
          // verify with Cloudflare
          try{
            const params = new URLSearchParams();
            params.append('secret', cf.secretKey);
            params.append('response', cfToken);
            const verify = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString() });
            const vr = await verify.json();
            if(!vr || !vr.success) return res.status(403).json({ error: 'Captcha verification failed' });
          }catch(e){ return res.status(500).json({ error: 'Captcha verification error' }); }
        }
      }
    }catch(e){ /* ignore */ }

    const user = users.find(u=>u.email===email);
    if(!user) return res.status(401).json({ error: 'Invalid credentials' });
    const ok = bcrypt.compareSync(password, user.passwordHash || user.password || '');
    if(!ok) return res.status(401).json({ error: 'Invalid credentials' });
    const token = makeToken(user);
    return res.json({ token, user: { id: user.id, email: user.email, fullname: user.fullname } });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
};
