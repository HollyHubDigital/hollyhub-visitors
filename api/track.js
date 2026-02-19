/**
 * Server-side tracking endpoint for Mixpanel
 * Bypasses client-side ad blockers by routing tracking through your own backend
 */

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const body = req.body || {};
    const { event, properties = {}, userId } = body;

    if (!event) {
      return res.status(400).json({ error: 'Missing event name' });
    }

    // Get Mixpanel token from environment or apps config
    let mixpanelToken = process.env.MIXPANEL_TOKEN;
    
    // If not in env, try to get from apps config
    if (!mixpanelToken) {
      try {
        const fs = require('fs');
        const path = require('path');
        const appsConfigPath = path.join(process.cwd(), 'data', 'apps-config.json');
        if (fs.existsSync(appsConfigPath)) {
          const config = JSON.parse(fs.readFileSync(appsConfigPath, 'utf8'));
          if (config.enabled && config.enabled.mixpanel && config.enabled.mixpanel.token) {
            mixpanelToken = config.enabled.mixpanel.token;
          }
        }
      } catch (e) {
        console.error('Error reading apps config:', e);
      }
    }

    if (!mixpanelToken) {
      return res.status(501).json({ error: 'Mixpanel not configured' });
    }

    // Prepare Mixpanel event
    const timestamp = Math.floor(Date.now() / 1000);
    const eventData = {
      event: event,
      properties: {
        token: mixpanelToken,
        time: timestamp,
        distinct_id: userId || 'anonymous',
        ...properties,
        ip: req.headers['x-forwarded-for']?.split(',')[0] || (req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown'),
        user_agent: req.headers['user-agent']
      }
    };

    // Use node-fetch with dynamic import (handles ESM v3+)
    let fetchFn;
    try {
      fetchFn = (await import('node-fetch')).default;
    } catch (e) {
      // Fallback to native fetch if available (Node.js 18+)
      if (typeof global.fetch !== 'undefined') {
        fetchFn = global.fetch;
      } else {
        throw new Error('fetch not available');
      }
    }

    // Send to Mixpanel via server-side API
    const mixpanelResponse = await fetchFn('https://api.mixpanel.com/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        data: Buffer.from(JSON.stringify(eventData)).toString('base64'),
        verbose: 1
      })
    });

    const responseText = await mixpanelResponse.text();

    if (mixpanelResponse.ok || responseText === '1') {
      return res.json({
        success: true,
        message: `Event '${event}' tracked successfully via server-side API`,
        event: event,
        userId: userId || 'anonymous'
      });
    } else {
      console.error('Mixpanel API error:', responseText);
      return res.status(500).json({
        error: 'Failed to send event to Mixpanel',
        details: responseText
      });
    }
  } catch (e) {
    console.error('Tracking error:', e);
    return res.status(500).json({
      error: 'Internal tracking error',
      message: e.message
    });
  }
};
