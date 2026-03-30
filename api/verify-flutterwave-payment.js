// Flutterwave Payment Verification Endpoint
// Verifies that a payment was successful by calling Flutterwave's verify API
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
    const transactionId = body.transaction_id;
    const txRef = body.tx_ref;
    
    if (!transactionId || !txRef) {
      return res.status(400).json({ error: 'Missing transaction_id or tx_ref' });
    }
    
    // Get Flutterwave secret key from environment
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
      return res.status(501).json({ error: 'Flutterwave not configured.' });
    }
    
    console.log(`[Flutterwave] Verifying payment: transaction_id=${transactionId}, tx_ref=${txRef}`);
    
    // Call Flutterwave verify endpoint
    const fetch = (await import('node-fetch')).default;
    
    try {
      const verifyUrl = `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`;
      
      const verifyResponse = await fetch(verifyUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${flutterwaveSecret}`,
          'Content-Type': 'application/json'
        }
      });
      
      const verifyData = await verifyResponse.json();
      
      console.log(`[Flutterwave] Verify response status: ${verifyResponse.status}`, verifyData);
      
      // Check if payment was successful
      if (verifyData.status === 'success' && verifyData.data) {
        const txData = verifyData.data;
        
        // Verify the transaction reference matches
        if (txData.tx_ref !== txRef) {
          console.warn(`[Flutterwave] tx_ref mismatch: expected ${txRef}, got ${txData.tx_ref}`);
          return res.status(400).json({ error: 'Transaction reference mismatch' });
        }
        
        // Verify payment status
        if (txData.status === 'successful') {
          console.log(`[Flutterwave] ✓ Payment verified: amount=${txData.amount}, currency=${txData.currency}, customer=${txData.customer.email}`);
          
          return res.json({
            status: 'success',
            message: 'Payment verified',
            transactionId: txData.id,
            txRef: txData.tx_ref,
            amount: txData.amount,
            currency: txData.currency,
            email: txData.customer?.email,
            name: txData.customer?.name,
            paymentMethod: txData.payment_method,
            timestamp: txData.created_at
          });
        } else {
          console.log(`[Flutterwave] Payment not successful: status=${txData.status}`);
          return res.status(400).json({ 
            error: 'Payment not successful',
            status: txData.status
          });
        }
      } else {
        console.error(`[Flutterwave] Verification failed:`, verifyData);
        const errorMsg = verifyData.message || 'Payment verification failed';
        return res.status(400).json({ error: errorMsg });
      }
    } catch (fetchError) {
      console.error('[Flutterwave] Fetch error during verification:', fetchError);
      return res.status(500).json({ error: 'Failed to verify payment with Flutterwave API' });
    }
    
  } catch (e) {
    console.error('[Flutterwave verify] Error:', e);
    return res.status(500).json({ error: e.message });
  }
};
