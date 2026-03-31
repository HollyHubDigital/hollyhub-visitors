// checkout.js - client script to create a Paystack or Flutterwave Checkout authorization
document.addEventListener('DOMContentLoaded', () => {
  const payBtn = document.getElementById('payBtn');
  const flutterwaveBtn = document.getElementById('flutterwaveBtn');
  const amountInput = document.getElementById('amount');
  const descInput = document.getElementById('description');
  const msg = document.getElementById('checkoutMsg');

  // Flutterwave public key (from environment or fallback)
  const FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK-c9e4ab2f265c4998a14d4ba9f2e3e812-X';

  // Flutterwave payment handler
  if (flutterwaveBtn) {
    flutterwaveBtn.addEventListener('click', async () => {
      msg.textContent = 'Starting Flutterwave payment...';
      const raw = parseFloat((amountInput.value || '').toString());
      if (isNaN(raw) || raw <= 0) { msg.textContent = 'Enter a valid amount.'; return; }
      
      const desc = descInput.value ? `${descInput.value} ($${raw.toFixed(2)})` : `Website payment ($${raw.toFixed(2)})`;

      try {
        flutterwaveBtn.disabled = true;
        const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
        
        // Get user email and name from token if available
        let userEmail = 'visitor@example.com';
        let userName = 'Customer';
        if (token) {
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            userEmail = decoded.email || decoded.user || userEmail;
            userName = decoded.name || 'Customer';
          } catch (e) {}
        }

        // Call backend to create Flutterwave payment reference
        const headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;
        
        const r = await fetch('/api/create-flutterwave-payment', { 
          method: 'POST', 
          headers, 
          body: JSON.stringify({
            amount: raw, // Send as dollars, not cents
            email: userEmail,
            name: userName,
            description: desc,
            currency: 'USD'
          })
        });

        if (!r.ok) { 
          const t = await r.json().catch(() => null);
          throw new Error(t && t.error ? t.error : await r.text());
        }

        const data = await r.json();
        if (!data.tx_ref || !data.amount) {
          throw new Error('Invalid response from payment server');
        }

        msg.textContent = 'Opening Flutterwave payment...';
        console.log('[Checkout] Opening Flutterwave for', userEmail);

        // Open Flutterwave checkout
        if (typeof FlutterwaveCheckout === 'function') {
          FlutterwaveCheckout({
            public_key: FLUTTERWAVE_PUBLIC_KEY,
            tx_ref: data.tx_ref,
            amount: data.amount,
            currency: data.currency || 'USD',
            payment_options: 'card, banktransfer, ussd, mobilemoney, paypal',
            customer: {
              email: data.email,
              name: data.name,
              phone_number: data.phone || ''
            },
            customizations: {
              title: 'HollyHub',
              description: data.description,
              logo: 'https://cdn.jsdelivr.net/gh/HollyHubDigital/hollyhub-visitors@main/public/assets/hollyhub.jpg'
            },
            callback: function(response) {
              console.log('Flutterwave payment response:', response);
              if (response.status === 'successful') {
                msg.textContent = '✓ Payment successful! Verifying...';
                verifyFlutterwavePayment(response.transaction_id, response.tx_ref);
              } else {
                msg.textContent = 'Payment failed. Please try again.';
                flutterwaveBtn.disabled = false;
              }
            },
            onclose: function() {
              console.log('Flutterwave payment modal closed');
              msg.textContent = 'Payment cancelled. Redirecting...';
              flutterwaveBtn.disabled = false;
              setTimeout(() => { window.location.href = '/cancel.html'; }, 1500);
            }
          });
        } else {
          throw new Error('Flutterwave library not loaded');
        }
      } catch (e) {
        console.error(e);
        msg.textContent = 'Flutterwave payment failed: ' + e.message;
        flutterwaveBtn.disabled = false;
      }
    });
  }

  // Helper function to verify Flutterwave payment on backend
  async function verifyFlutterwavePayment(transactionId, txRef) {
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = 'Bearer ' + token;

      const r = await fetch('/api/verify-flutterwave-payment', {
        method: 'POST',
        headers,
        body: JSON.stringify({ transaction_id: transactionId, tx_ref: txRef })
      });

      const result = await r.json();
      
      if (result.status === 'success') {
        msg.textContent = '✓ Payment verified! Redirecting...';
        setTimeout(() => { window.location.href = '/success.html'; }, 1500);
      } else {
        msg.textContent = 'Payment verification failed. Please contact support.';
        flutterwaveBtn.disabled = false;
      }
    } catch (e) {
      console.error('Verification error:', e);
      msg.textContent = 'Verification error: ' + e.message;
      flutterwaveBtn.disabled = false;
    }
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
      if (j.paystackPublicKey && typeof PaystackPop !== 'undefined' && typeof PaystackPop.setup === 'function') {
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

  // Squad Payment Function
  function SquadPay(email, amountInKobo, currency = "NGN") {
    // Check if squad is loaded, if not wait a bit
    const checkSquad = () => {
      if (typeof squad === 'undefined') {
        console.log('Squad not ready, waiting...');
        setTimeout(checkSquad, 500);
        return;
      }

      const squadInstance = new squad({
        onClose: () => {
          console.log("Widget closed");
          msg.textContent = 'Payment cancelled.';
          squadBtn.disabled = false;
        },
        onLoad: () => console.log("Widget loaded successfully"),
        onSuccess: () => {
          console.log('Payment successful');
          msg.textContent = '✓ Payment successful! Redirecting...';
          setTimeout(() => { window.location.href = '/success.html'; }, 1500);
        },
        key: "YOUR_LIVE_SQUAD_KEY_HERE", // Replace with your live key from Squad Dashboard
        email: email,
        amount: amountInKobo,
        currency_code: currency
      });
      squadInstance.setup();
      squadInstance.open();
    };

    // Start checking
    checkSquad();
  }

  // Squad button event listener
  const squadBtn = document.getElementById('squadBtn');
  if (squadBtn) {
    squadBtn.addEventListener('click', async () => {
      msg.textContent = 'Starting GTCO payment...';
      const raw = parseFloat((amountInput.value || '').toString());
      if (isNaN(raw) || raw <= 0) { 
        msg.textContent = 'Enter a valid amount.'; 
        return; 
      }
      
      try {
        squadBtn.disabled = true;
        
        // Get user email
        let userEmail = 'visitor@example.com';
        const token = localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token') || '';
        if (token) {
          try {
            const decoded = JSON.parse(atob(token.split('.')[1]));
            userEmail = decoded.email || decoded.user || userEmail;
          } catch (e) {}
        }
        
        // Convert USD to NGN for Squad
        let exchangeRate = 1500; // Default fallback rate
        try {
          const res = await fetch(`https://api.exchangerate.host/rates?base=USD&symbols=NGN`);
          const data = await res.json();
          if (data && data.rates && typeof data.rates.NGN === 'number') {
            exchangeRate = data.rates.NGN;
          }
        } catch (e) {
          console.log('Using default exchange rate');
        }
        
        const ngnAmount = raw * exchangeRate;
        const amountInKobo = Math.round(ngnAmount * 100); // Convert to kobo
        
        msg.textContent = `Processing ≈ ₦${ngnAmount.toFixed(2)} NGN...`;
        
        SquadPay(userEmail, amountInKobo, "NGN");
        
      } catch (e) {
        console.error('Squad payment error:', e);
        msg.textContent = 'GTCO payment failed: ' + e.message;
        squadBtn.disabled = false;
      }
    });
  }
});
