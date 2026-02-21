/**
 * App Loader - Loads and initializes all active apps on visitor pages
 * This script is automatically injected into visitor pages via the header/footer
 */

(function() {
  'use strict';

  const AppLoader = {
    debug: true,
    log(...args) {
      if (this.debug) console.log('[AppLoader]', ...args);
    },

    // Load app configuration from server
    async loadAppsConfig() {
      try {
        const response = await fetch('/api/apps?config=true');
        if (!response.ok) {
          this.log('Failed to load apps config');
          return { enabled: {}, disabled: [] };
        }
        return await response.json();
      } catch (e) {
        this.log('Error loading apps config:', e);
        return { enabled: {}, disabled: [] };
      }
    },

    // Load and inject preview scripts from server (provides fallback for apps without specific handlers)
    async injectPreviewScripts() {
      // Skip on localhost for development - all apps already have client-side handlers
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname === '0.0.0.0';
      if (isLocalhost) {
        this.log('Preview scripts skipped on localhost (dev mode)');
        return;
      }

      try {
        const response = await fetch('/api/apps?preview=true');
        if (!response.ok) {
          this.log('Failed to fetch preview scripts, skipping');
          return;
        }
        const data = await response.json();
        if (data.scripts && data.scripts.trim()) {
          try {
            const scriptEl = document.createElement('script');
            scriptEl.type = 'text/javascript';
            scriptEl.innerHTML = data.scripts;
            document.head.appendChild(scriptEl);
            this.log('Preview scripts injected');
          } catch (appendError) {
            this.log('Error injecting preview scripts into DOM:', appendError);
          }
        }
      } catch (e) {
        this.log('Error loading preview scripts:', e);
      }
    },

    // Initialize all active apps
    async init() {
      this.log('Initializing apps...');
      
      try {
        const config = await this.loadAppsConfig();
        const enabledApps = config.enabled || {};

        this.log('Enabled apps:', Object.keys(enabledApps));

        // Initialize each app using client-side handlers
        for (const [appId, appConfig] of Object.entries(enabledApps)) {
          this.initializeApp(appId, appConfig);
        }

        // Also inject preview scripts from server as fallback for apps without specific handlers
        // This ensures any app with a scriptInjection function will work automatically
        await this.injectPreviewScripts();

        // Trigger custom event for other scripts
        window.dispatchEvent(new CustomEvent('appsLoaded', { detail: { apps: Object.keys(enabledApps) } }));
        // Load public site settings (like WhatsApp number) and apply to visitor page elements
        try{
          await this.loadPublicSettings();
        }catch(e){ this.log('loadPublicSettings error', e); }
      } catch (e) {
        this.log('Error in init:', e);
      }
    },

    // Fetch public settings and apply dynamic elements on pages
    async loadPublicSettings(){
      try{
        const r = await fetch('/api/public-settings');
        if(!r.ok) { this.log('No public settings found'); return; }
        const s = await r.json();
        const num = (s.whatsappNumber || '').replace(/\s+/g,'');
        if(!num) return;

        // Update tel links that should point to the WhatsApp number
        document.querySelectorAll('.js-whatsapp-tel').forEach(el=>{
          try{
            el.href = 'tel:' + num;
            // Only replace text for non-button elements (keep button text like "Call Support")
            const isButton = el.classList.contains('btn') || el.tagName === 'BUTTON';
            const def = el.dataset && el.dataset.default;
            if(def && !isButton) {
              el.textContent = def.replace(/(\+?\d{3})(\d{3})(\d{3})(\d{3})?/, (m,a,b,c,d)=>{ return a + ' ' + (b||'') + ' ' + (c||'') + (d? ' ' + d: ''); });
            }
          }catch(e){ /* ignore */ }
        });

        // Update WhatsApp links (wa.me) using data-msg
        document.querySelectorAll('.js-whatsapp-wa').forEach(el=>{
          try{
            const msg = encodeURIComponent(el.dataset && el.dataset.msg ? el.dataset.msg : 'Hello');
            el.href = `https://wa.me/${num.replace(/^\+/, '')}?text=${msg}`;
            el.setAttribute('target','_blank');
          }catch(e){}
        });
      }catch(e){ this.log('Error loading public settings', e); }
    },

    // Initialize individual app
    initializeApp(appId, config) {
      this.log(`Initializing ${appId}...`, config);

      switch (appId) {
        case 'googleAnalytics':
          this.initGoogleAnalytics(config);
          break;
        case 'klaviyo':
          this.initKlaviyo(config);
          break;
        case 'paystack':
          this.initPaystack(config);
          break;
        case 'cloudflare':
          this.initCloudflare(config);
          break;
        case 'cookieConsent':
          this.initCookieConsent(config);
          break;
        case 'drift':
          this.initDrift(config);
          break;
        case 'mixpanel':
          this.initMixpanel(config);
          break;
        case 'freshchat':
          this.initFreshchat(config);
          break;
        case 'hotjar':
          this.initHotjar(config);
          break;
        case 'segment':
          this.initSegment(config);
          break;
        case 'typeform':
          this.initTypeform(config);
          break;
        case 'intercom':
          this.initIntercom(config);
          break;
        case 'privy':
          this.initPrivy(config);
          break;
        case 'yotpo':
          this.initYotpo(config);
          break;
        case 'tawkto':
          this.initTawkto(config);
          break;
        case 'sumo':
          this.initSumo(config);
          break;
        default:
          this.log(`Unknown app: ${appId}`);
      }
    },

    // App initialization methods
    initGoogleAnalytics(config) {
      if (!config.gaId) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${config.gaId}`;
      document.head.appendChild(script);

      window.dataLayer = window.dataLayer || [];
      function gtag() { window.dataLayer.push(arguments); }
      window.gtag = gtag;
      gtag('js', new Date());
      gtag('config', config.gaId);
      this.log('Google Analytics loaded');
    },

    initKlaviyo(config) {
      if (!config.publicKey) return;
      const company = config.publicKey.trim();
      const accountParam = config.accountId ? `&account_id=${config.accountId.trim()}` : '';
      
      // Inject the exact Klaviyo tracking script as two separate script tags
      // Script 1: Async library loader with company ID in URL
      const scriptAsync = document.createElement('script');
      scriptAsync.async = true;
      scriptAsync.type = 'text/javascript';
      scriptAsync.src = `https://static.klaviyo.com/onsite/js/${company}/klaviyo.js?company_id=${company}${accountParam}`;
      document.head.appendChild(scriptAsync);
      
      // Script 2: Initialize Klaviyo proxy (must be synchronous)
      const scriptInit = document.createElement('script');
      scriptInit.type = 'text/javascript';
      // Exact Klaviyo initialization code - handles both presence and absence of Klaviyo library
      scriptInit.innerHTML = `
        !function(){
          if(!window.klaviyo){
            window._klOnsite=window._klOnsite||[];
            try{
              window.klaviyo=new Proxy({},{
                get:function(n,i){
                  return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){
                    for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];
                    var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){
                      window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))
                    }));
                    return e
                  }
                }
              })
            }catch(n){
              window.klaviyo=window.klaviyo||[];
              window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}
            }
          }
        }();
      `;
      document.head.appendChild(scriptInit);
      
      this.log('Klaviyo loaded with company ID:', company.substring(0, 8) + '...');
    },

    initPaystack(config) {
      if (!config.publicKey) return;
      const script = document.createElement('script');
      script.src = 'https://js.paystack.co/v1/inline.js';
      script.onload = () => {
        window.paystackPublicKey = config.publicKey;
        window.paystack = window.PaystackPop || {};
      };
      document.head.appendChild(script);
      this.log('Paystack loaded');
    },

    initCloudflare(config) {
      if (!config.siteKey) {
        this.log('Cloudflare siteKey not configured, skipping Turnstile');
        return;
      }
      const siteKey = config.siteKey;
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      window.cloudflareEnable = true;
      window.cloudflare = { siteKey };

      // Helper: insert widget placeholder and a hidden input into a form
      const addWidgetToForm = (formId, widgetId) => {
        const form = document.getElementById(formId);
        if (!form) return null;

        // avoid duplicating
        if (form.querySelector('#' + widgetId)) return form.querySelector('#' + widgetId);

        // create container for turnstile widget
        const container = document.createElement('div');
        container.id = widgetId;
        container.style.marginBottom = '1rem';

        // create inner element expected by Cloudflare script
        const inner = document.createElement('div');
        inner.className = 'cf-turnstile';
        inner.setAttribute('data-sitekey', siteKey);
        container.appendChild(inner);

        // create hidden input to hold token
        let hidden = form.querySelector('input[name="cf-turnstile-response"]');
        if (!hidden) {
          hidden = document.createElement('input');
          hidden.type = 'hidden';
          hidden.name = 'cf-turnstile-response';
          form.appendChild(hidden);
        }

        // insert container before submit button if possible
        const submit = form.querySelector('[type=submit]');
        if (submit && submit.parentNode) {
          submit.parentNode.insertBefore(container, submit);
        } else {
          form.appendChild(container);
        }

        return { container, hidden, inner };
      };

      // Render widgets when turnstile is available
      const renderWidgets = () => {
        try {
          // Add to login and signup forms
          const login = addWidgetToForm('loginForm', 'turnstile-login');
          const signup = addWidgetToForm('signupForm', 'turnstile-signup');

          const renderIf = (slot) => {
            if (!slot) return;
            try {
              if (window.turnstile && typeof window.turnstile.render === 'function') {
                window.turnstile.render(slot.inner || slot.container, {
                  sitekey: siteKey,
                  callback: (token) => { slot.hidden.value = token; },
                  'expired-callback': () => { slot.hidden.value = ''; },
                  'error-callback': () => {
                    this.log('Turnstile error callback triggered, removing widget');
                    if (slot.container && slot.container.parentNode) {
                      slot.container.parentNode.removeChild(slot.container);
                    }
                  }
                });
                return;
              }
            } catch (e) {
              this.log('Turnstile render error:', e.message);
              // Remove broken widget, allow form to work without it
              if (slot.container && slot.container.parentNode) {
                try { slot.container.parentNode.removeChild(slot.container); } catch (re) {}
              }
            }
          };

          renderIf(login);
          renderIf(signup);
        } catch (e) {
          this.log('Error initializing Cloudflare widgets:', e.message);
        }
      };

      // If script loads later, render widgets after load
      script.onload = () => {
        this.log('Cloudflare Turnstile script loaded');
        // Use setTimeout to ensure Turnstile API is ready
        setTimeout(() => {
          try {
            renderWidgets();
          } catch (e) {
            this.log('Turnstile widget rendering failed:', e.message);
          }
        }, 100);
      };

      // Handle script load errors gracefully
      script.onerror = () => {
        this.log('Failed to load Cloudflare Turnstile script, continuing without CAPTCHA');
        // Remove any partially rendered widgets
        document.querySelectorAll('.cf-turnstile').forEach(el => {
          try { el.parentNode && el.parentNode.removeChild(el); } catch (e) {}
        });
      };

      // Add error handler to window for uncaught Turnstile errors
      const originalErrorHandler = window.onerror;
      window.onerror = function(msg, url, lineNo, colNo, error) {
        if (msg && msg.toString().includes('TurnstileError')) {
          console.error('Turnstile widget failed:', msg);
          // Remove broken Turnstile widgets
          document.querySelectorAll('#turnstile-login, #turnstile-signup').forEach(el => {
            try { el.parentNode && el.parentNode.removeChild(el); } catch (e) {}
          });
          // Don't let the error stop the page
          return true;
        }
        if (originalErrorHandler) return originalErrorHandler(msg, url, lineNo, colNo, error);
      };

      document.head.appendChild(script);
      this.log('Cloudflare Turnstile loader injected (optional CAPTCHA)');
    },

    initCookieConsent(config) {
      const script1 = document.createElement('script');
      script1.src = 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.umd.js';
      script1.async = true;

      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.css';

      script1.onload = () => {
        if (window.CookieConsent) {
          window.CookieConsent.run({
            onFirstConsent: () => this.log('Cookie consent given'),
            onConsent: () => this.log('Preferences saved'),
            categories: {
              necessary: { enabled: true, readOnly: true },
              analytics: { enabled: false, readOnly: false },
              marketing: { enabled: false, readOnly: false }
            },
            language: { default: 'en' }
          });
        }
      };

      document.head.appendChild(link);
      document.head.appendChild(script1);
      this.log('Cookie Consent loaded');
    },

    initDrift(config) {
      if (!config.appId) return;
      window.driftt = window.drift = window.drift || [];
      const t = window.drift;
      if (!t.init) {
        t.invoked = true;
        t.methods = ['identify', 'config', 'track', 'reset', 'debug', 'show', 'ping', 'page', 'hide', 'off', 'on'];
        t.factory = function (e) {
          return function () {
            const n = Array.prototype.slice.call(arguments);
            n.unshift(e);
            t.push(n);
            return t;
          };
        };
        t.methods.forEach(function (e) { t[e] = t.factory(e); });
        t.load = function (e) {
          const n = !1;
          const o = document.createElement('script');
          o.async = true;
          o.src = 'https://js.driftt.com/include/' + e + '/platform.js';
          o.onload = function () { if (!n) { n = true; t.identify(); t.config(); t.show(); } };
          o.onerror = function () { n = true; };
          document.body.appendChild(o);
        };
        t.load(config.appId);
      }
      this.log('Drift loaded');
    },

    initMixpanel(config) {
      if (!config.token) {
        this.log('Mixpanel: no token provided');
        return;
      }
      
      const self = this;
      const loadMixpanelScript = (attempt = 1) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.mxpnl.com/libs/mixpanel-latest.min.js';
        
        script.onload = () => {
          self.log('Mixpanel script loaded from CDN');
          // Add a small delay to ensure window.mixpanel is available
          setTimeout(() => {
            if (window.mixpanel) {
              self.log('window.mixpanel is available, initializing...');
              try {
                window.mixpanel.init(config.token, { 
                  track_pageview: true, 
                  persistence: 'localStorage', 
                  debug: true 
                });
                self.log('Mixpanel initialized with token:', config.token);
                window.mixpanel.track('Page View');
                self.log('Page View event tracked (client-side)');
              } catch (e) {
                self.log('ERROR initializing Mixpanel:', e);
              }
            } else {
              self.log('ERROR: window.mixpanel is NOT available after script load');
              // Use server-side tracking as fallback
              self.useServerSideTracking('Page View');
            }
          }, 100);
        };

        script.onerror = () => {
          self.log(`ERROR (attempt ${attempt}): Failed to load Mixpanel script from CDN - likely blocked by ad blocker`);
          self.log('FALLBACK: Using server-side tracking (ad-blocker proof)');
          // Use server-side tracking instead
          self.useServerSideTracking('Page View', { source: 'server-side-fallback' });
        };

        document.head.appendChild(script);
        self.log(`Mixpanel script appended to DOM (attempt ${attempt})`);
      };

      loadMixpanelScript();
    },

    // Server-side tracking - bypasses ad blockers entirely
    async useServerSideTracking(event, properties = {}) {
      try {
        const response = await fetch('/api/track', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            event: event,
            properties: {
              ...properties,
              timestamp: new Date().toISOString(),
              url: window.location.href,
              referrer: document.referrer
            },
            userId: window.userId || undefined
          })
        });

        if (!response.ok) {
          this.log(`Server-side tracking error: HTTP ${response.status}`);
          return;
        }

        const result = await response.json();
        if (result.ok || result.success) {
          this.log(`✓ Event '${event}' tracked via server-side API (ad-blocker proof)`);
        } else {
          this.log(`Server-side tracking error: ${result.error || 'unknown'}`);
        }
      } catch (e) {
        this.log('Server-side tracking failed:', e.message);
      }
    },

    initFreshchat(config) {
      if (!config.token) return;
      const script = document.createElement('script');
      script.src = 'https://assets.freshchat.com/js/widget.js';
      script.onload = () => {
        if (window.fcWidget) {
          window.fcWidget.init({
            token: config.token,
            host: 'https://wchat.freshchat.com'
          });
        }
      };
      document.head.appendChild(script);
      this.log('Freshchat loaded');
    },

    initHotjar(config) {
      if (!config.siteId) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://script.hotjar.com/modules.js?hjid=${config.siteId}&hjsv=6`;
      document.head.appendChild(script);
      this.log('Hotjar loaded');
    },

    initSegment(config) {
      if (!config.writeKey) return;
      window.analytics = window.analytics || [];
      const analytics = window.analytics;
      analytics.methods = ['trackSubmit', 'trackClick', 'trackLink', 'trackForm', 'pageview', 'identify', 'reset', 'group', 'track', 'ready', 'alias', 'debug', 'page', 'once', 'off', 'on'];
      analytics.factory = function (e) {
        return function () {
          const t = Array.prototype.slice.call(arguments);
          t.unshift(e);
          analytics.push(t);
          return analytics;
        };
      };
      analytics.methods.forEach(function (e) { analytics[e] = analytics.factory(e); });
      analytics.load = function (e) {
        const t = document.createElement('script');
        t.type = 'text/javascript';
        t.async = true;
        t.src = 'https://cdn.segment.com/analytics.js/v1/' + e + '/analytics.min.js';
        const n = document.getElementsByTagName('script')[0];
        n.parentNode.insertBefore(t, n);
      };
      analytics.SNIPPET_VERSION = '4.15.3';
      analytics.load(config.writeKey);
      analytics.page();
      this.log('Segment loaded');
    },

    initTypeform(config) {
      if (!config.scriptUrl) return;
      const script = document.createElement('script');
      script.src = 'https://embed.typeform.com/embed.js';
      document.head.appendChild(script);
      this.log('Typeform loaded');
    },

    initIntercom(config) {
      if (!config.appId) return;
      window.intercomSettings = {
        api_base: 'https://api-iam.intercom.io',
        app_id: config.appId
      };
      const script = document.createElement('script');
      script.async = true;
      script.innerHTML = `
        (function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;function l(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${config.appId}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);}if(document.readyState==='loading'){d.addEventListener('DOMContentLoaded',l);}else{l();}}}}());
      `;
      document.head.appendChild(script);
      this.log('Intercom loaded');
    },

    initPrivy(config) {
      if (!config.siteId) return;
      const siteId = config.siteId.trim();
      if (!siteId) return;
      window.Privy = window.Privy || {};
      window.Privy.site_id = siteId;
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://widget.privy.com/assets/privy.js';
      document.head.appendChild(script);
      this.log('Privy loaded with siteId:', siteId);
    },

    initYotpo(config) {
      if (!config.apiKey) return;
      window.Yotpo = window.Yotpo || {};
      window.Yotpo.config = {
        api_key: config.apiKey.trim()
      };
      if (config.accountId) {
        window.Yotpo.config.account_id = config.accountId.trim();
      }
      const script = document.createElement('script');
      script.async = true;
      script.src = 'https://cdn.yotpo.com/loader.js';
      document.head.appendChild(script);
      this.log('Yotpo loaded with apiKey:', config.apiKey.trim().substring(0, 8) + '...');
    },

    initTawkto(config) {
      if (!config.propertyId) return;
      let tawkSrc = config.propertyId.trim();
      // Allow either "propertyId" or a combined "propertyId/widgetId" value
      if (tawkSrc.indexOf('/') === -1) {
        tawkSrc = tawkSrc + '/default';
      }
      
      window.Tawk_API = window.Tawk_API || {};
      window.Tawk_LoadStart = new Date();
      
      const script = document.createElement('script');
      script.async = true;
      script.type = 'text/javascript';
      script.charset = 'UTF-8';
      script.src = `https://embed.tawk.to/${tawkSrc}`;
      document.head.appendChild(script);
      this.log('Tawk.to loaded with propertyId:', config.propertyId.substring(0, 12) + '...');
    },

    initSumo(config) {
      if (!config.scriptUrl) return;
      const script = document.createElement('script');
      script.async = true;
      script.src = config.scriptUrl;
      document.head.appendChild(script);
      this.log('Sumo loaded');
    }
  };

  // Global tracking function - works even with ad blockers enabled
  window.trackEvent = async (event, properties = {}) => {
    // Try Mixpanel first if available
    if (window.mixpanel && typeof window.mixpanel.track === 'function') {
      try {
        window.mixpanel.track(event, properties);
        console.log('[Analytics] Event tracked via Mixpanel:', event);
        return;
      } catch (e) {
        console.warn('[Analytics] Mixpanel tracking failed, falling back to server:', e);
      }
    }

    // Fallback to server-side tracking (bypasses ad blockers)
    try {
      const response = await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: event,
          properties: {
            ...properties,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            referrer: document.referrer
          },
          userId: window.userId || undefined
        })
      });
      const result = await response.json();
      if (result.success) {
        console.log('[Analytics] Event tracked via server-side API:', event);
      }
    } catch (e) {
      console.error('[Analytics] Tracking failed:', e);
    }
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => AppLoader.init());
  } else {
    AppLoader.init();
  }

  // Expose globally for debugging
  window.AppLoader = AppLoader;
})();
