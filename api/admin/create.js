const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { putFile } = require('../../api/gh');

module.exports = async function (req, res) {
  try{
    if (req.method !== 'POST') return res.status(405).end('Method not allowed');
    const body = req.body || {};
    const setupToken = process.env.SETUP_TOKEN || '';
    if(setupToken && body.setupToken !== setupToken) return res.status(401).end('Invalid setup token');
    const username = body.username || 'admin';
    const password = body.password;
    if(!password) return res.status(400).end('Password required');
    const hash = bcrypt.hashSync(password, 10);

    // write into data/users.json (unified admin storage)
    const usersFp = path.join(process.cwd(), 'data', 'users.json');
    const userObj = { username, passwordHash: hash, createdAt: new Date().toISOString() };

    // support committing to a different repo via settings or request override
    const { getRepoConfig } = require('../utils');
    const repoOpts = await getRepoConfig(req) || {};
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      // try to read existing users.json in repo (via putFile we overwrite)
      let usersArr = [];
      try{ const f = await require('../../api/gh').getFile('data/users.json', repoOpts); usersArr = JSON.parse(f.content); }catch(_){ usersArr = []; }
      usersArr.unshift(userObj);
      await putFile('data/users.json', JSON.stringify(usersArr, null, 2), 'Create admin user', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
      return res.json({ ok: true });
    } else {
      let usersArr = [];
      if(fs.existsSync(usersFp)){
        try{ usersArr = JSON.parse(fs.readFileSync(usersFp,'utf8')) || []; }catch(_){ usersArr = []; }
      }
      usersArr.unshift(userObj);
      fs.writeFileSync(usersFp, JSON.stringify(usersArr, null, 2), 'utf8');
      return res.json({ ok: true });
    }
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
