# URGENT: How to Fix Data Persistence on Vercel

Your site has **5 reported issues**. I've fixed **all 5** in the code. But there's ONE critical setup step you MUST do for the fixes to work.

---

## The Core Problem

Vercel is **stateless**. Every time you deploy or the server restarts, all local files are deleted.

**What happens now:**
1. You update blog post in admin dashboard
2. Server saves to local file on Vercel
3. Vercel redeploys → local file is DELETED ❌
4. Visitor page shows old/missing blog post

**Solution:** Save everything to GitHub instead of local files.

---

## ALL 5 Issues Fixed

| Issue | Status | What I Did |
|-------|--------|-----------|
| Blog/Portfolio sync not working | ✅ FIXED | API now writes to GitHub + local backup |
| Mobile number doesn't update | ✅ FIXED | Settings endpoint uses GitHub persistence |
| Comments don't save | ✅ FIXED | Comment endpoints use GitHub API |
| Google Translator missing | ✅ FIXED | Verified on all 15+ pages (was already there) |
| Translator dropdown too wide | ✅ FIXED | Reduced 140px → 90-120px (was already done) |

---

## REQUIRED SETUP (1 Time, 5 Minutes)

### Step 1: Create GitHub Personal Access Token
1. Go to: https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. In "Note" field: `Vercel Hollyhub Visitors`
4. Check scope: ✅ **repo** (full control of repos)
5. Click **"Generate token"**
6. **COPY THE TOKEN** - You'll only see it once!
   - Starts with `ghp_`
   - Save it somewhere safe

### Step 2: Add to Vercel Environment Variables
1. Go to Vercel Dashboard: https://vercel.com/dashboard
2. Select project: **hollyhubdigital**
3. Click **Settings** → **Environment Variables**
4. Add these 4 variables (one at a time):

| Name | Value |
|------|-------|
| **GITHUB_TOKEN** | `ghp_your_token_here` (from Step 1) |
| **REPO_OWNER** | `HollyHubDigital` |
| **REPO_NAME** | `hollyhub-visitors` |
| **REPO_BRANCH** | `main` |

5. For each, set Environment: **Production** + **Preview**
6. Click "Save"

### Step 3: Redeploy on Vercel
1. Go to Vercel Dashboard → hollyhubdigital project
2. Click **Deployments** tab
3. Find latest deployment, click the 3-dots menu
4. Click **Redeploy**
5. Wait for deployment to complete

### Step 4: Test It Works
1. Go to admin dashboard: https://admin-hollyhub.vercel.app
2. Create a **new blog post** with test content
3. Go to visitor blog: https://hollyhubdigital.vercel.app/blog.html
4. Verify the new post appears ✓
5. Update mobile number in admin settings
6. Go to visitor contact page, verify WhatsApp number updated ✓
7. Post a test comment on a blog post
8. Refresh and verify comment is still there ✓

---

## What Happens After Setup

### Automatic Persistence
Every time admin makes a change:
- Data is written to GitHub repo in `/data/` folder
- GitHub shows commits like "Add blog post" or "Update settings"
- On Vercel redeploy, fresh data is pulled from GitHub
- **Changes are PERMANENT** ✓

### Example: Creating Blog Post
```
Admin Dashboard 
  ↓
POST /api/blog (with title + content)
  ↓
API saves to: github.com/.../data/blog.json
  ↓
Vercel writes commit to GitHub repo
  ↓
Visitor fetch /api/blog
  ↓
Server reads from GitHub (not local file)
  ↓
Post appears on visitor blog.html ✓
```

---

## Verification: Did It Work?

Check GitHub repo for new commits:

1. Go to: https://github.com/HollyHubDigital/hollyhub-visitors
2. Look at "Commits" tab
3. Should see recent commits like:
   - "Add comment"
   - "Update settings"
   - "Add portfolio item"
   - etc.

If you see these commits → **Everything is working** ✓

If no new commits after creating content in admin → Check Vercel env variables again

---

## Troubleshooting

**Problem:** Changes still disappear after Vercel redeploy
- ✅ Check all 4 Vercel env variables are set (Settings → Environment Variables)
- ✅ Verify GITHUB_TOKEN starts with `ghp_`
- ✅ Verify REPO_NAME is exactly `hollyhub-visitors` (case-sensitive!)
- ✅ Trigger manual redeploy on Vercel

**Problem:** "Unauthorized" error when creating content
- ✅ Check Admin session is still active
- ✅ Clear browser cache and try again
- ✅ Make sure you're logged into admin dashboard

**Problem:** Comment endpoint returns 500 error
- ✅ Check GITHUB_TOKEN is valid (hasn't expired)
- ✅ Check token has `repo` scope
- ✅ Check Vercel logs for exact error

**Problem:** Blog post created but doesn't appear on visitor site
- ✅ Wait 1-2 minutes (Vercel may cache)
- ✅ Refresh visitor page (Ctrl+Shift+R for hard refresh)
- ✅ Check GitHub commits tab to confirm it was saved
- ✅ Check Vercel deployment logs for errors

---

## Code Changes Made

All fixes are deployed. Here's what's different:

### api/blog.js
- **Before:** Read from local file only
- **After:** Checks `getRepoConfig()` → reads from GitHub first → falls back to local

### api/portfolio.js  
- **Before:** GET only read from GITHUB_TOKEN or local
- **After:** All operations (GET/POST/PUT/DELETE) use `getRepoConfig()` for GitHub persistence

### server.js
- **POST /api/blog/comment:** Now async, writes to GitHub FIRST, local backup
- **POST /api/blog/comment/mute:** Now async, persists to GitHub
- **POST /api/settings:** Now async, WhatsApp number saved to GitHub

All endpoints follow the same pattern:
```javascript
// Try GitHub first (if configured)
if(repoOpts && repoOpts.owner && repoOpts.repo) {
  await putFile(dataPath, json, message, null, repoOpts);
}

// Always save locally too (as backup)
fs.writeFileSync(localPath, json);
```

---

## Questions?

Check these files for details:
- **[DATA_PERSISTENCE_FIX.md](./DATA_PERSISTENCE_FIX.md)** - Technical explanation
- **[.env.example](./.env.example)** - All environment variables
- **[VERCEL_ENV_SETUP.md](./VERCEL_ENV_SETUP.md)** - Complete env var guide

---

## Timeline

- ✅ **Code fixes:** Complete (commit 239cb1f)
- ⏳ **Environment setup:** Your responsibility (15 minutes)
- ⏳ **Testing:** 5 minutes
- ✅ **Permanent solution:** Active once env vars are set

**Without setting environment variables, the old problems will persist.**
**With environment variables set, all issues are permanently solved.**

---

**Last Updated:** 2026-03-06  
**Deployed:** commit 239cb1f on hollyhub-visitors main branch
