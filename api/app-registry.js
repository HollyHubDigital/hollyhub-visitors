/**
 * App Registry - Defines all available third-party integrations
 * Each app can have its own installation, configuration, and injection requirements
 */

const appRegistry = {
  googleAnalytics: {
    id: 'googleAnalytics',
    name: 'Google Analytics',
    category: 'analytics',
    description: 'Track visitor traffic and user behavior with Google Analytics',
    icon: '📊',
    required: false,
    configFields: [
      { name: 'gaId', label: 'Google Analytics ID', type: 'text', placeholder: 'G-XXXXXXXXXX', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.gaId) return '';
      return `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${config.gaId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${config.gaId}');
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://analytics.google.com/analytics/web/'
  },

  klaviyo: {
    id: 'klaviyo',
    name: 'Klaviyo Email Marketing',
    category: 'marketing',
    description: 'Email marketing and customer automation with Klaviyo',
    icon: '📧',
    required: false,
    configFields: [
      { name: 'publicKey', label: 'Public API Key', type: 'text', placeholder: 'pk_xxx...', required: true },
      { name: 'accountId', label: 'Account ID', type: 'text', placeholder: 'Your Klaviyo account ID', required: false }
    ],
    scriptInjection: (config) => {
      if (!config.publicKey) return '';
      // Prefer using company_id pattern for onsite Klaviyo script when provided
      const company = config.publicKey;
      const accountParam = config.accountId ? `&account_id=${config.accountId}` : '';
      return `<!-- Klaviyo Onsite Tracking -->
<script async type="text/javascript" src="https://static.klaviyo.com/onsite/js/${company}/klaviyo.js?company_id=${company}${accountParam}"></script>
<script type="text/javascript">
  // Initialize Klaviyo proxy to queue calls until library loads
  !function(){if(!window.klaviyo){window._klOnsite=window._klOnsite||[];try{window.klaviyo=new Proxy({},{get:function(n,i){return"push"===i?function(){var n;(n=window._klOnsite).push.apply(n,arguments)}:function(){for(var n=arguments.length,o=new Array(n),w=0;w<n;w++)o[w]=arguments[w];var t="function"==typeof o[o.length-1]?o.pop():void 0,e=new Promise((function(n){window._klOnsite.push([i].concat(o,[function(i){t&&t(i),n(i)}]))}));return e}}})}catch(e){window.klaviyo=window.klaviyo||[],window.klaviyo.push=function(){var n;(n=window._klOnsite).push.apply(n,arguments)}}}}();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://www.klaviyo.com/'
  },

  paystack: {
    id: 'paystack',
    name: 'Paystack Payment Gateway',
    category: 'payments',
    description: 'Accept payments with Paystack',
    icon: '💳',
    required: false,
    configFields: [
      { name: 'publicKey', label: 'Paystack Public Key', type: 'text', placeholder: 'pk_live_...', required: true },
      { name: 'secretKey', label: 'Paystack Secret Key', type: 'password', placeholder: 'sk_live_...', required: true, adminOnly: true }
    ],
    scriptInjection: (config) => {
      if (!config.publicKey) return '';
      return `<!-- Paystack Payment Processing -->
<script src="https://js.paystack.co/v1/inline.js"></script>
<script>
  (function(){
    window.paystackPublicKey = '${config.publicKey}';
    window.PaystackPop = window.PaystackPop || {};
    if (typeof window.PaystackPop.setup === 'function') {
      try{ window.paystack = window.PaystackPop; }catch(e){}
    } else {
      // attempt to initialize after load if Paystack becomes available
      window.addEventListener('load', function() {
        if (typeof window.PaystackPop.setup === 'function') {
          try{ window.paystack = window.PaystackPop; }catch(e){}
        }
      });
    }
  })();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://dashboard.paystack.com/'
  },

  cloudflare: {
    id: 'cloudflare',
    name: 'Cloudflare reCAPTCHA',
    category: 'security',
    description: 'Bot protection and CAPTCHA with Cloudflare',
    icon: '🔐',
    required: false,
    configFields: [
      { name: 'siteKey', label: 'Site Key', type: 'text', placeholder: '0x...', required: true },
      { name: 'secretKey', label: 'Secret Key', type: 'password', placeholder: 'Your secret key', required: true, adminOnly: true }
    ],
    scriptInjection: (config) => {
      if (!config.siteKey) return '';
      return `<!-- Cloudflare reCAPTCHA -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<script>
  window.cloudflareEnable = true;
  window.cloudflare = { siteKey: '${config.siteKey}' };
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://dash.cloudflare.com/'
  },

  cookieConsent: {
    id: 'cookieConsent',
    name: 'Cookie Consent Manager',
    category: 'compliance',
    description: 'GDPR compliant cookie consent banner',
    icon: '🍪',
    required: false,
    configFields: [
      { name: 'position', label: 'Banner Position', type: 'select', options: ['bottom', 'top'], default: 'bottom', required: false },
      { name: 'color', label: 'Banner Color', type: 'text', placeholder: '#1e293b', default: '#1e293b', required: false },
      { name: 'privacyUrl', label: 'Privacy Policy URL', type: 'text', placeholder: '/privacy-policy.html', required: false }
    ],
    scriptInjection: (config) => {
      return `<!-- Cookie Consent Manager -->
<script src="https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.umd.js"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orestbida/cookieconsent@3.0.1/dist/cookieconsent.css">
<script>
  window.CookieConsent.run({
    onFirstConsent: () => {
      console.log('Cookie consent given');
    },
    onConsent: () => {
      console.log('Preferences saved');
    },
    categories: {
      necessary: {
        enabled: true,
        readOnly: true
      },
      analytics: {
        enabled: false,
        readOnly: false
      },
      marketing: {
        enabled: false,
        readOnly: false
      }
    },
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            title: 'We use cookies',
            description: 'This website uses cookies to enhance user experience and analyze site traffic.',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            showPreferencesBtn: 'Manage preferences'
          },
          preferencesModal: {
            title: 'Manage cookie preferences',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save preferences'
          }
        }
      }
    }
  });
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://github.com/orestbida/cookieconsent'
  },

  drift: {
    id: 'drift',
    name: 'Drift Live Chat',
    category: 'messaging',
    description: 'Live chat and conversational marketing with Drift',
    icon: '💬',
    required: false,
    configFields: [
      { name: 'appId', label: 'Drift App ID', type: 'text', placeholder: 'Your Drift App ID', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.appId) return '';
      return `<!-- Drift Live Chat -->
<script>
  "use strict";
  !function() {
    var t = window.driftt = window.drift = window.drift || [];
    if (!t.init) {
      if (t.invoked) return void (window.console && console.error && console.error("Drift snippet included twice."));
      t.invoked = !0, t.methods = [ "identify", "config", "track", "reset", "debug", "show", "ping", "page", "hide", "off", "on" ], t.factory = function(e) {
        return function() {
          var n = Array.prototype.slice.call(arguments);
          return n.unshift(e), t.push(n), t;
        };
      }, t.methods.forEach(function(e) {
        t[e] = t.factory(e);
      }), t.load = function(e) {
        var n = !1, o = document.createElement("script");
        o.async = !0, o.src = "https://js.driftt.com/include/" + e + "/platform.js", o.onload = function() {
          if (!n) return n = !0, t.identify(), t.config(), t.show();
        }, o.onerror = function() {
          n || (n = !0);
        }, document.body.appendChild(o);
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function() {
        t.load("${config.appId}");
      });
      else t.load("${config.appId}");
    }
  }();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://app.drift.com/'
  },

  mixpanel: {
    id: 'mixpanel',
    name: 'Mixpanel Analytics',
    category: 'analytics',
    description: 'Advanced product analytics and user behavior tracking',
    icon: '📈',
    required: false,
    configFields: [
      { name: 'token', label: 'Mixpanel Token', type: 'text', placeholder: 'Your Mixpanel token', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.token) return '';
      return `<!-- Mixpanel Analytics -->
<script src="https://cdn.mxpnl.com/libs/mixpanel-latest.min.js"></script>
<script>
  (function(){
    function safeInit(){
      try{
        if (window.mixpanel && typeof window.mixpanel.init === 'function'){
          window.mixpanel.init('${config.token}', { track_pageview: true, persistence: 'localStorage' });
          try{ window.mixpanel.track('Page View'); }catch(e){}
        }
      }catch(e){ /* ignore */ }
    }
    if (window.mixpanel) safeInit();
    else window.addEventListener('load', safeInit);
  })();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://mixpanel.com/'
  },

  freshchat: {
    id: 'freshchat',
    name: 'Freshchat Messaging',
    category: 'messaging',
    description: 'Customer messaging and support with Freshchat',
    icon: '💭',
    required: false,
    configFields: [
      { name: 'token', label: 'Freshchat Token', type: 'text', placeholder: 'Your Freshchat token', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.token) return '';
      return `<!-- Freshchat Messaging -->
<script src="https://assets.freshchat.com/js/widget.js"></script>
<script>
  (function(){
    function safeInit(){
      try{
        if (window.fcWidget && typeof window.fcWidget.init === 'function'){
          window.fcWidget.init({ token: '${config.token}', host: 'https://wchat.freshchat.com' });
        }
      }catch(e){ /* ignore */ }
    }
    if (window.fcWidget) safeInit();
    else window.addEventListener('load', safeInit);
  })();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://app.freshchat.com/'
  },

  hotjar: {
    id: 'hotjar',
    name: 'Hotjar Analytics',
    category: 'analytics',
    description: 'User behavior analytics, heatmaps, and session recordings',
    icon: '🔥',
    required: false,
    configFields: [
      { name: 'siteId', label: 'Hotjar Site ID', type: 'text', placeholder: 'Your site ID', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.siteId) return '';
      return `<!-- Hotjar Analytics -->
<script async src="https://script.hotjar.com/modules.js?hjid=${config.siteId}&hjsv=6"></script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://insights.hotjar.com/'
  },

  segment: {
    id: 'segment',
    name: 'Segment Analytics',
    category: 'analytics',
    description: 'Customer data platform for unified analytics',
    icon: '🔗',
    required: false,
    configFields: [
      { name: 'writeKey', label: 'Segment Write Key', type: 'text', placeholder: 'Your write key', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.writeKey) return '';
      return `<!-- Segment Analytics -->
<script>
  !function(){var analytics=window.analytics=window.analytics||[];if(!analytics.initialize)if(analytics.invoked)window.console&&console.error&&console.error("Segment snippet included twice.");else{analytics.invoked=!0;analytics.methods=["trackSubmit","trackClick","trackLink","trackForm","pageview","identify","reset","group","track","ready","alias","debug","page","once","off","on","addSourceMiddleware","addIntegrationMiddleware","setAnonymousId","addDestinationMiddleware"];analytics.factory=function(e){return function(){var t=Array.prototype.slice.call(arguments);t.unshift(e);analytics.push(t);return analytics}};for(var e=0;e<analytics.methods.length;e++){var t=analytics.methods[e];analytics[t]=analytics.factory(t)}analytics.load=function(e,t){var n=document.createElement("script");n.type="text/javascript";n.async=!0;n.src="https://cdn.segment.com/analytics.js/v1/"+e+"/analytics.min.js";var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(n,a);analytics._loadOptions=t};analytics._writeKey="${config.writeKey}";analytics.SNIPPET_VERSION="4.15.3";analytics.load("${config.writeKey}");analytics.page()}}();
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://segment.com/'
  },

  typeform: {
    id: 'typeform',
    name: 'Typeform Surveys',
    category: 'engagement',
    description: 'Embed surveys and forms with Typeform',
    icon: '📋',
    required: false,
    configFields: [
      { name: 'scriptUrl', label: 'Typeform Script URL', type: 'text', placeholder: 'https://embed.typeform.com/...' , required: true }
    ],
    scriptInjection: (config) => {
      if (!config.scriptUrl) return '';
      return `<!-- Typeform Surveys -->
<script src="https://embed.typeform.com/embed.js"></script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://admin.typeform.com/'
  },

  intercom: {
    id: 'intercom',
    name: 'Intercom Support',
    category: 'messaging',
    description: 'Customer support and messaging platform',
    icon: '🆘',
    required: false,
    configFields: [
      { name: 'appId', label: 'Intercom App ID', type: 'text', placeholder: 'Your Intercom app ID', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.appId) return '';
      return `<!-- Intercom Support -->
<script>
  window.intercomSettings = {
    api_base: "https://api-iam.intercom.io",
    app_id: "${config.appId}"
  };
</script>
<script async>
(function(){var w=window;var ic=w.Intercom;if(typeof ic==="function"){ic('reattach_activator');ic('update',w.intercomSettings);}else{var d=document;var i=function(){i.c(arguments);};i.q=[];i.c=function(args){i.q.push(args);};w.Intercom=i;function l(){var s=d.createElement('script');s.type='text/javascript';s.async=true;s.src='https://widget.intercom.io/widget/${config.appId}';var x=d.getElementsByTagName('script')[0];x.parentNode.insertBefore(s,x);}if(document.readyState==='loading'){d.addEventListener('DOMContentLoaded',l);}else{l();}}}}());
</script>`;
    },
    version: '1.0.0'
    ,
    helpUrl: 'https://app.intercom.com/'
  },

  tawkto: {
    id: 'tawkto',
    name: 'tawk.to Live Chat',
    category: 'messaging',
    description: 'Embed tawk.to live chat widget',
    icon: '💬',
    required: false,
    configFields: [
      { name: 'propertyId', label: 'tawk.to Property ID', type: 'text', placeholder: 'e.g. 5f12345678901234567890abc', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.propertyId) return '';
      return `<!-- tawk.to Live Chat -->
    <script type="text/javascript">
    var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
    (function(){
    var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
    s1.async=true;
    var _tawkSrc = '${config.propertyId}';
    // Allow either "propertyId" or a combined "propertyId/widgetId" value
    if (_tawkSrc.indexOf('/') === -1) {
      _tawkSrc = _tawkSrc + '/default';
    }
    s1.src = 'https://embed.tawk.to/' + _tawkSrc;
    s1.charset='UTF-8';
    s0.parentNode.insertBefore(s1,s0);
    })();
    </script>`;
    },
    version: '1.0.0',
    helpUrl: 'https://www.tawk.to'
  },

  privy: {
    id: 'privy',
    name: 'Privy Popups & Emails',
    category: 'marketing',
    description: 'Privy popups, banners, and email capture',
    icon: '📣',
    required: false,
    configFields: [
      { name: 'siteId', label: 'Privy Site ID', type: 'text', placeholder: 'Privy site id or script key', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.siteId) return '';
      return `<!-- Privy Popup -->
<script async src="https://widget.privy.com/assets/privy.js"></script>
<script>
  window.Privy = window.Privy || {};
  window.Privy.site_id = '${config.siteId}';
</script>`;
    },
    version: '1.0.0',
    helpUrl: 'https://www.privy.com'
  },

  sumo: {
    id: 'sumo',
    name: 'Sumo Popups',
    category: 'marketing',
    description: 'Sumo (list building & popups) integration',
    icon: '🎯',
    required: false,
    configFields: [
      { name: 'scriptUrl', label: 'Sumo Script URL', type: 'text', placeholder: 'e.g. https://load.sumome.com/YOUR_KEY.js', required: true }
    ],
    scriptInjection: (config) => {
      if (!config.scriptUrl) return '';
      return `<!-- Sumo Popups -->
<script async src="${config.scriptUrl}"></script>`;
    },
    version: '1.0.0',
    helpUrl: 'https://sumo.com'
  },

  yotpo: {
    id: 'yotpo',
    name: 'Yotpo Email & SMS',
    category: 'marketing',
    description: 'Email and SMS marketing automation with Yotpo',
    icon: '💬',
    required: false,
    configFields: [
      { name: 'apiKey', label: 'Yotpo API Key', type: 'text', placeholder: 'Your Yotpo API key', required: true },
      { name: 'accountId', label: 'Account ID', type: 'text', placeholder: 'Your Yotpo Account ID', required: false }
    ],
    scriptInjection: (config) => {
      if (!config.apiKey) return '';
      return `<!-- Yotpo Email & SMS -->
<script>
  (function() {
    window.Yotpo = window.Yotpo || {};
    window.Yotpo.config = {
      api_key: '${config.apiKey}'
      ${config.accountId ? `,\n      account_id: '${config.accountId}'` : ''}
    };
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.async = true;
    s.src = 'https://cdn.yotpo.com/loader.js';
    var x = document.getElementsByTagName('script')[0];
    x.parentNode.insertBefore(s, x);
  })();
</script>`;
    },
    version: '1.0.0',
    helpUrl: 'https://www.yotpo.com/'
  }
};

/**
 * Get all available apps
 */
function getAllApps() {
  return appRegistry;
}

/**
 * Get app by ID
 */
function getApp(appId) {
  return appRegistry[appId] || null;
}

/**
 * Get apps by category
 */
function getAppsByCategory(category) {
  return Object.values(appRegistry).filter(app => app.category === category);
}

/**
 * Generate all active scripts for injection
 */
function generateActiveScripts(enabledApps) {
  const scripts = [];
  if (!enabledApps) return '';

  // enabledApps may be either an array of app ids or an object mapping ids->config
  if (Array.isArray(enabledApps)) {
    for (const appId of enabledApps) {
      const app = getApp(appId);
      if (app && app.scriptInjection) {
        const appConfig = {};
        scripts.push(`<!-- ${app.name} v${app.version} -->`);
        try { scripts.push(app.scriptInjection(appConfig)); } catch(e) { /* ignore */ }
      }
    }
  } else {
    for (const [appId, cfg] of Object.entries(enabledApps || {})) {
      const app = getApp(appId);
      if (app && app.scriptInjection) {
        const appConfig = cfg || {};
        scripts.push(`<!-- ${app.name} v${app.version} -->`);
        try { scripts.push(app.scriptInjection(appConfig)); } catch(e) { /* ignore */ }
      }
    }
  }

  return scripts.join('\n\n');
}

module.exports = {
  appRegistry,
  getAllApps,
  getApp,
  getAppsByCategory,
  generateActiveScripts
};
