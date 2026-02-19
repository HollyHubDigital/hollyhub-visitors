const fs = require('fs');
const path = require('path');
const { getFile, putFile, deleteFile } = require('./gh');

module.exports = async (req, res) => {
  try{
    if(req.method === 'GET'){
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){ const f = await getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); return res.json(JSON.parse(f.content || '[]')); }
      const fp = path.join(process.cwd(), 'data', 'files.json'); if(!fs.existsSync(fp)) return res.json([]); return res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
    }

    if(req.method === 'DELETE'){
      const name = req.query.name;
      if(!name) return res.status(400).end('name required');
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){
        try{ await deleteFile(`public/uploads/${name}`, `Delete ${name}`, null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); }catch(e){}
        const f = await getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); let arr = JSON.parse(f.content||'[]'); arr = arr.filter(x=>x.filename!==name); await putFile('data/files.json', JSON.stringify(arr, null, 2), 'Update files.json', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); return res.json({ ok:true });
      } else {
        try{ const up = path.join(process.cwd(),'public','uploads', name); if(fs.existsSync(up)) fs.unlinkSync(up); const fp = path.join(process.cwd(),'data','files.json'); let arr = JSON.parse(fs.readFileSync(fp,'utf8')||'[]'); arr = arr.filter(x=>x.filename!==name); fs.writeFileSync(fp, JSON.stringify(arr, null, 2)); return res.json({ ok:true }); }catch(e){ return res.status(500).end(e.message); }
      }
    }
    return res.status(405).end('Method');
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
