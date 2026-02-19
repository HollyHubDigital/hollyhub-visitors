const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const { getFile, putFile } = require('./gh');

function requireAuth(req){
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if(!auth) return false;
  const parts = auth.split(' '); if(parts.length!==2) return false;
  try{ const payload = jwt.verify(parts[1], process.env.JWT_SECRET || 'devsecret'); return !!payload; }catch(e){ return false; }
}

module.exports = async (req, res) => {
  try{
    const dataPath = 'data/portfolio.json';
    if(req.method === 'GET'){
      if(process.env.GITHUB_TOKEN){ const f = await getFile(dataPath); return res.json(JSON.parse(f.content||'[]')); }
      const fp = path.join(process.cwd(), dataPath);
      if(!fs.existsSync(fp)) return res.json([]);
      return res.json(JSON.parse(fs.readFileSync(fp,'utf8')));
    }

    if(req.method === 'POST'){
      if(!requireAuth(req)) return res.status(401).end('Unauthorized');
      const { title, category, image, description, url, tags } = req.body || {};
      if(!title) return res.status(400).end('Missing title');
      const items = process.env.GITHUB_TOKEN ? JSON.parse((await getFile(dataPath)).content || '[]') : (fs.existsSync(path.join(process.cwd(), dataPath)) ? JSON.parse(fs.readFileSync(path.join(process.cwd(), dataPath),'utf8')) : []);
      const item = { id: Date.now().toString(), title, category: category||'', image: image||'', description: description||'', url: url||'', tags: Array.isArray(tags) ? tags : (tags ? tags.split(',').map(s=>s.trim()).filter(Boolean) : []), createdAt: new Date().toISOString() };
      items.unshift(item);
      const json = JSON.stringify(items, null, 2);
      if(process.env.GITHUB_TOKEN){ await putFile(dataPath, json, 'Add portfolio item'); } else { fs.writeFileSync(path.join(process.cwd(), dataPath), json, 'utf8'); }
      // regenerate portfolio.html
      const listing = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio - Holly</title><link rel="stylesheet" href="styles.css"></head><body><header class="sticky-header"><div class="header-container"><a href="index.html" class="logo-link">HOLLYDEV</a></div></header><main class="container" style="padding:2rem"><h1>Portfolio</h1><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">${items.map(p=>`<article style="background:#111;padding:1rem;border-radius:8px"><div style="height:160px;background:#222;border-radius:6px;margin-bottom:8px;background-image:url('${p.image}');background-size:cover;background-position:center"></div><h3>${p.title}</h3><p style="opacity:0.8">${p.category}</p><p style="opacity:0.85">${(p.description||'').slice(0,160)}...</p><a href="${p.url||'#'}" style="color:var(--secondary-accent);">View Project</a></article>`).join('')}</div></main></body></html>`;
      if(process.env.GITHUB_TOKEN){ await putFile('portfolio.html', listing, 'Regenerate portfolio listing'); } else { fs.writeFileSync(path.join(process.cwd(),'portfolio.html'), listing, 'utf8'); }
      return res.json(item);
    }

    if(req.method === 'PUT'){
      if(!requireAuth(req)) return res.status(401).end('Unauthorized');
      const id = req.query.id || (req.body && req.body.id);
      if(!id) return res.status(400).end('Missing id');
      const items = process.env.GITHUB_TOKEN ? JSON.parse((await getFile(dataPath)).content || '[]') : (fs.existsSync(path.join(process.cwd(), dataPath)) ? JSON.parse(fs.readFileSync(path.join(process.cwd(), dataPath),'utf8')) : []);
      const idx = items.findIndex(x=>x.id===id);
      if(idx===-1) return res.status(404).end('Not found');
      const payload = req.body || {};
      items[idx] = { ...items[idx], title: payload.title||items[idx].title, category: payload.category||items[idx].category, image: payload.image||items[idx].image, description: payload.description||items[idx].description, url: payload.url||items[idx].url, tags: Array.isArray(payload.tags) ? payload.tags : (payload.tags ? payload.tags.split(',').map(s=>s.trim()).filter(Boolean) : items[idx].tags) };
      const json2 = JSON.stringify(items, null, 2);
      if(process.env.GITHUB_TOKEN){ await putFile(dataPath, json2, 'Update portfolio item'); } else { fs.writeFileSync(path.join(process.cwd(), dataPath), json2, 'utf8'); }
      // regenerate listing
      const listing2 = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio - Holly</title><link rel="stylesheet" href="styles.css"></head><body><header class="sticky-header"><div class="header-container"><a href="index.html" class="logo-link">HOLLYDEV</a></div></header><main class="container" style="padding:2rem"><h1>Portfolio</h1><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">${items.map(p=>`<article style="background:#111;padding:1rem;border-radius:8px"><div style="height:160px;background:#222;border-radius:6px;margin-bottom:8px;background-image:url('${p.image}');background-size:cover;background-position:center"></div><h3>${p.title}</h3><p style="opacity:0.8">${p.category}</p><p style="opacity:0.85">${(p.description||'').slice(0,160)}...</p><a href="${p.url||'#'}" style="color:var(--secondary-accent);">View Project</a></article>`).join('')}</div></main></body></html>`;
      if(process.env.GITHUB_TOKEN){ await putFile('portfolio.html', listing2, 'Regenerate portfolio listing'); } else { fs.writeFileSync(path.join(process.cwd(),'portfolio.html'), listing2, 'utf8'); }
      return res.json(items[idx]);
    }

    if(req.method === 'DELETE'){
      if(!requireAuth(req)) return res.status(401).end('Unauthorized');
      const id = req.query.id;
      if(!id) return res.status(400).end('Missing id');
      const items = process.env.GITHUB_TOKEN ? JSON.parse((await getFile(dataPath)).content || '[]') : (fs.existsSync(path.join(process.cwd(), dataPath)) ? JSON.parse(fs.readFileSync(path.join(process.cwd(), dataPath),'utf8')) : []);
      const idx = items.findIndex(x=>x.id===id);
      if(idx===-1) return res.status(404).end('Not found');
      items.splice(idx,1);
      const json3 = JSON.stringify(items, null, 2);
      if(process.env.GITHUB_TOKEN){ await putFile(dataPath, json3, 'Remove portfolio item'); } else { fs.writeFileSync(path.join(process.cwd(), dataPath), json3, 'utf8'); }
      // regenerate listing
      const listing3 = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio - Holly</title><link rel="stylesheet" href="styles.css"></head><body><header class="sticky-header"><div class="header-container"><a href="index.html" class="logo-link">HOLLYDEV</a></div></header><main class="container" style="padding:2rem"><h1>Portfolio</h1><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem">${items.map(p=>`<article style="background:#111;padding:1rem;border-radius:8px"><div style="height:160px;background:#222;border-radius:6px;margin-bottom:8px;background-image:url('${p.image}');background-size:cover;background-position:center"></div><h3>${p.title}</h3><p style="opacity:0.8">${p.category}</p><p style="opacity:0.85">${(p.description||'').slice(0,160)}...</p><a href="${p.url||'#'}" style="color:var(--secondary-accent);">View Project</a></article>`).join('')}</div></main></body></html>`;
      if(process.env.GITHUB_TOKEN){ await putFile('portfolio.html', listing3, 'Regenerate portfolio listing'); } else { fs.writeFileSync(path.join(process.cwd(),'portfolio.html'), listing3, 'utf8'); }
      return res.json({ ok:true });
    }

    return res.status(405).end('Method not allowed');
  }catch(e){ console.error(e); res.status(500).end(e.message); }
};
