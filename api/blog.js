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
      if(process.env.GITHUB_TOKEN){ const f = await getFile('data/blog.json'); return res.json(JSON.parse(f.content||'[]')); }
      const fp = path.join(process.cwd(),'data','blog.json'); if(!fs.existsSync(fp)) return res.json([]); return res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
    }

      if(req.method === 'GET'){
        const { getRepoConfig } = require('./utils');
        const repoOpts = await getRepoConfig(req) || {};
        if(repoOpts && repoOpts.owner && repoOpts.repo){ const f = await getFile('data/blog.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); return res.json(JSON.parse(f.content||'[]')); }
        const fp = path.join(process.cwd(),'data','blog.json'); if(!fs.existsSync(fp)) return res.json([]); return res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
      }

      if(req.method === 'POST'){
        if(!requireAuth(req)) return res.status(401).end('Unauthorized');
        const { title, category, image, content } = req.body || {};
        if(!title || !content) return res.status(400).end('Missing title or content');
        const { getRepoConfig } = require('./utils');
        const repoOpts = await getRepoConfig(req) || {};
        let posts = [];
        if(repoOpts && repoOpts.owner && repoOpts.repo){ posts = JSON.parse((await getFile('data/blog.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token })).content || '[]'); }
        else { posts = JSON.parse(fs.readFileSync(path.join(process.cwd(),'data','blog.json'),'utf8')||'[]'); }
        const post = { id: Date.now().toString(), title, category: category||'', image: image||'', content, createdAt: new Date().toISOString() };
        posts.unshift(post);
        const postsJson = JSON.stringify(posts, null, 2);
        if(repoOpts && repoOpts.owner && repoOpts.repo){ await putFile('data/blog.json', postsJson, 'Add blog post', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); }
        else { fs.writeFileSync(path.join(process.cwd(),'data','blog.json'), postsJson, 'utf8'); }
        // optionally regenerate blog.html listing for visitor site
        const listing = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Blog - Holly</title><link rel="stylesheet" href="styles.css"></head><body><header class="sticky-header"><div class="header-container"><a href="index.html" class="logo-link">HOLLYDEV</a></div></header><main class="container" style="padding:2rem"><h1>Blog</h1><div class="grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">${posts.map(p=>`<article style="background:#111;padding:1rem;border-radius:8px"><h3>${p.title}</h3><p style="opacity:0.8">${p.category} • ${new Date(p.createdAt).toLocaleDateString()}</p><p style="opacity:0.85">${(p.content||'').slice(0,180)}...</p></article>`).join('')}</div></main></body></html>`;
        if(repoOpts && repoOpts.owner && repoOpts.repo){ await putFile('blog.html', listing, 'Regenerate blog listing', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); }
        else { fs.writeFileSync(path.join(process.cwd(),'blog.html'), listing, 'utf8'); }
        return res.json(post);
      }
