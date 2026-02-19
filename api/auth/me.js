const jwt = require('jsonwebtoken');
const { getFile } = require('../gh');
const fs = require('fs');
const path = require('path');
const { getRepoConfig } = require('../utils');

function parseToken(req){
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if(!auth) return null;
  const parts = auth.split(' '); if(parts.length!==2) return null;
  try{ return jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); }catch(e){ return null; }
}

module.exports = async (req, res) => {
  try{
    if(req.method !== 'GET') return res.status(405).end('Method not allowed');
    const payload = parseToken(req);
    if(!payload) return res.status(401).json({ error: 'Unauthorized' });

    // look up user record to return profile data
    const repoOpts = await getRepoConfig(req) || {};
    let users = [];
    const dataPath = 'data/users.json';
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{ const f = await getFile(dataPath, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); users = JSON.parse(f.content||'[]'); }catch(e){ users = []; }
    } else {
      const fp = path.join(process.cwd(),'data','users.json'); if(fs.existsSync(fp)) users = JSON.parse(fs.readFileSync(fp,'utf8')||'[]');
    }

    const user = users.find(u=>u.id===payload.id || u.email===payload.email);
    if(!user) return res.status(404).json({ error: 'User not found' });
    return res.json({ id: user.id, email: user.email, fullname: user.fullname, createdAt: user.createdAt });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
};
