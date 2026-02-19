const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const { username, email } = req.body || {};
    if(!username && !email) return res.status(400).json({ error: 'Missing identifier' });

    const fp = path.join(process.cwd(),'data','users.json');
    if(!fs.existsSync(fp)) return res.status(404).json({ error: 'No users' });
    const arr = JSON.parse(fs.readFileSync(fp,'utf8')||'[]');
    const user = arr.find(u => (username && u.username===username) || (email && u.email===email));
    if(!user) return res.status(404).json({ error: 'User not found' });

    const secret = process.env.PASSWORD_RESET_SECRET || process.env.JWT_SECRET || 'devsecret';
    const token = jwt.sign({ id: user.id || user.email || user.username, ts: Date.now() }, secret, { expiresIn: '1h' });

    // In production, send token by email. For local dev return it so admin can use it.
    return res.json({ ok: true, resetToken: token });
  }catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
};
