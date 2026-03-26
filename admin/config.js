/**
 * Admin Configuration
 * Sets up API base URL for admin dashboard
 */

// Get API base URL from window location or use default
window.ADMIN_CONFIG = {
  // API base for all admin calls (proxied locally, actual target is visitors domain)
  apiBase: '/api',
  
  // Visitors domain (for direct navigation if needed)
  visitorsDomain: process.env.VISITORS_API_URL || 'https://hollyhubdigital.vercel.app',
  
  // Storage keys for authentication
  tokenKey: 'adminToken',
  userKey: 'adminUser',
  
  // Debug mode
  debug: window.location.hostname === 'localhost',
  
  /**
   * Helper function to make API calls with auth header
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Fetch options
   * @returns {Promise}
   */
  async fetch(endpoint, options = {}) {
    const url = `${window.ADMIN_CONFIG.apiBase}${endpoint}`;
    const token = localStorage.getItem(window.ADMIN_CONFIG.tokenKey);
    
    const fetchOptions = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };
    
    // Add auth token if present
    if (token) {
      fetchOptions.headers.Authorization = `Bearer ${token}`;
    }
    
    if (window.ADMIN_CONFIG.debug) {
      console.log(`[API] ${fetchOptions.method || 'GET'} ${url}`, fetchOptions);
    }
    
    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`[API Error] ${response.status}`, data);
      throw new Error(data.error || data.message || `HTTP ${response.status}`);
    }
    
    return data;
  }
};

console.log(`[Admin Config] API Base: ${window.ADMIN_CONFIG.apiBase}`);
console.log(`[Admin Config] Visitors Domain: ${window.ADMIN_CONFIG.visitorsDomain}`);
