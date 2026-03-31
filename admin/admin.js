// Admin Dashboard - COMPLETE VERSION
if (typeof ADMIN_INITIALIZED !== 'undefined') {
  console.log('[Admin] Script already loaded, skipping re-initialization');
} else {
  window.ADMIN_INITIALIZED = true;
  console.log('[Admin] admin.js loaded - version 0afa1aa, timestamp:', new Date().toISOString());
  
const API = {
  baseURL() { return (typeof window.API_BASE_URL === 'string' && window.API_BASE_URL) ? window.API_BASE_URL : ''; },
  buildURL(path) { 
    const base = API.baseURL();
    if (!base) return path; // Use relative path if no base URL is set
    return base + path;
  },
  token() { return localStorage.getItem('adminToken') || ''; },
  visitorsURL() { return (typeof window.VISITORS_BASE_URL === 'string' && window.VISITORS_BASE_URL) ? window.VISITORS_BASE_URL : 'https://hollyhubdigitals.vercel.app'; },
  headers(json=true){ 
    const headers = {};
    const token = API.token();
    console.log('[API.headers] Building headers... token present:', !!token);
    if(token) {
      headers['Authorization'] = 'Bearer ' + token;
      console.log('[API.headers] Authorization header set, length:', headers['Authorization'].length);
    } else {
      console.warn('[API.headers] No token available');
    }
    if(json) headers['Content-Type'] = 'application/json';
    return headers;
  }
};

// Small toast helper
function showToast(message, actionLabel, actionFn, timeout=5000){
  let el = document.getElementById('adminToast');
  if(!el){
    el = document.createElement('div');
    el.id = 'adminToast';
    el.style.position = 'fixed';
    el.style.right = '20px';
    el.style.bottom = '20px';
    el.style.zIndex = 9999;
    document.body.appendChild(el);
  }
  const item = document.createElement('div');
  item.style.background = 'linear-gradient(90deg,#222,#111)';
  item.style.color = '#fff';
  item.style.padding = '12px 14px';
  item.style.borderRadius = '8px';
  item.style.boxShadow = '0 6px 18px rgba(0,0,0,0.4)';
  item.style.marginTop = '8px';
  item.style.minWidth = '220px';
  item.style.fontSize = '14px';
  item.textContent = message;
  if(actionLabel && actionFn){
    const btn = document.createElement('button');
    btn.textContent = actionLabel;
    btn.style.marginLeft = '10px';
    btn.style.padding = '6px 8px';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', ()=>{ actionFn(); document.getElementById('adminToast') && item.remove(); });
    item.appendChild(btn);
  }
  el.appendChild(item);
  setTimeout(()=>{ try{ item.remove(); }catch(e){} }, timeout);
}

function requireAuth() {
  const token = API.token();
  console.log('[requireAuth] Checking authentication...');
  console.log('[requireAuth] Token present:', !!token);
  if(token) {
    console.log('[requireAuth] Token length:', token.length);
    console.log('[requireAuth] Token preview:', token.substring(0, 30) + '...');
  } else {
    console.warn('[requireAuth] No token found, redirecting to login');
  }
  if(!token) { window.location.href = 'adminlogin.html'; }
}

// ===== TAB SWITCHING =====
function initTabs(){
  document.querySelectorAll('.admin-tab-btn').forEach(btn=>{
    btn.addEventListener('click', e=>{
      const tab = btn.dataset.tab;
      document.querySelectorAll('.admin-tab-btn').forEach(b=>b.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach(p=>p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(tab).classList.add('active');
    });
  });
}

// ===== EDIT PAGES SECTION =====
async function loadPageSections(){
  const page = document.getElementById('pageSelector').value;
  if(!page) return alert('Please select a page');

  const container = document.getElementById('pageEditContainer');
  container.innerHTML = '<p style="opacity:0.8">Loading...</p>';

  try {
    const r = await fetch(API.buildURL(`/api/pages/sections/${page}`), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load sections');
    const sections = await r.json();

    let html = `<div class="section-card"><h3 class="section-title">${page.charAt(0).toUpperCase() + page.slice(1)} Editable Sections</h3>`;
    
    if(page === 'index'){
      html += `
        <div class="form-group">
          <label class="form-label">Hero Image (.inter)</label>
          <input id="interImage" class="form-input" value="${sections.interImage || ''}" placeholder="Image URL" />
          <small style="opacity:0.7">Current: ${sections.interImage || 'None'}</small>
        </div>
        <div class="form-group">
          <label class="form-label">Recent Projects Cards</label>
          <textarea id="recentProjects" class="form-input" placeholder="JSON array of project cards">${JSON.stringify(sections.recentProjects || [], null, 2)}</textarea>
        </div>
      `;
      // inject preview iframe area
      setTimeout(()=>{
        const preview = document.getElementById('pagePreviewArea');
        if(preview){
          const visitorsUrl = API.visitorsURL();
          preview.innerHTML = `<iframe id="pagePreviewFrame" src="${visitorsUrl}/" style="width:100%;height:420px;border:1px solid rgba(255,255,255,0.06);border-radius:8px"></iframe>`;
        }
      }, 50);
    } else if(page === 'portfolio'){
      html += `<div class="form-group"><label class="form-label">Portfolio Items (managed in Portfolio tab)</label><p style="opacity:0.8">Use the Portfolio tab to add/edit/delete items</p></div>`;
    } else if(page === 'blog'){
      html += `<div class="form-group"><label class="form-label">Blog Posts (managed in Blog tab)</label><p style="opacity:0.8">Use the Blog tab to create/edit/delete posts</p></div>`;
    }

    html += `<button id="savePageSectionsBtn" class="btn-primary">Save Changes</button></div>`;
    container.innerHTML = html;

    document.getElementById('savePageSectionsBtn').addEventListener('click', async ()=>{
      const payload = { page, sections: {} };
      if(page === 'index'){
        payload.sections.interImage = document.getElementById('interImage').value;
        try {
          payload.sections.recentProjects = JSON.parse(document.getElementById('recentProjects').value || '[]');
        } catch(e) {
          return alert('Invalid JSON in Recent Projects field');
        }
      }
      await savePageSections(payload);
    });
  } catch(e) {
    container.innerHTML = `<p style="color:#FF5555">Error: ${e.message}</p>`;
  }
}

async function savePageSections(payload){
  try {
    const r = await fetch(API.buildURL('/api/pages/sections/save'), { method:'PUT', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    showToast('Page sections saved', 'View', ()=>window.open('/', '_blank'));
    document.getElementById('pageEditContainer').innerHTML = '<p style="color:var(--primary-accent)">✓ Changes saved!</p>';
    // refresh preview iframe if present
    try{ const f = document.getElementById('pagePreviewFrame'); if(f && f.contentWindow) f.contentWindow.location.reload(); }catch(e){}
  } catch(e) {
    showToast('Save failed: '+e.message, null, null, 6000);
  }
}

// ===== PORTFOLIO MANAGEMENT =====
async function publishPortfolio(){
  const title = document.getElementById('pfTitle').value;
  const category = document.getElementById('pfCategory').value;
  const description = document.getElementById('pfDescription').value;
  const imageInput = document.getElementById('pfImage');
  const image = imageInput.value;
  const url = document.getElementById('pfUrl').value;
  const fileInput = document.getElementById('pfImageFile');
  const addToRecent = document.getElementById('pfAddToRecent') && document.getElementById('pfAddToRecent').checked;

  if(!title || !description || (!image && !(fileInput && fileInput.files && fileInput.files[0]))) return alert('Please fill all required fields');

  const editingId = document.getElementById('pfEditingId').value;
  const payload = { title, category, description, image, url };

  try {
    let uploadedMeta = null;
    // If a file is selected, upload it first
    if(fileInput && fileInput.files && fileInput.files[0]){
      const file = fileInput.files[0];
      uploadedMeta = await uploadFile(file, ['portfolio', addToRecent? 'recent-projects': '']);
    }
    let endpoint = '/api/portfolio';
    let method = 'POST';
    if(editingId){
      endpoint += '?id='+encodeURIComponent(editingId);
      method = 'PUT';
    }
    // prefer uploaded filename if available
    if(uploadedMeta && uploadedMeta.filename){ payload.image = uploadedMeta.filename; }
    
    const token = API.token();
    const headers = API.headers();
    const fullUrl = API.buildURL(endpoint);
    console.log('[publishPortfolio] ===== PORTFOLIO PUBLISH START =====');
    console.log('[publishPortfolio] Endpoint:', endpoint);
    console.log('[publishPortfolio] Full URL:', fullUrl);
    console.log('[publishPortfolio] Method:', method);
    console.log('[publishPortfolio] Token present:', !!token);
    console.log('[publishPortfolio] Token length:', token ? token.length : 0);
    console.log('[publishPortfolio] Token starts with:', token ? token.substring(0, 30) + '...' : 'EMPTY');
    console.log('[publishPortfolio] Headers object:', headers);
    console.log('[publishPortfolio] Authorization header value:', headers.Authorization);
    
    const r = await fetch(fullUrl, { method, headers, body: JSON.stringify(payload) });
    if(!r.ok) {
      const errText = await r.text();
      console.error('[publishPortfolio] Request failed - Status:', r.status, '| Response:', errText);
      throw new Error(`Server error (${r.status}): ${errText}`);
    }
    const createdItem = await r.json();
    showToast(editingId ? 'Portfolio item updated' : 'Portfolio item published', 'Open', ()=>window.open('/portfolio.html','_blank'));
    // Optionally add to recentProjects on home page
    if(addToRecent){
      try{
        // fetch current sections
        const sres = await fetch(API.buildURL('/api/pages/sections/index'), { headers: API.headers() });
        const sections = sres.ok ? await sres.json() : {};
        sections.recentProjects = sections.recentProjects || [];
        // create project entry
        const proj = { id: (editingId || createdItem.id) || Date.now().toString(), title: payload.title, description: payload.description, image: payload.image || '', url: payload.url || '' };
        // if editing, replace matching id
        const idx = sections.recentProjects.findIndex(p=>p.id===proj.id);
        if(idx!==-1) sections.recentProjects[idx] = proj; else sections.recentProjects.unshift(proj);
        await savePageSections({ page: 'index', sections });
      }catch(e){ console.error('Add to recent failed', e); }
    }
    document.getElementById('pfTitle').value = '';
    document.getElementById('pfCategory').value = '';
    document.getElementById('pfDescription').value = '';
    document.getElementById('pfImage').value = '';
    document.getElementById('pfUrl').value = '';
    document.getElementById('pfEditingId').value = '';
    await refreshPortfolioList();
  } catch(e) {
    alert('Publish failed: '+e.message);
  }
}

async function uploadFile(file, targets){
  const token = API.token();
  console.log('[uploadFile] Token status:', token ? 'Present' : 'Missing');
  console.log('[uploadFile] Token length:', token ? token.length : 0);
  console.log('[uploadFile] Token preview:', token ? token.substring(0, 20) + '...' : 'NONE');
  console.log('[uploadFile] API Base URL:', API.baseURL());
  
  if(!token) {
    throw new Error('Authentication required. Please log in again.');
  }
  
  const fd = new FormData();
  fd.append('file', file);
  if(targets && targets.length) fd.append('targets', targets.filter(Boolean).join(','));
  
  const headers = { 'Authorization': 'Bearer ' + token };
  const uploadUrl = API.buildURL('/api/upload');
  console.log('[uploadFile] Uploading to:', uploadUrl);
  console.log('[uploadFile] Authorization header:', headers.Authorization);
  console.log('[uploadFile] Full header object:', headers);
  
  const r = await fetch(uploadUrl, { method: 'POST', headers, body: fd });
  
  if(!r.ok) {
    const errText = await r.text();
    console.error('[uploadFile] Upload failed - Status:', r.status, 'Text:', errText);
    throw new Error(`Upload failed (${r.status}): ${errText}`);
  }
  
  return await r.json();
}

async function refreshPortfolioList(){
  try {
    const url = API.buildURL('/api/portfolio');
    console.log('[portfolio] Loading from:', url);
    const r = await fetch(url, { headers: API.headers() });
    
    if(!r.ok) {
      console.error('[portfolio] Fetch failed:', r.status, r.statusText);
      throw new Error(`Failed to load portfolio (${r.status})`);
    }
    
    const items = await r.json();
    console.log('[portfolio] Loaded items:', items ? items.length : 0);
    
    const container = document.getElementById('portfolioList');
    if (!container) return;
    
    container.innerHTML = '';
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="opacity:0.6">No portfolio items yet. Create one above.</p>';
      return;
    }
    
    items.forEach(item=>{
      const div = document.createElement('div');
      div.className = 'portfolio-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${item.title}</div>
          <div style="opacity:0.8;font-size:0.9rem">${item.category} • ${new Date(item.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" data-action="edit-portfolio" data-id="${item.id}">Edit</button>
          <button class="btn-danger" data-action="delete-portfolio" data-id="${item.id}">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
    
    // Attach event listeners for edit/delete buttons
    container.querySelectorAll('[data-action="edit-portfolio"]').forEach(btn => {
      btn.addEventListener('click', (e) => editPortfolioItem(e.target.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-portfolio"]').forEach(btn => {
      btn.addEventListener('click', (e) => deletePortfolioItem(e.target.dataset.id));
    });
  } catch(e) {
    console.error('[portfolio] Error:', e);
    const container = document.getElementById('portfolioList');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

async function editPortfolioItem(id){
  try {
    const r = await fetch(API.buildURL('/api/portfolio?id='+encodeURIComponent(id)), { headers: API.headers() });
    if(!r.ok) throw new Error('Not found');
    const item = await r.json();
    document.getElementById('pfTitle').value = item.title;
    document.getElementById('pfCategory').value = item.category || '';
    document.getElementById('pfDescription').value = item.description;
    document.getElementById('pfImage').value = item.image;
    document.getElementById('pfUrl').value = item.url || '';
    document.getElementById('pfEditingId').value = item.id;
    document.querySelector('[data-tab="portfolio"]').click();
  } catch(e) {
    alert('Error loading item: '+e.message);
  }
}

async function deletePortfolioItem(id){
  if(!confirm('Delete this portfolio item?')) return;
  try {
    const r = await fetch(API.buildURL('/api/portfolio?id='+encodeURIComponent(id)), { method:'DELETE', headers: API.headers() });
    if(!r.ok) throw new Error(await r.text());
    alert('Item deleted');
    await refreshPortfolioList();
  } catch(e) {
    alert('Delete failed: '+e.message);
  }
}

// ===== BLOG MANAGEMENT =====
async function publishBlog(){
  const title = document.getElementById('blogTitle').value;
  const category = document.getElementById('blogCategory').value;
  const image = document.getElementById('blogImage').value;
  const imageFileInput = document.getElementById('blogImageFile');
  const content = document.getElementById('blogContent').value;
  const editingId = document.getElementById('blogEditingId').value;

  if(!title || !content) return alert('Please fill title and content');

  const payload = { title, category, image, content };
  try {
    let uploadedMeta = null;
    if(imageFileInput && imageFileInput.files && imageFileInput.files[0]){
      uploadedMeta = await uploadFile(imageFileInput.files[0], ['blog']);
    }
    if(uploadedMeta && uploadedMeta.filename){ payload.image = uploadedMeta.filename; }

    let endpoint = '/api/blog';
    let method = 'POST';
    if(editingId){ endpoint += '?id='+encodeURIComponent(editingId); method = 'PUT'; }
    
    const token = API.token();
    const headers = API.headers();
    const fullUrl = API.buildURL(endpoint);
    console.log('[publishBlog] ===== BLOG PUBLISH START =====');
    console.log('[publishBlog] Endpoint:', endpoint);
    console.log('[publishBlog] Full URL:', fullUrl);
    console.log('[publishBlog] Method:', method);
    console.log('[publishBlog] Token present:', !!token);
    console.log('[publishBlog] Token length:', token ? token.length : 0);
    console.log('[publishBlog] Token starts with:', token ? token.substring(0, 30) + '...' : 'EMPTY');
    console.log('[publishBlog] Headers object:', headers);
    console.log('[publishBlog] Authorization header value:', headers.Authorization);
    
    const r = await fetch(fullUrl, { method, headers, body: JSON.stringify(payload) });
    if(!r.ok) {
      const errText = await r.text();
      console.error('[publishBlog] Request failed - Status:', r.status, '| Response:', errText);
      throw new Error(`Server error (${r.status}): ${errText}`);
    }
    const post = await r.json();
    showToast(editingId? 'Blog post updated' : 'Blog post published', 'Open', ()=>window.open('/blog.html','_blank'));
    document.getElementById('blogTitle').value = '';
    document.getElementById('blogCategory').value = '';
    document.getElementById('blogImage').value = '';
    document.getElementById('blogContent').value = '';
    document.getElementById('blogEditingId').value = '';
    await refreshBlogPosts();
  } catch(e) {
    showToast('Publish failed: '+e.message, null, null, 6000);
  }
}

async function editBlogPost(id){
  try{
    const r = await fetch(API.buildURL('/api/blog'), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed to load posts');
    const posts = await r.json();
    const post = posts.find(p=>p.id===id);
    if(!post) throw new Error('Post not found');
    document.getElementById('blogTitle').value = post.title;
    document.getElementById('blogCategory').value = post.category || '';
    document.getElementById('blogImage').value = post.image || '';
    document.getElementById('blogContent').value = post.content || '';
    document.getElementById('blogEditingId').value = post.id;
    document.querySelector('[data-tab="blog"]').click();
  }catch(e){ showToast('Load failed: '+e.message, null, null, 6000); }
}

async function refreshBlogPosts(){
  try {
    const url = API.buildURL('/api/blog');
    console.log('[blog] Loading from:', url);
    const r = await fetch(url, { headers: API.headers() });
    
    if(!r.ok) {
      console.error('[blog] Fetch failed:', r.status, r.statusText);
      throw new Error(`Failed to load blog posts (${r.status})`);
    }
    
    const posts = await r.json();
    console.log('[blog] Loaded posts:', posts ? posts.length : 0);
    
    const container = document.getElementById('publishedPosts');
    if (!container) return;
    
    container.innerHTML = '';
    if (!posts || posts.length === 0) {
      container.innerHTML = '<p style="opacity:0.6">No blog posts yet. Create one above.</p>';
      return;
    }
    
    posts.forEach(post=>{
      const div = document.createElement('div');
      div.className = 'blog-item';
      div.innerHTML = `
        <div>
          <div style="font-weight:700">${post.title}</div>
          <div style="opacity:0.8">${post.category} • ${new Date(post.createdAt).toLocaleDateString()}</div>
        </div>
        <div style="display:flex;gap:6px">
          <button class="btn-secondary" data-action="edit-blog" data-id="${post.id}">Edit</button>
          <button class="btn-danger" data-action="delete-blog" data-id="${post.id}">Delete</button>
        </div>
      `;
      container.appendChild(div);
    });
    
    // Attach event listeners for edit/delete buttons
    container.querySelectorAll('[data-action="edit-blog"]').forEach(btn => {
      btn.addEventListener('click', (e) => editBlogPost(e.target.dataset.id));
    });
    container.querySelectorAll('[data-action="delete-blog"]').forEach(btn => {
      btn.addEventListener('click', (e) => deleteBlogPost(e.target.dataset.id));
    });
  } catch(e) {
    console.error('[blog] Error:', e);
    const container = document.getElementById('publishedPosts');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

// ===== COMMENTS MODERATION =====
async function refreshCommentsModeration(){
  try{
    const r = await fetch(API.buildURL('/api/blog/comments'), { headers: API.headers() });
    if(!r.ok) throw new Error(`Failed to load comments (${r.status})`);
    const comments = await r.json();
    const container = document.getElementById('commentsModeration');
    if (!container) return;
    container.innerHTML = '';
    if(!comments || comments.length===0){ container.innerHTML = '<p style="opacity:0.8">No comments yet</p>'; return; }
    comments.slice().reverse().forEach(c=>{
      const div = document.createElement('div');
      div.style.display = 'flex'; div.style.justifyContent = 'space-between'; div.style.alignItems = 'center';
      div.style.padding = '0.5rem 0'; div.style.borderBottom = '1px solid rgba(255,255,255,0.03)';
      div.innerHTML = `<div style="max-width:78%"><div style="font-weight:700">${c.author||'Anonymous'}</div><div style="opacity:0.8;font-size:0.95rem">${(c.content||'').slice(0,200)}${(c.content && c.content.length>200? '...':'')}</div><div style="opacity:0.7;font-size:0.85rem">on post ${c.postId} • ${new Date(c.createdAt).toLocaleString()}</div></div>`;
      const btns = document.createElement('div');
      const del = document.createElement('button'); del.className='btn-danger'; del.textContent='Delete';
      del.addEventListener('click', async ()=>{
        if(!confirm('Delete this comment?')) return;
        try{ const dr = await fetch(API.buildURL('/api/blog/comment?id='+encodeURIComponent(c.id)), { method:'DELETE', headers: API.headers() }); if(!dr.ok) throw new Error(await dr.text()); showToast('Comment deleted'); await refreshCommentsModeration(); }catch(e){ alert('Delete failed: '+e.message); }
      });
      btns.appendChild(del);
      div.appendChild(btns);
      container.appendChild(div);
    });
  }catch(e){ 
    console.error('refreshCommentsModeration error:', e);
    const container = document.getElementById('commentsModeration');
    if (container) {
      container.innerHTML = `<p style="color:#ff6b6b">Error: ${e.message}</p>`;
    }
  }
}

async function deleteBlogPost(id){
  if(!confirm('Delete this blog post?')) return;
  try {
    const r = await fetch(API.buildURL('/api/blog?id='+encodeURIComponent(id)), { method:'DELETE', headers: API.headers() });
    if(!r.ok) throw new Error(await r.text());
    alert('Post deleted');
    await refreshBlogPosts();
  } catch(e) {
    alert('Delete failed: '+e.message);
  }
}

// ===== SETTINGS =====
async function updateAdminCredentials(){
  const currentPass = document.getElementById('currentPassword').value;
  const newUsername = document.getElementById('newUsername').value;
  const newPassword = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmPassword').value;

  if(!currentPass) return alert('Enter current password');
  if(newPassword && newPassword !== confirmPass) return alert('Passwords do not match');
  if(!newUsername && !newPassword) return alert('Enter at least username or password');

  const payload = { currentPassword: currentPass, newUsername, newPassword };
  try {
    const r = await fetch(API.buildURL('/api/admin/update-credentials'), { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Admin credentials updated. Please log in again.');
    localStorage.removeItem('adminToken');
    window.location.href = 'adminlogin.html';
  } catch(e) {
    alert('Update failed: '+e.message);
  }
}

async function saveSiteSettings(){
  const gaId = document.getElementById('gaId').value;
  const customScripts = document.getElementById('customScripts').value;
  const whatsappNumber = document.getElementById('whatsappNumber') ? document.getElementById('whatsappNumber').value : '';

  let scripts = [];
  if(customScripts){
    try {
      scripts = JSON.parse(customScripts);
    } catch(e) {
      return alert('Invalid JSON in Custom Scripts');
    }
  }

  const payload = { gaId, customScripts: scripts, whatsappNumber };
  try {
    const r = await fetch(API.buildURL('/api/settings'), { method:'POST', headers: API.headers(), body: JSON.stringify(payload) });
    if(!r.ok) throw new Error(await r.text());
    alert('Settings saved');
  } catch(e) {
    alert('Save failed: '+e.message);
  }
}

async function loadSiteSettings(){
  try{
    const r = await fetch(API.buildURL('/api/settings'), { headers: API.headers() });
    if(!r.ok) {
      if(r.status === 401) {
        console.warn('Settings require authentication - user may not be logged in yet');
      } else {
        throw new Error('Failed to load settings');
      }
      return;
    }
    const s = await r.json();
    if(document.getElementById('gaId')) document.getElementById('gaId').value = s.gaId || '';
    if(document.getElementById('customScripts')) document.getElementById('customScripts').value = JSON.stringify(s.customScripts || [], null, 2);
    if(document.getElementById('whatsappNumber')) document.getElementById('whatsappNumber').value = s.whatsappNumber || '';
  }catch(e){ console.warn('loadSiteSettings failed', e); }
}

// ===== APPS MANAGEMENT =====
let allAppsRegistry = {};
let currentAppsConfig = { enabled: {}, disabled: [] };
let currentFilterCategory = 'all';

async function loadAppsRegistry() {
  try {
    const r = await fetch(API.buildURL('/api/apps?registry=true'));
    if (!r.ok) throw new Error('Failed to load apps');
    const data = await r.json();
    allAppsRegistry = data.apps || {};
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
  } catch(e) {
    console.error('Load apps error:', e);
    showToast('Failed to load apps: ' + e.message, null, null, 6000);
  }
}

async function loadAppsConfiguration() {
  try {
    const r = await fetch(API.buildURL('/api/apps?config=true'), { headers: API.headers() });
    if (!r.ok) {
      // if auth failed or token invalid, try unauthenticated public config as a fallback
      const publicRes = await fetch(API.buildURL('/api/apps?config=true'));
      if (!publicRes.ok) throw new Error('Failed to load config');
      currentAppsConfig = await publicRes.json();
      return;
    }
    currentAppsConfig = await r.json();
  } catch(e) {
    console.error('Load config error:', e);
    // attempt public fallback so admin UI still shows active apps even when token is invalid
    try{
      const r2 = await fetch(API.buildURL('/api/apps?config=true'));
      if (r2.ok) currentAppsConfig = await r2.json();
    }catch(e2){ console.error('Public config fallback failed', e2); }
  }
}

function renderAppsList() {
  const container = document.getElementById('appsContainer');
  if (!container) return;
  
  container.innerHTML = '';
  
  // Filter apps
  let apps = Object.values(allAppsRegistry);
  if (currentFilterCategory !== 'all') {
    apps = apps.filter(app => app.category === currentFilterCategory);
  }
  
  apps.forEach(app => {
    const enabled = !!currentAppsConfig.enabled[app.id];
    const configured = enabled && Object.keys(currentAppsConfig.enabled[app.id]).length > 0;
    
    const card = document.createElement('div');
    card.className = 'app-card' + (enabled ? ' enabled' : '');
    card.innerHTML = `
      <div class="app-icon">${app.icon || '🔌'}</div>
      <div class="app-name">${app.name}</div>
      <div class="app-category">${app.category}</div>
      <div class="app-description">${app.description}</div>
      <div class="app-status ${enabled ? 'enabled' : 'disabled'}">
        ${enabled ? '✓ Active' : 'Inactive'}
        ${configured ? ' • Configured' : (enabled ? ' • Needs Config' : '')}
      </div>
      <div class="app-actions">
        <button class="btn-secondary" onclick="openAppConfigModal('${app.id}')" style="flex:1;">
          ${enabled ? 'Edit' : 'Install'}
        </button>
        ${enabled ? `<button class="btn-danger" onclick="disableApp('${app.id}')" style="flex:0;">Disable</button>` : ''}
      </div>
    `;
    container.appendChild(card);
  });
}

function updateActiveAppsList() {
  const container = document.getElementById('activeAppsList');
  if (!container) return;
  
  const activeApps = Object.keys(currentAppsConfig.enabled);
  if (activeApps.length === 0) {
    container.innerHTML = '<p style="opacity:0.8; margin:0;">No apps installed yet. Choose an app above to get started.</p>';
    return;
  }
  
  let html = '<div style="display:flex; gap:0.5rem; flex-wrap:wrap;">';
  activeApps.forEach(appId => {
    const app = allAppsRegistry[appId];
    if (app) {
      html += `<span style="background:rgba(0,255,0,0.2); color:#0f0; padding:0.5rem 0.75rem; border-radius:6px; font-size:0.9rem; display:flex; align-items:center; gap:0.5rem;">
        ${app.icon || '🔌'} ${app.name}
      </span>`;
    }
  });
  html += '</div>';
  container.innerHTML = html;
}

function openAppConfigModal(appId) {
  const app = allAppsRegistry[appId];
  if (!app) return;
  
  const isEnabled = !!currentAppsConfig.enabled[appId];
  const currentConfig = currentAppsConfig.enabled[appId] || {};
  
  const modal = document.getElementById('appConfigModal');
  const title = document.getElementById('appModalTitle');
  const body = document.getElementById('appModalBody');
  
  title.textContent = `Configure ${app.name}`;
  
  let html = `<p style="opacity:0.8; margin-bottom:1.5rem;">${app.description}</p>`;
  if (app.helpUrl) {
    html += `<div style="margin-bottom:0.75rem;"><a href="${app.helpUrl}" target="_blank" rel="noopener" class="btn-secondary">Open ${app.name} Dashboard</a></div>`;
  }
  html += `<form id="appConfigForm">`;
  
  // Generate form fields
  app.configFields.forEach(field => {
    const value = currentConfig[field.name] || (field.default || '');
    const required = field.required ? 'required' : '';
    
    html += `
      <div class="form-group">
        <label class="form-label">${field.label}${field.required ? ' *' : ''}</label>
    `;
    
    if (field.type === 'select') {
      html += `<select name="${field.name}" class="form-select" ${required}>
        <option value="">-- Select --</option>
    `;
      (field.options || []).forEach(option => {
        const selected = value === option ? 'selected' : '';
        html += `<option value="${option}" ${selected}>${option}</option>`;
      });
      html += `</select>`;
    } else {
      html += `<input type="${field.type}" name="${field.name}" class="form-input" placeholder="${field.placeholder || ''}" value="${value}" ${required} />`;
    }
    
    if (field.adminOnly) {
      html += `<small style="opacity:0.7; display:block; margin-top:0.25rem;">⚠️ Admin-only field (not shared with visitors)</small>`;
    }
    html += `</div>`;
  });
  
  html += `<div style="display:flex; gap:0.5rem; margin-top:2rem;">
    <button type="button" class="btn-primary" onclick="saveAppConfig('${appId}')">Install & Save</button>
    <button type="button" class="btn-secondary" onclick="closeAppModal()">Cancel</button>
  </div>`;
  html += `</form>`;
  
  body.innerHTML = html;
  modal.classList.add('active');
}

function closeAppModal() {
  const modal = document.getElementById('appConfigModal');
  modal.classList.remove('active');
}

async function saveAppConfig(appId) {
  const form = document.getElementById('appConfigForm');
  if (!form) return;
  
  // Collect form data
  const config = {};
  new FormData(form).forEach((value, key) => {
    config[key] = value;
  });
  
  try {
    const r = await fetch(API.buildURL('/api/apps'), {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({
        appId,
        action: 'enable',
        config
      })
    });
    
    if (!r.ok) throw new Error(await r.text());
    
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
    closeAppModal();
    showToast(`App installed successfully! Refresh your pages to see changes.`, null, null, 5000);
  } catch(e) {
    alert('Failed to save configuration: ' + e.message);
  }
}

async function disableApp(appId) {
  if (!confirm('Disable this app?')) return;
  
  try {
    const r = await fetch(API.buildURL('/api/apps'), {
      method: 'PUT',
      headers: API.headers(),
      body: JSON.stringify({
        appId,
        action: 'disable'
      })
    });
    
    if (!r.ok) throw new Error(await r.text());
    
    await loadAppsConfiguration();
    renderAppsList();
    updateActiveAppsList();
    showToast('App disabled. Refresh your pages to see changes.', null, null, 5000);
  } catch(e) {
    alert('Failed to disable app: ' + e.message);
  }
}

function attachAppFilterEvents() {
  document.querySelectorAll('.app-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.app-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentFilterCategory = tab.dataset.category;
      renderAppsList();
    });
  });
}

// ===== ANALYTICS =====
async function loadAnalytics(){
  try {
    const r = await fetch(API.buildURL('/api/analytics'), { headers: API.headers() });
    if(!r.ok) throw new Error('Failed');
    const data = await r.json();

    document.getElementById('totalVisitors').textContent = data.totalVisitors || 0;
    document.getElementById('todayVisitors').textContent = data.todayVisitors || 0;
    document.getElementById('uniqueVisitors').textContent = data.uniqueVisitors || 0;

    let countryHTML = '';
    const countries = data.countryStats || [];
    if(countries.length) {
      countryHTML = countries.map(c=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${c.country}</span>: ${c.count} visitors</div>`).join('');
    } else {
      countryHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('countryStats').innerHTML = countryHTML;

    let browserHTML = '';
    const browsers = data.browserStats || [];
    if(browsers.length) {
      browserHTML = browsers.map(b=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${b.browser}</span>: ${b.count} visitors</div>`).join('');
    } else {
      browserHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('browserStats').innerHTML = browserHTML;

    let pageHTML = '';
    const pages = data.pageViewStats || [];
    if(pages.length) {
      pageHTML = pages.map(p=>`<div style="padding:0.5rem;border-bottom:1px solid rgba(255,255,255,0.05)"><span style="font-weight:600">${p.page}</span>: ${p.views} views</div>`).join('');
    } else {
      pageHTML = '<p style="opacity:0.8">No data yet</p>';
    }
    document.getElementById('pageViewStats').innerHTML = pageHTML;
  } catch(e) {
    console.error('Analytics error:', e);
  }
}

// ===== INIT =====
function attachEvents(){
  const logoutBtn = document.getElementById('logoutBtn');
  if(logoutBtn) {
    logoutBtn.addEventListener('click', ()=>{
      localStorage.removeItem('adminToken');
      window.location.href = 'adminlogin.html';
    });
  } else { console.warn('attachEvents: logoutBtn not found'); }

  const loadPageBtn = document.getElementById('loadPageBtn');
  if(loadPageBtn) loadPageBtn.addEventListener('click', loadPageSections); else { console.warn('attachEvents: loadPageBtn not found'); }

  const publishPortfolioBtn = document.getElementById('publishPortfolioBtn');
  if(publishPortfolioBtn) publishPortfolioBtn.addEventListener('click', publishPortfolio); else { console.warn('attachEvents: publishPortfolioBtn not found'); }

  const publishBlogBtn = document.getElementById('publishBlogBtn');
  if(publishBlogBtn) publishBlogBtn.addEventListener('click', publishBlog); else { console.warn('attachEvents: publishBlogBtn not found'); }

  const updateCredsBtn = document.getElementById('updateCredsBtn');
  if(updateCredsBtn) updateCredsBtn.addEventListener('click', updateAdminCredentials); else { console.warn('attachEvents: updateCredsBtn not found'); }

  const saveSiteSettingsBtn = document.getElementById('saveSiteSettingsBtn');
  if(saveSiteSettingsBtn) saveSiteSettingsBtn.addEventListener('click', saveSiteSettings); else { console.warn('attachEvents: saveSiteSettingsBtn not found'); }

  // Apps management
  attachAppFilterEvents();

  const analyticsTab = document.querySelector('[data-tab="analytics"]');
  if(analyticsTab) {
    analyticsTab.addEventListener('click', loadAnalytics);
  }
  // refresh comments moderation when blog tab activated
  const blogTabBtn = document.querySelector('[data-tab="blog"]');
  if(blogTabBtn){
    blogTabBtn.addEventListener('click', ()=>{ refreshBlogPosts(); refreshCommentsModeration(); });
  }
  // reload download files when tab activated
  const downloadFilesTabBtn = document.querySelector('[data-tab="download-files"]');
  if(downloadFilesTabBtn){
    downloadFilesTabBtn.addEventListener('click', loadDownloadFilesUI);
  }
  
  // Close modal when clicking outside
  const modal = document.getElementById('appConfigModal');
  if(modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeAppModal();
    });
  }

  // ===== OVERLAY TAB EVENTS =====
  const masterOverlayToggle = document.getElementById('masterOverlayToggle');
  if(masterOverlayToggle) masterOverlayToggle.addEventListener('click', toggleMasterOverlay);
  
  const editModal1Btn = document.getElementById('editModal1Btn');
  if(editModal1Btn) editModal1Btn.addEventListener('click', () => {
    document.getElementById('modal1ImageFile').disabled = false;
    document.getElementById('modal1Description').readOnly = false;
    document.getElementById('modal1ButtonText').readOnly = false;
    document.getElementById('modal1ImageUrl').readOnly = false;
    document.getElementById('editModal1Btn').style.display = 'none';
    document.getElementById('saveModal1Btn').style.display = 'inline-block';
  });

  const saveModal1Btn = document.getElementById('saveModal1Btn');
  if(saveModal1Btn) saveModal1Btn.addEventListener('click', saveModal1Config);

  const toggleModal1Btn = document.getElementById('toggleModal1Btn');
  if(toggleModal1Btn) toggleModal1Btn.addEventListener('click', () => toggleModalState('modal1'));

  const editModal2Btn = document.getElementById('editModal2Btn');
  if(editModal2Btn) editModal2Btn.addEventListener('click', () => {
    document.getElementById('modal2MediaFile').disabled = false;
    document.getElementById('modal2Description').readOnly = false;
    document.getElementById('modal2MediaUrl').readOnly = false;
    document.getElementById('editModal2Btn').style.display = 'none';
    document.getElementById('saveModal2Btn').style.display = 'inline-block';
  });

  const saveModal2Btn = document.getElementById('saveModal2Btn');
  if(saveModal2Btn) saveModal2Btn.addEventListener('click', saveModal2Config);

  const toggleModal2Btn = document.getElementById('toggleModal2Btn');
  if(toggleModal2Btn) toggleModal2Btn.addEventListener('click', () => toggleModalState('modal2'));

  // Load overlay on tab click
  const overlayTabBtn = document.querySelector('[data-tab="overlay"]');
  if(overlayTabBtn) overlayTabBtn.addEventListener('click', loadOverlayUI);
}

// ===== OVERLAY MANAGEMENT =====
async function loadOverlayUI() {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load overlay config');
    const overlay = await r.json();

    // Update master toggle
    const masterBtn = document.getElementById('masterOverlayToggle');
    masterBtn.textContent = overlay.masterEnabled ? '🟢 All Modals ON' : '🔴 All Modals OFF';
    masterBtn.style.background = overlay.masterEnabled ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.1)';

    // Update Modal 1
    document.getElementById('modal1ImageUrl').value = overlay.modal1?.image || '';
    document.getElementById('modal1Description').value = overlay.modal1?.description || '';
    document.getElementById('modal1ButtonText').value = overlay.modal1?.buttonText || 'Get Started';
    const modal1Btn = document.getElementById('toggleModal1Btn');
    modal1Btn.textContent = overlay.modal1?.enabled ? '🟢 ON' : '🔴 OFF';
    modal1Btn.style.background = overlay.modal1?.enabled ? 'rgba(0,255,0,0.2)' : '';

    // Update Modal 2
    document.getElementById('modal2MediaUrl').value = overlay.modal2?.media || '';
    document.getElementById('modal2Description').value = overlay.modal2?.description || '';
    const modal2Btn = document.getElementById('toggleModal2Btn');
    modal2Btn.textContent = overlay.modal2?.enabled ? '🟢 ON' : '🔴 OFF';
    modal2Btn.style.background = overlay.modal2?.enabled ? 'rgba(0,255,0,0.2)' : '';

    // Disable edit/save buttons by default
    document.getElementById('modal1ImageFile').disabled = true;
    document.getElementById('modal1Description').readOnly = true;
    document.getElementById('modal1ButtonText').readOnly = true;
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('saveModal1Btn').style.display = 'none';

    document.getElementById('modal2MediaFile').disabled = true;
    document.getElementById('modal2Description').readOnly = true;
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('editModal2Btn').style.display = 'inline-block';
    document.getElementById('saveModal2Btn').style.display = 'none';
  } catch(e) {
    console.error('Error loading overlay UI:', e);
    showToast('Failed to load overlay config', null, null, 3000);
  }
}

async function toggleMasterOverlay() {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load current config');
    const overlay = await r.json();

    const newMasterState = !overlay.masterEnabled;

    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: newMasterState,
        modal1: overlay.modal1,
        modal2: overlay.modal2
      })
    });

    if(!saveR.ok) throw new Error('Failed to save');
    
    const btn = document.getElementById('masterOverlayToggle');
    btn.textContent = newMasterState ? '🟢 All Modals ON' : '🔴 All Modals OFF';
    btn.style.background = newMasterState ? 'rgba(0,255,0,0.2)' : 'rgba(255,0,0,0.1)';
    showToast(newMasterState ? 'All overlays enabled' : 'All overlays disabled', null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

async function saveModal1Config() {
  try {
    const imageFile = document.getElementById('modal1ImageFile').files[0];
    const description = document.getElementById('modal1Description').value;
    const buttonText = document.getElementById('modal1ButtonText').value;

    let imageUrl = document.getElementById('modal1ImageUrl').value || '';

    // Upload image if new file selected
    if(imageFile) {
      const formData = new FormData();
      formData.append('file', imageFile);
      try {
        const uploadR = await fetch(API.buildURL('/api/upload'), {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + API.token() },
          body: formData
        });
        if(!uploadR.ok) {
          const errData = await uploadR.text();
          throw new Error(`Image upload failed: ${uploadR.status} ${errData}`);
        }
        const uploadData = await uploadR.json();
        imageUrl = uploadData.url;
        console.log('[saveModal1] Image uploaded:', imageUrl);
      } catch(uploadErr) {
        console.error('[saveModal1] Upload error:', uploadErr);
        throw uploadErr;
      }
    }

    if(!imageUrl) {
      throw new Error('Please upload an image or paste an image URL');
    }

    // Get current config
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    // Save Modal 1 config
    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: {
          type: 'contactForm',
          enabled: true,
          image: imageUrl,
          description: description,
          buttonText: buttonText,
          web3formsKey: '4eab8d69-b661-4f80-92b2-a99786eddbf9'
        },
        modal2: { ...overlay.modal2, enabled: false }
      })
    });

    if(!saveR.ok) {
      const errData = await saveR.text();
      throw new Error(`Failed to save Modal 1: ${saveR.status} ${errData}`);
    }
    
    document.getElementById('modal1ImageUrl').readOnly = true;
    document.getElementById('modal1ImageUrl').value = imageUrl;
    document.getElementById('modal1Description').readOnly = true;
    document.getElementById('modal1ButtonText').readOnly = true;
    document.getElementById('modal1ImageFile').disabled = true;
    document.getElementById('editModal1Btn').style.display = 'inline-block';
    document.getElementById('saveModal1Btn').style.display = 'none';
    document.getElementById('toggleModal1Btn').textContent = '🟢 ON';
    document.getElementById('toggleModal1Btn').style.background = 'rgba(0,255,0,0.2)';
    showToast('Modal 1 saved and enabled!', null, null, 3000);
  } catch(e) {
    console.error('[saveModal1] Error:', e);
    alert('Error: ' + e.message);
  }
}

async function saveModal2Config() {
  try {
    const mediaFile = document.getElementById('modal2MediaFile').files[0];
    const description = document.getElementById('modal2Description').value;
    let mediaUrl = document.getElementById('modal2MediaUrl').value || '';

    // Upload media if new file selected
    if(mediaFile) {
      const formData = new FormData();
      formData.append('file', mediaFile);
      const uploadUrl = API.buildURL('/api/upload');
      console.log('[saveModal2] Uploading to:', uploadUrl);
      console.log('[saveModal2] File:', mediaFile.name, 'Size:', mediaFile.size);
      
      try {
        const uploadR = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + API.token() },
          body: formData
        });
        
        console.log('[saveModal2] Upload response status:', uploadR.status);
        console.log('[saveModal2] Response headers:', Array.from(uploadR.headers.entries()));
        
        if(!uploadR.ok) {
          const errData = await uploadR.text();
          console.error('[saveModal2] Upload failed with status', uploadR.status, ':', errData);
          throw new Error(`Media upload failed: ${uploadR.status} ${errData}`);
        }
        const uploadData = await uploadR.json();
        mediaUrl = uploadData.url;
        console.log('[saveModal2] Media uploaded:', mediaUrl);
      } catch(uploadErr) {
        console.error('[saveModal2] Upload error:', uploadErr.message);
        console.error('[saveModal2] Error details:', uploadErr);
        throw uploadErr;
      }
    }

    if(!mediaUrl) {
      throw new Error('Please upload media or paste a media URL (image, video, or YouTube link)');
    }

    // Get current config
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    // Detect media type
    let mediaType = 'image';
    if(mediaUrl.match(/youtube|youtu\.be|vimeo/i)) {
      mediaType = 'embed';
    } else if(mediaUrl.match(/\.(mp4|webm|mov|avi|mkv|flv|m4v|3gp|ogv|ts)$/i)) {
      mediaType = 'video';
    }

    // Save Modal 2 config
    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: { ...overlay.modal1, enabled: false },
        modal2: {
          type: 'mediaDisplay',
          enabled: true,
          media: mediaUrl,
          mediaType: mediaType,
          description: description
        }
      })
    });

    if(!saveR.ok) {
      const errData = await saveR.text();
      throw new Error(`Failed to save Modal 2: ${saveR.status} ${errData}`);
    }
    
    document.getElementById('modal2MediaUrl').readOnly = true;
    document.getElementById('modal2MediaUrl').value = mediaUrl;
    document.getElementById('modal2Description').readOnly = true;
    document.getElementById('modal2MediaFile').disabled = true;
    document.getElementById('editModal2Btn').style.display = 'inline-block';
    document.getElementById('saveModal2Btn').style.display = 'none';
    document.getElementById('toggleModal2Btn').textContent = '🟢 ON';
    document.getElementById('toggleModal2Btn').style.background = 'rgba(0,255,0,0.2)';
    showToast('Modal 2 saved and enabled!', null, null, 3000);
  } catch(e) {
    console.error('[saveModal2] Error:', e);
    alert('Error: ' + e.message);
  }
}

async function toggleModalState(modal) {
  try {
    const r = await fetch(API.buildURL('/api/overlay'));
    if(!r.ok) throw new Error('Failed to load config');
    const overlay = await r.json();

    const newState = modal === 'modal1' ? !overlay.modal1.enabled : !overlay.modal2.enabled;

    const saveR = await fetch(API.buildURL('/api/overlay'), {
      method: 'POST',
      headers: API.headers(),
      body: JSON.stringify({
        masterEnabled: overlay.masterEnabled,
        modal1: modal === 'modal1' ? { ...overlay.modal1, enabled: newState } : { ...overlay.modal1, enabled: false },
        modal2: modal === 'modal2' ? { ...overlay.modal2, enabled: newState } : { ...overlay.modal2, enabled: false }
      })
    });

    if(!saveR.ok) throw new Error('Failed to save');
    
    const btn = document.getElementById('toggleModal' + (modal === 'modal1' ? '1' : '2') + 'Btn');
    btn.textContent = newState ? '🟢 ON' : '🔴 OFF';
    btn.style.background = newState ? 'rgba(0,255,0,0.2)' : '';
    showToast(`Modal ${modal === 'modal1' ? '1' : '2'} ${newState ? 'enabled' : 'disabled'}`, null, null, 3000);
  } catch(e) {
    alert('Error: ' + e.message);
  }
}

// Expose functions globally for onclick handlers
window.editPortfolioItem = editPortfolioItem;
window.deletePortfolioItem = deletePortfolioItem;
window.editBlogPost = editBlogPost;
window.deleteBlogPost = deleteBlogPost;
window.publishPortfolio = publishPortfolio;
window.publishBlog = publishBlog;
window.uploadFile = uploadFile;
window.loadPageSections = loadPageSections;
window.savePageSections = savePageSections;
window.updateAdminCredentials = updateAdminCredentials;
window.saveSiteSettings = saveSiteSettings;
window.openAppConfigModal = openAppConfigModal;
window.closeAppModal = closeAppModal;
window.saveAppConfig = saveAppConfig;
window.disableApp = disableApp;
window.loadOverlayUI = loadOverlayUI;
window.toggleMasterOverlay = toggleMasterOverlay;

window.addEventListener('load', async ()=>{
  try{
    requireAuth();
  } catch(e){
    window.location.href = 'adminlogin.html';
  }
  initTabs();
  attachEvents();
  refreshPortfolioList();
  refreshBlogPosts();
  await loadSiteSettings();
  loadAppsRegistry();
  loadDownloadFilesUI();
});
  
  // ===== DOWNLOAD FILES SECTION =====
  async function loadDownloadFilesUI() {
    const container = document.getElementById('publishedDownloadFiles');
    const successContainer = document.getElementById('successPageUploads');
    
    try {
      // Load download files
      const dfResponse = await fetch(API.buildURL('/api/download-files'));
      const downloadFiles = await dfResponse.json() || [];
      
      // Load success files
      const sfResponse = await fetch(API.buildURL('/api/success-files'), {
        headers: API.headers()
      });
      const successFiles = await sfResponse.json() || [];
      
      // Render download files
      if (downloadFiles.length === 0) {
        container.innerHTML = '<p style="opacity:0.8;">No download files published yet.</p>';
      } else {
        container.innerHTML = downloadFiles.map(file => `
          <div class="section-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p style="font-weight:600; margin:0;">📄 ${file.originalname}</p>
                <p style="opacity:0.7; margin:0.5rem 0 0 0; font-size:0.9rem;">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button class="btn-danger" onclick="deleteDownloadFile('${file.id}')">Delete</button>
            </div>
          </div>
        `).join('');
      }
      
      // Render success files
      if (successFiles.length === 0) {
        successContainer.innerHTML = '<p style="opacity:0.8;">No files uploaded from success page yet.</p>';
      } else {
        successContainer.innerHTML = successFiles.map(file => `
          <div class="section-card">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <div>
                <p style="font-weight:600; margin:0;">📄 ${file.originalname}</p>
                <p style="opacity:0.7; margin:0.5rem 0 0 0; font-size:0.9rem;">${(file.size / 1024 / 1024).toFixed(2)} MB • ${new Date(file.uploadedAt).toLocaleString()}</p>
              </div>
              <button class="btn-danger" onclick="deleteSuccessFile('${file.id}')">Delete</button>
            </div>
          </div>
        `).join('');
      }
    } catch (error) {
      console.error('Error loading files:', error);
      container.innerHTML = '<p style="color:#FF5555;">Error loading files: ' + error.message + '</p>';
      successContainer.innerHTML = '<p style="color:#FF5555;">Error loading files: ' + error.message + '</p>';
    }
  }
  
  window.deleteDownloadFile = async function(fileId) {
    if (!confirm('Delete this file?')) return;
    
    try {
      const r = await fetch(API.buildURL('/api/download-file?id=' + fileId), {
        method: 'DELETE',
        headers: API.headers()
      });
      
      if (!r.ok) throw new Error(await r.text());
      
      showToast('✅ File deleted successfully', null, null, 3000);
      loadDownloadFilesUI();
    } catch (error) {
      alert('Error deleting file: ' + error.message);
    }
  };
  
  window.deleteSuccessFile = async function(fileId) {
    if (!confirm('Delete this file?')) return;
    
    try {
      const r = await fetch(API.buildURL('/api/success-file?id=' + fileId), {
        method: 'DELETE',
        headers: API.headers()
      });
      
      if (!r.ok) throw new Error(await r.text());
      
      showToast('✅ File deleted successfully', null, null, 3000);
      loadDownloadFilesUI();
    } catch (error) {
      alert('Error deleting file: ' + error.message);
    }
  };
  
  // Attach upload handler
  document.getElementById('publishDownloadFileBtn')?.addEventListener('click', async function() {
    const fileInput = document.getElementById('dfFileInput');
    const tokenInput = document.getElementById('dfTokenInput');
    const statusMsg = document.getElementById('dfUploadStatus');
    
    if (!fileInput.files.length) {
      statusMsg.textContent = '❌ Please select a file';
      statusMsg.style.color = '#FF5555';
      return;
    }
    
    if (!tokenInput.value) {
      statusMsg.textContent = '❌ Please enter a token';
      statusMsg.style.color = '#FF5555';
      return;
    }
    
    try {
      statusMsg.textContent = '⏳ Uploading file...';
      statusMsg.style.color = '#5555ff';
      
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('token', tokenInput.value);
      
      const r = await fetch(API.buildURL('/api/upload-download-file'), {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + API.token() },
        body: formData
      });
      
      if (!r.ok) {
        const error = await r.json();
        throw new Error(error.error || 'Upload failed');
      }
      
      const result = await r.json();
      statusMsg.textContent = '✅ File published successfully!';
      statusMsg.style.color = '#25D366';
      fileInput.value = '';
      tokenInput.value = '';
      
      setTimeout(() => {
        loadDownloadFilesUI();
      }, 1000);
      
    } catch (error) {
      console.error('Upload error:', error);
      statusMsg.textContent = '❌ Upload failed: ' + error.message;
      statusMsg.style.color = '#FF5555';
    }
  });

  // ===== PROJECTS MANAGEMENT =====
  async function loadProjectsUI() {
    try {
      const r = await fetch(API.buildURL('/api/projects'), { headers: API.headers() });
      if (!r.ok) throw new Error('Failed to load projects');
      const projects = await r.json();

      const container = document.getElementById('projectsContainer');
      if (!container) return;

      if (projects.length === 0) {
        container.innerHTML = '<p style="opacity:0.8">No projects submitted yet</p>';
        return;
      }

      container.innerHTML = projects.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt)).map(p => {
        const email = p.userEmail || p.contact || 'Not provided';
        return `
        <div style="padding:1rem; border:1px solid rgba(255,255,255,0.1); border-radius:8px; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:0.75rem;">
            <div style="flex:1;">
              <div style="font-weight:600; color:var(--primary-accent); font-size:1.1rem;">${p.projectType}</div>
              <div style="opacity:0.8; font-size:0.9rem; margin-top:0.5rem;"><strong>📋 Project ID:</strong> <code style="background:rgba(255,255,255,0.05); padding:0.3rem 0.6rem; border-radius:4px; font-family:monospace;">${p.id}</code></div>
              <div style="opacity:0.8; font-size:0.9rem; margin-top:0.4rem;"><strong>👤 Client:</strong> ${p.name}</div>
              <div style="opacity:0.8; font-size:0.9rem; margin-top:0.4rem;"><strong>📧 Email:</strong> <a href="mailto:${email}" style="color:var(--secondary-accent);text-decoration:none;font-weight:500">${email}</a></div>
              ${p.phone ? `<div style="opacity:0.8; font-size:0.9rem; margin-top:0.4rem;"><strong>📱 Phone:</strong> ${p.phone}</div>` : ''}
            </div>
            <div style="text-align:right;">
              <div style="font-size:0.85rem; opacity:0.7;">${new Date(p.uploadedAt).toLocaleString()}</div>
            </div>
          </div>
          <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:6px; margin-bottom:1rem;">
            <div style="font-weight:600; margin-bottom:0.5rem;">Description:</div>
            <div style="opacity:0.85;">${p.description}</div>
          </div>
          <div style="background:rgba(255,255,255,0.02); padding:0.75rem; border-radius:6px; margin-bottom:1rem;">
            <div style="font-weight:600; margin-bottom:0.5rem;">Files (${p.files.length}):</div>
            <div style="opacity:0.85; font-size:0.9rem;">
              ${p.files.map(f => '<div>📄 ' + f.originalname + ' (' + (f.size / 1024).toFixed(1) + ' KB)</div>').join('')}
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; margin-bottom:1rem; flex-wrap:wrap;">
            ${p.files.map((f, idx) => '<button class="btn-primary" onclick="viewProjectFile(\'' + f.filename + '\')" style="min-width:70px; background-color:#4A90E2; padding:0.6rem 1rem; font-size:0.9rem;">View ' + (idx + 1) + '</button><button class="btn-primary" onclick="downloadProjectFile(\'' + f.filename + '\')" style="min-width:70px; background-color:#2ECC71; padding:0.6rem 1rem; font-size:0.9rem;">DL ' + (idx + 1) + '</button>').join('')}
          </div>
          <div style="display:flex; gap:1rem; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; background:${p.status === 'completed' ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)'}; border:1px solid ${p.status === 'completed' ? 'rgba(0,255,0,0.3)' : 'rgba(255,165,0,0.3)'}; border-radius:6px; cursor:pointer; font-size:0.9rem;">
              <input type="checkbox" ${p.status === 'completed' ? 'checked' : ''} onchange="toggleProjectStatus(\'' + p.id + '\', this.checked)" style="cursor:pointer;"/>
              <span style="color:${p.status === 'completed' ? '#0f0' : '#ffcc00'};">${p.status === 'completed' ? 'Completed' : 'Pending'}</span>
            </label>
            <label style="display:flex; align-items:center; gap:0.5rem; padding:0.5rem 1rem; background:${p.payment === 'verified' ? 'rgba(0,255,0,0.1)' : 'rgba(255,165,0,0.1)'}; border:1px solid ${p.payment === 'verified' ? 'rgba(0,255,0,0.3)' : 'rgba(255,165,0,0.3)'}; border-radius:6px; cursor:pointer; font-size:0.9rem;">
              <input type="checkbox" ${p.payment === 'verified' ? 'checked' : ''} onchange="toggleProjectPayment(\'' + p.id + '\', this.checked)" style="cursor:pointer;"/>
              <span style="color:${p.payment === 'verified' ? '#0f0' : '#ffcc00'};">${p.payment === 'verified' ? 'Paid' : 'Verifying'}</span>
            </label>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button class="btn-danger" onclick="deleteProject(\'' + p.id + '\')" style="min-width:70px; padding:0.6rem 1rem; font-size:0.9rem;">Delete</button>
          </div>
        </div>
        `;
      }).join('');
    } catch (e) {
      console.error('loadProjectsUI error:', e);
      const container = document.getElementById('projectsContainer');
      if (container) container.innerHTML = '<p style="color:#FF5555">Error loading projects. Check console.</p>';
    }
  }

  window.viewProjectFile = function(filename) {
    window.open('/public/uploads/' + filename, '_blank');
  };

  window.downloadProjectFile = function(filename) {
    const link = document.createElement('a');
    link.href = '/public/uploads/' + filename;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  window.toggleProjectStatus = async function(projectId, isCompleted) {
    try {
      const r = await fetch(API.buildURL('/api/projects/' + projectId), {
        method: 'PUT',
        headers: API.headers(),
        body: JSON.stringify({ status: isCompleted ? 'completed' : 'pending' })
      });
      
      if (!r.ok) throw new Error('Failed to update project status');
      
      showToast(isCompleted ? '✅ Project marked as completed' : '⏳ Project marked as pending', null, null, 3000);
      loadProjectsUI();
    } catch (error) {
      alert('Error updating status: ' + error.message);
      loadProjectsUI();
    }
  };

  window.toggleProjectPayment = async function(projectId, isVerified) {
    try {
      const r = await fetch(API.buildURL('/api/projects/' + projectId), {
        method: 'PUT',
        headers: API.headers(),
        body: JSON.stringify({ payment: isVerified ? 'verified' : 'verifying' })
      });
      
      if (!r.ok) throw new Error('Failed to update payment status');
      
      showToast(isVerified ? '✅ Payment verified' : '⏳ Payment status reset', null, null, 3000);
      loadProjectsUI();
    } catch (error) {
      alert('Error updating payment: ' + error.message);
      loadProjectsUI();
    }
  };

  window.deleteProject = async function(projectId) {
    if (!confirm('Delete this project? This cannot be undone.')) return;
    
    try {
      const r = await fetch(API.buildURL('/api/projects/' + projectId), {
        method: 'DELETE',
        headers: API.headers()
      });
      
      if (!r.ok) throw new Error('Failed to delete project');
      
      showToast('✅ Project deleted', null, null, 3000);
      loadProjectsUI();
    } catch (error) {
      alert('Error deleting project: ' + error.message);
    }
  };

  // Add projects tab event listener
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'projects') {
      btn.addEventListener('click', loadProjectsUI);
    }
  });

  // ===== HEADLINE MANAGEMENT =====
  async function loadHeadlineUI() {
    try {
      const r = await fetch(API.buildURL('/api/headline'), { headers: API.headers() });
      if (!r.ok) throw new Error('Failed to load headline');
      
      const data = await r.json();
      const textarea = document.getElementById('headlineText');
      const status = document.getElementById('headlineStatus');
      const statusText = document.getElementById('headlineStatusText');
      const lastUpdated = document.getElementById('headlineLastUpdated');
      const toggleBtn = document.getElementById('toggleHeadlineBtn');
      
      textarea.value = data.text || '';
      textarea.readOnly = true;
      
      if (data.enabled) {
        toggleBtn.textContent = '🟢 ON';
        toggleBtn.style.borderColor = '#51CF66';
        toggleBtn.style.color = '#51CF66';
      } else {
        toggleBtn.textContent = '🔴 OFF';
        toggleBtn.style.borderColor = 'var(--secondary-accent)';
        toggleBtn.style.color = 'var(--secondary-accent)';
      }
      
      status.style.display = 'block';
      statusText.textContent = 'Status: ' + (data.enabled ? '✅ ACTIVE' : '❌ INACTIVE');
      lastUpdated.textContent = 'Last updated: ' + new Date(data.lastUpdated || Date.now()).toLocaleString();
    } catch (error) {
      console.error('Error loading headline:', error);
      showToast('Error loading headline: ' + error.message, null, null, 3000);
    }
  }
  
  window.editHeadline = function() {
    const textarea = document.getElementById('headlineText');
    const editBtn = document.getElementById('editHeadlineBtn');
    const updateBtn = document.getElementById('updateHeadlineBtn');
    
    textarea.readOnly = false;
    textarea.focus();
    editBtn.style.display = 'none';
    updateBtn.style.display = 'block';
  };
  
  window.updateHeadline = async function() {
    const textarea = document.getElementById('headlineText');
    const editBtn = document.getElementById('editHeadlineBtn');
    const updateBtn = document.getElementById('updateHeadlineBtn');
    
    try {
      const text = textarea.value;
      const token = API.token();
      
      const r = await fetch(API.buildURL('/api/headline'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ text })
      });
      
      if (!r.ok) throw new Error('Failed to update headline');
      
      textarea.readOnly = true;
      editBtn.style.display = 'block';
      updateBtn.style.display = 'none';
      
      showToast('✅ Headline updated successfully!', null, null, 3000);
      loadHeadlineUI();
    } catch (error) {
      alert('Error updating headline: ' + error.message);
    }
  };
  
  window.toggleHeadline = async function() {
    try {
      const r = await fetch(API.buildURL('/api/headline'), { headers: API.headers() });
      if (!r.ok) throw new Error('Failed to load headline');
      
      const data = await r.json();
      const token = API.token();
      
      const updateR = await fetch(API.buildURL('/api/headline'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ text: data.text, enabled: !data.enabled })
      });
      
      if (!updateR.ok) throw new Error('Failed to toggle headline');
      
      showToast('✅ Headline turned ' + (!data.enabled ? 'ON' : 'OFF') + '!', null, null, 3000);
      loadHeadlineUI();
    } catch (error) {
      alert('Error toggling headline: ' + error.message);
    }
  };
  
  // Add headline tab event listener
  document.querySelectorAll('.admin-tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'headline') {
      btn.addEventListener('click', loadHeadlineUI);
    }
  });
  
  document.getElementById('editHeadlineBtn').addEventListener('click', editHeadline);
  document.getElementById('updateHeadlineBtn').addEventListener('click', updateHeadline);
  document.getElementById('toggleHeadlineBtn').addEventListener('click', toggleHeadline);

} // End of ADMIN_INITIALIZED guard