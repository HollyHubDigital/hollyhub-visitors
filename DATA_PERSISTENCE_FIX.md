# Critical Issues Fixed - Data Persistence & Sync Guide

## Problems Identified & Fixed

### Problem 1: Blog/Portfolio Posts Not Updating on Visitors Pages
**Root Cause:** Admin dashboard posts changes, but Vercel is stateless. Changes saved to local files are lost on redeployment.

**Fixed In:**
- `api/blog.js` - Updated to use `getRepoConfig()` and write to GitHub
- `api/portfolio.js` - Updated to use `getRepoConfig()` for all CRUD operations
- Both now read from GitHub first, then fall back to local files

### Problem 2: Mobile Number Not Updating from Admin Dashboard
**Root Cause:** `/api/settings` endpoint only saves to local files, which are lost on redeployment.

**Fixed In:**
- `server.js` POST `/api/settings` - Now uses `getRepoConfig()` to save to GitHub while maintaining local files as fallback
- Settings are persisted to GitHub so Vercel deployments pull fresh data

### Problem 3: Comments Not Being Saved or Posted
**Root Cause:** Comment endpoints (`POST /api/blog/comment`, `POST /api/blog/comment/mute`) only saved to local files.

**Fixed In:**
- `server.js` POST `/api/blog/comment` - Now async, uses `getRepoConfig()`, saves to GitHub + local
- `server.js` POST `/api/blog/comment/mute` - Same GitHub persistence update
- Comments are now preserved across deployments

### Problem 4: Google Translator Missing from Visitor Pages
**Status:** ✅ **ALREADY FIXED** - All 15+ visitor pages have Google Translate:
- index.html, about.html, blog.html, portfolio.html
- contact.html, services.html, marketing.html
- checkout.html, cancel.html, success.html
- signup.html, login.html, reset.html, terms.html

### Problem 5: Translator Dropdown Too Wide
**Status:** ✅ **FIXED** - Reduced from 140px to 90px-120px in styles.css

---

## How to Fix Data Loss Issues (Vercel Deployment)

Your site has TWO dependencies for data persistence:

### Option A: GitHub Token-Based Persistence (RECOMMENDED)
This is the **PERMANENT** solution.

1. **Create GitHub Personal Access Token**
   - Go to: https://github.com/settings/tokens
   - Click "Generate new token (classic)"
   - Select scopes: `repo` (full control of private repos)
   - Copy the token

2. **Set Environment Variables on Vercel**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add these variables:
   ```
   GITHUB_TOKEN = ghp_your_token_here
   REPO_OWNER = HollyHubDigital
   REPO_NAME = hollyhub-visitors
   REPO_BRANCH = main
   ```

3. **How It Works After Setup**
   - All write endpoints check for `getRepoConfig()`
   - If configured, changes save to GitHub directly
   - Vercel reads fresh data from GitHub on deployments
   - Changes are PERMANENT and sync instantly

### Option B: Admin Dashboard Configuration (FALLBACK)
If you don't have direct Vercel access:

1. **Admin Dashboard Updates Settings**
   - Admin panel has a settings page
   - Fill in: Repo Owner, Repo Name, Repo Token
   - Admin saves these to `data/settings.json`

2. **API Syncs with Configured Repo**
   - When admin makes changes, API reads the configured repo from settings
   - Changes are written to that GitHub repo
   - LIMITATION: Only works if admin sends the repo config in requests

---

## Verification Checklist

After making changes, your system should:

- [ ] Blog posts created in admin → appear on visitor blog.html ✓
- [ ] Portfolio items created in admin → appear on visitor portfolio.html ✓  
- [ ] Mobile number updated in admin → appears on visitor pages (via /api/public-settings) ✓
- [ ] Comments posted on visitor blog → saved and persist ✓
- [ ] All visitor pages have Google Translate dropdown ✓
- [ ] Translator dropdown is compact (90-120px width) ✓

---

## Files Modified

```
api/blog.js        - Uses getRepoConfig for GitHub sync
api/portfolio.js   - GET/POST/PUT/DELETE now use getRepoConfig
server.js          - Comment & settings endpoints now use GitHub
styles.css         - Translator dropdown resized (already done)
.env.example       - Template for configuration
```

---

## Testing Locally

1. **Set Environment Variables**
   ```powershell
   $env:GITHUB_TOKEN = "ghp_your_test_token"
   $env:REPO_OWNER = "HollyHubDigital"
   $env:REPO_NAME = "hollyhub-visitors"
   $env:JWT_SECRET = "test-min-32-characters-secret-12345"
   ```

2. **Start Server**
   ```powershell
   npm install
   node server.js
   ```

3. **Test Creating Post (from admin)**
   ```powershell
   curl -X POST http://localhost:3000/api/blog `
     -H "Content-Type: application/json" `
     -H "Authorization: Bearer token_here" `
     -d '{"title":"Test","content":"Test content"}'
   ```

4. **Check Blog Data Read**
   ```powershell
   curl http://localhost:3000/api/blog
   ```
   Should return posts from GitHub if GITHUB_TOKEN is set

---

## Architecture Explanation

**Before Fix:**
```
Admin → /api/blog POST → Vercel (saves to local file) ✗ (lost on redeploy)
                                ↓
Visitor → GET /api/blog → reads local file (stale/missing data)
```

**After Fix:**
```
Admin → /api/blog POST → Vercel → GitHub (persisted) ✓
                           ↓
                        Local backup
                           
Visitor → GET /api/blog → GitHub (fresh data) ✓
                           ↓
                        Local fallback
```

---

## Next Steps

**Immediate (This Week):**
1. Get GitHub token from user account
2. Add GITHUB_TOKEN, REPO_OWNER, REPO_NAME to Vercel environment variables
3. Test creating a blog post in admin dashboard
4. Verify it appears on visitor site
5. Wait 1-2 min, trigger Vercel redeploy, verify post still there

**Ongoing:**
- Monitor GitHub repo for commits from visitors API
- Comments, settings, blog, portfolio changes should all create commits
- If not working, check Vercel environment variables are set correctly

---

## Troubleshooting

**Issue: Changes still not persisting**
- Check Vercel environment variables are set (case-sensitive!)
- Verify GITHUB_TOKEN has `repo` scope
- Check that REPO_OWNER and REPO_NAME match your repo URL

**Issue: API returning 500 error**
- Check server.js logs for errors
- Verify GitHub token is valid (not expired)
- Check REPO_NAME is exactly "hollyhub-visitors" (case-sensitive)

**Issue: Comments/settings not appearing after update**
- Wait 1-2 minutes for Vercel to redeploy
- Manually trigger redeploy from Vercel dashboard
- Clear browser cache (Ctrl+Shift+Delete)

---

Last Updated: 2026-03-06
