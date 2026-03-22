const formidable = require('formidable');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { putFile } = require('./gh');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return res.status(405).json({error: 'Method not allowed'});
  
  try {
    console.log('[upload] Request received', { method: req.method });
    
    // Use /tmp for uploads â€“ ONLY writable directory on Vercel (fixes EROFS)
    const uploadDir = os.tmpdir();
    const form = new formidable.IncomingForm({
      uploadDir: uploadDir,
      keepExtensions: true,
      maxFileSize: 50 * 1024 * 1024,
      multiples: false
    });
    
    form.parse(req, async (err, fields, files) => {
      try {
        console.log('[upload] Form parsed', { err: err?.message, fileCount: Object.keys(files).length });
        
        if(err) {
          console.error('[upload] Form parse error:', err.message);
          return res.status(400).json({error: 'Form error: ' + err.message});
        }

        const file = files.file;
        if(!file) return res.status(400).json({error: 'No file provided'});

        // Read file buffer using async (better for Vercel)
        const filePath = file.filepath || file.path;
        console.log('[upload] Temp file path:', filePath);
        const buffer = await fs.promises.readFile(filePath);
        const type = file.mimetype || file.type || '';
        const originalname = file.originalFilename || file.name || 'file';
        
        // Size validation
        const MAX_SIZE = 50 * 1024 * 1024; // 50MB max
        if(buffer.length > MAX_SIZE) {
          return res.status(413).json({error: 'File too large (max 50MB)'});
        }

        const filename = Date.now() + '-' + originalname.replace(/[^a-zA-Z0-9._-]/g, '');
        
        // Get repository configuration
        const { getRepoConfig } = require('./utils');
        const repoOpts = await getRepoConfig(req);
        
        if(!repoOpts || !repoOpts.owner || !repoOpts.repo) {
          console.error('[upload] Missing repo config', {owner: repoOpts?.owner, repo: repoOpts?.repo});
          return res.status(500).json({error: 'Repository not configured'});
        }

        // Upload file to GitHub
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

        // Try to update metadata file
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
          console.warn('[upload] Metadata update failed, but file uploaded:', metaError.message);
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
        console.error('[upload] Handler exception:', e.message);
        return res.status(500).json({error: e.message});
      } finally {
        // Clean up temp files from formidable (not always needed in /tmp, but good practice)
        if(files && files.file) {
          try {
            const fileObj = Array.isArray(files.file) ? files.file[0] : files.file;
            const tempPath = fileObj.filepath || fileObj.path;
            if(tempPath && tempPath.startsWith('/tmp')) {
              fs.unlink(tempPath, (err) => {
                if(err) console.warn('[upload] Failed to clean temp file:', tempPath, err.message);
              });
            }
          } catch(cleanupError) {
            console.warn('[upload] Cleanup error:', cleanupError.message);
          }
        }
      }
    });
  } catch(e) {
    console.error('[upload] Outer exception:', e.message);
    return res.status(500).json({error: 'Server error'});
  }
};
