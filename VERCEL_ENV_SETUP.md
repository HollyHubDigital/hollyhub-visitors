# Vercel Environment Variables Setup Guide

This guide lists **all API keys and secrets** in your project and how to configure them as Vercel environment variables. This ensures **sensitive credentials are NOT exposed in your frontend** and are kept secure on the backend.

---

## 🔐 Public Keys (Safe for Frontend)

These can be stored in `apps-config.json` and will be injected into visitor pages:

### 1. **Google Analytics**
- **Key Name:** `GOOGLE_ANALYTICS_ID`
- **Value:** `G-N5NZW9GSTP` (from your apps-config.json)
- **Used In:** Frontend tracking (visitor pages)
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: GOOGLE_ANALYTICS_ID
  Value: G-N5NZW9GSTP
  ```

### 2. **Paystack Public Key**
- **Key Name:** `PAYSTACK_PUBLIC_KEY`
- **Value:** `pk_live_20668bcbad0f1ac082aa14c7e33e86e965e52987`
- **Used In:** Frontend payment modal (`checkout.js`)
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: PAYSTACK_PUBLIC_KEY
  Value: pk_live_20668bcbad0f1ac082aa14c7e33e86e965e52987
  ```

### 3. **Mixpanel Token**
- **Key Name:** `MIXPANEL_TOKEN`
- **Value:** `0e82a6caff9478ddcddf00224b32cbc1`
- **Used In:** Frontend analytics tracking
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: MIXPANEL_TOKEN
  Value: 0e82a6caff9478ddcddf00224b32cbc1
  ```

### 4. **Klaviyo Public Key**
- **Key Name:** `KLAVIYO_PUBLIC_KEY`
- **Value:** `pk_73bd5193d7741d0f76085958775d84408c`
- **Used In:** Frontend email marketing widget
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: KLAVIYO_PUBLIC_KEY
  Value: pk_73bd5193d7741d0f76085958775d84408c
  ```

### 5. **Tawk.to Property ID**
- **Key Name:** `TAWKTO_PROPERTY_ID`
- **Value:** `6992799f3a5ba51c3b88d08c/1jhi2m6n0`
- **Used In:** Frontend customer support chat
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: TAWKTO_PROPERTY_ID
  Value: 6992799f3a5ba51c3b88d08c/1jhi2m6n0
  ```

### 6. **Privy Site ID**
- **Key Name:** `PRIVY_SITE_ID`
- **Value:** `8D48E51CE4E017165773A3CA`
- **Used In:** Frontend popup/email capture
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: PRIVY_SITE_ID
  Value: 8D48E51CE4E017165773A3CA
  ```

### 7. **Yotpo API Key**
- **Key Name:** `YOTPO_API_KEY`
- **Value:** `Xw19ihiKlAgx8uTlE0gGspxMuu3kbT3MksJYjr7p`
- **Used In:** Frontend email/SMS marketing
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: YOTPO_API_KEY
  Value: Xw19ihiKlAgx8uTlE0gGspxMuu3kbT3MksJYjr7p
  ```

### 8. **Yotpo Account ID**
- **Key Name:** `YOTPO_ACCOUNT_ID`
- **Value:** `1287298`
- **Used In:** Frontend email/SMS (optional)
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: YOTPO_ACCOUNT_ID
  Value: 1287298
  ```

### 9. **Cloudflare Turnstile Site Key**
- **Key Name:** `CLOUDFLARE_SITE_KEY`
- **Value:** `0x4AAAAAACcPVkNQ6P6p5n0y`
- **Used In:** Frontend reCAPTCHA on forms
- **Security:** Public – can be exposed
- **Setup in Vercel:**
  ```
  Name: CLOUDFLARE_SITE_KEY
  Value: 0x4AAAAAACcPVkNQ6P6p5n0y
  ```

---

## 🔒 Secret Keys (BACKEND ONLY - NEVER expose to frontend)

These must be stored in Vercel environment variables AND **NOT** in `apps-config.json`:

### 1. **Paystack Secret Key** (⚠️ CRITICAL)
- **Key Name:** `PAYSTACK_SECRET`
- **Value:** `sk_xxxx_your_actual_secret_key_here`
- **Used In:** Backend payment processing (`api/checkout.js`)
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: PAYSTACK_SECRET
  Value: sk_xxxx_your_actual_secret_key_here
  Environment: Production (and Preview if needed)
  ```
- **Never expose to:**
  - Frontend JavaScript
  - apps-config.json
  - Client-side code

### 2. **Cloudflare Secret Key** (⚠️ CRITICAL)
- **Key Name:** `CLOUDFLARE_SECRET_KEY`
- **Value:** `0x4AAAAAACcPVgFgwaWq6xvdhlwB7IVAnJs`
- **Used In:** Backend form validation (`api/checkout.js`, login endpoints)
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: CLOUDFLARE_SECRET_KEY
  Value: 0x4AAAAAACcPVgFgwaWq6xvdhlwB7IVAnJs
  Environment: Production
  ```

### 3. **SMTP Credentials** (⚠️ CRITICAL)
- **Service:** Resend
- **Credentials:**
  ```
  Name: SMTP_HOST
  Value: smtp.resend.com
  
  Name: SMTP_PORT
  Value: 465
  
  Name: SMTP_SECURE
  Value: 1
  
  Name: SMTP_USER
  Value: resend
  
  Name: SMTP_PASS
  Value: re_BnDJybQm_22mJPWMSG5WRbmVSWqWvqkgQ
  
  Name: SMTP_FROM
  Value: onboarding@resend.dev
  ```
- **Used In:** Backend email sending (`api/auth/reset-request.js`)
- **Security:** PRIVATE – Backend only
- **Note:** The `SMTP_PASS` is your Resend API key – NEVER expose to frontend

### 4. **GitHub OAuth Credentials** (⚠️ CRITICAL)
- **Key Name:** `GITHUB_CLIENT_ID`
- **Value:** `Ov23li5YHSpjXRvzZG2e`
- **Used In:** Backend OAuth flow (future use)
- **Security:** Client ID is public, but keep secret for rate limit avoidance
- **Setup in Vercel:**
  ```
  Name: GITHUB_CLIENT_ID
  Value: Ov23li5YHSpjXRvzZG2e
  ```

- **Key Name:** `GITHUB_CLIENT_SECRET`
- **Value:** `f463af1067865c277f059277779919b02603678c`
- **Used In:** Backend OAuth authentication
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: GITHUB_CLIENT_SECRET
  Value: f463af1067865c277f059277779919b02603678c
  Environment: Production
  ```

- **Key Name:** `GITHUB_TOKEN` (optional)
- **Value:** Your GitHub PAT (Personal Access Token)
- **Used In:** Backend GitHub API access (`api/gh.js`)
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: GITHUB_TOKEN
  Value: ghp_xxxxxxxxxxxxxxxxxxxx (your token)
  Environment: Production
  ```

### 5. **Google OAuth Credentials** (⚠️ CRITICAL)
- **Key Name:** `GOOGLE_CLIENT_ID`
- **Value:** `xxxx_your_google_client_id_here`
- **Used In:** Backend OAuth flow (future use)
- **Security:** Client ID is public, but keep for consistency
- **Setup in Vercel:**
  ```
  Name: GOOGLE_CLIENT_ID
  Value: xxxx_your_google_client_id_here
  ```

- **Key Name:** `GOOGLE_CLIENT_SECRET`
- **Value:** `xxxx_your_google_client_secret_here`
- **Used In:** Backend OAuth authentication
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: GOOGLE_CLIENT_SECRET
  Value: xxxx_your_google_client_secret_here
  Environment: Production
  ```

### 6. **JWT Secret** (⚠️ CRITICAL)
- **Key Name:** `JWT_SECRET`
- **Value:** (Create a strong random secret)
- **Used In:** Backend authentication token signing (`server.js`)
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: JWT_SECRET
  Value: (Generate a strong secret: openssl rand -base64 32)
  Example: aB7cDeFgHiJkLmNoPqRsTuVwXyZ1234567890abcdef+ghijk=
  Environment: Production
  ```
- **Generate with:** `openssl rand -base64 32`

### 7. **Admin Credentials** (⚠️ CRITICAL)
- **Key Name:** `ADMIN_USER`
- **Value:** `admin` (or your chosen username)
- **Used In:** Backend admin authentication
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: ADMIN_USER
  Value: admin
  ```

- **Key Name:** `ADMIN_PASS`
- **Value:** (Use a strong password)
- **Used In:** Backend admin authentication
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: ADMIN_PASS
  Value: YourSecurePassword123!
  Environment: Production
  ```

### 8. **NextAuth Secret** (⚠️ CRITICAL)
- **Key Name:** `NEXTAUTH_SECRET`
- **Value:** (Create a strong random secret)
- **Used In:** Backend session management
- **Security:** PRIVATE – Backend only
- **Setup in Vercel:**
  ```
  Name: NEXTAUTH_SECRET
  Value: (Generate: openssl rand -base64 32)
  Example: xYz9AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd=
  Environment: Production
  ```

---

## 📋 Complete Vercel Environment Variables Setup

### Step 1: Go to Vercel Dashboard
1. Log in to [vercel.com](https://vercel.com)
2. Select your project
3. Go to **Settings → Environment Variables**

### Step 2: Add All Variables

#### Copy-Paste this as a bulk list:
```
GOOGLE_ANALYTICS_ID=xxxx_your_google_analytics_id_here
PAYSTACK_PUBLIC_KEY=xxxx_your_paystack_public_key_here
PAYSTACK_SECRET=xxxx_your_paystack_secret_key_here
MIXPANEL_TOKEN=xxxx_your_mixpanel_token_here
KLAVIYO_PUBLIC_KEY=xxxx_your_klaviyo_public_key_here
TAWKTO_PROPERTY_ID=xxxx_your_tawkto_property_id_here
PRIVY_SITE_ID=xxxx_your_privy_site_id_here
YOTPO_API_KEY=xxxx_your_yotpo_api_key_here
YOTPO_ACCOUNT_ID=xxxx_your_yotpo_account_id_here
CLOUDFLARE_SITE_KEY=xxxx_your_cloudflare_site_key_here
CLOUDFLARE_SECRET_KEY=xxxx_your_cloudflare_secret_key_here
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=resend
SMTP_PASS=xxxx_your_smtp_password_here
SMTP_FROM=onboarding@resend.dev
GITHUB_CLIENT_ID=xxxx_your_github_client_id_here
GITHUB_CLIENT_SECRET=xxxx_your_github_client_secret_here
GOOGLE_CLIENT_ID=xxxx_your_google_client_id_here
GOOGLE_CLIENT_SECRET=xxxx_your_google_client_secret_here
JWT_SECRET=xxxx_your_jwt_secret_min_32_chars_here
ADMIN_USER=admin
ADMIN_PASS=xxxx_your_secure_password_here
NEXTAUTH_SECRET=xxxx_your_nextauth_secret_here
```

### Step 3: Update Your Project Code

Your backend will automatically read from these environment variables:

```javascript
// In server.js and api files:
const jwtSecret = process.env.JWT_SECRET || 'devsecret';
const adminUser = process.env.ADMIN_USER || 'admin';
const adminPass = process.env.ADMIN_PASS || 'password';
const paystackSecret = process.env.PAYSTACK_SECRET;
const smtpPass = process.env.SMTP_PASS;
```

### Step 4: Fetch Public Keys from Backend

Frontend should NOT use environment variables directly. Instead:

1. **Create a public endpoint** to return only PUBLIC keys:
```javascript
// /api/public-config
module.exports = async (req, res) => {
  return res.json({
    googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY,
    mixpanelToken: process.env.MIXPANEL_TOKEN,
    klaviyoPublicKey: process.env.KLAVIYO_PUBLIC_KEY,
    tawktoPropertyId: process.env.TAWKTO_PROPERTY_ID,
    privySiteId: process.env.PRIVY_SITE_ID,
    yotpoApiKey: process.env.YOTPO_API_KEY,
    yotpoAccountId: process.env.YOTPO_ACCOUNT_ID,
    cloudflareSiteKey: process.env.CLOUDFLARE_SITE_KEY
  });
};
```

2. **Frontend fetches from endpoint:**
```javascript
// In app-loader.js or startup script:
fetch('/api/public-config')
  .then(r => r.json())
  .then(config => {
    // Use config.paystackPublicKey, etc.
    // Never access PAYSTACK_SECRET from frontend
  });
```

---

## ✅ Security Checklist

- [ ] Remove `.env` file from git (add to `.gitignore`)
- [ ] All PRIVATE keys are in Vercel env vars (Production only)
- [ ] All PUBLIC keys can be injected into frontend
- [ ] `apps-config.json` does NOT contain secret keys
- [ ] Frontend only accesses public keys via API
- [ ] No `process.env` usage in client-side JavaScript
- [ ] PAYSTACK_SECRET is NEVER exposed to frontend
- [ ] SMTP_PASS is NEVER exposed to frontend
- [ ] JWT_SECRET is NEVER exposed to frontend
- [ ] Admin credentials are stored securely in Vercel

---

## 🔄 How Keys Flow to Frontend

```
┌─────────────────────────────────────────────────────┐
│ Vercel Environment Variables (Server/Backend Only)  │
│                                                     │
│ PRIVATE:               PUBLIC:                      │
│ - PAYSTACK_SECRET      - PAYSTACK_PUBLIC_KEY      │
│ - SMTP_PASS            - GOOGLE_ANALYTICS_ID      │
│ - JWT_SECRET           - MIXPANEL_TOKEN           │
│ - ADMIN_PASS           - KLAVIYO_PUBLIC_KEY       │
│                        - PRIVY_SITE_ID            │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│ Backend API Endpoints                               │
│ - /api/public-config (returns public keys only)    │
│ - /api/checkout (uses PAYSTACK_SECRET)             │
│ - /api/auth/* (uses SMTP, JWT_SECRET)              │
└─────────────────────────────────────────────────────┘
       ↓
┌─────────────────────────────────────────────────────┐
│ Frontend (App-Loader, Checkout, etc.)              │
│ - Only receives PUBLIC keys from /api/public-config│
│ - Never has access to PRIVATE keys                 │
└─────────────────────────────────────────────────────┘
```

---

## 🚀 Deployment Steps

1. **Local Development:**
   - Keys stay in `.env` (not committed to git)
   - Server reads from `.env`

2. **Vercel Production:**
   - Add all variables to Vercel Settings → Environment Variables
   - Set to: **Production** and **Preview** as needed
   - Redeploy after adding variables
   - Server reads from Vercel environment

3. **Testing:**
   - After deployment, check server logs to confirm keys are loaded
   - Test endpoints that need keys (payment, email, etc.)
   - Verify frontend does NOT have access to secret keys

---

## 📝 Notes

- **Do NOT commit `.env` to GitHub** – add to `.gitignore`
- **Regenerate JWT_SECRET on production** – use secure random generator
- **Rotate secrets regularly** – especially PAYSTACK_SECRET and SMTP_PASS
- **Test on Vercel Preview** before Production deployment
- **Monitor Vercel logs** for any key-related errors

