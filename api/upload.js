const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { putFile } = require('./gh');

function requireAuth(req){
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if(!auth) return false;
  const parts = auth.split(' '); if(parts.length!==2) return false;
  try{ const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); return !!payload; }catch(e){ return false; }
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end('Method');
  if(!requireAuth(req)) return res.status(401).end('Unauthorized');
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if(err) return res.status(500).end(err.message);
    const file = files.file;
    if(!file) return res.status(400).end('No file');
    const descr = fields.description || '';
    const targets = (fields.targets||'').split(',').map(s=>s.trim()).filter(Boolean);
    const buffer = fs.readFileSync(file.filepath || file.path);
    const type = file.mimetype || file.type || '';
    const IMG_MAX = 10 * 1024 * 1024;
    const VID_MAX = 50 * 1024 * 1024;
    if(targets.includes('portfolio')){
      if(!(type.startsWith('image/') || type.startsWith('video/'))) return res.status(400).end('Portfolio uploads must be images or videos');
      if(type.startsWith('video/') && file.size > VID_MAX) return res.status(400).end('Video exceeds 50MB limit');
      if(type.startsWith('image/') && file.size > IMG_MAX) return res.status(400).end('Image exceeds 10MB limit');
    } else {
      if(type.startsWith('video/') && file.size > VID_MAX) return res.status(400).end('Video exceeds 50MB limit');
      if(type.startsWith('image/') && file.size > IMG_MAX) return res.status(400).end('Image exceeds 10MB limit');
      if(!type.startsWith('image/') && !type.startsWith('video/') && file.size > IMG_MAX) return res.status(400).end('File exceeds 10MB limit');
    }
    const filename = Date.now() + '-' + (file.originalFilename || file.name);
    try{
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req);
      console.log('[upload.js] repoOpts:', repoOpts ? { owner: repoOpts.owner, repo: repoOpts.repo, hasToken: !!repoOpts.token } : 'NULL');
      console.log('[upload.js] ENV vars - REPO_OWNER:', process.env.REPO_OWNER, 'REPO_NAME:', process.env.REPO_NAME, 'GITHUB_TOKEN:', process.env.GITHUB_TOKEN ? 'SET' : 'MISSING');
      if(!repoOpts || !repoOpts.owner || !repoOpts.repo) {
        return res.status(500).end('GitHub repository not configured');
      }
      await require('./gh').putFile(`public/uploads/${filename}`, buffer.toString('base64'), `Upload ${filename}`, null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
      let filesArr = [];
      try{ const f = await require('./gh').getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); filesArr = JSON.parse(f.content); }catch(e){ filesArr = []; }
      const meta = { id: Date.now().toString(), filename, originalname: file.originalFilename||file.name, description: descr, targets, uploadedAt: new Date().toISOString() };
      filesArr.push(meta);
      await require('./gh').putFile('data/files.json', JSON.stringify(filesArr, null, 2), 'Update files.json', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
      return res.json(meta);
    }catch(e){ console.error('[upload.js] Error:', e.message); return res.status(500).end(e.message); }
  });
};
