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
      // Prefer remote settings when env config is present
      try{
        if(process.env.GITHUB_TOKEN && process.env.REPO_OWNER && process.env.REPO_NAME){
          const f = await getFile('data/settings.json', { 
            owner: process.env.REPO_OWNER, 
            repo: process.env.REPO_NAME,
            branch: process.env.REPO_BRANCH || 'main',
            token: process.env.GITHUB_TOKEN
          });
          return res.json(JSON.parse(f.content || '{}'));
        }
      }catch(e){ console.warn('[settings] Remote read failed:', e.message); }

      // Local fallback (read-only, won't cause 503)
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
      
      // Write to GitHub if configured
      if(process.env.GITHUB_TOKEN && process.env.REPO_OWNER && process.env.REPO_NAME){
        try{
          await putFile('data/settings.json', json, 'Update settings', null, { 
            owner: process.env.REPO_OWNER, 
            repo: process.env.REPO_NAME, 
            branch: process.env.REPO_BRANCH || 'main', 
            token: process.env.GITHUB_TOKEN 
          });
          return res.json({ ok: true });
        }catch(e){ 
          console.error('[settings] GitHub save failed:', e.message);
          return res.status(500).json({error: 'Failed to save settings: ' + e.message});
        }
      } else {
        // No GitHub config - cannot write on Vercel
        return res.status(500).json({error: 'GitHub repository not configured. Cannot save settings on serverless.'});
      }
    }

    return res.status(405).end('Method not allowed');
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
