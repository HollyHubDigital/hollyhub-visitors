// Helper for GitHub Contents API (used when GITHUB_TOKEN is provided)
const fetch = require('node-fetch');
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
  const res = await fetch(url, { ...opts, headers });
  if(res.status >= 400){ const txt = await res.text(); const e = new Error(`GitHub API error ${res.status}: ${txt}`); e.status = res.status; throw e; }
  return res.json();
}

async function getFile(path, repoOpts={}){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const data = await ghRequest(`/contents/${encodeURIComponent(path)}?ref=${BRANCH}`, {}, repoOpts);
  return { content: Buffer.from(data.content, 'base64').toString('utf8'), sha: data.sha };
}

async function putFile(path, content, message, sha, repoOpts={}){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const body = { message: message || `Update ${path}`, content: Buffer.from(content, 'utf8').toString('base64'), branch: BRANCH };
  if(sha) body.sha = sha;
  return await ghRequest(`/contents/${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, repoOpts);
}

async function deleteFile(path, message, sha, repoOpts={}){
  const BRANCH = repoOpts.branch || process.env.REPO_BRANCH || 'main';
  const body = { message: message || `Delete ${path}`, sha, branch: BRANCH };
  return await ghRequest(`/contents/${encodeURIComponent(path)}`, { method: 'DELETE', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, repoOpts);
}

module.exports = { getFile, putFile, deleteFile, ghRequest };
