/**
 * Public Configuration API
 * Returns ONLY public/safe keys to frontend
 * Secret keys (PAYSTACK_SECRET, JWT_SECRET, etc.) are NEVER returned
 */

module.exports = async (req, res) => {
  try {
    // Only allow GET requests
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Build public config from environment variables and apps-config
    const publicConfig = {
      // Frontend tracking & analytics (PUBLIC)
      googleAnalyticsId: process.env.GOOGLE_ANALYTICS_ID || '',
      mixpanelToken: process.env.MIXPANEL_TOKEN || '',

      // Frontend payment (PUBLIC - only public key, not secret)
      paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY || '',

      // Frontend email marketing (PUBLIC)
      klaviyoPublicKey: process.env.KLAVIYO_PUBLIC_KEY || '',

      // Frontend customer support (PUBLIC)
      tawktoPropertyId: process.env.TAWKTO_PROPERTY_ID || '',

      // Frontend popups (PUBLIC)
      privySiteId: process.env.PRIVY_SITE_ID || '',

      // Frontend email/SMS (PUBLIC)
      yotpoApiKey: process.env.YOTPO_API_KEY || '',
      yotpoAccountId: process.env.YOTPO_ACCOUNT_ID || '',

      // Frontend reCAPTCHA (PUBLIC - only site key, not secret)
      cloudflareSiteKey: process.env.CLOUDFLARE_SITE_KEY || ''
    };

    // Try to load from apps-config.json as fallback (for backward compatibility)
    try {
      const fs = require('fs');
      const path = require('path');
      const cfgPath = path.join(process.cwd(), 'data', 'apps-config.json');
      if (fs.existsSync(cfgPath)) {
        const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8') || '{}');
        const enabled = cfg.enabled || {};

        // Merge with env vars (env vars take precedence)
        if (enabled.googleAnalytics && !publicConfig.googleAnalyticsId) {
          publicConfig.googleAnalyticsId = enabled.googleAnalytics.gaId;
        }
        if (enabled.mixpanel && !publicConfig.mixpanelToken) {
          publicConfig.mixpanelToken = enabled.mixpanel.token;
        }
        if (enabled.paystack && !publicConfig.paystackPublicKey) {
          publicConfig.paystackPublicKey = enabled.paystack.publicKey;
        }
        if (enabled.klaviyo && !publicConfig.klaviyoPublicKey) {
          publicConfig.klaviyoPublicKey = enabled.klaviyo.publicKey;
        }
        if (enabled.tawkto && !publicConfig.tawktoPropertyId) {
          publicConfig.tawktoPropertyId = enabled.tawkto.propertyId;
        }
        if (enabled.privy && !publicConfig.privySiteId) {
          publicConfig.privySiteId = enabled.privy.siteId;
        }
        if (enabled.yotpo && !publicConfig.yotpoApiKey) {
          publicConfig.yotpoApiKey = enabled.yotpo.apiKey;
          publicConfig.yotpoAccountId = enabled.yotpo.accountId;
        }
        if (enabled.cloudflare && !publicConfig.cloudflareSiteKey) {
          publicConfig.cloudflareSiteKey = enabled.cloudflare.siteKey;
        }
      }
    } catch (e) {
      console.warn('[public-config] Failed to load from apps-config.json:', e.message);
      // Continue with env vars only
    }

    // Add cache headers for browsers (cache for 5 minutes)
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');

    return res.json(publicConfig);
  } catch (e) {
    console.error('[public-config] Error:', e);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
