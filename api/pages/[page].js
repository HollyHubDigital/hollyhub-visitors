const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getFile, putFile } = require('../../api/gh');

function requireAuth(req){
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if(!auth) return false;
  const parts = auth.split(' '); if(parts.length!==2) return false;
  try{ const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); return !!payload; }catch(e){ return false; }
}

module.exports = async (req, res) => {
  const page = req.query.page;
  if(!page) return res.status(400).end('Page required');
  const map = { index: 'index.html', about: 'about.html', services: 'services.html', portfolio: 'portfolio.html', blog: 'blog.html', marketing: 'marketing.html', contact: 'contact.html', terms: 'terms.html' };
  const file = map[page]; if(!file) return res.status(404).end('Unknown page');

    if(req.method === 'GET'){
    try{
      const { getRepoConfig } = require('../../api/utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){ const f = await getFile(file, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); return res.setHeader('Content-Type','text/html').send(f.content); }
      const fp = path.join(process.cwd(), file); if(!fs.existsSync(fp)) return res.status(404).end('Not found'); return res.setHeader('Content-Type','text/html').send(fs.readFileSync(fp,'utf8'));
    }catch(e){ console.error(e); return res.status(500).end(e.message); }
  }

    if(req.method === 'PUT'){
    if(!requireAuth(req)) return res.status(401).end('Unauthorized');
    let body = req.body;
    const content = (typeof body === 'string' && body.length>0) ? body : (body && body.content ? body.content : JSON.stringify(body));
    try{
      const { getRepoConfig } = require('../../api/utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){ await putFile(file, content, `Update ${file}`, null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); return res.json({ ok:true }); }
      const fp = path.join(process.cwd(), file); fs.writeFileSync(fp, content, 'utf8'); return res.json({ ok:true });
    }catch(e){ console.error(e); return res.status(500).end(e.message); }
  }

  return res.status(405).end('Method not allowed');
};
