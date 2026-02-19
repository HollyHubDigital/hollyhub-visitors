// ===== UTILITY FUNCTIONS =====
const showNotification = (message, type = 'success') => {
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  setTimeout(() => notification.remove(), 3000);
};

// ===== MOBILE MENU =====
const hamburgerBtn = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobile-menu');

if (hamburgerBtn && mobileMenu) {
  hamburgerBtn.addEventListener('click', () => {
    hamburgerBtn.classList.toggle('active');
    mobileMenu.classList.toggle('active');
  });

  // Close menu when link is clicked
  document.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', () => {
      hamburgerBtn.classList.remove('active');
      mobileMenu.classList.remove('active');
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.sticky-header')) {
      hamburgerBtn.classList.remove('active');
      mobileMenu.classList.remove('active');
    }
  });
}

// ===== SEARCH FUNCTIONALITY =====
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const searchModal = document.getElementById('searchModal');
const searchResults = document.getElementById('searchResults');
const searchClose = document.getElementById('searchClose');

// Search database (in production, this would be from backend)
const searchDatabase = [
  { title: 'Website Development', url: 'services.html#web-dev', category: 'Service' },
  { title: 'Digital Marketing', url: 'services.html#marketing', category: 'Service' },
  { title: 'Portfolio', url: 'portfolio.html', category: 'Page' },
  { title: 'About Me', url: 'about.html', category: 'Page' },
  { title: 'Blog', url: 'blog.html', category: 'Page' },
  { title: 'Pricing', url: 'index.html#pricing', category: 'Section' },
  { title: 'Contact', url: 'contact.html', category: 'Page' },
  { title: 'SEO Services', url: 'services.html#seo', category: 'Service' },
  { title: 'E-Commerce Solutions', url: 'services.html#ecommerce', category: 'Service' },
  { title: 'Brand Design', url: 'services.html#design', category: 'Service' },
  { title: 'Sign Up', url: 'signup.html', category: 'Action' },
  { title: 'Login', url: 'login.html', category: 'Action' },
  { title: 'FAQ', url: 'index.html#faq', category: 'Section' },
  { title: 'Testimonials', url: 'index.html#testimonials', category: 'Section' }
];

const performSearch = (query) => {
  if (!query || !query.trim()) return;
  const q = query.toLowerCase();

  // collect matches from the static search database
  const dbMatches = searchDatabase.filter(item => (
    (item.title && item.title.toLowerCase().includes(q)) ||
    (item.category && item.category.toLowerCase().includes(q)) ||
    (item.url && item.url.toLowerCase().includes(q))
  ));

  // also scan page headings and links for matches (helps find in-page content)
  const domMatches = [];
  document.querySelectorAll('h1,h2,h3,h4,a').forEach(el => {
    const text = (el.innerText || el.textContent || '').trim();
    if(!text) return;
    if(text.toLowerCase().includes(q)){
      let url = '#';
      if(el.tagName.toLowerCase() === 'a' && el.href) url = el.getAttribute('href') || el.href;
      else if(el.id) url = `#${el.id}`;
      domMatches.push({ title: text, url, category: 'On-page' });
    }
  });

  // merge & dedupe by url+title
  const combined = [...dbMatches, ...domMatches];
  const seen = new Set();
  const results = [];
  combined.forEach(it => {
    const key = (it.url||'') + '|' + (it.title||'');
    if(!seen.has(key)) { seen.add(key); results.push(it); }
  });

  searchResults.innerHTML = '';
  if (results.length === 0) {
    searchResults.innerHTML = '<p style="text-align: center; opacity: 0.7;">No results found</p>';
  } else {
    results.forEach(result => {
      const resultHTML = `
        <a href="${result.url}" class="search-result-item">
          <strong>${result.title}</strong>
          <span style="display: block; font-size: 0.85rem; opacity: 0.6; margin-top: 0.3rem;">${result.category||''}</span>
        </a>
      `;
      searchResults.innerHTML += resultHTML;
    });
  }

  searchModal.classList.add('active');
};

if (searchBtn && searchInput) {
  searchBtn.addEventListener('click', () => {
    performSearch(searchInput.value);
  });

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      performSearch(searchInput.value);
    }
  });
}

if (searchClose) {
  searchClose.addEventListener('click', () => {
    searchModal.classList.remove('active');
  });
}

// Close search modal when clicking outside
if (searchModal) {
  searchModal.addEventListener('click', (e) => {
    if (e.target === searchModal) {
      searchModal.classList.remove('active');
    }
  });
}

// ===== LANGUAGE TRANSLATOR =====
const languageSelect = document.getElementById('languageSelect');
const translations = {
  en: {
    'nav-home': 'HOME',
    'nav-services': 'SERVICES',
    'nav-features': 'FEATURES',
    'nav-pricing': 'PRICING',
    'nav-portfolio': 'PORTFOLIO',
    'nav-blog': 'BLOG',
    'nav-about': 'ABOUT',
  },
  es: {
    'nav-home': 'INICIO',
    'nav-services': 'SERVICIOS',
    'nav-features': 'CARACTERÍSTICAS',
    'nav-pricing': 'PRECIOS',
    'nav-portfolio': 'PORTAFOLIO',
    'nav-blog': 'BLOG',
    'nav-about': 'ACERCA DE',
  },
  fr: {
    'nav-home': 'ACCUEIL',
    'nav-services': 'SERVICES',
    'nav-features': 'CARACTÉRISTIQUES',
    'nav-pricing': 'TARIFICATION',
    'nav-portfolio': 'PORTEFEUILLE',
    'nav-blog': 'BLOG',
    'nav-about': 'À PROPOS',
  },
  de: {
    'nav-home': 'STARTSEITE',
    'nav-services': 'DIENSTLEISTUNGEN',
    'nav-features': 'FUNKTIONEN',
    'nav-pricing': 'PREISGESTALTUNG',
    'nav-portfolio': 'PORTFOLIO',
    'nav-blog': 'BLOG',
    'nav-about': 'ÜBER UNS',
  }
};

if (languageSelect) {
  // Load saved language preference
  const savedLang = localStorage.getItem('selectedLanguage') || 'en';
  languageSelect.value = savedLang;

  const applyGoogleTranslate = (lang) => {
    try{ document.cookie = `googtrans=/en/${lang}; path=/`; }catch(e){}
    try{
      const hostname = location.hostname;
      if(hostname && hostname.indexOf('.') !== -1){
        document.cookie = `googtrans=/en/${lang}; path=/; domain=.${hostname}`;
      }
    }catch(e){}

    const triggerCombo = () => {
      const combo = document.querySelector('.goog-te-combo');
      if (combo) {
        combo.value = lang;
        combo.dispatchEvent(new Event('change'));
        return true;
      }
      const iframe = document.querySelector('iframe.goog-te-banner-frame, iframe.goog-te-menu-frame');
      if (iframe) {
        try{
          const innerDoc = iframe.contentDocument || iframe.contentWindow.document;
          const combo2 = innerDoc.querySelector('.goog-te-combo');
          if (combo2) { combo2.value = lang; combo2.dispatchEvent(new Event('change')); return true; }
        }catch(e){}
      }
      return false;
    };

    if (window.google && window.google.translate) {
      try{ new google.translate.TranslateElement({pageLanguage: 'en', autoDisplay: false}, 'google_translate_element'); }catch(e){}
      setTimeout(triggerCombo, 700);
    } else {
      const s = document.createElement('script');
      s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      s.onload = () => setTimeout(triggerCombo, 700);
      document.head.appendChild(s);
    }
  };

  languageSelect.addEventListener('change', (e) => {
    const lang = e.target.value;
    localStorage.setItem('selectedLanguage', lang);
    applyGoogleTranslate(lang);
  });

  // Try to apply previously selected language on load (without forcing a full reload)
  if (savedLang && savedLang !== 'en') {
    setTimeout(() => applyGoogleTranslate(savedLang), 500);
  }
}

// Google translate init callback
function googleTranslateElementInit(){
  try{ new google.translate.TranslateElement({pageLanguage: 'en', autoDisplay: false}, 'google_translate_element'); }catch(e){ /* ignore */ }
}

// ===== FAQ ACCORDION =====
const faqItems = document.querySelectorAll('.faq-item');

faqItems.forEach(item => {
  const question = item.querySelector('.faq-question');
  
  if (question) {
    question.addEventListener('click', () => {
      // Close other items
      faqItems.forEach(otherItem => {
        if (otherItem !== item) {
          otherItem.classList.remove('active');
        }
      });
      
      // Toggle current item
      item.classList.toggle('active');
    });
  }
});

// ===== SMOOTH SCROLL ENHANCEMENT =====
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function(e) {
    // Only prevent default for valid anchors
    const href = this.getAttribute('href');
    if (href !== '#' && href !== '#!' && document.querySelector(href)) {
      e.preventDefault();
      const target = document.querySelector(href);
      target.scrollIntoView({
        behavior: 'smooth',
        block: 'start'
      });
    }
  });
});

// ===== HEADER SCROLL EFFECT =====
const header = document.getElementById('header');
let lastScrollPosition = 0;

window.addEventListener('scroll', () => {
  const currentScrollPosition = window.pageYOffset;
  
  if (header) {
    if (currentScrollPosition > 100) {
      header.style.background = 'rgba(0, 0, 0, 0.98)';
      header.style.boxShadow = '0 2px 10px rgba(255, 0, 0, 0.2)';
    } else {
      header.style.background = 'rgba(0, 0, 0, 0.95)';
      header.style.boxShadow = 'none';
    }
  }
  
  lastScrollPosition = currentScrollPosition;
});

// ===== FORM VALIDATION =====
const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

const validateForm = (form) => {
  const inputs = form.querySelectorAll('[required]');
  let isValid = true;

  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.style.borderColor = '#FF0000';
      isValid = false;
    } else if (input.type === 'email' && !validateEmail(input.value)) {
      input.style.borderColor = '#FF0000';
      isValid = false;
    } else {
      input.style.borderColor = '#333333';
    }
  });

  return isValid;
};

// ===== ADMIN FEATURES =====
// Check if user is admin
const isAdmin = () => {
  return localStorage.getItem('adminToken') !== null;
};

// Admin page functionality
if (window.location.pathname.includes('admin')) {
  const checkAdmin = () => {
    if (!isAdmin()) {
      window.location.href = 'login.html';
    }
  };
  checkAdmin();
}

// ===== AUTH FUNCTIONS =====
const setAuthToken = (token, isAdmin = false) => {
  localStorage.setItem('authToken', token);
  if (isAdmin) {
    localStorage.setItem('adminToken', token);
  }
  // update UI immediately when token is set
  try{ updateAuthUI(); }catch(e){ /* ignore if not loaded yet */ }
};

// Update header UI based on authentication state
const updateAuthUI = () => {
  const token = getAuthToken();
  const loginBtns = Array.from(document.querySelectorAll('.btn-login, .btn-signup'));
  const mobileMenu = document.querySelector('.mobile-menu');
  const headerActions = document.querySelector('.header-actions');

  if (token) {
    loginBtns.forEach(b => { if(b) b.style.display = 'none'; });

    // ensure header logout (desktop) exists
    let headerLogout = document.querySelector('.btn-logout.header-logout');
    if (!headerLogout && headerActions) {
      headerLogout = document.createElement('button');
      headerLogout.className = 'btn btn-logout header-logout';
      headerLogout.textContent = 'LOGOUT';
      headerLogout.addEventListener('click', () => { try{ logout(); }catch(e){} });
      headerActions.appendChild(headerLogout);
    } else if (headerLogout) {
      headerLogout.style.display = 'inline-block';
    }

    // ensure mobile logout inside mobile menu (.mobile-auth)
    let mobileAuth = document.querySelector('.mobile-auth');
    let mobileLogout = document.querySelector('.btn-logout.mobile-logout');
    if (!mobileLogout && mobileAuth) {
      mobileLogout = document.createElement('button');
      mobileLogout.className = 'btn btn-logout mobile-logout';
      mobileLogout.textContent = 'LOGOUT';
      mobileLogout.style.width = '100%';
      mobileLogout.addEventListener('click', () => { try{ logout(); }catch(e){} });
      mobileAuth.appendChild(mobileLogout);
    } else if (mobileLogout) {
      mobileLogout.style.display = 'block';
    }
  } else {
    loginBtns.forEach(b => { if(b) b.style.display = 'inline-block'; });
    const headerLogout = document.querySelector('.btn-logout.header-logout');
    if (headerLogout) headerLogout.style.display = 'none';
    const mobileLogout = document.querySelector('.btn-logout.mobile-logout');
    if (mobileLogout) mobileLogout.style.display = 'none';
  }
};

const getAuthToken = () => {
  return localStorage.getItem('authToken') || localStorage.getItem('adminToken') || localStorage.getItem('token');
};

const logout = () => {
  localStorage.removeItem('authToken');
  localStorage.removeItem('adminToken');
  localStorage.removeItem('userData');
  window.location.href = 'index.html';
  showNotification('Logged out successfully');
};

// ===== INITIALIZATION =====
// If OAuth redirected back with token param, store it
try{
  const qs = new URLSearchParams(window.location.search);
  const t = qs.get('token');
  if(t){
    setAuthToken(t);
    qs.delete('token');
    const newUrl = window.location.pathname + (qs.toString() ? '?' + qs.toString() : '');
    history.replaceState({}, '', newUrl);
  }
}catch(e){}

document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  const token = getAuthToken();
  if (token) {
    // User is logged in - update header UI
    updateAuthUI();
  }

  // Add notification styles if not present
  if (!document.querySelector('style[data-notifications]')) {
    const style = document.createElement('style');
    style.setAttribute('data-notifications', 'true');
    style.textContent = `
      .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        background-color: #4361EE;
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        animation: slideInRight 0.3s ease;
        z-index: 3000;
      }
      
      .notification-success {
        background-color: #4361EE;
      }
      
      .notification-error {
        background-color: #FF0000;
      }
      
      .notification-warning {
        background-color: #FFB800;
      }
      
      @keyframes slideInRight {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
  }
});

  // ensure header UI updates on initial load even if token was set earlier
  document.addEventListener('DOMContentLoaded', () => updateAuthUI());

// Intercept 'Order' links that point to signup and route logged-in users to checkout instead
document.addEventListener('DOMContentLoaded', ()=>{
  try{
    document.querySelectorAll('a[href^="signup.html"]').forEach(a=>{
      a.addEventListener('click', (e)=>{
        const href = a.getAttribute('href') || '';
        const parts = href.split('?');
        const qs = parts[1] || '';
        const params = new URLSearchParams(qs);
        const service = params.get('service');
        if(pageUtils.getAuthToken()){
          e.preventDefault();
          const target = 'checkout.html' + (service ? ('?service='+encodeURIComponent(service)) : '');
          window.location.href = target;
        }
      });
    });
  }catch(e){ /* ignore */ }
});

// ===== SECTION FADE-IN ON SCROLL =====
// Observe sections and add 'visible' class when they enter the viewport
document.addEventListener('DOMContentLoaded', () => {
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('section').forEach(section => {
      observer.observe(section);
    });
  }
});

// ===== TAWK.TO HELPER FUNCTIONS =====
const sendToTawk = (message, visitorEmail = '', visitorName = '') => {
  return new Promise((resolve) => {
    if (typeof Tawk_API === 'undefined') {
      console.warn('[Tawk] Tawk.to not loaded yet');
      resolve(false);
      return;
    }

    try {
      // Set visitor info first (email and name)
      if (visitorEmail || visitorName) {
        window.Tawk_API = window.Tawk_API || {};
        if (visitorEmail) {
          try {
            Tawk_API.setVisitorEmail(visitorEmail);
            console.log('[Tawk] Visitor email set:', visitorEmail);
          } catch (e) {
            console.warn('[Tawk] setVisitorEmail not available, using custom property');
          }
        }
        if (visitorName) {
          try {
            Tawk_API.setVisitorName(visitorName);
            console.log('[Tawk] Visitor name set:', visitorName);
          } catch (e) {
            console.warn('[Tawk] setVisitorName not available');
          }
        }
      }

      // Store message context for Tawk to use
      window.tawkMessageContext = message;
      console.log('[Tawk] Message context stored:', message);
      resolve(true);
    } catch (e) {
      console.error('[Tawk] Error in sendToTawk:', e && e.message);
      resolve(false);
    }
  });
};

// ===== EXPORT FUNCTIONS FOR GLOBAL USE =====
window.pageUtils = {
  showNotification,
  validateEmail,
  validateForm,
  logout,
  isAdmin,
  getAuthToken,
  setAuthToken,
  sendToTawk
};