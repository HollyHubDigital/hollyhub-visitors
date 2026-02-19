const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const { token, newPassword } = req.body || {};
    if(!token || !newPassword) return res.status(400).json({ error: 'Missing token or password' });

    const secret = process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'devsecret';
    let payload = null;
    try{ payload = jwt.verify(token, secret); }catch(e){ return res.status(400).json({ error: 'Invalid or expired token' }); }

    const fp = path.join(process.cwd(),'data','users.json');
    if(!fs.existsSync(fp)) return res.status(404).json({ error: 'No users' });
    const arr = JSON.parse(fs.readFileSync(fp,'utf8')||'[]');
    const id = payload.id;
    const userIdx = arr.findIndex(u => u.id === id || u.email === id || u.username === id);
    if(userIdx === -1) return res.status(404).json({ error: 'User not found' });

    const hash = bcrypt.hashSync(newPassword, 10);
    arr[userIdx].passwordHash = hash;
    fs.writeFileSync(fp, JSON.stringify(arr, null, 2), 'utf8');

    return res.json({ ok: true });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
};
