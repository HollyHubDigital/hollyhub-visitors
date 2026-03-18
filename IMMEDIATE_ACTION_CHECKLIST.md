# ✅ ACTION CHECKLIST - What You Need To Do Next

## CRITICAL: Add Environment Variables to Vercel (This makes everything work!)

### Step 1: Go to Vercel Dashboard
1. Open https://vercel.com
2. Log in with your account
3. Click on your project "hollyhub-visitors"
4. Click **Settings** in the top menu
5. Click **Environment Variables** in the left sidebar

### Step 2: Add GitHub Token (Required for likes/comments persistence)
1. Click **Add New**
2. Name: `REPO_OWNER`
3. Value: `HollyHubDigital`
4. Select "Production"
5. Click Save

Repeat for:
- Name: `REPO_NAME` → Value: `hollyhub-visitors`
- Name: `REPO_BRANCH` → Value: `main`

### Step 3: Add GitHub Token (The crucial one!)
1. Go to GitHub personal access tokens:
   - https://github.com/settings/tokens
2. Click **Generate new token (classic)**
3. Name it: `Vercel Visitors Repo Access`
4. **MUST CHECK**: ✅ `repo` (Full control of private repositories)
5. Click **Generate token**
6. **Copy the token immediately** (you won't see it again!)

Back in Vercel:
1. Click **Add New** again
2. Name: `GITHUB_TOKEN`
3. Value: Paste your token here
4. Select "Production"
5. Click Save

### Step 4: Add Email Configuration (Pick ONE method)

#### Option A: Resend (Recommended - Easier)
1. Go to https://Resend.com and sign up
2. Get your API key from dashboard
3. In Vercel, click **Add New**:
   - Name: `RESEND_API_KEY`
   - Value: Your Resend API key
   - Select "Production"
   - Save
4. Click **Add New** again:
   - Name: `RESEND_FROM`
   - Value: `onboarding@resend.dev`
   - Select "Production"  
   - Save

#### Option B: SMTP with Gmail
1. Set up App Password for Gmail:
   - Go to https://myaccount.google.com/apppasswords
   - Create an app password (NOT your regular Gmail password!)
   - Copy the 16-character password

2. In Vercel, add these:
   - `SMTP_HOST` = `smtp.gmail.com`
   - `SMTP_PORT` = `587`
   - `SMTP_USER` = your-email@gmail.com
   - `SMTP_PASS` = your 16-character app password
   - `SMTP_SECURE` = `0`
   - (optional) `SMTP_FROM` = your-email@gmail.com

### Step 5: Redeploy on Vercel
- Vercel will auto-redeploy once you save variables
- OR: Click **Deployments** → Find the latest one → Click three dots → **Redeploy**
- Wait 2-3 minutes for deployment to complete

---

## Testing Checklist (After Vercel redeployment completes)

Go through each item and verify it works:

### Blog Features
- [ ] Visit https://hollyhubdigitals.vercel.app/blog.html
- [ ] Click the ❤️ like button on a blog post
- [ ] Refresh the page (F5)
- [ ] Like should STILL be there (persisted!)
- [ ] Post a comment
- [ ] Refresh the page
- [ ] Comment should STILL be there

### Translation Features
- [ ] Go to any page (homepage, about, services, etc.)
- [ ] Look in the header for language selector dropdown
- [ ] Click it and select "Español"
- [ ] Page should translate to Spanish
- [ ] Click back and select "English"
- [ ] Should return to English

### Checkout Features
- [ ] Visit https://hollyhubdigitals.vercel.app/checkout.html
- [ ] Click one of the preset buttons ($100, $250, $500, $1000)
- [ ] The amount should appear in the input field
- [ ] Click "Pay Now"
- [ ] Paystack payment form should appear (don't submit for real!)

### Auth Features  
- [ ] Visit https://hollyhubdigitals.vercel.app/login.html
- [ ] Try to log in (don't worry if it fails, just check NO errors)
- [ ] Go to https://hollyhubdigitals.vercel.app/signup.html
- [ ] Try to sign up
- [ ] Should NOT see "ES module" error
- [ ] Should see "Email and password required" or similar message

### Password Reset
- [ ] Go to login page
- [ ] Click "Forgot password?"
- [ ] Enter your email
- [ ] Should see "Reset link sent"
- [ ] Check your email (including spam folder)
- [ ] Should have received reset link

---

## If Something Doesn't Work

### Likes/Comments Still Not Persisting?
1. Verify all three GitHub env vars are set:
   - `REPO_OWNER` = `HollyHubDigital`
   - `REPO_NAME` = `hollyhub-visitors`
   - `GITHUB_TOKEN` = (your personal access token)
2. Check Vercel logs:
   - Go to Deployments → Latest → Logs
   - Look for errors about GitHub
3. Verify GitHub token has `repo` permission
   - Go to https://github.com/settings/tokens
   - Click on your token
   - Should show ✅ under `repo`

### Paystack Form Not Loading?
1. Hard refresh: Ctrl+Shift+R (not just F5)
2. Check browser console:
   - Press F12 to open DevTools
   - Click Console tab
   - Look for any red error messages
3. Check if Paystack can load:
   - Press F12 → Network tab
   - Reload page
   - Look for `checkout.paystack.com` in requests
   - Should be green (success), not red

### Google Translate Not Working?
1. Verify language dropdown is visible in header
2. Make sure JavaScript is enabled in browser
3. Try this:
   - Open DevTools → Console
   - Type: `typeof google` and press Enter
   - Should show "object"

### Login/Signup Still Showing Errors?
1. Hard refresh: Ctrl+Shift+R
2. Open DevTools → Console
3. Look for the specific error message
4. Check Vercel deployment logs for clues

### Email Not Arriving?
1. Check spam/junk folder first
2. If using Resend:
   - Verify email was verified in Resend dashboard
   - Check Resend logs for delivery status
3. If using SMTP:
   - Verify Gmail app password is correct (not regular password!)
   - Check Vercel logs for SMTP errors

---

## ⚡ Quick Commands (If you need to check something)

### Check current Vercel deployment
Visit: https://vercel.com → Select project → Deployments → Latest

### View deployment logs
Click the deployment → Logs → Runtime Logs

### Check if site is deployed
Visit: https://hollyhubdigitals.vercel.app/

### Check if GitHub token works
Go to: https://github.com/settings/tokens → Check your token

---

## 📞 Common Questions Answered

**Q: I set the env vars but they're not working?**
A: Make sure you selected "Production" environment when adding them. Vercel won't use preview-only vars on production site.

**Q: Do I need to set keys in admin deployment too?**
A: Only if you're using the admin dashboard. For visitor site, use "visitors" deployment settings.

**Q: How long until Vercel redeploys?**
A: Usually 2-3 minutes after you save env vars. Can check status in Deployments tab.

**Q: Will this break my site temporarily?**
A: No, adding env vars and redeploying is safe. Old version stays live until new one is ready.

**Q: What if I make a typo in env var value?**
A: Just edit it again. Click the env var, change the value, save. Vercel will redeploy.

**Q: Can I use a different GitHub token?**
A: Yes, any personal access token with `repo` permission works, from any GitHub account.

**Q: Do I need to add all env vars at once?**
A: No, add GitHub vars first (critical for persistence). Email vars can be added later.

---

## 🎉 When Everything Works

After deployment and testing, you should have:
- ✅ Likes that persist across page refreshes
- ✅ Comments that save permanently
- ✅ Language translation on all pages
- ✅ Working checkout form with Paystack
- ✅ Login/signup without errors
- ✅ Password reset emails

---

**Start with Step 1 above. You've got this! All the code is ready and deployed. Just need to add the environment variables.**

