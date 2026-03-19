# Vercel Environment Variables Setup Guide

## Overview
Your application uses GitHub API to persist data (user credentials, comments, likes, blog posts, portfolio posts) on Vercel's serverless platform, which doesn't have persistent file storage between deployments.

## Required Environment Variables

### 1. **GitHub API Configuration** (Required for Data Persistence)
These are CRITICAL for saving all user data (comments, likes, posts, credentials, etc.).

Set these on Vercel:
```
REPO_OWNER=HollyHubDigital
REPO_NAME=hollyhub-visitors
REPO_BRANCH=main
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

**How to get GITHUB_TOKEN:**
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: "Holly Vercel"
4. Select these scopes:
   - `repo` (Full control of private repositories)
   - `workflow` (Manage GitHub Actions)
   - `read:public_key` (Read public SSH key information)
5. Click "Generate token"
6. Copy the token immediately (you won't see it again)
7. Add it to Vercel as `GITHUB_TOKEN`

**Important:** 
- The repository must exist and be accessible with this token
- The token needs `repo` scope to read/write data files
- Without this, all data (comments, likes, posts, credentials) will be lost after deployment

### 2. **Email Reset Configuration** (For Password Reset Emails)

You have two options:

#### Option A: Resend API (Recommended for Vercel)
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
RESEND_FROM=noreply@yourdomain.com
```

Get Resend API key: https://resend.com/dashboard

#### Option B: SMTP (Fallback)
```
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxxxxxxxxxxxx
SMTP_FROM=noreply@yourdomain.com
```

### 3. **OAuth Configuration**
```
GITHUB_CLIENT_ID=Ov23lixxxxxxxxxx
GITHUB_CLIENT_SECRET=xxxxxxxxxxxxxxxx
GOOGLE_CLIENT_ID=xxxxx-xxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxx
```

### 4. **Security**
```
JWT_SECRET=your_random_secret_key_here
NEXTAUTH_SECRET=your_random_secret_key_here
```

## Step-by-Step Setup on Vercel

1. **Go to your Vercel project dashboard**
   - Visit https://vercel.com/dashboard

2. **Click on your project** (hollyhubdigitals or similar)

3. **Go to Settings → Environment Variables**

4. **Add each variable:**
   - NAME: `REPO_OWNER`
   - VALUE: `HollyHubDigital`
   - Click "Save"

5. **Repeat for all variables** above

6. **Redeploy:**
   - Go to Deployments
   - Click the three dots on the latest deployment
   - Select "Redeploy"
   - Or push a new commit to trigger auto-deploy

## Verification

### Check if Data Persistence is Working:

1. **Test 1: User Signup**
   - Create a new account at https://hollyhubdigitals.vercel.app/signup.html
   - Reload the page
   - Try logging in - account should still exist
   - Check your GitHub repo's `data/users.json` file

2. **Test 2: Blog Comments**
   - Add a comment on a blog post
   - Reload the page
   - Comment should still be there
   - Check your GitHub repo's `data/blog_comments.json` file

3. **Test 3: Password Reset**
   - Click "Forgot password" on login page
   - Enter an existing user's email
   - You should receive a password reset email
   - Check the email and reset your password

4. **Check Logs:**
   - Vercel → your project → Functions → Select any API endpoint
   - Look for "[reset-request]" or GitHub-related logs
   - If you see errors, note them and check:
     - Is GITHUB_TOKEN set correctly?
     - Is the repository accessible?
     - Is RESEND_API_KEY valid?

## Troubleshooting

### Data not persisting after reload
- ✅ Check: Is GITHUB_TOKEN set on Vercel?
- ✅ Check: Can you access the GitHub repo with that token?
- ✅ Check: Does the repo have a `data/` folder with JSON files?
- ✅ Solution: Redeploy after setting GitHub variables

### Email reset not working
- ✅ Check: Is RESEND_API_KEY or SMTP_PASS set correctly?
- ✅ Check: Is the email address in an existing user account?
- ✅ Check: Vercel logs for "[reset-request]" errors
- ✅ Solution: Verify email service credentials, redeploy

### 500 error on login
- ✅ Check: Are GitHub API variables configured?
- ✅ Check: Is GITHUB_TOKEN valid and hasn't expired?
- ✅ Check: Vercel function logs for actual error message
- ✅ Solution: Update GITHUB_TOKEN, redeploy

## File Structure in GitHub

After setup, your repository should have:
```
data/
├── users.json              # User credentials
├── password_resets.json    # Password reset tokens
├── blog_comments.json      # Blog comments
├── blog_likes.json         # Blog post likes
├── blog.json               # Blog post content
├── portfolio.json          # Portfolio items
├── files.json              # Uploaded files metadata
├── analytics.json          # Analytics data
└── settings.json           # Site settings
```

All these files will be auto-created and updated by the API as users interact with the site.

## Security Notes

⚠️ **Important:**
- Never commit `.env` to GitHub - use `.gitignore`
- Store all secrets in Vercel's environment variables, not in files
- Rotate GITHUB_TOKEN if it gets compromised
- Use separate tokens for different services if possible
- Keep RESEND_API_KEY safe - it can send emails on your behalf

## Support

If something isn't working:
1. Check Vercel function logs for error messages
2. Verify all required variables are set
3. Redeploy after making changes
4. Wait 1-2 minutes for changes to take effect
5. Clear browser cache (Ctrl+Shift+Delete) and try again

---
**Last Updated:** March 19, 2026
**Status:** All critical fixes implemented
