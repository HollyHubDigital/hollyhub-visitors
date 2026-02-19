module.exports = async (req, res) => {
  // Proxy to existing github handler so callback URL can be /api/auth/callback/github
  const handler = require('../github.js');
  return handler(req, res);
};
