// checkout.js - client script to create a Paystack Checkout authorization via /api/checkout
document.addEventListener('DOMContentLoaded', () => {
  const payBtn = document.getElementById('payBtn');
  const tawkBtn = document.getElementById('tawkBtn');
  const amountInput = document.getElementById('amount');
  const descInput = document.getElementById('description');
  const msg = document.getElementById('checkoutMsg');

  // Send description to Tawk.to
  if (tawkBtn) {
    tawkBtn.addEventListener('click', async () => {
      const desc = descInput.value || 'No details provided';
      if (!desc.trim()) {
        msg.textContent = 'Please enter a description first.';
        return;
      }
      msg.textContent = 'Opening support chat...';
      tawkBtn.disabled = true;

      try {
        // Get user email from token or localStorage
        let userEmail = '';
        const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
        if (token) {
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            userEmail = decoded.email || decoded.user || '';
          } catch (e) {}
        }

        // Send visitor info to Tawk.to
        await pageUtils.sendToTawk(
          `Service Details: ${desc}`,
          userEmail || 'visitor@example.com',
          'Checkout Customer'
        );

        msg.textContent = '✓ Chat window opening... Your description: ' + desc;
        
        // Open Tawk widget immediately - visitor can see and send their message
        if (typeof Tawk_API !== 'undefined') {
          setTimeout(() => {
            if (Tawk_API.toggle) {
              Tawk_API.toggle();
              console.log('[Checkout] Tawk widget opened');
            }
          }, 300);
        }
      } catch (e) {
        console.error(e);
        msg.textContent = 'Error: ' + e.message;
      }
      tawkBtn.disabled = false;
    });
  }

  // Function to fetch and display estimated NGN amount
  const updateEstimate = async () => {
    const raw = parseFloat((amountInput.value || '').toString());
    if (isNaN(raw) || raw <= 0) {
      msg.textContent = '';
      return;
    }
    try {
      // Try primary API: exchangerate.host/rates (most reliable)
      let rate = null;
      try {
        const res = await fetch(`https://api.exchangerate.host/rates?base=USD&symbols=NGN`);
        const data = await res.json();
        if (data && data.rates && typeof data.rates.NGN === 'number') {
          rate = data.rates.NGN;
        }
      } catch (e1) {
        // Fallback to secondary API
        try {
          const res = await fetch(`https://api.exchangerate-api.com/v6/latest/USD`);
          const data = await res.json();
          if (data && data.rates && typeof data.rates.NGN === 'number') {
            rate = data.rates.NGN;
          }
        } catch (e2) {
          msg.textContent = '(Unable to fetch exchange rate)';
          return;
        }
      }
      
      if (rate) {
        const ngnAmount = (raw * rate).toFixed(2);
        msg.textContent = `≈ ₦${ngnAmount} NGN (1 USD = ₦${rate.toFixed(2)})`;
      }
    } catch (e) {
      msg.textContent = '(Exchange rate unavailable)';
    }
  };

  // preset amount buttons
  document.querySelectorAll('button[data-amount]').forEach(b=>{
    b.addEventListener('click', ()=>{
      const v = b.dataset.amount;
      amountInput.value = v;
      updateEstimate();
    });
  });

  // Update estimate when user types
  amountInput.addEventListener('input', updateEstimate);

  payBtn.addEventListener('click', async () => {
    msg.textContent = 'Starting payment...';
    const raw = parseFloat((amountInput.value || '').toString());
    if (isNaN(raw) || raw <= 0) { msg.textContent = 'Enter a valid amount.'; return; }
    msg.textContent = `Processing $${raw.toFixed(2)} USD...`;
    const desc = descInput.value ? `${descInput.value} ($${raw.toFixed(2)})` : `Website payment ($${raw.toFixed(2)})`;
    const payload = { amount: raw, currency: 'USD', description: desc, cancelUrl: `${window.location.origin}/cancel.html` };

    try {
      payBtn.disabled = true;
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const r = await fetch('/api/checkout', { method: 'POST', headers, body: JSON.stringify(payload) });
      if (!r.ok) { const t = await r.json().catch(() => null); throw new Error(t && t.error ? t.error : await r.text()); }
      const j = await r.json();

      if (!j.accessCode || !j.email || j.amount === undefined) { throw new Error('Invalid response from payment server'); }

      // If Paystack inline library is available, open embedded modal; otherwise redirect
      if (typeof PaystackPop !== 'undefined' && typeof PaystackPop.setup === 'function') {
        msg.textContent = 'Opening Paystack payment modal...';
        console.log(`[Checkout] Opening embedded Paystack payment modal for ${j.email}`);
        try {
          const handler = PaystackPop.setup({
            key: j.paystackPublicKey || '',
            email: j.email,
            amount: j.amount,
            ref: j.reference,
            onClose: function () {
              msg.textContent = 'Payment cancelled. Redirecting...';
              setTimeout(() => { window.location.href = '/cancel.html'; }, 1500);
            },
            onSuccess: function (response) {
              msg.textContent = `✓ Payment successful! Reference: ${response.reference}. Redirecting...`;
              setTimeout(() => { window.location.href = '/success.html'; }, 1500);
            }
          });
          handler.openIframe();
        } catch (e) {
          console.error('[Checkout] PaystackPop error:', e);
          msg.textContent = 'Error: Paystack modal failed to load. ' + e.message;
          payBtn.disabled = false;
        }
      } else {
        // Fallback to hosted checkout redirect
        msg.textContent = 'Opening Paystack checkout...';
        window.location.href = j.url || `https://checkout.paystack.com/${j.accessCode}`;
      }
      return;
    } catch (e) {
      console.error(e);
      msg.textContent = 'Payment failed: ' + e.message;
      payBtn.disabled = false;
    }
  });
  // If a service query param is provided, prefill description
  try{
    const qs = new URLSearchParams(window.location.search);
    const service = qs.get('service');
    if(service){
      descInput.value = service.replace(/[-_]/g,' ');
      if(!amountInput.value) amountInput.value = '';
    }
  }catch(e){/*ignore*/}
});
