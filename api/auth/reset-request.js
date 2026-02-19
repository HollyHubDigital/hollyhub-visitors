const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
let nodemailer = null;
try{ nodemailer = require('nodemailer'); }catch(e){ nodemailer = null; }

const resetsJson = path.join(process.cwd(), 'data', 'password_resets.json');
const usersJson = path.join(process.cwd(), 'data', 'users.json');

if(!fs.existsSync(path.dirname(resetsJson))){ fs.mkdirSync(path.dirname(resetsJson), { recursive: true }); }
if(!fs.existsSync(resetsJson)) fs.writeFileSync(resetsJson, '[]');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    const { email } = req.body || {};
    if(!email) return res.status(400).json({ error: 'Missing email' });

    const users = fs.existsSync(usersJson) ? JSON.parse(fs.readFileSync(usersJson,'utf8')||'[]') : [];
    console.log('[reset-request] received email:', email, 'lowercased:', email.toLowerCase(), 'users with emails:', users.map(u=>u.email||'N/A').join(', '));
    const user = users.find(u=>u.email===email.toLowerCase());
    if(!user) { console.log('[reset-request] email not found'); return res.status(200).json({ ok:true, message: 'If the email exists, a reset link has been sent' }); }

    const token = crypto.randomBytes(24).toString('hex');
    const expires = Date.now() + (60*60*1000); // 1 hour
    const arr = JSON.parse(fs.readFileSync(resetsJson,'utf8')||'[]');
    arr.push({ token, email: user.email, expires });
    fs.writeFileSync(resetsJson, JSON.stringify(arr, null, 2), 'utf8');

    const origin = (req.protocol || 'http') + '://' + (req.get('host') || 'localhost:3000');
    const resetUrl = origin + '/reset.html?token=' + token;
    const isLocalHost = (req.get('host') && (req.get('host').includes('localhost') || req.get('host').includes('127.0.0.1')));
    const devResp = ((process.env.NODE_ENV !== 'production') || isLocalHost) ? { ok: true, resetUrl } : { ok: true };
    console.log('reset-request: NODE_ENV=', process.env.NODE_ENV, 'isLocalHost=', isLocalHost, 'devRespIncludesUrl=', !!devResp.resetUrl);
    const urlsLog = path.join(process.cwd(), 'data', 'reset-urls.log');

    // Try send email if SMTP configured
    if(nodemailer && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS){
      const createTransporter = () => nodemailer.createTransport({ host: process.env.SMTP_HOST, port: parseInt(process.env.SMTP_PORT||587,10), secure: (process.env.SMTP_SECURE==='1' || process.env.SMTP_SECURE==='true'), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
      const transporter = createTransporter();
      const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
      try{
        const info = await transporter.sendMail({ from: fromAddress, to: user.email, subject: 'Password reset', html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>` });
        try{ fs.appendFileSync(urlsLog, `[${new Date().toISOString()}] sent to ${user.email} from ${fromAddress}: ${resetUrl} -- info: ${JSON.stringify({ accepted: info.accepted, messageId: info.messageId, response: info.response })}\n`, 'utf8'); }catch(e){ console.error('Failed to write reset-urls.log', e); }
        return res.json(devResp);
      }catch(mailErr){
        console.error('Initial sendMail failed:', mailErr && mailErr.message ? mailErr.message : mailErr);
        // If Resend blocks unverified senders, retry using Resend's default onboarding sender for dev testing
        const msg = (mailErr && (mailErr.message || mailErr.response || '')) + '';
        if(msg.toLowerCase().includes('not verified') || msg.includes('550')){
          try{
            const fallbackFrom = process.env.RESEND_FALLBACK_FROM || 'onboarding@resend.dev';
            const retryTransporter = createTransporter();
            const info2 = await retryTransporter.sendMail({ from: fallbackFrom, to: user.email, subject: 'Password reset', html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>` });
            // Log the successful fallback send and return ok
            const entry = `[${new Date().toISOString()}] fallback-sent to ${user.email} from ${fallbackFrom}: ${resetUrl} -- info: ${JSON.stringify({ accepted: info2.accepted, messageId: info2.messageId, response: info2.response })}\n`;
            try{ fs.appendFileSync(urlsLog, entry, 'utf8'); }catch(e){ console.error('Failed to write reset-urls.log', e); }
            return res.json(devResp);
          }catch(retryErr){
            console.error('Fallback sendMail failed:', retryErr && retryErr.message ? retryErr.message : retryErr);
            // write reset url locally so developer can copy it for testing
            const urlsLog = path.join(process.cwd(), 'data', 'reset-urls.log');
            const entry = `[${new Date().toISOString()}] failed-send for ${user.email}: ${resetUrl} -- error: ${retryErr && retryErr.message ? retryErr.message : JSON.stringify(retryErr)}\n`;
            try{ fs.appendFileSync(urlsLog, entry, 'utf8'); }catch(e){ console.error('Failed to write reset-urls.log', e); }
            return res.json(devResp);
          }
        }
        // Other mail errors: log and fallback to local logging
        const urlsLog = path.join(process.cwd(), 'data', 'reset-urls.log');
        const entry = `[${new Date().toISOString()}] failed-send for ${user.email}: ${resetUrl} -- error: ${msg}\n`;
        try{ fs.appendFileSync(urlsLog, entry, 'utf8'); }catch(e){ console.error('Failed to write reset-urls.log', e); }
        return res.json(devResp);
      }
    }

    // If RESEND API key is provided, try sending via Resend HTTP API
    if(process.env.RESEND_API_KEY){
      try{
        const resendFrom = process.env.RESEND_FROM || process.env.SMTP_FROM || 'onboarding@resend.dev';
        const payload = {
          from: resendFrom,
          to: [user.email],
          subject: 'Password reset',
          html: `<p>Click to reset your password: <a href="${resetUrl}">${resetUrl}</a></p>`
        };
        const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` }, body: JSON.stringify(payload) });
        if(r.ok) return res.json(devResp);
        const text = await r.text();
        const urlsLog = path.join(process.cwd(), 'data', 'reset-urls.log');
        const entry = `[${new Date().toISOString()}] resend-failed for ${user.email}: ${resetUrl} -- response: ${text}\n`;
        try{ fs.appendFileSync(urlsLog, entry, 'utf8'); }catch(e){ console.error('Failed to write reset-urls.log', e); }
        return res.json(devResp);
      }catch(e){ console.error('Resend send failed', e); const urlsLog = path.join(process.cwd(), 'data', 'reset-urls.log'); try{ fs.appendFileSync(urlsLog, `[${new Date().toISOString()}] resend-exception for ${user.email}: ${resetUrl} -- ${e && e.message ? e.message : JSON.stringify(e)}\n`, 'utf8'); }catch(_){} return res.json(devResp); }
    }

    // No SMTP - log and return url for dev
    console.log('Password reset link for', user.email, resetUrl);
    try{ fs.appendFileSync(urlsLog, `[${new Date().toISOString()}] logged-reset-url for ${user.email}: ${resetUrl}\n`, 'utf8'); }catch(e){}
    return res.json(devResp);
  }catch(e){
    console.error(e);
    try{
      const logPath = path.join(process.cwd(), 'data', 'reset-errors.log');
      const entry = `[${new Date().toISOString()}] ${e && e.stack ? e.stack : JSON.stringify(e)}\n\n`;
      fs.appendFileSync(logPath, entry, 'utf8');
    }catch(err){ console.error('Failed to write reset error log', err); }
    return res.status(500).json({ error: e.message });
  }
};
