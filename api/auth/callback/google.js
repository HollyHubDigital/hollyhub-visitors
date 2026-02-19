module.exports = async (req, res) => {
  // Proxy to existing google handler so callback URL can be /api/auth/callback/google
  const handler = require('../google.js');
  return handler(req, res);
};
