const fs = require('fs');
const path = require('path');
const { getFile, putFile, deleteFile } = require('./gh');

module.exports = async (req, res) => {
  try{
    if(req.method === 'GET'){
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){ 
        const f = await getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        return res.json(JSON.parse(f.content || '[]')); 
      }
      const fp = path.join(process.cwd(), 'data', 'files.json'); 
      if(!fs.existsSync(fp)) return res.json([]); 
      return res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
    }

    if(req.method === 'DELETE'){
      const name = req.query.name;
      if(!name) return res.status(400).end('name required');
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req);
      
      if(repoOpts && repoOpts.owner && repoOpts.repo){
        try{ 
          await deleteFile(`public/uploads/${name}`, `Delete ${name}`, null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        }catch(e){ console.warn('[files] Delete file failed:', e.message); }
        
        const f = await getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        let arr = JSON.parse(f.content||'[]'); 
        arr = arr.filter(x=>x.filename!==name); 
        await putFile('data/files.json', JSON.stringify(arr, null, 2), 'Update files.json', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        return res.json({ ok:true });
      } else {
        return res.status(500).json({error: 'GitHub repository not configured'});
      }
    }
    return res.status(405).end('Method');
  }catch(e){ console.error('[files]', e); res.status(500).end(e.message); }
};
