# CRITICAL ENVIRONMENT SETUP - VISITORS SITE

## Your Actions Required on Vercel Dashboard

### 1. GitHub Token Configuration (FOR DATA PERSISTENCE)

**REQUIRED for likes, comments, and all data to persist across Vercel redeployments**

These variables must be set EXACTLY in your Vercel Environment Variables:

```
REPO_OWNER=HollyHubDigital
REPO_NAME=hollyhub-visitors
REPO_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxx (your Personal Access Token)
```

**GitHub Token Setup:**
1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Create new token with THESE permissions:
   - ✅ repo (full control of private repositories)
   - ✅ workflow (to allow GitHub Actions)
3. Copy the token immediately (you won't see it again)
4. Add to Vercel under "Environment Variables" for your "visitors" deployment

**Verify Token Works:**
- Token should be able to commit to your repository
- Go to your hollyhub-visitors repo → Settings → Deploy keys
- Your token should have "write access"

---

### 2. Email Reset Password Configuration

Choose ONE of these two methods:

#### Option A: Use Resend (Easier)

1. Go to https://Resend.com → Sign up
2. Get your API key from dashboard
3. Add to Vercel Environment Variables:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
   RESEND_FROM=noreply@yourdomain.com
   ```
   (Replace with your actual Resend API key and sender email)

#### Option B: Use SMTP (Gmail, Outlook, etc.)

Add to Vercel Environment Variables:
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password (or password)
SMTP_SECURE=0
SMTP_FROM=your-email@gmail.com
```

(For Gmail: Use [App Passwords](https://myaccount.google.com/apppasswords), NOT your regular password)

---

### 3. Optional: Admin Page Configuration

If you want an admin dashboard, add:
```
ADMIN_USER=admin
ADMIN_PASS=your-secure-password
JWT_SECRET=your-jwt-secret-key
```

---

## After Setting Environment Variables

1. Go to Vercel dashboard
2. Go to your "visitors" deployment
3. Click Settings → Environment Variables
4. Add all the above variables for your production environment
5. Redeploy the site (Vercel will auto-redeploy, or click "Redeploy")
6. Wait 2-3 minutes for deployment to complete

---

## Testing Checklist

After Vercel redeploys:

- [ ] **Likes persist** - Click like button on blog → refresh page → like should still show
- [ ] **Comments persist** - Post comment → refresh page → comment should still be there
- [ ] **Checkout works** - Click amount buttons → amount shows in input → Pay Now works
- [ ] **Google Translate** - All pages have language selector at top
- [ ] **Reset password** - Enter email on forgot password → should receive email link
- [ ] **Login/signup** - Should work without ES module errors

---

## Quick Debug Commands

If something still doesn't work:

```bash
# Test if Vercel sees your env vars (run in browser console on deployed site):
console.log('Site deployed successfully');
// If you see errors in console, check Vercel logs

# Check Vercel deployment logs:
# Go to vercel.com → Choose deployment → View deployment details
```

