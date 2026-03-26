# HollyHub Digital - Admin Dashboard

🔐 **Production:** https://admin-hollyhubdigital.vercel.app

This is the **admin control panel** for managing HollyHub Digital's website content and integrations.

## 📋 What's Included

✅ **Admin Features:**
- Blog post management (create, edit, delete)
- Portfolio item management
- File upload & management
- Integration/App configuration (Google Analytics, Paystack, etc.)
- Analytics dashboard (visitor stats, page views)
- Admin password management
- Settings management (WhatsApp, custom scripts)

## 🏗️ Architecture

This is a **lightweight proxy dashboard** that:
1. Serves the admin interface (HTML/CSS/JS)
2. Proxies all API requests to the **visitors domain**
3. Has NO database - all data is on the visitors domain

**Visitors Backend:** https://hollyhubdigital.vercel.app
**Admin Dashboard:** https://admin-hollyhubdigital.vercel.app

All API calls from admin → forwarded to visitors domain

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Set up .env file
cat > .env << EOF
PORT=3000
VISITORS_API_URL=http://localhost:3000
EOF

# In one terminal, start visitors backend (port 3000):
# cd ../visitors-repo && npm start

# In another terminal, start admin dashboard (port 3001):
PORT=3001 npm start
```

**Then:**
- Visitors site: http://localhost:3000
- Admin dashboard: http://localhost:3001/admin

### Environment Variables

**Minimal setup required:**
```
PORT=3000
VISITORS_API_URL=https://hollyhubdigital.vercel.app
```

The admin proxy automatically:
- Forwards all `/api/*` requests to VISITORS_API_URL
- Includes authorization headers
- Handles CORS automatically

## 📁 Project Structure

```
.
├── admin/                              (Admin panel files)
│   ├── admin.html                      (Admin dashboard page)
│   ├── admin.js                        (Admin logic & API calls)
│   ├── adminlogin.html                 (Login page)
│   └── setup.html                      (Initial setup page)
├── styles.css                          (Shared CSS)
├── server.js                           (Express proxy server)
├── package.json
├── .env                                (API URL config)
└── vercel.json                         (Vercel deploy config)
```

## 🔄 How Admin Works

### 1. User Flow

```
1. User visits admin-hollyhubdigital.vercel.app
2. Browser loads admin/admin.html
3. JavaScript in admin.js makes API calls to /api/*
4. Server.js proxies calls to VISITORS_API_URL
5. Response returned to browser
6. Admin UI updates
```

### 2. Authentication Flow

```
1. Admin enters username/password in login
2. POST /api/admin/login
   └─> Server.js proxies to: https://hollyhubdigital.vercel.app/api/admin/login
3. Visitors API validates & returns JWT token
4. Admin stores JWT in localStorage
5. All future API calls include Authorization: Bearer {token}
6. Visitors API validates token & processes request
```

### 3. Data Flow

```
Admin Dashboard (admin.html)
    │
    └─> API Call: POST /api/blog
         │
         └─> Admin Server (server.js)
              │
              └─> Visitors Backend
                   │
                   └─> data/blog.json (or other data)
```

## 🔐 Admin Features

### Blog Management
- **View all posts** - `GET /api/blog`
- **Create post** - `POST /api/blog`
- **Edit post** - `PUT /api/blog?id={id}`
- **Delete post** - `DELETE /api/blog?id={id}`
- **Comments** - View & manage blog comments

### Portfolio Management
- **View items** - `GET /api/portfolio`
- **Add item** - `POST /api/portfolio`
- **Edit item** - `PUT /api/portfolio?id={id}`
- **Delete item** - `DELETE /api/portfolio?id={id}`

### File Management
- **Upload files** - `POST /api/upload`
- **View uploads** - `GET /api/files`
- **Delete file** - `DELETE /api/files/{filename}`

### Integrations
- **Configure apps** - `POST /api/apps`
- **Manage integrations** - (Google Analytics, Paystack, Privy, Yotpo, etc.)
- **View app status** - Which integrations are enabled

### Analytics
- **View stats** - `GET /api/analytics`
- **Visitor metrics** - Total visitors, unique countries, browsers, pages
- **Today's stats** - Real-time visitor count

### Settings
- **Admin password** - `POST /api/admin/update-credentials`
- **Public settings** - `POST /api/settings` (WhatsApp #, custom scripts)
- **Google Analytics ID** - Configure for visitors site

## 🌐 Deployment

### Deploy to Vercel

1. **Create Vercel Project:**
   ```bash
   vercel
   ```

2. **Add Environment Variable:**
   ```
   VISITORS_API_URL = https://hollyhubdigital.vercel.app
   ```

3. **Redeploy:**
   ```bash
   vercel --prod
   ```

4. **Custom Domain:**
   - Set domain to: `admin-hollyhubdigital.vercel.app`
   - Or your preferred subdomain

## 🔗 Integration with Visitors Site

The admin panel connects to the **visitors backend** which:
- Hosts all visitor pages (index.html, about.html, etc.)
- Runs all API endpoints
- Stores all data (JSON files in `/data`)
- Manages email, payments, authentication

**CORS Configuration:**
The visitors backend allows requests from:
- `https://admin-hollyhubdigital.vercel.app` (production)
- `http://localhost:3001` (local development)

## 🔐 Security Notes

- **No secrets in this repo** - All API keys on visitors domain
- **JWT stored in localStorage** - Automatically sent with every API call
- **CORS enabled** - Admin can call visitors API across domains
- **API keys protected** - Admin can't see Paystack secret or SMTP password
- **Authentication required** - Most admin endpoints need valid JWT token

## 📊 Monitoring

### Check if Everything Works

**Local Test:**
```bash
# Start visitors on port 3000
cd ../visitors-repo && npm start

# In another terminal, start admin on port 3001
cd admin-repo && PORT=3001 npm start

# Test in browser
open http://localhost:3001/admin

# Try login (default: admin/password)
```

**Production Check:**
```bash
# Visit admin dashboard
https://admin-hollyhubdigital.vercel.app/admin

# Check Vercel logs for proxy errors
vercel.com → Project → Deployments → Logs
```

## 🆘 Troubleshooting

### "Visitors API unavailable"
- Check `VISITORS_API_URL` in `.env`
- Verify visitors site is deployed & running
- Check Vercel deployments for errors

### "401 Unauthorized"
- JWT token expired (clear localStorage & re-login)
- Wrong credentials in admin login
- Visitors backend JWT_SECRET mismatch

### "CORS Error"
- Visitors backend CORS headers may need updating
- Verify admin domain is in ALLOWED_ORIGINS
- Check Server.js CORS settings

### Admin login not working
- Check if admin account exists in visitors `/data/users.json`
- Try resetting admin via /admin/setup.html on visitors site
- Check JWT_SECRET matches between both domains

## 📞 Support

For issues:
1. **Admin dashboard problems** → Check this repo's server.js
2. **API errors** → Check visitors repo's API endpoints
3. **Data issues** → Check data files in visitors `/data` folder
4. **Deployment issues** → Check Vercel logs & environment variables

## 📄 License

Private project for Holly - HollyHub Digital
