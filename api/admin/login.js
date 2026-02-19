const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getFile } = require('../../api/gh');

module.exports = async function (req, res) {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const { username, password } = req.body || {};
    if(!username || !password) return res.status(400).end('Missing');

    // Try primary unified storage: data/users.json
    const { getRepoConfig } = require('../utils');
    const repoOpts = await getRepoConfig(req) || {};
    let stored = null;

    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        const f = await getFile('data/users.json', repoOpts);
        const arr = JSON.parse(f.content || '[]');
        if (Array.isArray(arr) && arr.length>0) stored = arr.find(u=>u && u.username) || arr[0];
      }catch(_){ stored = null; }
    } else {
      const usersFp = path.join(process.cwd(), 'data', 'users.json');
      if(fs.existsSync(usersFp)){
        try{
          const arr = JSON.parse(fs.readFileSync(usersFp,'utf8')) || [];
          if (Array.isArray(arr) && arr.length>0) stored = arr.find(u=>u && u.username) || arr[0];
        }catch(_){ stored = null; }
      }
    }

    // Fallback for legacy data/admin.json (older handler)
    if(!stored){
      if(repoOpts && repoOpts.owner && repoOpts.repo){
        try{ const f = await getFile('data/admin.json', repoOpts); stored = JSON.parse(f.content || '{}'); }catch(_){ stored = null; }
      } else {
        const fp = path.join(process.cwd(), 'data', 'admin.json');
        if(fs.existsSync(fp)){
          try{ stored = JSON.parse(fs.readFileSync(fp,'utf8') || '{}'); }catch(_){ stored = null; }
        }
      }
    }

    if(!stored) return res.status(500).end('Admin config missing');

    // support different field names: passwordHash or hash
    const storedUsername = stored.username || stored.user || stored.email || '';
    const storedHash = stored.passwordHash || stored.hash || stored.password || '';
    const ok = bcrypt.compareSync(password || '', storedHash || '');
    if(storedUsername !== username || !ok) return res.status(401).end('Unauthorized');
    if(!ok) return res.status(401).end('Unauthorized');

    const token = jwt.sign({ user: username }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '12h' });
    return res.json({ token });
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
