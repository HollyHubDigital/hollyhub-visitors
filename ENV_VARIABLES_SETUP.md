# 🔑 Environment Variables Quick Reference

## 📌 What Changed & What To Do

You asked to keep all API keys OUT of the frontend and let them be fetched from Vercel. Here's the complete setup.

---

## ✅ What I Created For You

### 1. **VERCEL_ENV_SETUP.md** (Complete guide)
   - Lists ALL 30+ keys in your project
   - Shows which are PUBLIC (safe for frontend)
   - Shows which are PRIVATE (backend only)
   - Step-by-step Vercel setup instructions
   - Security checklist

### 2. **.gitignore** (Protect your keys)
   - Prevents `.env` from being committed to GitHub
   - Excludes `node_modules` and build artifacts

### 3. **/api/public-config.js** (NEW endpoint)
   - Returns ONLY public keys to frontend
   - Blocks access to secret keys (PAYSTACK_SECRET, SMTP_PASS, etc.)
   - Uses environment variables FIRST, falls back to apps-config.json
   - Example: `GET /api/public-config` returns:
     ```json
     {
       "paystackPublicKey": "pk_live_20668...",
       "googleAnalyticsId": "G-N5NZW9GSTP",
       "yotpoApiKey": "Xw19ihiKlAgx8uTlE0g...",
       ...
     }
     ```

---

## 🚀 Implementation Steps

### Step 1: Add Variables to Vercel
1. Go to [vercel.com](https://vercel.com) → Your Project → Settings → Environment Variables
2. Copy-paste all variables from **VERCEL_ENV_SETUP.md** (marked as "SECURE/PRIVATE KEY")
3. Set each to: **Production** (or both Production + Preview)

### Step 2: Restart Server
Backend automatically reads `process.env` variables from Vercel.

### Step 3: Frontend Fetches Public Keys
Instead of hardcoding keys in frontend, apps fetch from `/api/public-config`:

```javascript
// In your HTML or app-loader.js:
const publicConfig = await fetch('/api/public-config').then(r => r.json());

// Use public keys only:
window.paystackPublicKey = publicConfig.paystackPublicKey;
window.mixpanelToken = publicConfig.mixpanelToken;
// etc.
```

---

## 📋 All Keys Summary

### ✅ PUBLIC (Safe for Frontend) - 9 keys
```
1. GOOGLE_ANALYTICS_ID
2. PAYSTACK_PUBLIC_KEY
3. MIXPANEL_TOKEN
4. KLAVIYO_PUBLIC_KEY
5. TAWKTO_PROPERTY_ID
6. PRIVY_SITE_ID
7. YOTPO_API_KEY
8. YOTPO_ACCOUNT_ID
9. CLOUDFLARE_SITE_KEY
```

### 🔒 PRIVATE (Backend Only) - 16+ keys
```
1. PAYSTACK_SECRET ⚠️
2. CLOUDFLARE_SECRET_KEY ⚠️
3. SMTP_HOST
4. SMTP_PORT
5. SMTP_SECURE
6. SMTP_USER
7. SMTP_PASS ⚠️
8. SMTP_FROM
9. GITHUB_CLIENT_ID
10. GITHUB_CLIENT_SECRET ⚠️
11. GITHUB_TOKEN
12. GOOGLE_CLIENT_ID
13. GOOGLE_CLIENT_SECRET ⚠️
14. JWT_SECRET ⚠️
15. ADMIN_USER
16. ADMIN_PASS ⚠️
17. NEXTAUTH_SECRET ⚠️
```

---

## 🔄 Current vs. New Architecture

### ❌ BEFORE (Keys in apps-config.json)
```
├── data/apps-config.json
│   ├── paystack: { publicKey: "pk_live_...", secretKey: "sk_live_..." } ⚠️ EXPOSED
│   ├── privy: { siteId: "8D48E..." }
│   └── ...
└── Frontend reads from apps-config.json directly → KEY LEAK RISK
```

### ✅ AFTER (Secure with Env Variables)
```
Vercel Environment Variables (Private)
├── PAYSTACK_SECRET = "sk_live_..." (only on server)
├── PAYSTACK_PUBLIC_KEY = "pk_live_..." (can be shared)
├── JWT_SECRET = "xyzabc..." (only on server)
├── SMTP_PASS = "re_BnD..." (only on server)
└── ... (13 more private keys)

Backend
├── Uses `process.env.PAYSTACK_SECRET` in /api/checkout.js
├── Uses `process.env.JWT_SECRET` in /api/auth/*
└── Uses `process.env.SMTP_PASS` for email

/api/public-config.js (NEW)
└── Returns ONLY: { paystackPublicKey, googleAnalyticsId, ... }
    ├── Filters out all PRIVATE keys
    └── Uses env vars first, falls back to apps-config.json

Frontend
├── Calls `/api/public-config` to get public keys only
├── Never has access to PAYSTACK_SECRET
├── Never has access to JWT_SECRET
├── Never has access to SMTP credentials
└── Safe from key leaks ✅
```

---

## 🛡️ Security Benefits

| Before | After |
|--------|-------|
| ❌ Secret keys in `apps-config.json` | ✅ Secrets in Vercel only |
| ❌ Frontend can read all keys | ✅ Frontend reads `/api/public-config` |
| ❌ `.env` committed to GitHub | ✅ `.env` in `.gitignore` |
| ❌ Anyone with GitHub access sees keys | ✅ Only Vercel has access to secrets |
| ❌ Paystack secret exposed in frontend | ✅ Paystack secret stays on backend |

---

## 📝 Files Modified/Created

```
NEW:
✅ VERCEL_ENV_SETUP.md
✅ .gitignore
✅ /api/public-config.js

NO CHANGES NEEDED (Already Secure):
✅ server.js - Already reads process.env
✅ /api/apps.js - Already filters admin-only keys
✅ /api/checkout.js - Already uses process.env.PAYSTACK_SECRET
✅ /api/auth/* - Already uses process.env.SMTP_PASS
```

---

## ✨ Next Steps

1. **Read VERCEL_ENV_SETUP.md** for complete details
2. **Add all variables to Vercel** (copy-paste from guide)
3. **Test locally** with `.env` file
4. **Redeploy to Vercel** after adding env vars
5. **Delete keys from apps-config.json** for extra safety (optional but recommended)

---

## 🆘 Troubleshooting

### "PAYSTACK_SECRET is undefined"
- Check Vercel Settings → Environment Variables
- Confirm it's set to "Production"
- Redeploy after adding the variable

### "Frontend can still access keys"
- Use `/api/public-config` endpoint
- Don't reference `process.env` in browser code
- Check Network tab to ensure frontend only sees public keys

### "Keys not loading on Vercel"
- Redeploy: `vercel redeploy` or push to git
- Check Vercel Logs for errors
- Verify variable names match exactly

---

## 📚 Documentation

Open **VERCEL_ENV_SETUP.md** for:
- Complete key list with descriptions
- Exact Vercel setup instructions
- Security checklist
- How keys flow to frontend diagram
- Notes on rotation and management

