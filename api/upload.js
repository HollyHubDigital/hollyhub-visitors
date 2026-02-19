const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { putFile } = require('./gh');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).end('Method');
  // Parse multipart
  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    if(err) return res.status(500).end(err.message);
    const file = files.file;
    if(!file) return res.status(400).end('No file');
    const descr = fields.description || '';
    const targets = (fields.targets||'').split(',').map(s=>s.trim()).filter(Boolean);
    const buffer = fs.readFileSync(file.filepath || file.path);
    // server-side validation
    const type = file.mimetype || file.type || '';
    // default max size 10MB for images and general files
    const IMG_MAX = 10 * 1024 * 1024;
    // allow larger for video uploads (50MB)
    const VID_MAX = 50 * 1024 * 1024;
    if(targets.includes('portfolio')){
      // portfolio may include images or videos
      if(!(type.startsWith('image/') || type.startsWith('video/'))) return res.status(400).end('Portfolio uploads must be images or videos');
      if(type.startsWith('video/') && file.size > VID_MAX) return res.status(400).end('Video exceeds 50MB limit');
      if(type.startsWith('image/') && file.size > IMG_MAX) return res.status(400).end('Image exceeds 10MB limit');
    } else {
      // general uploads: allow common types but enforce image size limits for images
      if(type.startsWith('video/') && file.size > VID_MAX) return res.status(400).end('Video exceeds 50MB limit');
      if(type.startsWith('image/') && file.size > IMG_MAX) return res.status(400).end('Image exceeds 10MB limit');
      if(!type.startsWith('image/') && !type.startsWith('video/') && file.size > IMG_MAX) return res.status(400).end('File exceeds 10MB limit');
    }
    const filename = Date.now() + '-' + (file.originalFilename || file.name);
    try{
      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req) || {};
      if(repoOpts && repoOpts.owner && repoOpts.repo){
        // commit binary content to repo
        await require('./gh').putFile(`public/uploads/${filename}`, buffer.toString('base64'), `Upload ${filename}`, null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        // update data/files.json
        let filesArr = [];
        try{ const f = await require('./gh').getFile('data/files.json', { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token }); filesArr = JSON.parse(f.content); }catch(e){ filesArr = []; }
        const meta = { id: Date.now().toString(), filename, originalname: file.originalFilename||file.name, description: descr, targets, uploadedAt: new Date().toISOString() };
        filesArr.push(meta);
        await require('./gh').putFile('data/files.json', JSON.stringify(filesArr, null, 2), 'Update files.json', null, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
        return res.json(meta);
      } else {
        const updir = path.join(process.cwd(), 'public', 'uploads'); fs.mkdirSync(updir, { recursive: true }); const fp = path.join(updir, filename); fs.writeFileSync(fp, buffer);
        const dataPath = path.join(process.cwd(), 'data', 'files.json'); let arr = JSON.parse(fs.readFileSync(dataPath,'utf8')||'[]'); const meta = { id: Date.now().toString(), filename, originalname: file.originalFilename||file.name, description: descr, targets, uploadedAt: new Date().toISOString() }; arr.push(meta); fs.writeFileSync(dataPath, JSON.stringify(arr, null, 2)); return res.json(meta);
      }
    }catch(e){ console.error(e); return res.status(500).end(e.message); }
  });
};
