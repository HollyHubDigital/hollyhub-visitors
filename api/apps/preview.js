const fs = require('fs');
const path = require('path');
const { getApp } = require('../app-registry');

module.exports = async function (req, res) {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    const appsConfigPath = path.join(dataDir, 'apps-config.json');
    let appsCfg = { enabled: {} };
    try { if (fs.existsSync(appsConfigPath)) appsCfg = JSON.parse(fs.readFileSync(appsConfigPath, 'utf8') || '{}'); } catch (e) { appsCfg = { enabled: {} }; }

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

    function escapeHtml(str){
      return (str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Apps Preview</title>
  <style>body{font-family:system-ui,Segoe UI,Roboto,Arial;background:#0b0b0b;color:#ddd;padding:24px}pre{background:#061010;padding:12px;border-radius:6px;overflow:auto;max-height:50vh}</style>
  ${inject}
</head>
<body>
  <h1>Apps Injection Preview</h1>
  <p>Below are the scripts that the server will inject into visitor pages for currently enabled apps.</p>
  <h2>Generated Scripts</h2>
  <pre>${escapeHtml(inject)}</pre>
</body>
</html>`;

    res.setHeader('Content-Type','text/html');
    return res.send(html);
  } catch (e) {
    console.error('apps/preview error', e);
    return res.status(500).send('Preview failed');
  }
};
