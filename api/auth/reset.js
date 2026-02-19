const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const resetsJson = path.join(process.cwd(), 'data', 'password_resets.json');
const usersJson = path.join(process.cwd(), 'data', 'users.json');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const { token, newPassword } = req.body || {};
    if(!token || !newPassword) return res.status(400).json({ error: 'Missing token or newPassword' });

    const resets = fs.existsSync(resetsJson) ? JSON.parse(fs.readFileSync(resetsJson,'utf8')||'[]') : [];
    const recIdx = resets.findIndex(r=>r.token===token && r.expires && r.expires > Date.now());
    if(recIdx===-1) return res.status(400).json({ error: 'Invalid or expired token' });
    const rec = resets[recIdx];

    const users = fs.existsSync(usersJson) ? JSON.parse(fs.readFileSync(usersJson,'utf8')||'[]') : [];
    const user = users.find(u=>u.email===rec.email);
    if(!user) return res.status(404).json({ error: 'User not found' });

    user.passwordHash = bcrypt.hashSync(newPassword, 10);
    // remove reset record
    resets.splice(recIdx,1);
    fs.writeFileSync(resetsJson, JSON.stringify(resets, null, 2), 'utf8');
    fs.writeFileSync(usersJson, JSON.stringify(users, null, 2), 'utf8');

    return res.json({ ok:true });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
};
