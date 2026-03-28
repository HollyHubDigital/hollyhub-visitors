/**
 * Headline API
 * Manages scrolling headline display for index.html
 * GET: fetch headline settings
 * POST: save headline settings (requires admin token)
 */
const fs = require('fs');
const path = require('path');
const { getFile, putFile } = require('./gh');
const { getRepoConfig } = require('./utils');

module.exports = async (req, res) => {
  try {
    const method = req.method;

    if (method === 'GET') {
      // Public endpoint - anyone can fetch headline
      const repoOpts = await getRepoConfig(req) || {};
      const configPath = 'data/apps-config.json';

      try {
        let config = {};
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          const f = await getFile(configPath, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
          config = JSON.parse(f.content || '{}');
        } else {
          const cfgPath = path.join(process.cwd(), 'data', 'apps-config.json');
          if (fs.existsSync(cfgPath)) {
            config = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
          }
        }

        const headline = config.headline || { text: '', enabled: false };
        return res.json(headline);
      } catch (e) {
        // Return empty headline if config doesn't exist
        return res.json({ text: '', enabled: false });
      }
    }

    if (method === 'POST') {
      // Admin only - save headline
      const token = req.headers.authorization ? req.headers.authorization.replace('Bearer ', '') : null;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Verify token (simple check - in production use proper JWT verification)
      const adminToken = process.env.JWT_SECRET ? token : null;
      if (!adminToken && !token) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const { text, enabled } = req.body || {};
      if (text === undefined || enabled === undefined) {
        return res.status(400).json({ error: 'Missing text or enabled field' });
      }

      const repoOpts = await getRepoConfig(req) || {};
      const configPath = 'data/apps-config.json';

      try {
        let config = {};
        
        // Fetch existing config
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          try {
            const f = await getFile(configPath, { owner: repoOpts.owner, repo: repoOpts.repo, branch: repoOpts.branch, token: repoOpts.token });
            config = JSON.parse(f.content || '{}');
          } catch (e) {
            config = {};
          }
        } else {
          const cfgPath = path.join(process.cwd(), 'data', 'apps-config.json');
          if (fs.existsSync(cfgPath)) {
            config = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
          }
        }

        // Update headline
        config.headline = {
          text: text.trim(),
          enabled: Boolean(enabled),
          lastUpdated: new Date().toISOString()
        };

        const json = JSON.stringify(config, null, 2);

        // Save to GitHub if configured, otherwise save locally
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          await putFile(configPath, json, 'Update headline settings', null, {
            owner: repoOpts.owner,
            repo: repoOpts.repo,
            branch: repoOpts.branch,
            token: repoOpts.token
          });
        } else {
          const dir = path.join(process.cwd(), 'data');
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(path.join(dir, 'apps-config.json'), json, 'utf8');
        }

        return res.json({ success: true, headline: config.headline });
      } catch (e) {
        console.error('Headline update error:', e);
        return res.status(500).json({ error: 'Failed to update headline: ' + e.message });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Headline API error:', err);
    return res.status(500).json({ error: err.message });
  }
};
