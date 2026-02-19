# HollyHub Digital - Visitors Site

🌐 **Production:** https://hollyhubdigital.vercel.app

This is the **visitors-facing website** with the complete backend API for HollyHub Digital freelance services.

## 📋 What's Included

✅ **Visitor Pages:**
- Landing page (index.html)
- Services, Portfolio, Blog
- Contact, About, Terms
- Signup/Login/Password Reset

✅ **Backend API:**
- Admin authentication & credentials management
- Blog management (create, edit, delete posts)
- Portfolio management
- File upload & management
- Email integration (Resend SMTP)
- Payment processing (Paystack)
- Analytics tracking
- App integrations (Google Analytics, Mixpanel, Privy, Yotpo, etc.)

✅ **Security:**
- JWT-based authentication
- Rate limiting (240 requests/minute)
- XSS protection & input sanitization
- CSRF origin checks
- Secure headers (Helmet)
- Password hashing (bcryptjs)

✅ **CORS:**
- Allows requests from `admin-hollyhubdigital.vercel.app`
- Allows localhost for local development

## 🚀 Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Set up .env file (copy from .env template)
cp .env .env.local

# Start development server
npm run dev
```

Server runs on `http://localhost:3000`

### Environment Variables

All required keys are listed in `.env`. Key variables:

- **JWT_SECRET** - For authentication tokens
- **PAYSTACK_SECRET** - For payment processing
- **SMTP_PASS** - For email sending via Resend
- **ADMIN_USER** & **ADMIN_PASS** - Admin login credentials

See `VERCEL_ENV_SETUP.md` for complete list and Vercel setup instructions.

## 📁 Project Structure

```
.
├── index.html, about.html, services.html, etc.  (Visitor pages)
├── styles.css, script.js, checkout.js            (Frontend assets)
├── app-loader.js                                 (Visitor-facing app integrations)
├── server.js                                     (Express backend)
├── api/                                          (API endpoints)
│   ├── auth/                                     (Authentication)
│   ├── checkout.js                              (Payments)
│   ├── blog.js, portfolio.js, files.js          (Content management)
│   ├── apps.js                                  (App management)
│   ├── public-config.js                         (Public configuration)
│   └── ... (other endpoints)
├── data/                                         (JSON data storage)
│   ├── users.json                               (Admin & user accounts)
│   ├── blog.json                                (Blog posts)
│   ├── portfolio.json                           (Portfolio items)
│   ├── apps-config.json                         (App integrations config)
│   └── ... (other data)
├── public/uploads/                              (File uploads)
└── package.json
```

## 🔐 CORS Configuration

The server accepts requests from:
- `https://admin-hollyhubdigital.vercel.app` (production)
- `http://localhost:3001` (admin development)
- `http://localhost:3000` (direct access)

The admin dashboard proxies all API calls through this domain.

## 🌐 Deployment

### To Vercel

1. Create a new Vercel project
2. Connect this repository
3. Add all environment variables from `.env` to Vercel Settings
4. Deploy

```bash
vercel
```

### Production Domain

Set custom domain in Vercel: `hollyhubdigital.vercel.app`

## 🔗 Admin Dashboard

The admin panel is in a separate repository: **admin-hollyhubdigital**

Admin Features:
- Manage blog posts
- Manage portfolio items
- Manage files & uploads
- Manage integrations (apps)
- View analytics
- Update admin password

Admin dashboard in production: https://admin-hollyhubdigital.vercel.app

## 📚 API Documentation

### Public Endpoints (No Auth Required)
- `GET /api/blog` - Get all blog posts
- `GET /api/portfolio` - Get all portfolio items
- `GET /api/public-config` - Get public configuration
- `GET /api/public-settings` - Get public settings (WhatsApp, etc.)

### Admin Endpoints (Auth Required)
- `POST /api/admin/login` - Login to admin
- `POST /api/admin/create` - Create initial admin account
- `POST /api/blog` - Create blog post
- `PUT /api/blog?id={id}` - Update blog post
- `DELETE /api/blog?id={id}` - Delete blog post
- `POST /api/portfolio` - Create portfolio item
- `POST /api/upload` - Upload file
- `GET /api/analytics` - View analytics
- `POST /api/settings` - Update settings

### Visitor Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/reset-request` - Request password reset
- `POST /api/checkout` - Create Paystack payment
- `POST /api/blog/comment` - Add blog comment
- `POST /api/blog/like` - Like blog post

**For complete API docs, see `/api/` folder**

## 🔑 Admin Setup

On first deployment, you must set up admin credentials:

1. Visit: `https://hollyhubdigital.vercel.app/admin`
2. Click "Create Admin Account"
3. Enter username & password
4. Login to admin dashboard

Or manually set in `data/users.json`:
```json
[{
  "username": "admin",
  "passwordHash": "bcrypt_hash_here",
  "createdAt": "2026-02-19T..."
}]
```

## 🛡️ Security

- All API keys stored in Vercel environment variables (not in code)
- Passwords hashed with bcryptjs
- JWT tokens with 12-hour expiration
- Rate limiting prevents brute force
- CORS restricts cross-origin requests
- CSP headers prevent XSS
- CSRF origin validation

## 📞 Support

For issues related to:
- **Visitor site:** Contact Holly directly
- **Admin panel:** Check admin-hollyhubdigital repo
- **Payments:** Paystack documentation
- **Email:** Resend documentation

## 📄 License

Private project for HollyHub Digital
