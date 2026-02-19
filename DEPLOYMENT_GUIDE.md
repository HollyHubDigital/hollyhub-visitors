# Repository Split: Deployment & Verification Guide

## What Was Split?

Your monolithic project has been split into **2 separate repositories** that will deploy to **2 different Vercel projects**:

| Repo | Domain | Purpose | Contents |
|------|--------|---------|----------|
| **visitors-repo** | https://hollyhubdigital.vercel.app | Visitor website + Full API backend | All HTML pages, /api, /data, /public |
| **admin-repo** | https://admin-hollyhubdigital.vercel.app | Admin dashboard + API proxy | /admin folder, proxy server.js |

---

## Why This Architecture?

### Separation of Concerns
- **Visitors site** handles public content and APIs
- **Admin site** is isolated and only manages its UI + proxies API calls
- If admin has an issue, visitors site is unaffected
- If visitors API is down, admin still loads (but can't fetch data)

### Security
- Admin secrets never visible to visitor code
- Admin domain can be restricted with firewall rules if needed
- Each deployment has its own environment variables

### Scalability
- Visitors can scale independently from admin
- Admin is stateless (no data storage, just UI + proxy)
- API improvements don't require admin redeploy

---

## Before You Deploy

### ✅ Verification Checklist

```powershell
# 1. Check visitors-repo exists with all files
Test-Path c:\Users\holly\visitors-repo\server.js
Test-Path c:\Users\holly\visitors-repo\api
Test-Path c:\Users\holly\visitors-repo\data
Test-Path c:\Users\holly\visitors-repo\index.html
Test-Path c:\Users\holly\visitors-repo\package.json
# Should all return True

# 2. Check admin-repo exists with proxy server
Test-Path c:\Users\holly\admin-repo\server.js
Test-Path c:\Users\holly\admin-repo\admin
Test-Path c:\Users\holly\admin-repo\config.js
Test-Path c:\Users\holly\admin-repo\package.json
# Should all return True

# 3. Verify file sizes (rough estimates)
Get-Item c:\Users\holly\visitors-repo\server.js | Select-Object Length
# Should show ~970KB

Get-Item c:\Users\holly\admin-repo\server.js | Select-Object Length
# Should show ~5-10KB (much smaller)
```

---

## Deployment Steps

### Phase 1: Local Testing (Optional but Recommended)

**Test Visitors Site Locally:**
```powershell
cd c:\Users\holly\visitors-repo
npm install
$env:JWT_SECRET = "test-secret-key-min-32-chars-12345"
$env:ADMIN_USER = "admin"
$env:ADMIN_PASS = "password123"
node server.js
# Visit http://localhost:3000 in browser
```

**Test Admin Site Locally:**
```powershell
# In a new terminal
cd c:\Users\holly\admin-repo
npm install
$env:VISITORS_API_URL = "http://localhost:3000"
node server.js
# Visit http://localhost:3000/admin/adminlogin.html in browser
# Log in with your data/users.json credentials or admin/admin if empty
```

---

### Phase 2: Push to GitHub

**Create GitHub Repositories:**
1. Go to [github.com/new](https://github.com/new)
2. Create **hollyhub-visitors** (public or private)
3. Create **hollyhub-admin** (public or private)

**Push Visitors Repo:**
```powershell
cd c:\Users\holly\visitors-repo
git init
git config user.email "your-email@example.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit: Visitors site with full backend API"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hollyhub-visitors.git
git push -u origin main
```

**Push Admin Repo:**
```powershell
cd c:\Users\holly\admin-repo
git init
git config user.email "your-email@example.com"
git config user.name "Your Name"
git add .
git commit -m "Initial commit: Admin dashboard with API proxy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/hollyhub-admin.git
git push -u origin main
```

---

### Phase 3: Deploy to Vercel

#### Deploy Visitors Project

1. Go to [vercel.com](https://vercel.com) and log in
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Select **hollyhub-visitors** repo
5. **Configure Project:**
   - Project Name: `hollyhub-visitors` (or your choice)
   - Root Directory: `.` (current directory)
   - Framework: `Other` (since we're using Express directly)
   - Build Command: Leave empty or clear
   - Output Directory: Leave empty
   - Install Command: `npm install`
   - Start Command: `node server.js` ← **Important: Must be Express start command**

6. **Add Environment Variables** - Click "Environment Variables" and add:

   ```
   JWT_SECRET = [Must be exactly same on both projects - min 32 chars]
   PAYSTACK_SECRET = sk_xxxx_your_actual_secret_key_here
   PAYSTACK_PUBLIC_KEY = pk_xxxx_your_public_key_here
   SMTP_HOST = smtp.resend.com
   SMTP_PORT = 465
   SMTP_USER = resend
   SMTP_PASS = xxxx_your_actual_smtp_password_here
   SMTP_FROM = onboarding@resend.dev
   ADMIN_USER = admin
   ADMIN_PASS = [Set a strong password]
   GITHUB_CLIENT_ID = xxxx_your_github_client_id_here
   GITHUB_CLIENT_SECRET = xxxx_your_github_client_secret_here
   GOOGLE_CLIENT_ID = xxxx_your_google_client_id_here
   GOOGLE_CLIENT_SECRET = xxxx_your_google_client_secret_here
   NEXTAUTH_SECRET = xxxx_your_nextauth_secret_min_32_chars_here
   ```

7. Click **"Deploy"**
8. Wait for deployment to complete
9. You'll get a URL like `https://hollyhub-visitors.vercel.app`
   - Note this URL - you'll need it for admin repo

#### Deploy Admin Project

1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Select **hollyhub-admin** repo
5. **Configure Project:**
   - Project Name: `hollyhub-admin` (or your choice)
   - Root Directory: `.`
   - Framework: `Other`
   - Build Command: Leave empty
   - Start Command: `node server.js` ← **Important: Must be Express start command**

6. **Add Environment Variables:**
   ```
   VISITORS_API_URL = https://hollyhub-visitors.vercel.app
   JWT_SECRET = [MUST be identical to visitors project]
   ```

7. Click **"Deploy"**
8. Wait for deployment

---

## Verification After Deployment

### Test 1: Visitors Site Loads
```
Visit: https://hollyhub-visitors.vercel.app
Expected: Home page loads with all styling
Check: Browser console for [AppLoader] messages (Privy should init)
```

### Test 2: All Visitor Pages Work
```
Test these pages:
- https://hollyhub-visitors.vercel.app/about.html
- https://hollyhub-visitors.vercel.app/blog.html
- https://hollyhub-visitors.vercel.app/services.html
- https://hollyhub-visitors.vercel.app/portfolio.html

Expected: All load without 404 errors
```

### Test 3: API Endpoints Respond
```
Using Postman or curl:

GET https://hollyhub-visitors.vercel.app/api/blog
Expected: Returns array of blog posts from data/blog.json

GET https://hollyhub-visitors.vercel.app/api/public-settings
Expected: Returns public settings (WhatsApp, etc.)

POST https://hollyhub-visitors.vercel.app/api/auth/login
Body: {"username":"admin","password":"your-admin-pass"}
Expected: Returns JWT token
```

### Test 4: Admin Dashboard Loads
```
Visit: https://hollyhub-admin.vercel.app/admin/adminlogin.html
Expected: Login form appears

Log in with your admin credentials
Expected: Dashboard loads successfully
```

### Test 5: Admin Can Call APIs (Cross-Domain)
```
In admin dashboard, open DevTools (F12)
Go to Console tab
Try: fetch('/api/blog').then(r => r.json()).then(console.log)

Expected: 
- Network tab shows request to /api/blog
- Response contains blog posts from visitors domain
- No CORS errors in console
```

### Test 6: JWT Tokens Work Across Domains
```
In admin dashboard, open DevTools
Execute in console:
fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({username:'admin',password:'your-pass'})
}).then(r => r.json()).then(d => {
  console.log('Token:', d.token);
  localStorage.setItem('adminToken', d.token);
});

Then:
fetch('/api/blog').then(r => r.json()).then(console.log)

Expected: Blog data returns successfully (token validated on visitors domain)
```

---

## Common Issues & Fixes

### Issue: Admin gets "Cannot GET /api/blog"
**Diagnosis:** Admin proxy not forwarding requests correctly
**Fix:** 
- Ensure VISITORS_API_URL env var is set in admin Vercel project
- Check admin server.js has the proxy middleware
- Verify visitors API is working: visit visitors domain directly

### Issue: "Cannot find module 'express'" on deployment
**Diagnosis:** `npm install` didn't run or dependencies not saved
**Fix:**
- Both package.json files must exist in root directory
- Vercel should auto-run `npm install`
- Force redeploy: In Vercel dashboard, click "Redeploy"

### Issue: Admin login always fails
**Diagnosis:** JWT_SECRET mismatch between projects
**Fix:**
- Must be EXACTLY the same on both visitors and admin
- Get value from visitors project's Vercel env var
- Copy and paste exact same value to admin project
- Redeploy admin after updating

### Issue: CORS error when admin calls API
**Diagnosis:** Visitors CORS headers not set correctly
**Fix:**
- server.js in visitors must have: `app.use(cors())`
- If still issues, add explicit origin: `app.use(cors({ origin: 'https://admin-*.vercel.app' }))`

### Issue: Privy popup still not showing
**Diagnosis:** App loader not initializing Privy
**Fix:**
- Check browser console for `[AppLoader] initializing app: privy`
- Verify Privy site ID doesn't have leading/trailing spaces in data/apps-config.json
- Check Privy SDK loaded: `window.Privy` should exist in console

---

## Post-Deployment Optimization

### Custom Domains
If you have a custom domain:
1. **Visitors:** Add `hollyhubdigital.com` to visitors project in Vercel
2. **Admin:** Add `admin.hollyhubdigital.com` to admin project in Vercel
3. Update admin .env: `VISITORS_API_URL = https://hollyhubdigital.com`

### Environment-Specific Config
Create .env.production files (not committed to Git):
```
# visitors-repo/.env.production
JWT_SECRET=prod-secret-key-here
PAYSTACK_SECRET=your-production-key
... etc ...
```

### Monitoring
Set up monitoring in Vercel:
1. Analytics → Real-time logs
2. Deployments → View build logs
3. Settings → Alerts for failed deployments

---

## Quick Reference: Architecture Diagram

```
VISITOR VISIT
   ↓
Browser: https://hollyhubdigital.vercel.app
   ↓
visitors-repo/server.js
   ├─ Serves: index.html, about.html, blog.html, etc.
   ├─ Handles: /api/blog, /api/auth/login, /api/portfolio, etc.
   └─ Stores: All data in /data/*.json


ADMIN VISIT
   ↓
Browser: https://admin-hollyhubdigital.vercel.app
   ↓
admin-repo/server.js
   ├─ Serves: admin/admin.html, admin/admin.js
   ├─ Proxy: /api/* requests → https://hollyhubdigital.vercel.app/api/*
   └─ No data storage (stateless)


ADMIN API CALL
   ↓
admin-repo/admin.js: fetch('/api/blog')
   ↓
admin-repo/server.js: Intercepts, forwards to:
   ↓
visitors-repo/server.js: /api/blog endpoint
   ↓
Response: Returns to admin-repo server
   ↓
Response: Returned to admin.js in browser
```

---

## Rollback Plan

If something goes wrong after deployment:

**Option 1: Revert to Previous Vercel Deployment**
1. In Vercel dashboard, find affected project
2. Go to Deployments → Click previous successful deployment
3. Click "..." menu → "Promote to Production"
4. Wait for redeploy

**Option 2: Quick Fix from Local**
```powershell
cd c:\Users\holly\visitors-repo (or admin-repo)
# Fix issue in code
git add .
git commit -m "Fix: [description]"
git push origin main
# Vercel auto-deploys on push
```

**Option 3: Keep Monolith as Backup**
- Don't delete original folder (`c:\Users\holly\New folder (2)`)
- Can still deploy monolith if split fails badly
- Gives you 2 weeks to test split before archiving original

---

## File Checklist Before Pushing to GitHub

```powershell
# Visitors Repo - 14 critical files
c:\Users\holly\visitors-repo\
├── ✅ server.js (970+ lines)
├── ✅ package.json (with dependencies)
├── ✅ .env (template, no secrets)
├── ✅ .gitignore (excludes .env, node_modules)
├── ✅ README.md (deployment instructions)
├── ✅ vercel.json
├── ✅ index.html, about.html, ... (13 HTML files)
├── ✅ styles.css, script.js, checkout.js, app-loader.js
├── ✅ api/ (all 10+ endpoint files)
├── ✅ data/ (blog.json, users.json, portfolio.json, etc.)
└── ✅ public/uploads/ (user files)

# Admin Repo - 8 critical files
c:\Users\holly\admin-repo\
├── ✅ server.js (~100 lines, proxy)
├── ✅ package.json (express, cors, node-fetch only)
├── ✅ .env (contains VISITORS_API_URL)
├── ✅ .gitignore
├── ✅ README.md
├── ✅ vercel.json
├── ✅ config.js (admin client config)
└── ✅ admin/ (admin.html, admin.js, adminlogin.html, setup.html)
```

---

## Summary

You now have **2 production-ready projects** ready to deploy:

1. **visitors-repo** → `https://hollyhub-visitors.vercel.app`
   - Prod URL: `https://hollyhubdigital.vercel.app` (custom domain)
   - Full Node.js backend + public website

2. **admin-repo** → `https://admin-hollyhub-admin.vercel.app`  
   - Prod URL: `https://admin.hollyhubdigital.vercel.app` (custom domain)
   - Admin UI + stateless proxy to visitors APIs

**Next Steps:**
1. Push both repos to GitHub
2. Import into Vercel  
3. Add environment variables (different values for each!)
4. Deploy and test

Good luck! 🚀
