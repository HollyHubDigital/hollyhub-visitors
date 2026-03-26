const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');
(async ()=>{
  try{
    const token = fs.readFileSync('_token.txt','utf8').trim();
    const base = 'https://admin-repo-three.vercel.app';

    // 1) Create blog
    const blogRes = await fetch(base + '/api/blog', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Smoke Test Post Node', category: 'testing', image: '', content: 'Node client smoke test' })
    });
    const blogBody = await blogRes.text();
    console.log('BLOG', blogRes.status, blogBody);

    // 2) Upload file
    const fd = new FormData();
    fd.append('file', fs.createReadStream('smoke.txt'));
    const upRes = await fetch(base + '/api/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd });
    const upBody = await upRes.text();
    console.log('UPLOAD', upRes.status, upBody);

    let filename = null;
    try{ filename = JSON.parse(upBody).filename }catch(e){}

    // 3) Create portfolio using returned filename or fallback
    const imageName = filename || 'smoke.txt';
    const portRes = await fetch(base + '/api/portfolio', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Smoke Portfolio Node', category: 'testing', description: 'Created from node smoke test', image: imageName, url: '' })
    });
    const portBody = await portRes.text();
    console.log('PORTFOLIO', portRes.status, portBody);
  }catch(e){ console.error('ERROR', e); process.exit(1) }
})();