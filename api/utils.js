const fs = require('fs');
const path = require('path');
const { getFile } = require('./gh');

// Determine target repo config. Priority:
// 1) request body/query override: repoOwner, repoName, repoBranch, token
// 2) saved settings in data/settings.json (if present)
// 3) environment variables REPO_OWNER/REPO_NAME/REPO_BRANCH
async function getRepoConfig(req){
  const body = req.body || {};
  const query = req.query || {};
  const override = {
    owner: body.repoOwner || query.repoOwner || null,
    repo: body.repoName || query.repoName || null,
    branch: body.repoBranch || query.repoBranch || null,
    token: body.repoToken || query.repoToken || null
  };
  if(override.owner && override.repo) return override;

  // try settings file
  try{
    if(process.env.GITHUB_TOKEN){
      const s = await getFile('data/settings.json');
      const json = JSON.parse(s.content || '{}');
      if(json.repoOwner && json.repoName) return { owner: json.repoOwner, repo: json.repoName, branch: json.repoBranch || json.branch || process.env.REPO_BRANCH, token: process.env.GITHUB_TOKEN };
    } else {
      const fp = path.join(process.cwd(), 'data', 'settings.json');
      if(fs.existsSync(fp)){
        const json = JSON.parse(fs.readFileSync(fp,'utf8')||'{}');
        if(json.repoOwner && json.repoName) return { owner: json.repoOwner, repo: json.repoName, branch: json.repoBranch || json.branch || process.env.REPO_BRANCH, token: process.env.GITHUB_TOKEN };
      }
    }
  }catch(e){ /* ignore */ }

  // fall back to env
  if(process.env.REPO_OWNER && process.env.REPO_NAME) return { owner: process.env.REPO_OWNER, repo: process.env.REPO_NAME, branch: process.env.REPO_BRANCH || 'main', token: process.env.GITHUB_TOKEN };
  return null;
}

module.exports = { getRepoConfig };
