const { getFile, putFile } = require('./gh');
const { getRepoConfig } = require('./utils');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = 'data/apps-config.json';

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const repoOpts = await getRepoConfig(req) || {};

    // GET overlay config
    if (req.method === 'GET') {
      try {
        let config = {};
        
        // Fetch existing config
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          try {
            const f = await getFile(CONFIG_FILE, { 
              owner: repoOpts.owner, 
              repo: repoOpts.repo, 
              branch: repoOpts.branch, 
              token: repoOpts.token 
            });
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

        const overlayConfig = config.overlay || {
          masterEnabled: false,
          modal1: {
            type: 'contactForm',
            enabled: false,
            image: null,
            description: '',
            buttonText: 'Get Started',
            web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9'
          },
          modal2: {
            type: 'mediaDisplay',
            enabled: false,
            media: null,
            mediaType: 'image',
            description: ''
          }
        };

        return res.status(200).json(overlayConfig);
      } catch (e) {
        console.error('Overlay GET error:', e);
        return res.status(200).json({
          masterEnabled: false,
          modal1: {
            type: 'contactForm',
            enabled: false,
            image: null,
            description: '',
            buttonText: 'Get Started',
            web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9'
          },
          modal2: {
            type: 'mediaDisplay',
            enabled: false,
            media: null,
            mediaType: 'image',
            description: ''
          }
        });
      }
    }

    // POST overlay config (requires admin auth)
    if (req.method === 'POST') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { masterEnabled, modal1, modal2 } = req.body;

      try {
        let config = {};
        
        // Fetch existing config
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          try {
            const f = await getFile(CONFIG_FILE, { 
              owner: repoOpts.owner, 
              repo: repoOpts.repo, 
              branch: repoOpts.branch, 
              token: repoOpts.token 
            });
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

        // Update overlay config
        config.overlay = {
          masterEnabled,
          modal1: {
            ...config.overlay?.modal1,
            ...modal1,
            web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9' // Keep fixed key
          },
          modal2: {
            ...config.overlay?.modal2,
            ...modal2
          }
        };

        // Auto-exclusivity: if one is enabled, disable the other
        if (modal1?.enabled) {
          config.overlay.modal2.enabled = false;
        } else if (modal2?.enabled) {
          config.overlay.modal1.enabled = false;
        }

        const json = JSON.stringify(config, null, 2);

        // Save to GitHub if configured, otherwise save locally
        if (repoOpts && repoOpts.owner && repoOpts.repo) {
          await putFile(CONFIG_FILE, json, 'Update overlay settings', null, {
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

        return res.status(200).json({
          success: true,
          message: 'Overlay config updated',
          overlay: config.overlay
        });
      } catch (error) {
        console.error('Overlay POST error:', error);
        res.status(500).json({ error: error.message || 'Internal server error' });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Overlay API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
