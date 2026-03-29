const { getFile, putFile } = require('./utils');

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
    // GET overlay config
    if (req.method === 'GET') {
      const config = await getFile(CONFIG_FILE);
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
    }

    // POST overlay config (requires admin auth)
    if (req.method === 'POST') {
      const token = req.headers.authorization?.split(' ')[1];
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { masterEnabled, modal1, modal2 } = req.body;

      // Validate auth token (basic check)
      if (!token || token.length < 10) {
        return res.status(401).json({ error: 'Invalid token' });
      }

      // Get current config
      let config = await getFile(CONFIG_FILE);
      if (!config) config = {};

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

      // Save to file
      await putFile(CONFIG_FILE, config);

      return res.status(200).json({
        success: true,
        message: 'Overlay config updated',
        overlay: config.overlay
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Overlay API error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
};
