// Visitors Backend - Full API server for visitor pages and admin proxy
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
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

// ✅ CORS: Allow admin.hollyhubdigital.vercel.app to access this API
const ALLOWED_ORIGINS = [
  'https://admin-hollyhubdigital.vercel.app',
  'http://localhost:3001',
  'http://localhost:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:3000'
];

// Allow the public visitors domain (production) and common Vercel preview patterns if needed
ALLOWED_ORIGINS.push('https://hollyhubdigital.vercel.app');

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Capture raw request body for webhook signature verification
app.use(express.json({ limit: process.env.JSON_LIMIT || '10mb', verify: (req, res, buf) => { try{ req.rawBody = buf.toString(); }catch(e){ req.rawBody = ''; } } }));
app.use(express.urlencoded({ extended: true }));

// === Security middleware (headers, rate limiting, input sanitization, CSRF origin checks) ===
app.disable('x-powered-by');

app.use((req, res, next) => {
  try{
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=()');
    // Explicitize script-src-elem and allow known external payment libs and worker blobs
    res.setHeader('Content-Security-Policy', "default-src 'self' https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://paystack.com https://js.paystack.co https://cdn.jsdelivr.net; script-src-elem 'self' https://paystack.com https://js.paystack.co https://cdn.jsdelivr.net; worker-src 'self' blob:; connect-src 'self' https: wss: https://eu.i.posthog.com; img-src 'self' data: https:; style-src 'self' 'unsafe-inline' https: https://paystack.com https://js.paystack.co https://cdn.jsdelivr.net;");
  }catch(e){}
  next();
});

// Rate limiting
const _rateMap = new Map();
const RATE_WINDOW_MS = parseInt(process.env.RATE_WINDOW_MS || '60000', 10);
const RATE_MAX = parseInt(process.env.RATE_MAX || '240', 10);
app.use((req, res, next) => {
  try{
    const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let entry = _rateMap.get(ip);
    if(!entry || now > entry.reset){
      entry = { count: 1, reset: now + RATE_WINDOW_MS };
      _rateMap.set(ip, entry);
    } else {
      entry.count++;
      if(entry.count > RATE_MAX){
        res.setHeader('Retry-After', Math.ceil((entry.reset - now) / 1000));
        return res.status(429).send('Too many requests - try again later');
      }
    }
  }catch(e){ /* if rate limiter fails, allow request to proceed */ }
  next();
});

setInterval(() => {
  const now = Date.now();
  try{
    for(const [ip, entry] of _rateMap.entries()){
      if(entry.reset < now) _rateMap.delete(ip);
    }
  }catch(e){}
}, 60 * 1000).unref && setInterval(() => {} , 60*1000);

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

// CSRF check
app.use((req, res, next) => {
  try{
    const method = (req.method || '').toUpperCase();
    if(['POST','PUT','DELETE','PATCH'].includes(method)){
      const origin = req.get('origin');
      const referer = req.get('referer');
      const host = `${req.protocol}://${req.get('host')}`;
      if(origin && !(origin === host || origin.includes('localhost') || origin.includes('127.0.0.1'))){
        return res.status(403).send('Forbidden (invalid origin)');
      }
      if(!origin && referer && !(referer.startsWith(host) || referer.includes('localhost') || referer.includes('127.0.0.1'))){
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

// Static files - must come before HTML handlers
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

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

// Generic static asset handler (fallback)
app.get(/\.(css|js|png|jpg|jpeg|gif|svg|ico|webp|mp4|weba|webm)$/, (req, res, next) => {
  try {
    // Normalize and remove leading slashes to avoid absolute path issues
    const rel = decodeURIComponent((req.path || '').replace(/^\/+/, ''));
    const filePath = path.join(__dirname, rel);
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

const storage = multer.diskStorage({ destination: uploadDir, filename: (req,file,cb)=>{ const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9._-]/g,'_'); cb(null, safe); } });
const MAX_UPLOAD_MB = parseInt(process.env.MAX_UPLOAD_MB || '200', 10);
const upload = multer({ storage, limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 } });

function authRequired(req,res,next){
  const h = req.headers.authorization; if(!h) return res.status(401).send('Missing token');
  const parts = h.split(' '); if(parts.length!==2) return res.status(401).send('Invalid token');
  const token = parts[1];
  try{ const p = jwt.verify(token, JWT_SECRET); req.user = p; next(); }catch(e){ return res.status(401).send('Invalid token'); }
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
app.post('/api/upload', authRequired, upload.single('file'), (req,res)=>{
  if(!req.file) return res.status(400).send('No file');
  const description = req.body.description || '';
  const targets = (req.body.targets || '').split(',').map(s=>s.trim()).filter(Boolean);
  const meta = { id: Date.now().toString(), filename: req.file.filename, originalname: req.file.originalname, description, targets, uploadedAt: new Date().toISOString() };
  const arr = JSON.parse(fs.readFileSync(filesJson,'utf8')) || [];
  arr.push(meta); fs.writeFileSync(filesJson, JSON.stringify(arr, null, 2));
  return res.json(meta);
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
app.post('/api/blog', authRequired, (req,res)=>{
  const { title, category, image, content } = req.body || {};
  if(!title || !content) return res.status(400).send('Missing title or content');
  const posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || [];
  const post = { id: Date.now().toString(), title, category: category||'', image: image||'', content, createdAt: new Date().toISOString() };
  posts.unshift(post);
  fs.writeFileSync(blogJson, JSON.stringify(posts, null, 2));
  return res.json(post);
});

app.put('/api/blog', authRequired, (req,res)=>{
  const id = req.query.id;
  if(!id) return res.status(400).send('Missing id');
  const { title, category, image, content } = req.body || {};
  const posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || [];
  const post = posts.find(p=>p.id===id);
  if(!post) return res.status(404).send('Post not found');
  if(title) post.title = title;
  if(typeof category !== 'undefined') post.category = category;
  if(typeof image !== 'undefined') post.image = image;
  if(typeof content !== 'undefined') post.content = content;
  post.updatedAt = new Date().toISOString();
  fs.writeFileSync(blogJson, JSON.stringify(posts, null, 2));
  return res.json(post);
});

app.get('/api/blog', (req,res)=>{
  let posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || [];
  if(!posts || posts.length === 0){
    posts = [
      { id: Date.now().toString(), title: 'Top 10 Web Development Trends in 2025', category: 'Web Development', image: '', content: 'Explore the latest web development technologies and trends that are shaping the industry.', createdAt: new Date().toISOString() },
      { id: (Date.now()+1).toString(), title: 'Complete SEO Guide for Beginners', category: 'SEO', image: '', content: 'Learn the fundamentals of SEO and how to optimize your website for search engines.', createdAt: new Date().toISOString() },
      { id: (Date.now()+2).toString(), title: 'Content Marketing Strategy That Works', category: 'Digital Marketing', image: '', content: 'Discover how to create a content marketing strategy that attracts your target audience.', createdAt: new Date().toISOString() },
      { id: (Date.now()+3).toString(), title: 'Building a Profitable Online Store', category: 'E-Commerce', image: '', content: 'Everything you need to know about building and launching a successful online store.', createdAt: new Date().toISOString() },
      { id: (Date.now()+4).toString(), title: '7 Ways to Increase Website Conversions', category: 'Conversion', image: '', content: 'Proven tactics to increase your website conversion rate.', createdAt: new Date().toISOString() },
      { id: (Date.now()+5).toString(), title: 'Understanding Website Analytics', category: 'Analytics', image: '', content: 'Learn how to read and interpret website analytics and KPIs.', createdAt: new Date().toISOString() }
    ];
    fs.writeFileSync(blogJson, JSON.stringify(posts, null, 2));
  }
  res.json(posts);
});

app.delete('/api/blog', authRequired, (req,res)=>{
  const id = req.query.id;
  if(!id) return res.status(400).send('Missing id');
  const posts = JSON.parse(fs.readFileSync(blogJson,'utf8')) || [];
  const idx = posts.findIndex(p=>p.id===id);
  if(idx===-1) return res.status(404).send('Post not found');
  posts.splice(idx,1);
  fs.writeFileSync(blogJson, JSON.stringify(posts, null, 2));
  return res.json({ ok:true });
});

// ===== BLOG COMMENTS & LIKES =====
const commentsJson = path.join(dataDir, 'blog_comments.json');
const likesJson = path.join(dataDir, 'blog_likes.json');
if(!fs.existsSync(commentsJson)) fs.writeFileSync(commentsJson, '[]');
if(!fs.existsSync(likesJson)) fs.writeFileSync(likesJson, '[]');

app.post('/api/blog/comment', (req,res)=>{
  const { postId, author, content } = req.body || {};
  if(!postId || !content) return res.status(400).send('Missing postId or content');
  const comments = JSON.parse(fs.readFileSync(commentsJson,'utf8')) || [];
  const comment = { id: Date.now().toString(), postId, author: author||'Anonymous', content, muted: false, createdAt: new Date().toISOString() };
  comments.push(comment);
  fs.writeFileSync(commentsJson, JSON.stringify(comments, null, 2));
  return res.json(comment);
});

app.get('/api/blog/comments', (req,res)=>{
  const postId = req.query.postId;
  const includeMuted = req.query.includeMuted === '1' || false;
  const comments = JSON.parse(fs.readFileSync(commentsJson,'utf8')) || [];
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
});

app.post('/api/blog/comment/mute', authRequired, (req,res)=>{
  const { id, mute } = req.body || {};
  if(!id) return res.status(400).send('Missing id');
  const comments = JSON.parse(fs.readFileSync(commentsJson,'utf8')) || [];
  const idx = comments.findIndex(c=>c.id===id);
  if(idx===-1) return res.status(404).send('Not found');
  comments[idx].muted = !!mute;
  comments[idx].updatedAt = new Date().toISOString();
  fs.writeFileSync(commentsJson, JSON.stringify(comments, null, 2));
  return res.json({ ok:true, id, muted: comments[idx].muted });
});

app.delete('/api/blog/comment', authRequired, (req,res)=>{
  const id = req.query.id;
  if(!id) return res.status(400).send('Missing id');
  const comments = JSON.parse(fs.readFileSync(commentsJson,'utf8')) || [];
  const idx = comments.findIndex(c=>c.id===id);
  if(idx===-1) return res.status(404).send('Not found');
  comments.splice(idx,1);
  fs.writeFileSync(commentsJson, JSON.stringify(comments, null, 2));
  return res.json({ ok:true });
});

app.post('/api/blog/like', (req,res)=>{
  const { postId } = req.body || {};
  if(!postId) return res.status(400).send('Missing postId');
  const likes = JSON.parse(fs.readFileSync(likesJson,'utf8')) || [];
  const rec = { id: Date.now().toString(), postId, createdAt: new Date().toISOString() };
  likes.push(rec);
  fs.writeFileSync(likesJson, JSON.stringify(likes, null, 2));
  const count = likes.filter(l=>l.postId===postId).length;
  return res.json({ ok:true, count });
});

app.get('/api/blog/likes', (req,res)=>{
  const postId = req.query.postId;
  const likes = JSON.parse(fs.readFileSync(likesJson,'utf8')) || [];
  if(postId) return res.json({ postId, count: likes.filter(l=>l.postId===postId).length });
  const counts = {};
  likes.forEach(l=>{ counts[l.postId] = (counts[l.postId]||0)+1; });
  return res.json(counts);
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
app.post('/api/portfolio', authRequired, (req,res)=>{
  const { title, category, description, image, url } = req.body || {};
  if(!title || !description || !image) return res.status(400).send('Missing required fields');
  const items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || [];
  const item = { id: Date.now().toString(), title, category: category||'', description, image, url: url||'', createdAt: new Date().toISOString() };
  items.push(item);
  fs.writeFileSync(portfolioJson, JSON.stringify(items, null, 2));
  return res.json(item);
});

app.get('/api/portfolio', (req,res)=>{
  const id = req.query.id;
  const items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || [];
  const normalize = (it)=>{
    const copy = Object.assign({}, it);
    const img = (copy.image||'').trim();
    if(img && !img.startsWith('http') && !img.startsWith('/')){
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
});

app.put('/api/portfolio', authRequired, (req,res)=>{
  const id = req.query.id;
  if(!id) return res.status(400).send('Missing id');
  const { title, category, description, image, url } = req.body || {};
  const items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || [];
  const item = items.find(x=>x.id===id);
  if(!item) return res.status(404).send('Not found');
  item.title = title;
  item.category = category;
  item.description = description;
  item.image = image;
  item.url = url;
  fs.writeFileSync(portfolioJson, JSON.stringify(items, null, 2));
  return res.json(item);
});

app.delete('/api/portfolio', authRequired, (req,res)=>{
  const id = req.query.id;
  if(!id) return res.status(400).send('Missing id');
  const items = JSON.parse(fs.readFileSync(portfolioJson,'utf8')) || [];
  const idx = items.findIndex(x=>x.id===id);
  if(idx===-1) return res.status(404).send('Not found');
  items.splice(idx,1);
  fs.writeFileSync(portfolioJson, JSON.stringify(items, null, 2));
  return res.json({ ok:true });
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
app.get('/api/settings', authRequired, (req,res)=>{
  const settings = JSON.parse(fs.readFileSync(settingsJson,'utf8')) || {};
  res.json(settings);
});

app.post('/api/settings', authRequired, validate(settingsSchema), (req,res)=>{
  const { gaId, customScripts, whatsappNumber } = req.body;
  const settings = { gaId: gaId||'', customScripts: customScripts||[], whatsappNumber: whatsappNumber||'' };
  fs.writeFileSync(settingsJson, JSON.stringify(settings, null, 2));
  return res.json({ ok:true });
});

app.get('/api/public-settings', (req,res)=>{
  try{
    const settings = JSON.parse(fs.readFileSync(settingsJson,'utf8')) || {};
    return res.json({ whatsappNumber: settings.whatsappNumber || '' });
  }catch(e){
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
