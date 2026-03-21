const formidable = require('formidable');
const fs = require('fs');
const { putFile, getFile } = require('./gh');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const form = new formidable.IncomingForm();
  form.parse(req, async (err, fields, files) => {
    try {
      if (err) {
        console.error('Form error:', err.message);
        return res.status(400).json({ error: 'Form parse error' });
      }

      const file = files.file;
      if (!file) {
        return res.status(400).json({ error: 'No file provided' });
      }

      const buffer = fs.readFileSync(file.filepath);
      const filename = Date.now() + '-' + (file.originalFilename || file.name).replace(/[^a-zA-Z0-9._-]/g, '');

      const { getRepoConfig } = require('./utils');
      const repoOpts = await getRepoConfig(req);

      if (!repoOpts || !repoOpts.owner || !repoOpts.repo) {
        console.error('No repo config');
        return res.status(500).json({ error: 'Repository not configured' });
      }

      console.log('[upload] Writing to GitHub:', filename);

      // ONLY way to store: push to GitHub
      await putFile(
        `public/uploads/${filename}`,
        buffer.toString('base64'),
        `Upload: ${filename}`,
        null,
        repoOpts
      );

      // Update metadata
      try {
        let files = [];
        try {
          const f = await getFile('data/files.json', repoOpts);
          files = JSON.parse(f.content);
        } catch (e) {}
        
        files.push({
          id: Date.now().toString(),
          filename,
          uploadedAt: new Date().toISOString()
        });

        await putFile('data/files.json', JSON.stringify(files, null, 2), 'Update files', null, repoOpts);
      } catch (e) {
        console.warn('Metadata update failed:', e.message);
      }

      return res.json({ id: Date.now().toString(), filename });
    } catch (e) {
      console.error('Upload error:', e.message);
      return res.status(500).json({ error: e.message });
    }
  });
};
