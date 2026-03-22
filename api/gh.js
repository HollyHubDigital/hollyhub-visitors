// Helper for GitHub Contents API (used when GITHUB_TOKEN is provided)
// Use global fetch if available (Vercel Node 18+ has it), otherwise provide a fallback
let fetchFn = typeof fetch !== 'undefined' ? fetch : null;
if (!fetchFn) {
  // Fallback for older Node.js versions - attempt to use node-fetch if installed
  try {
    const nodeFetch = require('node-fetch');
    fetchFn = nodeFetch && nodeFetch.default ? nodeFetch.default : nodeFetch;
  } catch(e) {
    // If node-fetch not available, create a minimal HTTP client
    const https = require('https');
    const http = require('http');
    const url = require('url');
    fetchFn = (uri, options = {}) => {
      return new Promise((resolve, reject) => {
        const parsedUrl = new url.URL(uri);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const opts = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          method: options.method || 'GET',
          headers: options.headers || {}
        };
        const req = protocol.request(opts, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => resolve({ ok: res.statusCode < 400, status: res.statusCode, json: () => Promise.resolve(JSON.parse(data)), text: () => Promise.resolve(data) }));
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
      });
    };
  }
}
const base = 'https://api.github.com';

function getAuthHeaders(token){ return { 'Authorization': `token ${token}`, 'User-Agent': 'holly-admin' }; }

async function ghRequest(path, opts={}, repoOpts={}){
  const OWNER = repoOpts.owner || process.env.REPO_OWNER;
  const REPO = repoOpts.repo || process.env.REPO_NAME;
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const TOKEN = repoOpts.token || process.env.GITHUB_TOKEN;
  if(!TOKEN || !OWNER || !REPO) throw new Error('GitHub not configured');
  const url = `${base}/repos/${OWNER}/${REPO}${path}`;
  const headers = Object.assign({}, opts.headers || {}, getAuthHeaders(TOKEN));
  const res = await fetchFn(url, { ...opts, headers });
  if(res.status >= 400){ const txt = await res.text(); const e = new Error(`GitHub API error ${res.status}: ${txt}`); e.status = res.status; throw e; }
  return res.json();
}

async function getFile(path, repoOpts={}){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const data = await ghRequest(`/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, {}, repoOpts);
  return { content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

async function putFile(path, content, message, sha, repoOpts={}, isBase64=false){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  
  // If sha not provided, try to fetch it from existing file
  let fileSha = sha;
  if(!fileSha){
    try{
      const existing = await ghRequest(`/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, {}, repoOpts);
      fileSha = existing.sha;
    }catch(e){
      // File doesn't exist yet, that's fine - we'll create it
      fileSha = null;
    }
  }
  
  // If content is already base64 (e.g., binary file), use as-is; otherwise encode it
  let encodedContent = isBase64 ? content : Buffer.from(content, 'utf8').toString('base64');
  const body = { message: message || `Update ${path}`, content: encodedContent, branch: BRANCH };
  if(fileSha) body.sha = fileSha;
  return await ghRequest(`/contents/${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, repoOpts);
}

async function deleteFile(path, message, sha, repoOpts={}){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const body = { message: message || `Delete ${path}`, sha, branch: BRANCH };
  return await ghRequest(`/contents/${encodeURIComponent(path)}`, { method: 'DELETE', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, repoOpts);
}

module.exports = { getFile, putFile, deleteFile, ghRequest };
