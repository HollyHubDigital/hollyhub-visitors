// Serverless endpoint to create a Paystack Payment authorization (if configured)
const url = require('url');

module.exports = async (req, res) => {
  try{
    if(req.method !== 'POST') return res.status(405).end('Method not allowed');
    // require auth
    const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
    if(!auth) return res.status(401).json({ error: 'Unauthorized' });
    const parts = auth.split(' '); if(parts.length!==2) return res.status(401).json({ error: 'Unauthorized' });
    const jwt = require('jsonwebtoken');
    let payload;
    try{ payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); }catch(e){ return res.status(401).json({ error: 'Unauthorized' }); }
    const body = req.body || {};
    const amount = Number(body.amount) || 0;
    const currency = (body.currency || 'NGN').toUpperCase();
    const description = body.description || 'Payment';
    const success = body.successUrl || (req.headers.origin ? `${req.headers.origin}/success.html` : '/success.html');
    const cancel = body.cancelUrl || (req.headers.origin ? `${req.headers.origin}/cancel.html` : '/cancel.html');

    // Allow configuration via environment or stored admin apps config (data/apps-config.json)
    let paystackSecret = process.env.PAYSTACK_SECRET;
    let paystackPublicKey = process.env.PAYSTACK_PUBLIC_KEY;
    if (!paystackSecret) {
      try {
        const fs = require('fs');
        const path = require('path');
        const cfgPath = path.join(process.cwd(), 'data', 'apps-config.json');
        if (fs.existsSync(cfgPath)) {
          const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
          if (cfg && cfg.enabled && cfg.enabled.paystack) {
            paystackSecret = cfg.enabled.paystack.secretKey;
            paystackPublicKey = cfg.enabled.paystack.publicKey;
          }
        }
      } catch (e) {
        console.warn('Failed to read apps-config for Paystack secret', e && e.message);
      }
    }
    if (!paystackSecret) return res.status(501).json({ error: 'Paystack not configured. Set PAYSTACK_SECRET or configure Paystack secret in data/apps-config.json.' });

    // Convert currency to NGN if needed (Paystack expects NGN amounts for NGN account)
    let amountInNgn = amount;
    if (currency !== 'NGN') {
      const fetch = (await import('node-fetch')).default;
      
      let convResult = null;
      
      // Try API 1: exchangerate.host/rates (most reliable free API)
      try {
        console.log(`[Checkout] Fetching live exchange rate for ${currency} to NGN...`);
        const convUrl = `https://api.exchangerate.host/rates?base=${currency}&symbols=NGN`;
        const convResp = await fetch(convUrl);
        if (!convResp.ok) throw new Error(`API returned ${convResp.status}`);
        const convJson = await convResp.json();
        if (convJson && convJson.rates && typeof convJson.rates.NGN === 'number') {
          const rate = convJson.rates.NGN;
          convResult = amount * rate;
          console.log(`[Checkout] ✓ Live rate from exchangerate.host: 1 ${currency} = ₦${rate.toFixed(2)} → ${amount} ${currency} = ₦${convResult.toFixed(2)}`);
        }
      } catch (e) {
        console.warn(`[Checkout] exchangerate.host failed (${e.message}) — trying backup API...`);
      }
      
      // Try API 2: exchangerate-api.com with v6 public endpoint (no key required)
      if (!convResult) {
        try {
          const convUrl = `https://api.exchangerate-api.com/v6/latest/${currency}`;
          const convResp = await fetch(convUrl);
          if (!convResp.ok) throw new Error(`API returned ${convResp.status}`);
          const convJson = await convResp.json();
          if (convJson && convJson.rates && typeof convJson.rates.NGN === 'number') {
            const rate = convJson.rates.NGN;
            convResult = amount * rate;
            console.log(`[Checkout] ✓ Live rate from exchangerate-api: 1 ${currency} = ₦${rate.toFixed(2)} → ${amount} ${currency} = ₦${convResult.toFixed(2)}`);
          }
        } catch (e) {
          console.warn(`[Checkout] exchangerate-api.com failed (${e.message})`);
        }
      }
      
      // Use result if successful
      if (convResult) {
        amountInNgn = convResult;
      } else {
        // Only use hardcoded fallback if BOTH APIs fail
        console.error(`[Checkout] ⚠ Both exchange rate APIs failed! Falling back to hardcoded rate of 1500 NGN per USD.`);
        amountInNgn = amount * 1500; // fallback: assume 1500 NGN per USD (adjust as needed)
      }
    }

    // Use fetch to call Paystack API
    const fetch = (await import('node-fetch')).default;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: payload.email,
        amount: Math.round((Number(amountInNgn) || 0) * 100), // Paystack uses kobo (1 NGN = 100 kobo)
        metadata: {
          userId: payload.id || '',
          description: description
        }
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      return res.status(paystackResponse.status).json({ error: paystackData.message || 'Payment initialization failed' });
    }

    // Return both authorization URL and details needed for embedded payment
    return res.json({ 
      url: paystackData.data.authorization_url,
      accessCode: paystackData.data.access_code,
      reference: paystackData.data.reference,
      email: payload.email,
      amount: Math.round((Number(amountInNgn) || 0) * 100), // Paystack uses kobo
      paystackPublicKey: paystackPublicKey || null
    });
  }catch(e){ console.error(e); return res.status(500).json({ error: e.message }); }
};
