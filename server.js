// Visitors Backend - Full API server for visitor pages and admin proxy
// Last deployment trigger: 2026-02-26
require('dotenv').config();
const express = require('express');
const multer = require('multer');
// Optional S3 / R2 support (use env vars to enable)
let AWS = null;
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { putFile, getFile } = require('./api/gh');
const os = require('os');
// Safe FS wrappers: if running in read-only serverless, fall back to in-memory store
let READ_ONLY_FS = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production' && !process.env.LOCAL_UPLOAD || false;
const _fs_readFileSync = fs.readFileSync.bind(fs);
const _fs_writeFileSync = fs.writeFileSync.bind(fs);
const _fs_mkdirSync = fs.mkdirSync && fs.mkdirSync.bind(fs);
const _fs_unlinkSync = fs.unlinkSync && fs.unlinkSync.bind(fs);
const _inMemoryFiles = new Map();

fs.readFileSync = function(filePath, ...args){
  try{ return _fs_readFileSync(filePath, ...args); }catch(e){
    if(e && (e.code === 'EROFS' || e.code === 'EACCES' || e.code === 'ENOENT')){
      // fall back to in-memory or sensible defaults for JSON
      const name = (typeof filePath === 'string') ? path.basename(filePath) : null;
      if(name && _inMemoryFiles.has(name)) return _inMemoryFiles.get(name);
      if(name && name.endsWith('.json')){
        if(name === 'settings.json' || name === 'pages_index.json') return '{}';
        return '[]';
      }
      return '';
    }
    throw e;
  }
};

fs.writeFileSync = function(filePath, data, ...args){
  try{ return _fs_writeFileSync(filePath, data, ...args); }catch(e){
    if(e && (e.code === 'EROFS' || e.code === 'EACCES')){
      READ_ONLY_FS = true;
      const name = (typeof filePath === 'string') ? path.basename(filePath) : null;
      if(name && name.endsWith('.json')){
        _inMemoryFiles.set(name, (typeof data === 'string') ? data : JSON.stringify(data));
        return;
      }
      return;
    }
    throw e;
  }
};

fs.mkdirSync = function(...args){
  try{ if(_fs_mkdirSync) return _fs_mkdirSync(...args); }catch(e){ if(e && (e.code === 'EROFS' || e.code === 'EACCES')){ READ_ONLY_FS = true; return; } throw e; }
};

fs.unlinkSync = function(...args){
  try{ if(_fs_unlinkSync) return _fs_unlinkSync(...args); }catch(e){ if(e && (e.code === 'EROFS' || e.code === 'EACCES')){ READ_ONLY_FS = true; return; } throw e; }
};
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const xss = require('xss-clean');
const Joi = require('joi');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password';
const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';

// ✅ CORS: Allow admin.hollyhubdigital.vercel.app and visitors on Render to access this API
const ALLOWED_ORIGINS = [
  // Vercel admin site (production)
  'https://admin-hollyhub.vercel.app',
  // older/alternate admin hostname (kept for compatibility)
  'https://admin-hollyhubdigital.vercel.app',
  // Vercel visitors site (production)
  'https://hollyhubdigitals.vercel.app',
  // Local dev (kept for local testing only)
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000'
];

// Allow preview patterns for Vercel
// (no need to push since wildcard .vercel.app is already allowed below)

app.use(cors({
  origin: (origin, callback) => {
    // Allow when no origin (server-to-server), or exact match, or Vercel hosts
    if (!origin || ALLOWED_ORIGINS.includes(origin) || (typeof origin === 'string' && origin.endsWith('.vercel.app'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// CORS error handler - return JSON instead of plain text
app.use((err, req, res, next) => {
  if (err && err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS: Origin not allowed' });
  }
  next(err);
});

// Capture raw request body for webhook signature verification
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb', verify: (req, res, buf) => { try{ req.rawBody = buf.toString(); }catch(e){ req.rawBody = ''; } } }));
app.use(express.urlencoded({ extended: true }));

// === Security middleware (headers, rate limiting, input sanitization, CSRF origin checks) ===
app.disable('x-powered-by');

// CORS - Allow admin dashboards to call this API from separate Vercel accounts
const allowedOrigins = [
  'https://admin-hollyhub.vercel.app',
  'https://admin-hollyhubdigital.vercel.app',
  'http://localhost:3000',
  'http://localhost:8080',
  'http://localhost:5000'
];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use((req, res, next) => {
  try{
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    // Content Security Policy: allow known external libs and allow admin sites to embed the visitors site in an iframe
    res.setHeader('Content-Security-Policy', "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://paystack.com https://js.paystack.co https://cdn.jsdelivr.net https://challenges.cloudflare.com https://cdn.mxpnl.com https://static.klaviyo.com https://www.googletagmanager.com https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com https://embed.tawk.to https://widget.privy.com https://cdn.yotpo.com https://script.hotjar.com https://cdn.segment.com https://embed.typeform.com https://widget.intercom.io https://api-iam.intercom.io https://assets.freshchat.com https://wchat.freshchat.com https://js.driftt.com https://load.sumome.com; script-src-elem 'self' 'unsafe-inline' https://paystack.com https://js.paystack.co https://cdn.jsdelivr.net https://challenges.cloudflare.com https://cdn.mxpnl.com https://static.klaviyo.com https://www.googletagmanager.com https://translate.google.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com https://embed.tawk.to https://widget.privy.com https://cdn.yotpo.com https://script.hotjar.com https://cdn.segment.com https://embed.typeform.com https://widget.intercom.io https://api-iam.intercom.io https://assets.freshchat.com https://wchat.freshchat.com https://js.driftt.com https://load.sumome.com; worker-src 'self' blob:; connect-src 'self' https: wss: https://eu.i.posthog.com https://translate.googleapis.com https://translate-pa.googleapis.com https://www.gstatic.com https://challenges.cloudflare.com; frame-src 'self' https://challenges.cloudflare.com https://paystack.com https://checkout.paystack.com https://js.paystack.co https://embed.tawk.to https://widget.privy.com https://assets.freshchat.com https://wchat.freshchat.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https: https://paystack.com https://js.paystack.co https://checkout.paystack.com https://cdn.jsdelivr.net https://widget.privy.com https://cdn.yotpo.com https://script.hotjar.com https://assets.freshchat.com https://wchat.freshchat.com https://fonts.googleapis.com https://www.gstatic.com; frame-ancestors 'self' https://admin-hollyhub.vercel.app https://admin-hollyhubdigital.vercel.app;");
    // If hosting platform injected an X-Frame-Options header, remove it so CSP frame-ancestors takes precedence
    try{ if(typeof res.removeHeader === 'function') res.removeHeader('X-Frame-Options'); }catch(e){}
  }catch(e){}
  next();
});

// ===== EMERGENCY FIX: RATE LIMITING COMPLETELY DISABLED =====
// User reported 429 errors preventing admin dashboard access
// Rate limiting has been completely removed to restore functionality
// Status: 2026-03-22T21:45:00Z - CRITICAL ISSUE RESOLUTION
const _rateMap = new Map();
// Rate limiter is 100% NON-FUNCTIONAL - all requests pass through
app.use((req, res, next) => {
  // RATE LIMITING DISABLED FOR EMERGENCY FIX
  // All requests bypass any rate limit checks
  // This middleware does nothing - pass all requests through
  next();
});
// Input sanitization
function sanitizeObject(obj){
  if(!obj || typeof obj !== 'object') return obj;
  for(const key of Object.keys(obj)){
    let val = obj[key];
    if(key.includes('$') || key.includes('.')){
      const safeKey = key.replace(/\$/g,'_').replace(/\./g,'_');
      obj[safeKey] = val;
      delete obj[key];
      continue;
    }
    if(typeof val === 'string'){
      val = val.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '');
      val = val.replace(/[<>]/g, '');
      obj[key] = val;
    } else if(typeof val === 'object'){
      sanitizeObject(val);
    }
  }
  return obj;
}

app.use((req, res, next) => {
  try{
    if(req.body) sanitizeObject(req.body);
    if(req.query) sanitizeObject(req.query);
  }catch(e){}
  next();
});

// Middleware: rewrite image srcs in HTML responses to CDN URLs (fallback)
app.use((req, res, next) => {
  const send = res.send.bind(res);
  res.send = function (body) {
    try {
      if (typeof body === 'string' && (body.indexOf('<html') !== -1 || body.indexOf('<!DOCTYPE') !== -1)) {
        const cdnBase = 'https://cdn.jsdelivr.net/gh/HollyHubDigital/hollyhub-visitors@main/public/assets/';
        // Replace quoted image filenames with CDN URLs
        body = body.replace(/src\s*=\s*["']hollyhub\.jpg["']/gi, `src="${cdnBase}hollyhub.jpg"`);
        body = body.replace(/src\s*=\s*["']hollyhubhero\.jpg["']/gi, `src="${cdnBase}hollyhubhero.jpg"`);
        body = body.replace(/src\s*=\s*["']google\.png["']/gi, `src="${cdnBase}google.png"`);
        body = body.replace(/src\s*=\s*["']github\.png["']/gi, `src="${cdnBase}github.png"`);
        body = body.replace(/src\s*=\s*["']whatsapp\.png["']/gi, `src="${cdnBase}whatsapp.png"`);
        body = body.replace(/src\s*=\s*["']Internet5\.jpg["']/gi, `src="${cdnBase}Internet5.jpg"`);
        // Also replace /assets/ prefixed paths
        body = body.replace(/src\s*=\s*["']\/assets\/([\w-]+\.(?:jpg|png|gif|svg|webp))["']/gi, `src="${cdnBase}$1"`);
      }
    } catch (e) { /* ignore */ }
    return send(body);
  };
  next();
});

// Add no-cache headers to all API responses
app.use((req, res, next) => {
  if (req.path && req.path.startsWith('/api')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// CSRF check (skip for public tracking endpoints)
app.use((req, res, next) => {
  try{
    const method = (req.method || '').toUpperCase();
    // Skip CSRF for public/payment endpoints like tracking, comments and checkout
    if(req.path === '/api/track' || req.path === '/api/public-settings' || req.path === '/api/checkout' || req.path === '/api/blog/comment' || req.path === '/api/blog/like') {
      return next();
    }
    if(['POST','PUT','DELETE','PATCH'].includes(method)){
      const origin = req.get('origin');
      const referer = req.get('referer');
      const host = `${req.protocol}://${req.get('host')}`;
      // Allow: same-origin, localhost, Vercel origins (admin)
      const isAllowedOrigin = origin && (
        origin === host || 
        origin.includes('localhost') || 
        origin.includes('127.0.0.1') ||
        origin.endsWith('.vercel.app')  // ✅ Allow Vercel origins
      );
      if(origin && !isAllowedOrigin){
        return res.status(403).send('Forbidden (invalid origin)');
      }
      
      // Check referer if no origin header
      const isAllowedReferer = !referer || (
        referer.startsWith(host) || 
        referer.includes('localhost') || 
        referer.includes('127.0.0.1') ||
        referer.includes('.vercel.app')  // ✅ Allow Vercel referer
      );
      if(!origin && referer && !isAllowedReferer){
        return res.status(403).send('Forbidden (invalid referer)');
      }
    }
  }catch(e){ /* ignore errors and continue */ }
  next();
});

// === VALIDATION SCHEMAS ===
const adminCreateSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(6).max(128).required(),
  setupToken: Joi.string().allow(null).allow('')
});

const adminLoginSchema = Joi.object({
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().max(128).required()
});

const adminUpdateCredsSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newUsername: Joi.string().alphanum().min(3).max(30).allow(null).allow(''),
  newPassword: Joi.string().min(6).max(128).allow(null).allow('')
});

const settingsSchema = Joi.object({
  gaId: Joi.string().max(30).allow(null).allow(''),
  whatsappNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).allow(null).allow(''),
  customScripts: Joi.array().items(Joi.string()).allow(null)
});

const checkoutSchema = Joi.object({
  amount: Joi.number().positive().max(10000).required(),
  email: Joi.string().email().max(255).allow(null).allow(''),
  description: Joi.string().max(500).allow(null).allow('')
});

const portfolioSchema = Joi.object({
  title: Joi.string().max(200).required(),
  category: Joi.string().max(100).allow(null).allow(''),
  description: Joi.string().max(2000).required(),
  image: Joi.string().max(500).allow(null).allow(''),
  url: Joi.string().uri().max(500).allow(null).allow('')
});

const blogSchema = Joi.object({
  title: Joi.string().max(300).required(),
  category: Joi.string().max(100).allow(null).allow(''),
  image: Joi.string().max(500).allow(null).allow(''),
  content: Joi.string().max(50000).required()
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: true, stripUnknown: true });
  if (error) {
    return res.status(400).send(`Validation error: ${error.details[0].message}`);
  }
  req.body = value;
  next();
};

// ===== S3 / R2 CONFIGURATION (EARLY INIT) =====
const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_REGION = process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1';
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '';
const S3_ENABLED = !!S3_BUCKET;
let s3 = null;
if (S3_ENABLED) {
  const s3conf = { region: S3_REGION };
  if (S3_ENDPOINT) s3conf.endpoint = S3_ENDPOINT;
  if (S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY) s3conf.credentials = new AWS.Credentials(S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY);
  s3 = new AWS.S3(s3conf);
}

// Static files - must come before HTML handlers
{
  const S3_BUCKET_ENV = process.env.S3_BUCKET || '';
  if (S3_BUCKET_ENV) {
    // Serve uploads from S3/R2 (stream or redirect)
    app.get('/uploads/:file', async (req, res) => {
      try{
        const file = req.params.file;
        const pub = process.env.S3_PUBLIC_URL || '';
        if(pub){
          return res.redirect(302, `${pub.replace(/\/$/, '')}/uploads/${encodeURIComponent(file)}`);
        }
        // lazy init S3 client
        const AWS_local = require('aws-sdk');
        const s3_local = new AWS_local.S3({ region: process.env.S3_REGION || process.env.AWS_REGION || 'us-east-1', endpoint: process.env.S3_ENDPOINT || undefined, credentials: (process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY) ? new AWS_local.Credentials(process.env.S3_ACCESS_KEY_ID, process.env.S3_SECRET_ACCESS_KEY) : undefined });
        const r = await s3_local.getObject({ Bucket: S3_BUCKET_ENV, Key: `uploads/${file}` }).promise();
        res.setHeader('Content-Type', r.ContentType || 'application/octet-stream');
        return res.send(r.Body);
      }catch(e){ console.error('S3 getObject error', e); return res.status(404).send('Not found'); }
    });
  } else {
    app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));
  }
}

// ✅ Explicit routes for sitemap and robots.txt (SEO)
app.get('/sitemap.xml', (req, res) => {
  try {
    const fp = path.join(__dirname, 'sitemap.xml');
    if(!fs.existsSync(fp)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    return res.sendFile(fp);
  } catch(e) {
    console.error('sitemap.xml error:', e);
    return res.status(500).send('Error');
  }
});

app.get('/robots.txt', (req, res) => {
  try {
    const fp = path.join(__dirname, 'robots.txt');
    if(!fs.existsSync(fp)) return res.status(404).send('Not found');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.sendFile(fp);
  } catch(e) {
    console.error('robots.txt error:', e);
    return res.status(500).send('Error');
  }
});

// Explicit handlers for root-level image assets
const imageAssets = ['hollyhub.jpg', 'hollyhubhero.jpg', 'google.png', 'github.png', 'whatsapp.png'];
imageAssets.forEach(filename => {
  app.get(`/${filename}`, (req, res) => {
    try {
      const filePath = path.join(__dirname, filename);
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
        return res.sendFile(filePath);
      }
    } catch (e) { console.error(`${filename} error:`, e); }
    return res.status(404).end();
  });
});

// Debug endpoint to check file system state
app.get('/__debug/fs', (req, res) => {
  const paths = [
    process.cwd(),
    path.join(process.cwd(), 'public'),
    path.join(process.cwd(), 'public/assets'),
    '/var/task',
    '/var/task/public',
    '/var/task/public/assets',
    __dirname,
    path.join(__dirname, 'public'),
    path.join(__dirname, 'public/assets')
  ];
  
  const info = {};
  paths.forEach(p => {
    try {
      const exists = fs.existsSync(p);
      let files = [];
      if (exists && fs.statSync(p).isDirectory()) {
        files = fs.readdirSync(p).slice(0, 5);
      }
      info[p] = { exists, isDir: exists && fs.statSync(p).isDirectory(), files };
    } catch (e) {
      info[p] = { error: e.message };
    }
  });
  
  return res.json({ __dirname, cwd: process.cwd(), paths: info });
});

// Debug endpoint to check GitHub configuration and connectivity
app.get('/__debug/github', async (req, res) => {
  try {
    const hasGithubToken = !!process.env.GITHUB_TOKEN;
    const hasRepoOwner = !!process.env.REPO_OWNER;
    const hasRepoName = !!process.env.REPO_NAME;
    const hasBranch = !!process.env.REPO_BRANCH;
    
    // Try to test GitHub API
    let githubTest = null;
    if (hasGithubToken && hasRepoOwner && hasRepoName) {
      try {
        const { getFile } = require('./api/gh');
        const testResult = await getFile('data/users.json');
        githubTest = { ok: true, message: 'Successfully read users.json from GitHub' };
      } catch (e) {
        githubTest = { ok: false, error: e.message };
      }
    }
    
    // Check getRepoConfig
    const repoConfig = await require('./api/utils').getRepoConfig({ body: {}, query: {} });
    
    return res.json({
      env: {
        hasGithubToken,
        hasRepoOwner,
        hasRepoName,
        hasBranch,
        REPO_OWNER: process.env.REPO_OWNER || '(not set)',
        REPO_NAME: process.env.REPO_NAME || '(not set)',
        REPO_BRANCH: process.env.REPO_BRANCH || '(not set)',
      },
      githubTest,
      repoConfig: repoConfig ? { owner: repoConfig.owner, repo: repoConfig.repo, branch: repoConfig.branch, hasToken: !!repoConfig.token } : null
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
});

// EXPLICIT IMAGE ROUTES MUST COME BEFORE express.static() MIDDLEWARE
// Pre-load images into memory to work around Vercel's serverless filesystem limitations
const imageCache = {};
const imageConfig = {
  '/public/assets/hollyhub.jpg': { paths: [
    path.join(process.cwd(), 'public/assets/hollyhub.jpg'),
    path.join(__dirname, 'public/assets/hollyhub.jpg'),
    '/var/task/public/assets/hollyhub.jpg',
    'public/assets/hollyhub.jpg'
  ], mime: 'image/jpeg' },
  '/hollyhub.jpg': { paths: [
    path.join(process.cwd(), 'public/assets/hollyhub.jpg'),
    path.join(__dirname, 'public/assets/hollyhub.jpg'),
    '/var/task/public/assets/hollyhub.jpg',
    'public/assets/hollyhub.jpg'
  ], mime: 'image/jpeg' },
  '/public/assets/hollyhubhero.jpg': { paths: [
    path.join(process.cwd(), 'public/assets/hollyhubhero.jpg'),
    path.join(__dirname, 'public/assets/hollyhubhero.jpg'),
    '/var/task/public/assets/hollyhubhero.jpg',
    'public/assets/hollyhubhero.jpg'
  ], mime: 'image/jpeg' },
  '/hollyhubhero.jpg': { paths: [
    path.join(process.cwd(), 'public/assets/hollyhubhero.jpg'),
    path.join(__dirname, 'public/assets/hollyhubhero.jpg'),
    '/var/task/public/assets/hollyhubhero.jpg',
    'public/assets/hollyhubhero.jpg'
  ], mime: 'image/jpeg' },
  '/public/assets/google.png': { paths: [
    path.join(process.cwd(), 'public/assets/google.png'),
    path.join(__dirname, 'public/assets/google.png'),
    '/var/task/public/assets/google.png',
    'public/assets/google.png'
  ], mime: 'image/png' },
  '/google.png': { paths: [
    path.join(process.cwd(), 'public/assets/google.png'),
    path.join(__dirname, 'public/assets/google.png'),
    '/var/task/public/assets/google.png',
    'public/assets/google.png'
  ], mime: 'image/png' },
  '/public/assets/github.png': { paths: [
    path.join(process.cwd(), 'public/assets/github.png'),
    path.join(__dirname, 'public/assets/github.png'),
    '/var/task/public/assets/github.png',
    'public/assets/github.png'
  ], mime: 'image/png' },
  '/github.png': { paths: [
    path.join(process.cwd(), 'public/assets/github.png'),
    path.join(__dirname, 'public/assets/github.png'),
    '/var/task/public/assets/github.png',
    'public/assets/github.png'
  ], mime: 'image/png' },
  '/public/assets/whatsapp.png': { paths: [
    path.join(process.cwd(), 'public/assets/whatsapp.png'),
    path.join(__dirname, 'public/assets/whatsapp.png'),
    '/var/task/public/assets/whatsapp.png',
    'public/assets/whatsapp.png'
  ], mime: 'image/png' },
  '/whatsapp.png': { paths: [
    path.join(process.cwd(), 'public/assets/whatsapp.png'),
    path.join(__dirname, 'public/assets/whatsapp.png'),
    '/var/task/public/assets/whatsapp.png',
    'public/assets/whatsapp.png'
  ], mime: 'image/png' }
};

console.log('[Init] Pre-loading', Object.keys(imageConfig).length, 'image routes into memory...');
Object.entries(imageConfig).forEach(([route, config]) => {
  let cachedData = null;
  for (const p of config.paths) {
    try {
      if (fs.existsSync(p)) {
        cachedData = fs.readFileSync(p);
        console.log(`[Init] ✓ Cached ${route} from ${p} (${cachedData.length} bytes)`);
        break;
      }
    } catch (e) {
      // Continue
    }
  }
  if (cachedData) {
    imageCache[route] = { data: cachedData, mime: config.mime };
  } else {
    console.error(`[Init] ✗ Failed to load ${route}`);
  }
});

// Serve images from cache
Object.keys(imageConfig).forEach((route) => {
  app.get(route, (req, res) => {
    const cached = imageCache[route];
    if (!cached) {
      console.error(`[Image] Request for ${route} but not in cache`);
      return res.status(404).json({ error: 'Image not found', route });
    }
    console.log(`[Image] ✓ Serving ${route} from cache (${cached.data.length} bytes)`);
    res.setHeader('Content-Type', cached.mime);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.setHeader('Content-Length', cached.data.length);
    return res.send(cached.data);
  });
});

// Serve public folder - use process.cwd() for Vercel compatibility
// THIS COMES AFTER explicit image routes so they have priority
const publicPath = path.join(process.cwd(), 'public');
app.use('/public', express.static(publicPath, { 
  maxAge: '1y', 
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Also serve assets at /assets for pages referencing /assets/*
app.use('/assets', express.static(path.join(process.cwd(), 'public', 'assets'), {
  maxAge: '1y',
  immutable: true,
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// Fallback: serve assets on-demand by checking multiple candidate paths
app.get('/assets/:file', (req, res) => {
  const file = req.params.file || '';
  const candidates = [
    path.join(process.cwd(), 'public', 'assets', file),
    path.join(__dirname, 'public', 'assets', file),
    path.join('/var/task', 'public', 'assets', file),
    path.join('public', 'assets', file),
    path.join(process.cwd(), file),
    path.join(__dirname, file)
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p) && fs.statSync(p).isFile()) {
        const ext = path.extname(p).toLowerCase();
        const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const data = fs.readFileSync(p);
        return res.send(data);
      }
    } catch (e) {
      // continue to next candidate
    }
  }
  return res.status(404).end();
});

// Specific handlers for common static assets (ensure correct MIME)
app.get('/styles.css', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'styles.css');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', 'text/css; charset=UTF-8');
      return res.sendFile(filePath);
    }
  } catch (e) { console.error('styles.css error:', e); }
  return res.status(404).end();
});

app.get('/script.js', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'script.js');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      return res.sendFile(filePath);
    }
  } catch (e) { console.error('script.js error:', e); }
  return res.status(404).end();
});

// Explicit app-loader handler
app.get('/app-loader.js', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'app-loader.js');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      return res.sendFile(filePath);
    }
  } catch (e) { console.error('app-loader.js error:', e); }
  return res.status(404).end();
});

// Explicit checkout.js handler
app.get('/checkout.js', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'checkout.js');
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      res.setHeader('Content-Type', 'application/javascript; charset=UTF-8');
      return res.sendFile(filePath);
    }
  } catch (e) { console.error('checkout.js error:', e); }
  return res.status(404).end();
});


// Generic static asset handler (fallback)
app.get(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|mp4|weba|webm)$/, (req, res, next) => {
  try {
    // Normalize and remove leading slashes to avoid absolute path issues
    const rel = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
    // Try multiple base paths for Vercel compatibility
    const possiblePaths = [
      path.join(process.cwd(), rel),       // Vercel runtime cwd
      path.join(__dirname, rel),            // Traditional __dirname
      path.join('/var/task', rel)           // Vercel function environment
    ];
    
    for (const filePath of possiblePaths) {
      try {
        if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes = {
            '.css': 'text/css; charset=UTF-8',
            '.js': 'application/javascript; charset=UTF-8',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml',
            '.ico': 'image/x-icon',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.weba': 'audio/webp'
          };
          res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
          return res.sendFile(filePath);
        }
      } catch (e) {
        // Try next path
      }
    }
  } catch (e) { console.error('Static file error:', e); }
  return next();
});

// Clean URL handler: serve pages like /about -> about.html
app.get('/:page', (req, res, next) => {
  try {
    const p = req.params.page;
    // ignore API and static-like requests
    if (!p || p.startsWith('api') || p.indexOf('.') !== -1) return next();
    const pageMap = { index: 'index.html', about: 'about.html', services: 'services.html', portfolio: 'portfolio.html', blog: 'blog.html', marketing: 'marketing.html', contact: 'contact.html', terms: 'terms.html' };
    const f = pageMap[p];
    const fp = f ? path.join(__dirname, f) : path.join(__dirname, p + '.html');
    if (!fs.existsSync(fp)) return next();
    let html = fs.readFileSync(fp, 'utf8');
    // inject scripts from apps-config
    const appsConfigPath = path.join(dataDir, 'apps-config.json');
    let appsCfg = { enabled: {} };
    try{ if(fs.existsSync(appsConfigPath)) appsCfg = JSON.parse(fs.readFileSync(appsConfigPath,'utf8') || '{}'); }catch(e){ appsCfg = { enabled: {} }; }
    try{
      const { getApp } = require('./api/app-registry');
      let injectScripts = '';
      for(const [appId, cfg] of Object.entries(appsCfg.enabled || {})){
        const appDef = getApp(appId);
        if(appDef && typeof appDef.scriptInjection === 'function'){
          try{ const s = appDef.scriptInjection(cfg || {}); if(s && s.length) injectScripts += '\n' + s + '\n'; }catch(e){ /* ignore */ }
        }
      }
      if(injectScripts && html.indexOf('</head>') !== -1) html = html.replace('</head>', injectScripts + '\n</head>');
    }catch(e){}
    res.setHeader('Content-Type','text/html');
    return res.send(html);
  }catch(e){ return next(); }
});

// Serve other static assets
const _serveStatic = express.static(path.join(__dirname));
app.use((req, res, next) => {
  // Skip API routes, let them be handled later
  if (req.path && req.path.startsWith('/api')) return next();
  // Skip HTML routes, handle those with app injection
  if (req.path === '/' || /\.html?$/.test(req.path)) return next();
  // Serve everything else as static
  return _serveStatic(req, res, next);
});
app.get('/', (req, res, next) => {
  try{
    const fp = path.join(__dirname, 'index.html');
    if(!fs.existsSync(fp)) return next();
    let html = fs.readFileSync(fp, 'utf8');

    const appsConfigPath = path.join(dataDir, 'apps-config.json');
    let appsCfg = { enabled: {} };
    try{ if(fs.existsSync(appsConfigPath)) appsCfg = JSON.parse(fs.readFileSync(appsConfigPath,'utf8') || '{}'); }catch(e){ appsCfg = { enabled: {} }; }

    try{
      const { getApp } = require('./api/app-registry');
      let injectScripts = '';
      for(const [appId, cfg] of Object.entries(appsCfg.enabled || {})){
        const appDef = getApp(appId);
        if(appDef && typeof appDef.scriptInjection === 'function'){
          try{
            const s = appDef.scriptInjection(cfg || {});
            if(s && s.length) injectScripts += '\n' + s + '\n';
          }catch(e){ console.error('app scriptInjection error', appId, e); }
        }
      }

      if(injectScripts && html.indexOf('</head>') !== -1){
        html = html.replace('</head>', injectScripts + '\n</head>');
      }
    }catch(e){ console.error('App injection failed', e); }

    res.setHeader('Content-Type','text/html');
    return res.send(html);
  }catch(e){ console.error('HTML serve error on /', e); return next(); }
});

// Serve other HTML files with app script injection
app.get(/\.html?$/, (req, res, next) => {
  try{
    const reqPath = req.path === '/' ? '/index.html' : req.path;
    const fp = path.join(__dirname, reqPath);
    if(!fs.existsSync(fp)) return next();
    let html = fs.readFileSync(fp, 'utf8');

    const appsConfigPath = path.join(dataDir, 'apps-config.json');
    let appsCfg = { enabled: {} };
    try{ if(fs.existsSync(appsConfigPath)) appsCfg = JSON.parse(fs.readFileSync(appsConfigPath,'utf8') || '{}'); }catch(e){ appsCfg = { enabled: {} }; }

    try{
      const { getApp } = require('./api/app-registry');
      let injectScripts = '';
      for(const [appId, cfg] of Object.entries(appsCfg.enabled || {})){
        const appDef = getApp(appId);
        if(appDef && typeof appDef.scriptInjection === 'function'){
          try{
            const s = appDef.scriptInjection(cfg || {});
            if(s && s.length) injectScripts += '\n' + s + '\n';
          }catch(e){ console.error('app scriptInjection error', appId, e); }
        }
      }

      if(injectScripts && html.indexOf('</head>') !== -1){
        html = html.replace('</head>', injectScripts + '\n</head>');
      }
    }catch(e){ console.error('App injection failed', e); }

    res.setHeader('Content-Type','text/html');
    return res.send(html);
  }catch(e){ console.error('HTML serve error', e); return next(); }
});

// Initialize directories
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const filesJson = path.join(dataDir, 'files.json');
const blogJson = path.join(dataDir, 'blog.json');
const usersJson = path.join(dataDir, 'users.json');
const portfolioJson = path.join(dataDir, 'portfolio.json');
const settingsJson = path.join(dataDir, 'settings.json');
const analyticsJson = path.join(dataDir, 'analytics.json');
const pagesIndexJson = path.join(dataDir, 'pages_index.json');
if(!fs.existsSync(filesJson)) fs.writeFileSync(filesJson, '[]');
if(!fs.existsSync(blogJson)) fs.writeFileSync(blogJson, '[]');
if(!fs.existsSync(usersJson)) fs.writeFileSync(usersJson, '[]');
if(!fs.existsSync(portfolioJson)) fs.writeFileSync(portfolioJson, '[]');
if(!fs.existsSync(settingsJson)) fs.writeFileSync(settingsJson, '{}');
if(!fs.existsSync(analyticsJson)) fs.writeFileSync(analyticsJson, '[]');
if(!fs.existsSync(pagesIndexJson)) fs.writeFileSync(pagesIndexJson, '{}');

// S3 was already configured at top of file; now set up upload storage & limits
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '200', 10);
// Always use memory storage for serverless/Vercel environments OR when S3/GitHub is configured
// (we never write uploads to local disk - always to GitHub or S3)
const storage = (S3_ENABLED || READ_ONLY_FS || process.env.GITHUB_TOKEN) ? multer.memoryStorage() : multer.diskStorage({ destination: uploadDir, filename: (req,file,cb)=>{ const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'); cb(null, safe); } });
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

// Helper to read/write JSON metadata either from local fs or S3
async function readStoreJson(name, fallback) {
  if (!S3_ENABLED) {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8') || (fallback || '[]')); } catch (e) { return fallback || [] }
  }
  try {
    const r = await s3.getObject({ Bucket: S3_BUCKET, Key: `data/${name}` }).promise();
    return JSON.parse(r.Body.toString('utf8') || (fallback || '[]'));
  } catch (e) {
    if (e.code === 'NoSuchKey' || e.code === 'NoSuchBucket' || e.statusCode === 404) return fallback || [];
    throw e;
  }
}

async function writeStoreJson(name, data) {
  if (!S3_ENABLED) {
    fs.writeFileSync(path.join(dataDir, name), JSON.stringify(data, null, 2), 'utf8');
    return;
  }
  await s3.putObject({ Bucket: S3_BUCKET, Key: `data/${name}`, Body: JSON.stringify(data, null, 2), ContentType: 'application/json' }).promise();
}

async function uploadToStore(fileBuffer, filename, mime) {
  if (!S3_ENABLED) throw new Error('S3 not enabled');
  const Key = `uploads/${filename}`;
  await s3.putObject({ Bucket: S3_BUCKET, Key, Body: fileBuffer, ContentType: mime || 'application/octet-stream' }).promise();
  const pub = process.env.S3_PUBLIC_URL || '';
  return pub ? `${pub.replace(/\/$/, '')}/uploads/${encodeURIComponent(filename)}` : filename;
}

function authRequired(req,res,next){
  const h = req.headers.authorization;
  console.log('[authRequired] Authorization header:', h ? `Present (${h.substring(0, 20)}...)` : 'MISSING');
  if(!h) return res.status(401).send('Missing token');
  const parts = h.split(' ');
  console.log('[authRequired] Header parts:', parts.length, '| Expected: 2');
  if(parts.length!==2) return res.status(401).send('Invalid token format');
  const token = parts[1];
  console.log('[authRequired] Token length:', token.length, '| Trying to verify...');
  try{
    const p = jwt.verify(token, JWT_SECRET);
    console.log('[authRequired] JWT verified successfully for user:', p.user);
    req.user = p;
    next();
  }catch(e){
    console.error('[authRequired] JWT verification failed:', e.message);
    return res.status(401).send('Invalid token: ' + e.message);
  }
}

// Accepts EITHER admin JWT OR GitHub token (for upload endpoint flexibility)
function authRequiredOrGithub(req,res,next){
  console.log('[authRequiredOrGithub] ===== AUTH CHECK START =====');
  console.log('[authRequiredOrGithub] Method:', req.method, '| Path:', req.path);
  
  // Check for GitHub token first (header or env)
  const githubTokenFromHeader = req.headers['x-github-token'];
  const githubTokenFromEnv = process.env.GITHUB_TOKEN;
  
  console.log('[authRequiredOrGithub] GitHub token from header:', !!githubTokenFromHeader);
  console.log('[authRequiredOrGithub] GitHub token from env:', !!githubTokenFromEnv);
  
  if(githubTokenFromHeader || githubTokenFromEnv) {
    console.log('[authRequiredOrGithub] ✓ Using GitHub token auth - allowing request');
    req.githubAuth = true;
    return next();
  }
  
  // Fall back to JWT admin auth
  const h = req.headers.authorization;
  console.log('[authRequiredOrGithub] Authorization header present:', !!h);
  if(!h) {
    console.error('[authRequiredOrGithub] ✗ FAILED: Missing authorization header');
    return res.status(401).send('Missing token');
  }
  
  const parts = h.split(' ');
  console.log('[authRequiredOrGithub] Header format - parts count:', parts.length, '| Part[0]:', parts[0]);
  
  if(parts.length!==2) {
    console.error('[authRequiredOrGithub] ✗ FAILED: Invalid header format (expected "Bearer <token>", got', parts.length, 'parts)');
    return res.status(401).send('Invalid token format');
  }
  
  const token = parts[1];
  console.log('[authRequiredOrGithub] Token length:', token.length, '| First 20 chars:', token.substring(0, 20) + '...');
  
  try{
    const p = jwt.verify(token, JWT_SECRET);
    console.log('[authRequiredOrGithub] ✓ JWT verified successfully for user:', p.user);
    req.user = p;
    next();
  }catch(e){
    console.error('[authRequiredOrGithub] ✗ FAILED: JWT verification error:', e.message);
    console.error('[authRequiredOrGithub] JWT_SECRET length:', JWT_SECRET ? JWT_SECRET.length : 'undefined');
    return res.status(401).send('Invalid token: ' + e.message);
  }
}

function getStoredAdmin(){
  try{
    const arr = JSON.parse(fs.readFileSync(usersJson,'utf8')) || [];
    if(!arr || arr.length===0) return null;
    let s = arr.find(u => u && typeof u.username === 'string' && u.username.length>0) ||
            arr.find(u => u && u.email === ADMIN_USER) ||
            arr[0];
    return { username: s.username || s.email || s.fullname || '', passwordHash: s.passwordHash || s.hash || s.password || '' };
  }catch(e){ return null; }
}

// ===== DEBUG ENDPOINTS =====
app.get('/api/debug/env', (req,res)=>{
  return res.json({
    GITHUB_TOKEN: process.env.GITHUB_TOKEN ? '✓ SET' : '✗ MISSING',
    REPO_OWNER: process.env.REPO_OWNER || '✗ MISSING',
    REPO_NAME: process.env.REPO_NAME || '✗ MISSING',
    REPO_BRANCH: process.env.REPO_BRANCH || 'main',
    NODE_ENV: process.env.NODE_ENV || 'not set'
  });
});

// ===== ADMIN ENDPOINTS =====
app.get('/api/admin/check', (req,res)=>{
  const a = getStoredAdmin();
  return res.json({ exists: !!a });
});

app.post('/api/admin/create', validate(adminCreateSchema), async (req,res)=>{
  const { username, password } = req.body;
  const existing = getStoredAdmin();
  if(existing) return res.status(400).send('Admin already exists');
  try{
    const hash = await bcrypt.hash(password, 10);
    const user = { username, passwordHash: hash, createdAt: new Date().toISOString() };
    fs.writeFileSync(usersJson, JSON.stringify([user], null, 2), 'utf8');
    return res.json({ ok: true });
  }catch(e){ return res.status(500).send('Create failed: '+e.message); }
});

app.post('/api/admin/login', validate(adminLoginSchema), async (req,res)=>{
  const { username, password } = req.body;
  const stored = getStoredAdmin();
  if(stored){
    const match = await bcrypt.compare(password || '', stored.passwordHash || '');
    if(username === stored.username && match){
      const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '12h' });
      return res.json({ token });
    }
    return res.status(401).send('Unauthorized');
  }
  if(username === ADMIN_USER && password === ADMIN_PASS){
    const token = jwt.sign({ user: username }, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token });
  }
  return res.status(401).send('Unauthorized');
});

const pageMap = { index: 'index.html', about: 'about.html', services: 'services.html', portfolio: 'portfolio.html', blog: 'blog.html', marketing: 'marketing.html', contact: 'contact.html', terms: 'terms.html' };

app.get('/api/pages/:page', (req,res)=>{
  const p = req.params.page; const f = pageMap[p]; if(!f) return res.status(404).send('Page not found');
  const fp = path.join(__dirname, f);
  if(!fs.existsSync(fp)) return res.status(404).send('File not found');
  res.setHeader('Content-Type', 'text/html');
  res.send(fs.readFileSync(fp, 'utf8'));
});

app.put('/api/pages/:page', authRequired, (req,res)=>{
  const p = req.params.page; const f = pageMap[p]; if(!f) return res.status(404).send('Page not found');
  const fp = path.join(__dirname, f);
  const body = req.body;
  const content = typeof body === 'object' && body.content ? body.content : (typeof req.body === 'string' ? req.body : (req.rawBody || ''));
  const toWrite = (content && content.length>0) ? content : (req.body && Object.keys(req.body).length===0 ? '' : JSON.stringify(req.body));
  try{ fs.writeFileSync(fp, toWrite, 'utf8'); return res.json({ ok:true }); }catch(e){ return res.status(500).send('Write failed: '+e.message); }
});

// ===== FILE UPLOAD =====
app.post('/api/upload', authRequiredOrGithub, upload.single('file'), async (req,res)=>{
  console.log('[/api/upload] ===== UPLOAD REQUEST RECEIVED =====');
  console.log('[/api/upload] User auth:', req.user ? '✓ JWT verified (' + req.user.user + ')' : 'None');
  console.log('[/api/upload] GitHub auth:', req.githubAuth ? '✓ Using GitHub token' : 'Not using GitHub auth');
  
  if(!req.file) {
    console.error('[/api/upload] No file in request');
    return res.status(400).send('No file');
  }
  
  console.log('[/api/upload] File received:', req.file.originalname, '| Size:', req.file.size, 'bytes');
  
  // Uploads REQUIRE GitHub token (Vercel serverless can't persist to local filesystem)
  if(!process.env.GITHUB_TOKEN || !process.env.REPO_OWNER || !process.env.REPO_NAME){
    console.error('[/api/upload] Missing GitHub config');
    return res.status(501).json({ 
      error: 'Uploads not configured', 
      message: 'GITHUB_TOKEN, REPO_OWNER, and REPO_NAME must be set in environment variables'
    });
  }

  const description = req.body.description || '';
  const targets = (req.body.targets || '').split(',').map(s=>s.trim()).filter(Boolean);

  try{
    const owner = process.env.REPO_OWNER;
    const repo = process.env.REPO_NAME;
    const branch = process.env.REPO_BRANCH || 'main';
    const token = process.env.GITHUB_TOKEN;
    
    console.log('[upload] Token length:', token ? token.length : 0, '| Token starts with:', token ? token.substring(0, 10) + '...' : 'MISSING');
    console.log('[upload] Repo:', owner, '/', repo, 'branch:', branch);
    
    const safe = Date.now() + '-' + (req.file.originalname || 'upload').replace(/[^a-zA-Z0-9._-]/g,'_');
    
    console.log('[upload] Starting upload:', { filename: req.file.originalname, size: req.file.size, safe, owner, repo, branch });
    
    const base64 = req.file.buffer.toString('base64');
    console.log('[upload] Converted to base64, size:', base64.length);
    
    // Upload to GitHub (pass isBase64=true since content is already base64-encoded)
    console.log('[upload] Calling putFile to GitHub...');
    await putFile(`public/uploads/${safe}`, base64, `Upload: ${safe}`, null, { owner, repo, branch, token }, true);
    console.log('[upload] GitHub upload successful');
    
    // Update metadata file
    const meta = { id: Date.now().toString(), filename: safe, originalname: req.file.originalname, description, targets, uploadedAt: new Date().toISOString() };
    
    try {
      console.log('[upload] Reading existing files.json from GitHub...');
      const existing = await getFile('data/files.json', { owner, repo, branch, token });
      const arr = JSON.parse(existing.content || '[]');
      arr.push(meta);
      console.log('[upload] Updating files.json metadata...');
      await putFile('data/files.json', JSON.stringify(arr, null, 2), 'Update files metadata', null, { owner, repo, branch, token });
      console.log('[upload] Metadata updated successfully');
    } catch(metaErr) {
      console.warn('[upload] Metadata update failed, but file uploaded:', metaErr.message);
    }
    
    console.log('[upload] Upload complete, returning metadata');
    return res.json(meta);
  }catch(e){ 
    console.error('[upload] CRITICAL ERROR:', e.message); 
    console.error('[upload] Stack:', e.stack);
    if(e.message.includes('401') || e.message.includes('Unauthorized')) {
      return res.status(401).json({ 
        error: 'GitHub authentication failed',
        message: 'The GITHUB_TOKEN appears to be invalid or expired. Please verify it on Vercel.',
        details: e.message
      });
    }
    return res.status(500).json({ 
      error: 'Upload failed', 
      message: e.message,
      details: 'Check Vercel logs for full error stack'
    }); 
  }
});

app.get('/api/files', authRequired, (req,res)=>{
  const arr = JSON.parse(fs.readFileSync(filesJson,'utf8')) || []; res.json(arr);
});

app.delete('/api/files/:filename', authRequired, (req,res)=>{
  const name = req.params.filename; const arr = JSON.parse(fs.readFileSync(filesJson,'utf8')) || [];
  const idx = arr.findIndex(x=>x.filename===name);
  if(idx===-1) return res.status(404).send('Not found');
  const fp = path.join(uploadDir, name);
  try{ if(fs.existsSync(fp)) fs.unlinkSync(fp); arr.splice(idx,1); fs.writeFileSync(filesJson, JSON.stringify(arr, null, 2)); return res.json({ ok:true }); }catch(e){ return res.status(500).send(e.message); }
});

// ===== BLOG =====
app.post('/api/blog', authRequired, async (req,res)=>{
  try {
    const { title, category, image, content } = req.body || {};
    if(!title || !content) return res.status(400).send('Missing title or content');
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req);
    let posts = [];
    
    // Try to read existing posts from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try { 
        const f = await getFile('data/blog.json', repoOpts); 
        posts = JSON.parse(f.content||'[]');
      } catch(e) {
        console.warn('[blog POST] GitHub read failed:', e.message);
        posts = [];
      }
    } else {
      // Try local fs as fallback
      try { posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || []; } catch(e) { posts = []; }
    }
    
    const post = { id: Date.now().toString(), title, category: category||'', image: image||'', content, createdAt: new Date().toISOString() };
    posts.unshift(post);
    const json = JSON.stringify(posts, null, 2);
    
    // Try to save to GitHub first
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try {
        await putFile('data/blog.json', json, 'Add blog post', null, repoOpts);
        console.log('[blog POST] Saved to GitHub');
      } catch(e) {
        console.warn('[blog POST] GitHub write failed, using /tmp fallback:', e.message);
      }
    }
    
    // Fallback to /tmp if GitHub unavailable
    if(!process.env.GITHUB_TOKEN) {
      try {
        const tmpDir = os.tmpdir();
        const blogDir = path.join(tmpDir, 'blog');
        if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
        const postFile = path.join(blogDir, post.id + '.json');
        fs.writeFileSync(postFile, JSON.stringify(post));
        console.log('[blog POST] Saved to /tmp');
      } catch(tmpErr) {
        console.error('[blog POST] /tmp fallback failed:', tmpErr.message);
      }
    }
    
    return res.json(post);
  } catch(e) {
    console.error('[blog POST] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/blog', authRequired, async (req,res)=>{
  try {
    const id = req.query.id;
    if(!id) return res.status(400).send('Missing id');
    const { title, category, image, content } = req.body || {};
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req);
    let posts = [];
    
    // Try to read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try { 
        const f = await getFile('data/blog.json', repoOpts); 
        posts = JSON.parse(f.content||'[]');
      } catch(e) {
        console.warn('[blog PUT] GitHub read failed:', e.message);
        posts = [];
      }
    } else {
      try { posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || []; } catch(e) { posts = []; }
    }
    
    const post = posts.find(p=>p.id===id);
    if(!post) return res.status(404).send('Post not found');
    if(title) post.title = title;
    if(typeof category !== 'undefined') post.category = category;
    if(typeof image !== 'undefined') post.image = image;
    if(typeof content !== 'undefined') post.content = content;
    post.updatedAt = new Date().toISOString();
    const json = JSON.stringify(posts, null, 2);
    
    // Try to save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try {
        await putFile('data/blog.json', json, 'Update blog post', null, repoOpts);
        console.log('[blog PUT] Saved to GitHub');
      } catch(e) {
        console.warn('[blog PUT] GitHub write failed, using /tmp fallback:', e.message);
      }
    }
    
    // Fallback to /tmp if GitHub unavailable
    if(!process.env.GITHUB_TOKEN) {
      try {
        const tmpDir = os.tmpdir();
        const blogDir = path.join(tmpDir, 'blog');
        if (!fs.existsSync(blogDir)) fs.mkdirSync(blogDir, { recursive: true });
        const postFile = path.join(blogDir, post.id + '.json');
        fs.writeFileSync(postFile, JSON.stringify(post));
        console.log('[blog PUT] Saved to /tmp');
      } catch(tmpErr) {
        console.warn('[blog PUT] /tmp fallback failed:', tmpErr.message);
      }
    }
    
    return res.json(post);
  } catch(e) {
    console.error('[blog PUT] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/blog', async (req,res)=>{
  try {
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    let posts = [];
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/blog.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        posts = JSON.parse(f.content||'[]');
        console.log('[blog GET] Read ' + posts.length + ' posts from GitHub');
      } catch(e) {
        console.error('[blog GET] GitHub read error:', e.message);
        posts = [];
      }
    } else {
      // Fallback to local fs
      try { posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || []; } catch(e) { posts = []; }
    }
    
    // Default posts if empty
    if(!posts || posts.length === 0){
      posts = [
        { id: Date.now().toString(), title: 'Top 10 Web Development Trends in 2025', category: 'Web Development', image: '', content: 'Explore the latest web development technologies and trends that are shaping the industry.', createdAt: new Date().toISOString() },
        { id: (Date.now()+1).toString(), title: 'Complete SEO Guide for Beginners', category: 'SEO', image: '', content: 'Learn the fundamentals of SEO and how to optimize your website for search engines.', createdAt: new Date().toISOString() },
        { id: (Date.now()+2).toString(), title: 'Content Marketing Strategy That Works', category: 'Digital Marketing', image: '', content: 'Discover how to create a content marketing strategy that attracts your target audience.', createdAt: new Date().toISOString() },
        { id: (Date.now()+3).toString(), title: 'Building a Profitable Online Store', category: 'E-Commerce', image: '', content: 'Everything you need to know about building and launching a successful online store.', createdAt: new Date().toISOString() },
        { id: (Date.now()+4).toString(), title: '7 Ways to Increase Website Conversions', category: 'Conversion', image: '', content: 'Proven tactics to increase your website conversion rate.', createdAt: new Date().toISOString() },
        { id: (Date.now()+5).toString(), title: 'Understanding Website Analytics', category: 'Analytics', image: '', content: 'Learn how to read and interpret website analytics and KPIs.', createdAt: new Date().toISOString() }
      ];
    }
    
    const normalize = (it)=>{
      const copy = Object.assign({}, it);
      const img = (copy.image||'').trim();
      if(img && !img.startsWith('http') && !img.startsWith('/')){
        copy.image = '/uploads/' + encodeURIComponent(img);
      }
      return copy;
    };
    res.json(posts.map(normalize));
  } catch(e) {
    console.error('[blog GET] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.delete('/api/blog', authRequired, async (req,res)=>{
  try {
    const id = req.query.id;
    if(!id) return res.status(400).send('Missing id');
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    let posts = [];
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/blog.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        posts = JSON.parse(f.content||'[]');
      } catch(e) {
        console.error('[blog DELETE] GitHub read error:', e.message);
        posts = [];
      }
    } else {
      try { posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || []; } catch(e) { posts = []; }
    }
    
    const idx = posts.findIndex(p=>p.id===id);
    if(idx===-1) return res.status(404).send('Post not found');
    posts.splice(idx,1);
    const json = JSON.stringify(posts, null, 2);
    
    // Save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try {
        await putFile('data/blog.json', json, 'Delete blog post', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        console.log('[blog DELETE] Saved to GitHub');
      } catch(e) {
        console.error('[blog DELETE] GitHub write error:', e.message);
      }
    } else {
      fs.writeFileSync(blogJson, json);
    }
    return res.json({ ok:true });
  } catch(e) {
    console.error('[blog DELETE] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ===== BLOG COMMENTS & LIKES =====
const commentsJson = path.join(dataDir, 'blog_comments.json');
const likesJson = path.join(dataDir, 'blog_likes.json');
if(!fs.existsSync(commentsJson)) fs.writeFileSync(commentsJson, '[]');
if(!fs.existsSync(likesJson)) fs.writeFileSync(likesJson, '[]');

app.post('/api/blog/comment', async (req,res)=>{
  try{
    const { postId, author, content } = req.body || {};
    if(!postId || !content) return res.status(400).json({ error: 'Missing postId or content' });
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    
    // Read current comments from GitHub
    let comments = [];
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        const f = await getFile('data/blog_comments.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        comments = JSON.parse(f.content || '[]');
        console.log('[blog comment] Read ' + comments.length + ' comments from GitHub');
      }catch(e){
        console.error('[blog comment] GitHub read error:', e.message);
        comments = [];
      }
    } else {
      // Fallback to local fs
      try{
        if(fs.existsSync(commentsJson)){
          const fileContent = fs.readFileSync(commentsJson, 'utf8');
          comments = JSON.parse(fileContent || '[]');
        }
      }catch(e){
        console.error('[blog comment] Error reading local comments.json:', e.message);
        comments = [];
      }
    }
    
    // Create new comment
    const comment = {
      id: Date.now().toString(),
      postId,
      author: author || 'Anonymous',
      content,
      muted: false,
      createdAt: new Date().toISOString()
    };
    comments.push(comment);
    
    const json = JSON.stringify(comments, null, 2);
    
    // Save comments to GitHub (async, don't block)
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      setImmediate(() => {
        putFile('data/blog_comments.json', json, 'Add comment', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token })
          .catch(err => console.warn('[blog comment] GitHub save failed:', err.message));
      });
    } else {
      // Fallback to local fs
      try{
        fs.writeFileSync(commentsJson, json, 'utf8');
      }catch(writeErr){
        console.error('[blog comment] Error writing local comments.json:', writeErr.message);
      }
    }
    
    return res.json(comment);
  }catch(e){
    console.error('[blog comment] Error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.get('/api/blog/comments', async (req,res)=>{
  try {
    const postId = req.query.postId;
    const includeMuted = req.query.includeMuted === '1' || false;
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    
    let comments = [];
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try {
        const f = await getFile('data/blog_comments.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        comments = JSON.parse(f.content || '[]');
        console.log('[blog comments GET] Read ' + comments.length + ' comments from GitHub');
      } catch(e) {
        console.error('[blog comments GET] GitHub read error:', e.message);
        comments = [];
      }
    } else {
      // Fallback to local fs
      try {
        comments = JSON.parse(fs.readFileSync(commentsJson,'utf8')) || [];
      } catch(e) {
        comments = [];
      }
    }
    
    let isAdminReq = false;
    try{
      const h = req.headers.authorization;
      if(h){ const t = h.split(' ')[1]; if(t){ jwt.verify(t, JWT_SECRET); isAdminReq = true; } }
    }catch(e){ isAdminReq = false; }

    const filtered = comments.filter(c=>{
      if(!isAdminReq && c.muted) return false;
      if(postId) return c.postId===postId;
      return true;
    });
    return res.json(filtered);
  } catch(e) {
    console.error('[blog comments GET] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/blog/comment/mute', authRequired, (req,res)=>{
  try{
    const { id, mute } = req.body || {};
    if(!id) return res.status(400).json({ error: 'Missing id' });
    
    // Read comments
    let comments = [];
    try{
      if(fs.existsSync(commentsJson)){
        const content = fs.readFileSync(commentsJson, 'utf8');
        comments = JSON.parse(content || '[]');
      }
    }catch(e){
      console.error('Error reading comments.json:', e.message);
      return res.status(500).json({ error: 'Failed to read comments' });
    }
    
    // Find and update comment
    const idx = comments.findIndex(c => c.id === id);
    if(idx === -1) return res.status(404).json({ error: 'Comment not found' });
    
    comments[idx].muted = !!mute;
    comments[idx].updatedAt = new Date().toISOString();
    
    // Save synchronously
    try{
      fs.writeFileSync(commentsJson, JSON.stringify(comments, null, 2), 'utf8');
    }catch(writeErr){
      console.error('Error writing comments.json:', writeErr.message);
      return res.status(500).json({ error: 'Failed to save' });
    }
    
    // Try GitHub asynchronously in background
    if(process.env.GITHUB_TOKEN && process.env.REPO_OWNER && process.env.REPO_NAME){
      setImmediate(() => {
        try{
          const { putFile } = require('./api/gh');
          putFile('data/blog_comments.json', JSON.stringify(comments, null, 2), 'Mute comment', null, {
            owner: process.env.REPO_OWNER,
            repo: process.env.REPO_NAME,
            branch: process.env.REPO_BRANCH || 'main',
            token: process.env.GITHUB_TOKEN
          }).catch(err => console.warn('GitHub mute sync failed:', err.message));
        }catch(e){
          console.warn('GitHub mute sync error:', e.message);
        }
      });
    }
    
    return res.json({ ok: true, id, muted: comments[idx].muted });
  }catch(e){
    console.error('Mute endpoint error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.delete('/api/blog/comment', authRequired, async (req,res)=>{
  try{
    const id = req.query.id;
    if(!id) return res.status(400).send('Missing id');
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    
    // Read current comments from GitHub
    let comments = [];
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        const f = await getFile('data/blog_comments.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        comments = JSON.parse(f.content || '[]');
        console.log('[blog comment DELETE] Read ' + comments.length + ' comments from GitHub');
      }catch(e){
        console.error('[blog comment DELETE] GitHub read error:', e.message);
        comments = [];
      }
    } else {
      // Fallback to local fs
      try{
        if(fs.existsSync(commentsJson)){
          const content = fs.readFileSync(commentsJson, 'utf8');
          comments = JSON.parse(content || '[]');
        }
      }catch(e){
        console.error('[blog comment DELETE] Error reading local comments.json:', e.message);
        comments = [];
      }
    }
    
    // Find and delete the comment
    const idx = comments.findIndex(c=>c.id===id);
    if(idx===-1) return res.status(404).send('Comment not found');
    comments.splice(idx,1);
    const json = JSON.stringify(comments, null, 2);
    
    // Save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        await putFile('data/blog_comments.json', json, 'Delete comment', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        console.log('[blog comment DELETE] Saved to GitHub');
      }catch(e){
        console.error('[blog comment DELETE] GitHub write error:', e.message);
      }
    } else {
      // Fallback to local fs
      try{
        fs.writeFileSync(commentsJson, json, 'utf8');
        console.log('[blog comment DELETE] Saved to local fs');
      }catch(writeErr){
        console.error('[blog comment DELETE] Error writing local comments.json:', writeErr.message);
      }
    }
    
    return res.json({ ok:true });
  }catch(e){
    console.error('[blog comment DELETE] Error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.post('/api/blog/like', async (req,res)=>{
  try{
    const { postId } = req.body || {};
    if(!postId) return res.status(400).json({ error: 'Missing postId' });
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    
    // Read current likes from GitHub
    let likes = [];
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        const f = await getFile('data/blog_likes.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        likes = JSON.parse(f.content || '[]');
        console.log('[blog like] Read ' + likes.length + ' likes from GitHub');
      }catch(e){
        console.error('[blog like] GitHub read error:', e.message);
        likes = [];
      }
    } else {
      // Fallback to local fs
      try{
        if(fs.existsSync(likesJson)){
          const content = fs.readFileSync(likesJson, 'utf8');
          likes = JSON.parse(content || '[]');
        }
      }catch(e){
        console.error('[blog like] Error reading local likes.json:', e.message);
        likes = [];
      }
    }
    
    // Add new like
    const rec = { 
      id: Date.now().toString(), 
      postId, 
      createdAt: new Date().toISOString() 
    };
    likes.push(rec);
    
    const json = JSON.stringify(likes, null, 2);
    
    // Count likes for this post
    const count = likes.filter(l => l.postId === postId).length;
    
    // Save to GitHub (async, don't block)
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      setImmediate(() => {
        putFile('data/blog_likes.json', json, 'Add like', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token })
          .catch(err => console.warn('[blog like] GitHub save failed:', err.message));
      });
    } else {
      // Fallback to local fs
      try{
        fs.writeFileSync(likesJson, json, 'utf8');
      }catch(writeErr){
        console.error('[blog like] Error writing local likes.json:', writeErr.message);
      }
    }
    
    return res.json({ ok: true, count });
  }catch(e){
    console.error('[blog like] Error:', e);
    return res.status(500).json({ error: 'Server error', details: e.message });
  }
});

app.get('/api/blog/likes', async (req,res)=>{
  try {
    const postId = req.query.postId;
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    
    let likes = [];
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try {
        const f = await getFile('data/blog_likes.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        likes = JSON.parse(f.content || '[]');
        console.log('[blog likes GET] Read ' + likes.length + ' likes from GitHub');
      } catch(e) {
        console.error('[blog likes GET] GitHub read error:', e.message);
        likes = [];
      }
    } else {
      // Fallback to local fs
      try {
        likes = JSON.parse(fs.readFileSync(likesJson,'utf8')) || [];
      } catch(e) {
        likes = [];
      }
    }
    
    if(postId) return res.json({ postId, count: likes.filter(l=>l.postId===postId).length });
    const counts = {};
    likes.forEach(l=>{ counts[l.postId] = (counts[l.postId]||0)+1; });
    return res.json(counts);
  } catch(e) {
    console.error('[blog likes GET] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ===== PAGES/SECTIONS =====
app.get('/api/pages/sections/:page', (req,res)=>{
  const page = req.params.page;
  try{
    let data = JSON.parse(fs.readFileSync(pagesIndexJson,'utf8') || '{}') || {};
    if(Array.isArray(data)) data = {};
    const sections = data[page] || { interImage: '', recentProjects: [] };
    return res.json(sections);
  }catch(e){ return res.status(500).send('Read failed'); }
});

app.put('/api/pages/sections/save', authRequired, (req,res)=>{
  const { page, sections } = req.body || {};
  if(!page) return res.status(400).send('Missing page');
  try{
    let data = JSON.parse(fs.readFileSync(pagesIndexJson,'utf8') || '{}') || {};
    if(Array.isArray(data)) data = {};
    data[page] = sections || { interImage: '', recentProjects: [] };
    fs.writeFileSync(pagesIndexJson, JSON.stringify(data, null, 2), 'utf8');
    return res.json({ ok:true, page, sections: data[page] });
  }catch(e){ return res.status(500).send('Write failed: '+e.message); }
});

// ===== PORTFOLIO =====
app.post('/api/portfolio', authRequired, async (req,res)=>{
  try {
    const { title, category, description, image, url } = req.body || {};
    if(!title || !description || !image) return res.status(400).send('Missing required fields');
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req);
    let items = [];
    
    // Try to read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try { 
        const f = await getFile('data/portfolio.json', repoOpts); 
        items = JSON.parse(f.content||'[]');
      } catch(e) {
        console.warn('[portfolio POST] GitHub read failed:', e.message);
        items = [];
      }
    } else {
      try { items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || []; } catch(e) { items = []; }
    }
    
    const item = { id: Date.now().toString(), title, category: category||'', description, image, url: url||'', createdAt: new Date().toISOString() };
    items.push(item);
    const json = JSON.stringify(items, null, 2);
    
    // Try to save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try {
        await putFile('data/portfolio.json', json, 'Add portfolio item', null, repoOpts);
        console.log('[portfolio POST] Saved to GitHub');
      } catch(e) {
        console.warn('[portfolio POST] GitHub write failed, using /tmp fallback:', e.message);
      }
    }
    
    // Fallback to /tmp if GitHub unavailable
    if(!process.env.GITHUB_TOKEN) {
      try {
        const tmpDir = os.tmpdir();
        const portfolioDir = path.join(tmpDir, 'portfolio');
        if (!fs.existsSync(portfolioDir)) fs.mkdirSync(portfolioDir, { recursive: true });
        const itemFile = path.join(portfolioDir, item.id + '.json');
        fs.writeFileSync(itemFile, JSON.stringify(item));
        console.log('[portfolio POST] Saved to /tmp');
      } catch(tmpErr) {
        console.warn('[portfolio POST] /tmp fallback failed:', tmpErr.message);
      }
    }
    
    return res.json(item);
  } catch(e) {
    console.error('[portfolio POST] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/portfolio', async (req,res)=>{
  try {
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    const id = req.query.id;
    let items = [];
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/portfolio.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        items = JSON.parse(f.content||'[]');
        console.log('[portfolio GET] Read ' + items.length + ' items from GitHub');
      } catch(e) {
        console.error('[portfolio GET] GitHub read error:', e.message);
        items = [];
      }
    } else {
      try { items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || []; } catch(e) { items = []; }
    }

    // Default fallback items if empty (for Vercel serverless deployment)
    if(!items || items.length === 0) {
      items = [
        { id: "1770909192560", title: "WEb3 Modal", category: "Web Design", description: "This is a web3 modal for reown, but just testing", image: "/uploads/Screenshot%202026-01-08%20142039.png", url: "https://support-portals-launchpad.vercel.app", createdAt: "2026-02-12T15:13:12.560Z" },
        { id: "1770910024666", title: "Hollyhub", category: "Web Design", description: "This is not an app but this is a modal", image: "/uploads/Internet.jpg", url: "https://acurast.com", createdAt: "2026-02-12T15:27:04.666Z" },
        { id: "1770912277558", title: "Hollywilly", category: "Email Marketing", description: "Digital marketing for your brand or for your needs", image: "/uploads/1770916659971-Internet4.jpg", url: "https://google.com", createdAt: "2026-02-12T16:04:37.558Z" },
        { id: "1770916072149", title: "Demo Project - Website Redesign", category: "Web Design", description: "A modern redesign delivered with performance and SEO in mind.", image: "/hollyhub.jpg", url: "https://example.com/demo", createdAt: "2026-02-12T17:07:52.149Z" },
        { id: "1770934775186", title: "HollyHub Modal", category: "Web3 Design", description: "This project is very amazing, i spent 4 months buiding this modal", image: "/uploads/1770934775171-Screenshot_2026-01-08_142039.png", url: "https://hollyhub-kran.vercel.app", createdAt: "2026-02-12T22:19:35.187Z" },
        { id: "1770953555973", title: "The Reown Modal", category: "Web3 Design", description: "This is my first reown modal that i built 3 months ago.", image: "/uploads/1770953555966-Internet.webp", url: "https://google.com", createdAt: "2026-02-13T03:32:35.973Z" }
      ];
      console.log('[portfolio GET] Using default fallback items');
    }
    
    const normalize = (it)=>{
      const copy = Object.assign({}, it);
      const img = (copy.image||'').trim();
      if(img && !img.startsWith('http') && !img.startsWith('/')) {
        copy.image = '/uploads/' + encodeURIComponent(img);
      }
      return copy;
    };
    if(id){
      const item = items.find(x=>x.id===id);
      if(!item) return res.status(404).send('Not found');
      return res.json(normalize(item));
    }
    return res.json(items.map(normalize));
  } catch(e) {
    console.error('[portfolio GET] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.put('/api/portfolio', authRequired, async (req,res)=>{
  try {
    const id = req.query.id;
    if(!id) return res.status(400).send('Missing id');
    const { title, category, description, image, url } = req.body || {};
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req);
    let items = [];
    
    // Try to read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try { 
        const f = await getFile('data/portfolio.json', repoOpts); 
        items = JSON.parse(f.content||'[]');
      } catch(e) {
        console.warn('[portfolio PUT] GitHub read failed:', e.message);
        items = [];
      }
    } else {
      try { items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || []; } catch(e) { items = []; }
    }
    
    const item = items.find(x=>x.id===id);
    if(!item) return res.status(404).send('Not found');
    if(title) item.title = title;
    if(typeof category !== 'undefined') item.category = category;
    if(typeof description !== 'undefined') item.description = description;
    if(typeof image !== 'undefined') item.image = image;
    if(typeof url !== 'undefined') item.url = url;
    item.updatedAt = new Date().toISOString();
    const json = JSON.stringify(items, null, 2);
    
    // Try to save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo && repoOpts.token) {
      try {
        await putFile('data/portfolio.json', json, 'Update portfolio item', null, repoOpts);
        console.log('[portfolio PUT] Saved to GitHub');
      } catch(e) {
        console.warn('[portfolio PUT] GitHub write failed, using /tmp fallback:', e.message);
      }
    }
    
    // Fallback to /tmp if GitHub unavailable
    if(!process.env.GITHUB_TOKEN) {
      try {
        const tmpDir = os.tmpdir();
        const portfolioDir = path.join(tmpDir, 'portfolio');
        if (!fs.existsSync(portfolioDir)) fs.mkdirSync(portfolioDir, { recursive: true });
        const itemFile = path.join(portfolioDir, item.id + '.json');
        fs.writeFileSync(itemFile, JSON.stringify(item));
        console.log('[portfolio PUT] Saved to /tmp');
      } catch(tmpErr) {
        console.warn('[portfolio PUT] /tmp fallback failed:', tmpErr.message);
      }
    }
    
    return res.json(item);
  } catch(e) {
    console.error('[portfolio PUT] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.delete('/api/portfolio', authRequired, async (req,res)=>{
  try {
    const id = req.query.id;
    if(!id) return res.status(400).send('Missing id');
    
    const { getRepoConfig } = require('./api/utils');
    const { getFile, putFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    let items = [];
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/portfolio.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        items = JSON.parse(f.content||'[]');
      } catch(e) {
        console.error('[portfolio DELETE] GitHub read error:', e.message);
        items = [];
      }
    } else {
      try { items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || []; } catch(e) { items = []; }
    }
    
    const idx = items.findIndex(x=>x.id===id);
    if(idx===-1) return res.status(404).send('Not found');
    items.splice(idx,1);
    const json = JSON.stringify(items, null, 2);
    
    // Save to GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try {
        await putFile('data/portfolio.json', json, 'Delete portfolio item', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        console.log('[portfolio DELETE] Saved to GitHub');
      } catch(e) {
        console.error('[portfolio DELETE] GitHub write error:', e.message);
      }
    } else {
      fs.writeFileSync(portfolioJson, json);
    }
    return res.json({ ok:true });
  } catch(e) {
    console.error('[portfolio DELETE] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

// ===== ADMIN CREDENTIALS =====
app.post('/api/admin/update-credentials', authRequired, validate(adminUpdateCredsSchema), async (req,res)=>{
  const { currentPassword, newUsername, newPassword } = req.body;
  
  const stored = getStoredAdmin();
  if(!stored) return res.status(500).send('No admin found');
  
  const match = await bcrypt.compare(currentPassword || '', stored.passwordHash || '');
  if(!match) return res.status(401).send('Incorrect password');
  
  const users = JSON.parse(fs.readFileSync(usersJson,'utf8')) || [];
  const admin = users[0];
  if(!admin) return res.status(500).send('Admin not found');
  
  if(newUsername) admin.username = newUsername;
  if(newPassword){
    admin.passwordHash = await bcrypt.hash(newPassword, 10);
  }
  admin.updatedAt = new Date().toISOString();
  
  fs.writeFileSync(usersJson, JSON.stringify(users, null, 2));
  return res.json({ ok:true });
});

// ===== SETTINGS =====
app.get('/api/settings', async (req,res)=>{
  try {
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    let settings = {};
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/settings.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        settings = JSON.parse(f.content||'{}');
        console.log('[settings GET] Read from GitHub');
      } catch(e) {
        console.error('[settings GET] GitHub read error:', e.message);
        settings = {};
      }
    } else {
      try { settings = JSON.parse(fs.readFileSync(settingsJson,'utf8')) || {}; } catch(e) { settings = {}; }
    }
    res.json(settings);
  } catch(e) {
    console.error('[settings GET] Error:', e.message);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/settings', authRequired, validate(settingsSchema), async (req,res)=>{
  const { gaId, customScripts, whatsappNumber } = req.body;
  const settings = { gaId: gaId||'', customScripts: customScripts||[], whatsappNumber: whatsappNumber||'' };
  const settingsJson_str = JSON.stringify(settings, null, 2);
  try{
    // Try to save to GitHub if configured
    const { getRepoConfig } = require('./api/utils');
    const repoOpts = await getRepoConfig(req) || {};
    if(repoOpts && repoOpts.owner && repoOpts.repo){
      try{
        const { putFile } = require('./api/gh');
        await putFile('data/settings.json', settingsJson_str, 'Update settings', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
      }catch(ghErr){ console.warn('GitHub save failed for settings:', ghErr.message); }
    }
    
    // Always save locally
    fs.writeFileSync(settingsJson, settingsJson_str);
    return res.json({ ok:true });
  }catch(e){
    console.error('Settings save error:', e);
    return res.status(500).send('Failed to save settings');
  }
});

app.get('/api/public-settings', async (req,res)=>{
  try {
    const { getRepoConfig } = require('./api/utils');
    const { getFile } = require('./api/gh');
    const repoOpts = await getRepoConfig(req) || {};
    let settings = {};
    
    // Read from GitHub
    if(repoOpts && repoOpts.owner && repoOpts.repo) {
      try { 
        const f = await getFile('data/settings.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); 
        settings = JSON.parse(f.content||'{}');
        console.log('[public-settings GET] Read from GitHub');
      } catch(e) {
        console.error('[public-settings GET] GitHub read error:', e.message);
        settings = {};
      }
    } else {
      try { settings = JSON.parse(fs.readFileSync(settingsJson,'utf8')) || {}; } catch(e) { settings = {}; }
    }
    return res.json({ whatsappNumber: settings.whatsappNumber || '' });
  } catch(e) {
    console.error('[public-settings GET] Error:', e.message);
    return res.json({ whatsappNumber: '' });
  }
});

// ===== ANALYTICS =====
app.post('/api/analytics', (req,res)=>{
  const { page, browser, country } = req.body || {};
  const records = JSON.parse(fs.readFileSync(analyticsJson,'utf8')) || [];
  const record = { id: Date.now().toString(), page: page||'unknown', browser: browser||'unknown', country: country||'unknown', timestamp: new Date().toISOString() };
  records.push(record);
  fs.writeFileSync(analyticsJson, JSON.stringify(records, null, 2));
  return res.json({ ok:true });
});

app.get('/api/analytics', authRequired, (req,res)=>{
  const records = JSON.parse(fs.readFileSync(analyticsJson,'utf8')) || [];
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const todayRecords = records.filter(r=>new Date(r.timestamp)>=today);
  
  const uniqueCountries = new Set();
  const countryStats = {};
  const browserStats = {};
  const pageViewStats = {};
  
  records.forEach(r=>{
    if(r.country && r.country!=='unknown') uniqueCountries.add(r.country);
    countryStats[r.country] = (countryStats[r.country]||0)+1;
    browserStats[r.browser] = (browserStats[r.browser]||0)+1;
    pageViewStats[r.page] = (pageViewStats[r.page]||0)+1;
  });
  
  const stats = {
    totalVisitors: records.length,
    todayVisitors: todayRecords.length,
    uniqueVisitors: uniqueCountries.size,
    countryStats: Object.entries(countryStats).map(([country,count])=>({country,count})).sort((a,b)=>b.count-a.count),
    browserStats: Object.entries(browserStats).map(([browser,count])=>({browser,count})).sort((a,b)=>b.count-a.count),
    pageViewStats: Object.entries(pageViewStats).map(([page,views])=>({page,views})).sort((a,b)=>b.views-a.views)
  };
  
  return res.json(stats);
});

// ===== SERVER-SIDE TRACKING (FOR AD-BLOCKER BYPASS) =====
app.post('/api/track', (req,res)=>{
  try{
    if(req.method !== 'POST'){
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const body = req.body || {};
    const { event, properties = {}, userId } = body;
    if(!event){
      return res.status(400).json({ error: 'Missing event name' });
    }
    let mixpanelToken = process.env.MIXPANEL_TOKEN;
    if(!mixpanelToken){
      try{
        const appsConfigPath = path.join(dataDir, 'apps-config.json');
        if(fs.existsSync(appsConfigPath)){
          const config = JSON.parse(fs.readFileSync(appsConfigPath, 'utf8'));
          if(config.enabled && config.enabled.mixpanel && config.enabled.mixpanel.token){
            mixpanelToken = config.enabled.mixpanel.token;
          }
        }
      }catch(e){ console.error('Error reading apps config:', e); }
    }
    if(!mixpanelToken){
      return res.status(501).json({ error: 'Mixpanel not configured' });
    }
    const timestamp = Math.floor(Date.now() / 1000);
    const eventData = {
      event: event,
      properties: {
        token: mixpanelToken,
        time: timestamp,
        distinct_id: userId || 'anonymous',
        ...properties
      }
    };
    // For now, just log the event server-side and return success
    console.log('[Track] Event:', event, 'Properties:', properties);
    return res.json({ ok: true, tracked: event });
  }catch(e){
    console.error('Track error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// Dynamic API loader
app.all('/api/*', async (req, res) => {
  try{
    const rel = req.path.replace(/^\/api\//, '');
    const filePath = path.join(__dirname, 'api', rel + '.js');
    if(fs.existsSync(filePath)){
      const handler = require(filePath);
      return handler(req, res);
    }
  }catch(e){ console.error('Dynamic API loader error', e); return res.status(500).send(e.message); }
});

app.listen(PORT, ()=>{ console.log('✅ Visitors Backend running on port', PORT); });

app.use((err, req, res, next) => {
  if (!err) return next();
  if (err && (err.code === 'LIMIT_FILE_SIZE' || err instanceof multer.MulterError)) {
    const msg = err.code === 'LIMIT_FILE_SIZE' ? 'File too large' : (err.message || 'Upload error');
    return res.status(413).send(msg);
  }
  console.error('Unhandled error', err && err.stack ? err.stack : err);
  return res.status(500).send(typeof err === 'string' ? err : (err && err.message ? err.message : 'Internal server error'));
});
