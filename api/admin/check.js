const fs = require('fs');
const path = require('path');
const { getFile } = require('../../api/gh');

module.exports = async function (req, res) {
  try{
    let exists = false;
    const { getRepoConfig } = require('../utils');
    const repoOpts = await getRepoConfig(req) || {};
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{ const f = await getFile('data/admin.json', repoOpts); exists = !!(f && f.content); }catch(e){ exists = false; }
    } else {
      const fp = path.join(process.cwd(), 'data', 'admin.json'); exists = fs.existsSync(fp) && fs.readFileSync(fp,'utf8').trim().length>0;
    }
    return res.json({ exists });
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
