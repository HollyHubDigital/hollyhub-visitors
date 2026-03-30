// Flutterwave Payment Initialization Endpoint
// Creates a unique transaction reference and returns it for frontend payment processing
const crypto = require('crypto');

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') return res.status(405).end('Method not allowed');
    
    // Require auth
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (!auth) return res.status(401).json({ error: 'Unauthorized' });
    
    const parts = auth.split(' ');
    if (parts.length !== 2) return res.status(401).json({ error: 'Unauthorized' });
    
    const jwt = require('jsonwebtoken');
    let payload;
    try {
      payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret');
    } catch (e) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const body = req.body || {};
    const amount = Number(body.amount) || 0;
    const currency = (body.currency || 'USD').toUpperCase();
    const email = body.email || payload.email || '';
    const name = body.name || 'Customer';
    const description = body.description || 'Payment';
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }
    
    // Get Flutterwave keys from environment
    let flutterwaveSecret = process.env.FLUTTERWAVE_SECRET_KEY;
    
    if (!flutterwaveSecret) {
      try {
        const fs = require('fs');
        const path = require('path');
        const cfgPath = path.join(process.cwd(), 'data', 'apps-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
          if (cfg && cfg.enabled && cfg.enabled.flutterwave) {
            flutterwaveSecret = cfg.enabled.flutterwave.secretKey;
          }
        }
      } catch (e) {
        console.warn('Failed to read apps-config for Flutterwave secret', e && e.message);
      }
    }
    
    if (!flutterwaveSecret) {
      return res.status(501).json({ error: 'Flutterwave not configured. Set FLUTTERWAVE_SECRET_KEY environment variable.' });
    }
    
    // Generate unique transaction reference (tx_ref)
    // Format: timestamp-random-userId for uniqueness
    const timestamp = Date.now();
    const randomStr = crypto.randomBytes(4).toString('hex');
    const userId = payload.id || 'user';
    const tx_ref = `tx_${timestamp}_${randomStr}`;
    
    console.log(`[Flutterwave] Creating payment: tx_ref=${tx_ref}, amount=${amount}, currency=${currency}, email=${email}`);
    
    // Return transaction reference and details to frontend
    // Frontend will use this to initialize FlutterwaveCheckout
    return res.json({
      status: 'success',
      tx_ref: tx_ref,
      amount: amount,
      currency: currency,
      email: email,
      name: name,
      description: description,
      timestamp: timestamp
    });
    
  } catch (e) {
    console.error('[Flutterwave create] Error:', e);
    return res.status(500).json({ error: e.message });
  }
};
