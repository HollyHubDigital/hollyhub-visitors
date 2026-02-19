const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getFile, putFile } = require('./gh');

function requireAuth(req){
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if(!auth) return false;
  const parts = auth.split(' '); if(parts.length!==2) return false;
  try{ const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); return !!payload; }catch(e){ return false; }
}

module.exports = async (req, res) => {
  try{
    if(req.method === 'GET'){
      // Prefer remote settings when env config is present (admin repo configured)
      try{
        if(process.env.GITHUB_TOKEN && process.env.REPO_OWNER && process.env.REPO_NAME){
          const f = await getFile('data/settings.json');
          return res.json(JSON.parse(f.content || '{}'));
        }
      }catch(e){ /* ignore remote read errors */ }

      const fp = path.join(process.cwd(),'data','settings.json');
      if(!fs.existsSync(fp)) return res.json({});
      return res.json(JSON.parse(fs.readFileSync(fp,'utf8')||'{}'));
    }

    if(req.method === 'PUT'){
      if(!requireAuth(req)) return res.status(401).end('Unauthorized');
      const body = req.body || {};
      const out = {
        siteTitle: body.siteTitle || '',
        siteEmail: body.siteEmail || '',
        repoOwner: body.repoOwner || '',
        repoName: body.repoName || '',
        repoBranch: body.repoBranch || '',
        repoToken: body.repoToken || ''
      };
      const json = JSON.stringify(out, null, 2);
      // write local settings
      const dir = path.join(process.cwd(),'data'); if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir,'settings.json'), json, 'utf8');

      // optionally push to configured admin repo (if environment provides GitHub token and repo)
      try{
        if(process.env.GITHUB_TOKEN && process.env.REPO_OWNER && process.env.REPO_NAME){
          await putFile('data/settings.json', json, 'Update settings', null, { owner: process.env.REPO_OWNER, repo: process.env.REPO_NAME, branch: process.env.REPO_BRANCH || 'main', token: process.env.GITHUB_TOKEN });
        }
      }catch(e){ console.warn('Remote save failed', e.message); }

      return res.json({ ok: true });
    }

    return res.status(405).end('Method not allowed');
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
