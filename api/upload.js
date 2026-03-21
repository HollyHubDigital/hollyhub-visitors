const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const { putFile } = require('./gh');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});
  
  try {
    const form = new formidable.IncomingForm();
    form.parse(req, async (err, fields, files) => {
      try {
        if(err) return res.status(400).json({error: 'Form error: ' + err.message});

        const file = files.file;
        if(!file) return res.status(400).json({error: 'No file provided'});

        const buffer = fs.readFileSync(file.filepath || file.path);
        const type = file.mimetype || file.type || '';
        const originalname = file.originalFilename || file.name || 'file';
        
        const MAX_SIZE = 50 * 1024 * 1024;
        if(buffer.length > MAX_SIZE) return res.status(413).json({error: 'File too large (max 50MB)'});

        const filename = Date.now() + '-' + originalname.replace(/[^a-zA-Z0-9._-]/g, '');
        
        const { getRepoConfig } = require('./utils');
        const repoOpts = await getRepoConfig(req);
        
        if(!repoOpts || !repoOpts.owner || !repoOpts.repo) {
          return res.status(500).json({error: 'Repository not configured'});
        }

        await putFile(
          `public/uploads/${filename}`,
          buffer.toString('base64'),
          `Upload: ${filename}`,
          null,
          { 
            owner: repoOpts.owner,
            repo: repoOpts.repo,
            branch: repoOpts.branch || 'main',
            token: repoOpts.token
          }
        );

        try {
          let filesList = [];
          try {
            const existing = await require('./gh').getFile('data/files.json', repoOpts);
            filesList = JSON.parse(existing.content);
          } catch(e) {
            filesList = [];
          }
          
          const meta = {
            id: Date.now().toString(),
            filename,
            originalname,
            type,
            size: buffer.length,
            uploadedAt: new Date().toISOString()
          };
          
          filesList.push(meta);
          
          await putFile(
            'data/files.json',
            JSON.stringify(filesList, null, 2),
            'Update files metadata',
            null,
            repoOpts
          );
          
          return res.json(meta);
        } catch(metaError) {
          return res.json({
            id: Date.now().toString(),
            filename,
            originalname,
            type,
            size: buffer.length,
            uploadedAt: new Date().toISOString()
          });
        }

      } catch(e) {
        console.error('[upload]', e.message);
        return res.status(500).json({error: e.message});
      }
    });
  } catch(e) {
    return res.status(500).json({error: 'Server error'});
  }
};
