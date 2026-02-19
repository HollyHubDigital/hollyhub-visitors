const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed');

    const secret = process.env.PAYSTACK_SECRET;
    if (!secret) return res.status(501).send('Paystack not configured');

    const signature = req.headers['x-paystack-signature'] || req.headers['x-paystack-signature'.toLowerCase()];
    const raw = req.rawBody || (req.body ? JSON.stringify(req.body) : '');
    const hash = crypto.createHmac('sha512', secret).update(raw).digest('hex');

    if (!signature || signature !== hash) {
      console.warn('Paystack webhook signature mismatch');
      return res.status(401).send('Invalid signature');
    }

    const payload = req.body || {};
    // Persist raw event for inspection
    const dataDir = path.join(process.cwd(), 'data');
    const eventsPath = path.join(dataDir, 'paystack_events.json');
    try{
      if(!fs.existsSync(eventsPath)) fs.writeFileSync(eventsPath, '[]', 'utf8');
      const arr = JSON.parse(fs.readFileSync(eventsPath,'utf8') || '[]');
      arr.push({ receivedAt: new Date().toISOString(), event: payload.event || null, data: payload.data || payload });
      fs.writeFileSync(eventsPath, JSON.stringify(arr, null, 2), 'utf8');
    }catch(e){ console.error('Failed to persist webhook event', e); }

    // Basic handling: respond 200 quickly. You can extend to update orders, send emails, etc.
    return res.json({ ok: true });
  } catch (e) {
    console.error('Webhook handler error', e);
    return res.status(500).send('Server error');
  }
};
