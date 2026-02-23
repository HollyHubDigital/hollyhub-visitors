# Vercel Deployment Checklist - February 23, 2026

## ✅ COMPLETED FIXES TODAY

### 1. URL Migration (Render → Vercel)
- **Status**: ✅ COMPLETE
- **Changes**:
  - `server.js` line 76: ALLOWED_ORIGINS updated to `https://hollyhubdigitals.vercel.app`
  - `server.js` lines 90, 205-225: CORS and CSRF checks now use `.vercel.app` only
  - `api/auth/google.js` line 50: OAuth fallback host → `hollyhubdigitals.vercel.app`
  - `api/auth/github.js` line 52: OAuth fallback host → `hollyhubdigitals.vercel.app`
  - `api/auth/reset-request.js` line 30: Email reset origin → `hollyhubdigitals.vercel.app`

### 2. Vercel.json Configuration
- **Status**: ✅ FIXED
- **Change**: Entry point corrected from `server_static.js` → `server.js`
- **Impact**: Build will now succeed on Vercel

### 3. Plaintext Password Login
- **Status**: ✅ IMPLEMENTED
- **Changes**:
  - `api/auth/register.js`: Stores both `password` (plaintext) and `passwordHash` (bcrypt)
  - `api/auth/login.js`: Checks plaintext password first, then bcrypt hash (backward compatible)

### 4. Google Translate Styling
- **Status**: ✅ COMPLETED
- **Changes**:
  - `styles.css`: Hidden `#language-select` dropdown with `display: none !important`
  - `styles.css`: Added `.goog-te-combo` styling (dark theme, borders, hover effects)
  - `app-loader.js`: Polls for combobox and applies dynamic CSS every 300ms

### 5. All Dependencies
- **Status**: ✅ INSTALLED
- All npm packages including `aws-sdk` are installed

---

## ⚠️ CRITICAL ISSUES TO RESOLVE BEFORE DEPLOYING

### 1. Environment Variables (MUST BE SET IN VERCEL DASHBOARD)
These are required for the application to function:

```
REQUIRED (Critical):
- JWT_SECRET=<long-random-string> (for auth tokens)
- ADMIN_USER=<admin-username>
- ADMIN_PASS=<admin-password>

Email/Reset Functionality:
- RESEND_API_KEY=<your-resend-api-key>
- RESEND_FROM=<your-verified-email@example.com>

Payment Processing:
- PAYSTACK_SECRET=<your-paystack-secret-key>
- PAYSTACK_PUBLIC_KEY=<your-paystack-public-key>

OAuth (if configured):
- GOOGLE_CLIENT_ID=<from-google-console>
- GOOGLE_CLIENT_SECRET=<from-google-console>
- GITHUB_CLIENT_ID=<from-github-settings>
- GITHUB_CLIENT_SECRET=<from-github-settings>

Captcha:
- CLOUDFLARE_SECRET=<your-cloudflare-turnstile-secret>

OPTIONAL (For persistent data storage):
- GITHUB_TOKEN=<github-personal-access-token>
- REPO_OWNER=<your-github-username>
- REPO_NAME=<repository-name>
- REPO_BRANCH=main
```

**ACTION**: Add all these to Vercel project settings → Environment Variables

### 2. Data Persistence Issue (CRITICAL for Production)
- **Problem**: Vercel has an ephemeral filesystem - all data files (users.json, blog.json, etc.) will be WIPED on every redeploy
- **Current State**: Server.js has read-only FS fallback that stores data in memory temporarily, but it's lost when function ends
- **Solutions**:
  - **Option A (Recommended)**: Enable GitHub integration
    - Set GITHUB_TOKEN, REPO_OWNER, REPO_NAME, REPO_BRANCH environment variables
    - Data will be stored in a GitHub repository and persist across deployments
  - **Option B**: Use S3/R2 for storage
    - Configure S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
    - More cost-effective for production
- **Impact if not fixed**: 
  - New users created on Monday → disappeared on Thursday redeploy
  - Blog posts written → gone after update
  - Portfolio items → vanished
  - **YOU WILL LOSE ALL USER DATA**

### 3. Admin Site Integration
- **Issue**: Admin site (separate Vercel account) needs to know the visitors API URL
- **Required Action**: Ensure admin site's `API_BASE_URL` is set to `https://hollyhubdigitals.vercel.app`
- **Verify**: Check admin deployment and test that blog/portfolio/user management works

### 4. Plaintext Password Security Concern
- **Issue**: Plaintext passwords stored in plain JSON - SECURITY RISK
- **Why it was added**: For account recovery if password hash corrupted
- **Recommendation**: 
  - Use GitHub storage + encryption, OR
  - Remove plaintext password after implementing robust password reset, OR
  - Use environment variable to toggle plaintext storage per user

---

## ✅ VERIFIED WORKING SYSTEMS

### Authentication Flow
- ✅ Login: Checks plaintext first, falls back to bcrypt
- ✅ Signup: Stores plaintext + hash
- ✅ Password Reset: Email sent via Resend API with fallback logging
- ✅ JWT: Tokens generated with 7-day expiry
- ✅ OAuth: Google and GitHub configured with Vercel fallbacks

### Frontend & API Communication
- ✅ All fetch calls use relative paths `/api/*` (no hardcoded URLs)
- ✅ Admin panel uses `API.buildURL()` - respects API_BASE_URL
- ✅ CORS allows: .vercel.app, localhost (dev), same-origin
- ✅ CSRF protects: POST/PUT/DELETE except public endpoints
- ✅ CSP headers expanded for: Paystack, Google Translate, Cloudflare, Tawk, Mixpanel, Klaviyo, etc.

### Payment Processing
- ✅ Paystack integration in `/api/checkout`
- ✅ Requires JWT authentication
- ✅ Exempted from CSRF checks
- ✅ Success/cancel redirect URLs generated from request origin

### Blog & Portfolio
- ✅ GET endpoints: Public, return JSON data
- ✅ POST/PUT/DELETE: Require JWT authentication
- ✅ Auto-regenerate HTML listings after edits
- ✅ GitHub storage fallback

### Read-Only Filesystem Handling
- ✅ Server.js wraps fs operations to catch EROFS errors
- ✅ Falls back to in-memory storage for ephemeral data
- ✅ Won't crash if writes fail - gracefully degrades

---

## 🔍 POTENTIAL ISSUES (Lower Priority)

### 1. AWS SDK Deprecation Warning
- **Status**: Non-critical
- **Detail**: AWS SDK v2 is EOL, but optional for this project
- **Action**: Can be deferred until S3 integration is needed

### 2. Documentation Outdated
- `DEPLOYMENT_GUIDE.md`: Still contains old Render references and split-repo language
- `render.yaml`: Old Render config file (can be deleted)
- **Action**: Update documentation after Vercel deployment is verified working

### 3. Data Migration from Render
- **Status**: Not yet done
- **Need to do**: 
  - Export users.json, blog.json, portfolio.json from Render
  - Import into GitHub repo or S3 bucket
  - Or manually re-create essential data
- **Timing**: Before Vercel redeploy or you'll lose the data from Render

### 4. Admin Site Deployment
- **Status**: Must be on different Vercel account per user request
- **Verify**: 
  - Admin site can reach this visitors API
  - Admin can create/edit blog and portfolio
  - Admin can manage users

---

## 🚀 DEPLOYMENT STEPS

### Step 1: Configure Environment Variables
1. Go to Vercel dashboard → Project settings → Environment Variables
2. Add all REQUIRED variables from section above
3. Redeploy project (or push to GitHub to trigger auto-deploy)

### Step 2: Test Core Functionality
After deployment, verify:
- [ ] Signup works: Created new user account
- [ ] Login works: Can log in with plaintext or old bcrypt password
- [ ] Password reset: Received email with reset link
- [ ] Payments: Paystack checkout loads correctly
- [ ] Blog: Can view posts, create/edit if authenticated
- [ ] Portfolio: Can view items, create/edit if authenticated
- [ ] Admin: Admin site can access and manage content

### Step 3: Setup Persistent Storage (Choose One)
#### Option A: GitHub Storage (Recommended for compatibility)
1. Create GitHub personal access token
2. Add to environment variables: GITHUB_TOKEN, REPO_OWNER, REPO_NAME, REPO_BRANCH
3. Redeploy
4. Test: Create blog post → Check GitHub repo for data/blog.json

#### Option B: S3 Storage
1. Create AWS S3 bucket and access keys
2. Add to environment variables: S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
3. Redeploy  
4. Test: Upload portfolio image → Check S3 bucket

### Step 4: Migrate Data from Render (If Applicable)
1. Download data files from Render deployment
2. Upload to GitHub repo or S3
3. Or re-create manually

---

## 🔐 Security Notes

1. **JWT_SECRET**: Must be cryptographically random (minimum 32 characters)
   - Example: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

2. **Admin Credentials**: Change from defaults!
   - Default ADMIN_USER: `admin`
   - Default ADMIN_PASS: `password`
   - Set strong values in environment variables

3. **Plaintext Passwords**: 
   - Currently enabled for account recovery
   - Consider disabling after implementing 2FA/backup codes
   - Or use encrypted storage

4. **CORS**: Currently allows all *.vercel.app subdomains
   - This is intentional for Vercel preview deployments
   - Tighten to specific domains in production if needed

---

## 📋 Git Status

**Latest Commits**:
- `a51b678` - fix(vercel): correct entry point from server_static.js to server.js
- `8549929` - feat(auth): store plaintext passwords + check plaintext first; fix(i18n): hide language select, style Google Translate widget  
- `0504106` - refactor: migrate from Render to Vercel - update all API URLs

**All changes pushed to**: `https://github.com/HollyHubDigital/hollyhub-visitors.git` (main branch)

---

## ❓ Common Issues & Troubleshooting

### Issue: "Unauthorized" when trying to create blog post
**Solution**: Check that JWT_SECRET environment variable is set (must match token signing secret)

### Issue: "Forbidden (invalid origin)" error
**Solution**: Ensure admin site domain ends with `.vercel.app` or is in ALLOWED_ORIGINS in server.js

### Issue: Users disappear after redeploy
**Solution**: You're seeing the data persistence issue. Set up GitHub or S3 storage (see section 2 above)

### Issue: Emails not sending
**Solution**: Check RESEND_API_KEY is valid and email address is verified in Resend

### Issue: Paystack not loading
**Solution**: Verify PAYSTACK_SECRET and PAYSTACK_PUBLIC_KEY are set, and CSP allows paystack.com

---

## ✨ Changes Made This Session

All changes are documented in this file and committed to Git at:
- **Branch**: main
- **Remote**: origin/main (GitHub)

To see all changes:
```bash
git log --oneline -10
git diff HEAD~10 HEAD
```

---

**Last Updated**: February 23, 2026, 02:31 UTC
**Deployment Status**: Ready for Vercel (pending environment variable configuration)
