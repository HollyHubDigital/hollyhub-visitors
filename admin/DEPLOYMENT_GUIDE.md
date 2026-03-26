# Admin Repository: Deployment Guide

## Quick Overview

This is the **Admin Dashboard** repository. It runs a lightweight Express server that:
- ✅ Serves the admin interface (`admin/admin.html`, `admin/admin.js`)
- ✅ Proxies all API calls to the visitors domain
- ✅ Requires NO data files (stateless)
- ✅ Requires NO file uploads (handled by visitors domain)

### What Goes Where?

| Component | Location | Deployment |
|-----------|----------|------------|
| **This repo** | `c:\Users\holly\admin-repo` | https://admin-hollyhubdigital.vercel.app |
| **Visitors repo** | `c:\Users\holly\visitors-repo` | https://hollyhubdigital.vercel.app |
| **Shared data** | Visitors domain only | Single source of truth |
| **Shared secret** | `JWT_SECRET` env var | Must be identical on both |

---

## How the Proxy Works

### Admin makes API call:
```javascript
// In admin/admin.js
fetch('/api/blog', options)
```

### Admin server intercepts it:
```javascript
// In admin/server.js
app.use('/api', async (req, res) => {
  const response = await fetch(
    `${VISITORS_API_URL}/api${req.path}`,  // Forward to visitors
    { method: req.method, headers: req.headers, body: ... }
  );
  res.json(await response.json());
});
```

### Request goes to visitors domain:
```
POST https://hollyhubdigital.vercel.app/api/blog
```

### Response comes back:
```javascript
{ "_id": "123", "title": "Hello", ... }
```

---

## Deployment Checklist

### Before Pushing to GitHub

✅ **Files exist:**
```powershell
Test-Path c:\Users\holly\admin-repo\server.js          # ~100 lines
Test-Path c:\Users\holly\admin-repo\package.json        # 3 dependencies
Test-Path c:\Users\holly\admin-repo\.env                # Template
Test-Path c:\Users\holly\admin-repo\admin\admin.html    # Main UI
Test-Path c:\Users\holly\admin-repo\admin\admin.js      # Logic
Test-Path c:\Users\holly\admin-repo\config.js           # Client config
```

✅ **No secrets committed:**
```powershell
# Verify .gitignore exists
Test-Path c:\Users\holly\admin-repo\.gitignore
# Should contain: .env, node_modules, .vscode, etc.
```

✅ **package.json has correct dependencies:**
```json
{
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "node-fetch": "^2.6.7"
  }
}
```

---

## Push to GitHub

```powershell
cd c:\Users\holly\admin-repo

# Initialize git
git init
git config user.email "your-email@example.com"
git config user.name "Your Name"

# Commit all files
git add .
git commit -m "Initial commit: Admin dashboard with API proxy"

# Set main branch
git branch -M main

# Add remote (replace with your username)
git remote add origin https://github.com/YOUR_USERNAME/hollyhub-admin.git

# Push to GitHub
git push -u origin main
```

---

## Deploy to Vercel

### Step 1: Create Vercel Project

1. Go to [vercel.com](https://vercel.com)
2. Click **"New Project"**
3. Click **"Import Git Repository"**
4. Select **hollyhub-admin** repo

### Step 2: Configure Project

- **Project Name:** `hollyhub-admin`
- **Root Directory:** `.` (current folder)
- **Framework:** `Other` (we're using Express.js directly)
- **Build Command:** (leave empty)
- **Output Directory:** (leave empty)
- **Install Command:** `npm install`
- **Start Command:** `node server.js` ← **CRITICAL: Must be this for Express**

### Step 3: Set Environment Variables

Click **"Environment Variables"** and add:

```
VISITORS_API_URL = https://hollyhub-visitors.vercel.app
JWT_SECRET = [SAME SECRET AS VISITORS PROJECT - min 32 chars]
```

⚠️ **CRITICAL:** JWT_SECRET must be **exactly identical** to what you set for the visitors project. If they don't match, authentication will fail.

### Step 4: Deploy

Click **"Deploy"** and wait for build to complete.

Expected output:
```
✅ Build successful
✅ Project deployed to: https://hollyhub-admin.vercel.app
```

---

## Verify Deployment Works

### Test 1: Admin UI Loads
```
Visit: https://hollyhub-admin.vercel.app/admin/adminlogin.html
Expected: Login form appears with logo and styling
```

### Test 2: Check Console Messages
```
Open DevTools (F12) → Console tab
Expected to see: [Admin Config] messages indicating config loaded
```

### Test 3: Admin Can Call APIs
```
In browser DevTools console, run:
fetch('/api/blog').then(r => r.json()).then(d => console.log('Blogs:', d))

Expected: 
- Request in Network tab shows: /api/blog
- Response: Array of blog posts
- No CORS errors
```

### Test 4: Admin Login Works
```
fetch('/api/admin/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({username:'admin', password:'your-password'})
}).then(r => r.json()).then(console.log)

Expected:
- Returns: { token: "eyJhb..." }
- Status: 200 OK
```

### Test 5: Cross-Domain Token Validation
```
1. Get a token from login (above)
2. Use it in next request:

const token = 'eyJhb...'; // from login
fetch('/api/blog/comment', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({postId: '123', text: 'Comment'})
}).then(r => r.json()).then(console.log)

Expected: Comment posted successfully (token validated on visitors domain)
```

---

## Troubleshooting

### Problem: Cannot GET /admin/adminlogin.html (404)
**Cause:** Static files not served correctly
**Fix:**
- Check server.js line: `app.use(express.static('admin'));`
- Ensure admin folder exists with adminlogin.html
- Hard refresh in browser (Ctrl+Shift+R or Cmd+Shift+R)

### Problem: fetch('/api/blog') returns 404
**Cause:** Proxy not forwarding to visitors domain correctly
**Fix:**
- Check env var: `VISITORS_API_URL=https://hollyhub-visitors.vercel.app`
- Verify visitors domain is deployed and working
- Check server.js proxy middleware is defined
- Restart admin server (redeploy from Vercel)

### Problem: Login fails, gets "Unauthorized"
**Cause:** JWT_SECRET mismatch between projects
**Fix:**
- Go to Vercel → visitors project → Settings → Environment Variables
- Copy exact JWT_SECRET value
- Go to Vercel → admin project → Settings → Environment Variables
- Paste same JWT_SECRET value
- Click "Save" and redeploy

### Problem: "Cannot find module 'express'" 
**Cause:** Dependencies not installed
**Fix:**
- Ensure package.json exists in root directory
- Vercel should auto-run `npm install`
- If still fails, redeploy: Vercel Dashboard → [project] → Deployments → Previous Deployment → "Promote to Production"

### Problem: Admin loads but console shows errors
**Cause:** admin.js trying to call endpoints that don't exist
**Fix:**
- Ensure visitors domain has all API endpoints
- Check `/api/blog`, `/api/portfolio`, `/api/admin/login` paths exist
- See [VISITORS README](../visitors-repo/README.md) for available endpoints

---

## File Structure

What's in this admin repo:

```
admin-repo/
├── server.js              # Lightweight proxy server (~100 lines)
├── package.json           # Only 3 dependencies (express, cors, node-fetch)
├── config.js              # Client-side config for admin.js
├── .env                   # Template (VISITORS_API_URL, JWT_SECRET)
├── .gitignore             # Excludes secrets and node_modules
├── README.md              # Basic project info
├── DEPLOYMENT_GUIDE.md    # This file
├── admin/
│   ├── adminlogin.html    # Login page
│   ├── admin.html         # Main dashboard
│   ├── admin.js           # Dashboard logic (calls /api endpoints via proxy)
│   └── setup.html         # Initial setup page
└── styles.css             # Admin styling (copied from main repo)

⚠️ Missing by design:
❌ No /api folder (proxies to visitors)
❌ No /data folder (data stored only on visitors)
❌ No /public or uploads (handled by visitors)
```

---

## Production Customization

### Using Custom Domain
If you have `admin.hollyhubdigital.com`:

1. In Vercel dashboard for admin project:
   - Settings → Domains
   - Add `admin.hollyhubdigital.com`
   - Follow DNS setup instructions

2. Update admin .env:
   ```
   VISITORS_API_URL = https://hollyhubdigital.com
   ```
   (Use custom visitor domain, not vercel.app)

3. If visitors domain also uses custom domain, update VISITORS_API_URL accordingly

### Environment Separation
Create `.env.production` (not in git) with production-only values:
```
VISITORS_API_URL = https://your-custom-domain.com
JWT_SECRET = your-production-secret
```

---

## Security Notes

### ✅ What's Protected
- Admin endpoints require JWT authentication
- Cross-domain calls validate tokens on visitors domain
- No secrets exposed in admin code
- All data operations happen on visitors domain

### ⚠️ What to Monitor
- Ensure VISITORS_API_URL points to correct domain
- JWT_SECRET never leaked in error messages
- Admin domain firewall rules (if needed)

### 🔒 Best Practices
- Never commit `.env` files
- Rotate JWT_SECRET periodically
- Monitor Vercel logs for auth failures
- Use strong admin password

---

## Monitoring & Logs

### View Deployment Logs
1. Vercel dashboard → Choose admin project
2. Click **"Deployments"**
3. Click latest deployment
4. View **"Build Logs"** and **"Runtime Logs"**

### Monitor API Calls
1. Vercel dashboard → Choose admin project
2. Click **"Analytics"** → **"Web Analytics"**
3. See traffic to `/`, `/admin/`, `/api`

### Check Real-time Logs
1. Vercel dashboard → Choose admin project
2. Click **"Logs"**
3. Filter by status code, URL, or timestamp

---

## Rollback & Recovery

### If Deployment Fails

**Option 1: Use Previous Vercel Deployment**
1. Vercel dashboard → Deployments
2. Click previous successful deployment
3. Click "..." menu → "Promote to Production"

**Option 2: Quick Local Fix & Redeploy**
```powershell
cd c:\Users\holly\admin-repo
# Fix issue in code (e.g., server.js)
git add .
git commit -m "Fix: [description]"
git push origin main
# Vercel auto-deploys on push ~1-2 minutes
```

**Option 3: Force Redeploy from Git**
- In Vercel, click "Redeploy" button
- Rebuilds from latest commit on main branch

---

## Quick Command Reference

```powershell
# Local development
npm install
$env:VISITORS_API_URL = "http://localhost:3000"
node server.js

# Push to GitHub
git add .
git commit -m "message"
git push origin main

# Check Vercel deployment status
# Go to: https://vercel.com/YOUR_USERNAME/hollyhub-admin/deployments
```

---

## Still Having Issues?

### Check These First
1. ✅ Is visitors domain deployed and accessible?
   - Visit: https://hollyhub-visitors.vercel.app
   - Should load homepage

2. ✅ Is JWT_SECRET identical on both projects?
   - Visitors: Settings → Environment Variables → JWT_SECRET
   - Admin: Settings → Environment Variables → JWT_SECRET
   - Should be exact same string

3. ✅ Is VISITORS_API_URL correct in admin?
   - Should match visitors project's public domain
   - Not localhost, must be full https://... URL

4. ✅ Did you redeploy admin after changing env vars?
   - Changes take effect on next deployment
   - Click "Redeploy" in Vercel if in doubt

### Contact Points
- **Visitors API issues**: Check visitors-repo/README.md
- **Admin UI issues**: Check admin/admin.js code
- **Proxy issues**: Check admin/server.js proxy middleware
- **Vercel issues**: Check Vercel logs in deployment

---

## Success Indicators 🎉

After deployment, you should have:
- ✅ Admin dashboard loads at https://admin-hollyhubdigital.vercel.app/admin/adminlogin.html
- ✅ Can log in with admin credentials
- ✅ Can create/edit blog posts
- ✅ Changes sync to visitors site immediately
- ✅ No CORS errors in DevTools
- ✅ No 404 errors on API calls
- ✅ JWT tokens valid across both domains

You're done! 🚀
