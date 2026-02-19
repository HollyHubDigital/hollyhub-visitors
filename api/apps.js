const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { appRegistry, getAllApps, getApp } = require('./app-registry');

const dataDir = path.join(process.cwd(), 'data');
const appsConfigPath = path.join(dataDir, 'apps-config.json');

// Ensure data directory exists
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Initialize apps config file if it doesn't exist
function initAppsConfig() {
  if (!fs.existsSync(appsConfigPath)) {
    fs.writeFileSync(appsConfigPath, JSON.stringify({ enabled: {}, disabled: [] }, null, 2), 'utf8');
  }
}

// Get current apps config
function getAppsConfig() {
  try {
    if (!fs.existsSync(appsConfigPath)) initAppsConfig();
    return JSON.parse(fs.readFileSync(appsConfigPath, 'utf8') || '{"enabled":{},"disabled":[]}');
  } catch (e) {
    return { enabled: {}, disabled: [] };
  }
}

// Save apps config
function saveAppsConfig(config) {
  try {
    fs.writeFileSync(appsConfigPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('Failed to save apps config:', e);
    return false;
  }
}

// Check if admin is authenticated
function requireAuth(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth) return false;
  const parts = auth.split(' ');
  if (parts.length !== 2) return false;
  try {
    const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret');
    return !!payload;
  } catch (e) {
    return false;
  }
}

module.exports = async (req, res) => {
  initAppsConfig();
  
  try {
    // GET /api/apps - Get all available apps and current config
    if (req.method === 'GET') {
      const query = req.query || {};
      
      // Get specific app or all apps
      if (query.id) {
        const app = getApp(query.id);
        if (!app) return res.status(404).json({ error: 'App not found' });
        return res.json({ app });
      }

      // Get all apps registry
      if (query.registry === 'true') {
        return res.json({ apps: getAllApps() });
      }

      // Get current configuration (if auth -> full, else public-safe)
      if (query.config === 'true') {
        const config = getAppsConfig();
        const allApps = getAllApps();
        if (requireAuth(req)) {
          return res.json(config);
        }

        // Build public-facing enabled config (remove adminOnly fields)
        const returnedConfig = { enabled: {}, disabled: config.disabled || [] };
        for (const [appId, appCfg] of Object.entries(config.enabled || {})) {
          const appDef = allApps[appId];
          if (!appDef || !appCfg) continue;
          const publicCfg = {};
          const fields = appDef.configFields || [];
          for (const f of fields) {
            if (f.adminOnly) continue; // skip admin-only
            if (appCfg[f.name] !== undefined) publicCfg[f.name] = appCfg[f.name];
          }
          returnedConfig.enabled[appId] = publicCfg;
        }

        return res.json(returnedConfig);
      }

      // Preview generated injection scripts for enabled apps
      if (query.preview === 'true') {
        const appsCfg = getAppsConfig();
        const allApps = getAllApps();
        let inject = '';
        for (const [appId, cfg] of Object.entries(appsCfg.enabled || {})) {
          const appDef = getApp(appId);
          if (appDef && typeof appDef.scriptInjection === 'function') {
            try {
              const s = appDef.scriptInjection(cfg || {});
              if (s && s.length) inject += s + '\n\n';
            } catch (e) {
              console.error('preview script error', appId, e);
            }
          }
        }
        return res.json({ scripts: inject });
      }

      // Default: return all apps with their status
      const config = getAppsConfig();
      const allApps = getAllApps();
      const appsWithStatus = Object.keys(allApps).map(appId => ({
        ...allApps[appId],
        enabled: !!config.enabled[appId],
        configured: !!config.enabled[appId] && Object.keys(config.enabled[appId]).length > 0
      }));

      // If requester is not authenticated, filter out admin-only fields from app configs
      const isAuthed = requireAuth(req);
      let returnedConfig = { enabled: {}, disabled: config.disabled || [] };
      if (isAuthed) {
        returnedConfig = config;
      } else {
        // Build public-facing enabled config (remove adminOnly fields)
        for (const [appId, appCfg] of Object.entries(config.enabled || {})) {
          const appDef = allApps[appId];
          if (!appDef || !appCfg) continue;
          const publicCfg = {};
          const fields = appDef.configFields || [];
          for (const f of fields) {
            if (f.adminOnly) continue; // skip admin-only
            if (appCfg[f.name] !== undefined) publicCfg[f.name] = appCfg[f.name];
          }
          returnedConfig.enabled[appId] = publicCfg;
        }
      }

      return res.json({ apps: appsWithStatus, config: returnedConfig });
    }

    // PUT /api/apps - Update app configuration (requires auth)
    if (req.method === 'PUT') {
      if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body || {};
      const { appId, action, config } = body;

      if (!appId) return res.status(400).json({ error: 'Missing appId' });
      
      const app = getApp(appId);
      if (!app) return res.status(404).json({ error: 'App not found' });

      const appsConfig = getAppsConfig();

      if (action === 'enable') {
        // Enable app with initial config
        appsConfig.enabled[appId] = config || {};
        // Remove from disabled list if present
        appsConfig.disabled = appsConfig.disabled.filter(id => id !== appId);
      } else if (action === 'disable') {
        // Disable app
        delete appsConfig.enabled[appId];
        if (!appsConfig.disabled.includes(appId)) {
          appsConfig.disabled.push(appId);
        }
      } else if (action === 'update') {
        // Update existing app config
        if (!appsConfig.enabled[appId]) {
          return res.status(400).json({ error: 'App not enabled' });
        }
        appsConfig.enabled[appId] = { ...appsConfig.enabled[appId], ...config };
      } else {
        return res.status(400).json({ error: 'Invalid action' });
      }

      if (saveAppsConfig(appsConfig)) {
        return res.json({ 
          success: true, 
          message: `App ${appId} ${action}d`,
          app: { ...app, enabled: !!appsConfig.enabled[appId] }
        });
      } else {
        return res.status(500).json({ error: 'Failed to save configuration' });
      }
    }

    // POST /api/apps - Test or validate app configuration
    if (req.method === 'POST') {
      if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body || {};
      const { appId, action, config } = body;

      if (!appId) return res.status(400).json({ error: 'Missing appId' });

      const app = getApp(appId);
      if (!app) return res.status(404).json({ error: 'App not found' });

      if (action === 'test') {
        // Test app connection/configuration
        // This is a placeholder - implement specific testing for each app
        if (!config) return res.status(400).json({ error: 'Missing config' });

        // Validate required fields
        const missingFields = app.configFields
          .filter(field => field.required && !config[field.name])
          .map(field => field.name);

        if (missingFields.length > 0) {
          return res.status(400).json({ 
            error: 'Missing required fields',
            fields: missingFields
          });
        }

        // For now, just validate structure
        return res.json({ 
          success: true,
          message: `${app.name} configuration is valid`
        });
      }

      return res.status(400).json({ error: 'Invalid action' });
    }

    // DELETE /api/apps - Remove app configuration
    if (req.method === 'DELETE') {
      if (!requireAuth(req)) return res.status(401).json({ error: 'Unauthorized' });

      const appId = req.query.id;
      if (!appId) return res.status(400).json({ error: 'Missing appId' });

      const appsConfig = getAppsConfig();
      delete appsConfig.enabled[appId];
      if (!appsConfig.disabled.includes(appId)) {
        appsConfig.disabled.push(appId);
      }

      if (saveAppsConfig(appsConfig)) {
        return res.json({ success: true, message: `App ${appId} deleted` });
      } else {
        return res.status(500).json({ error: 'Failed to delete configuration' });
      }
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Apps API error:', e);
    res.status(500).json({ error: e.message });
  }
};
