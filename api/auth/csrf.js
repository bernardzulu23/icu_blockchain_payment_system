/**
 * GET /api/auth/csrf — issue double-submit CSRF cookie (Vercel lightweight).
 */
require('../_bootstrap');

const { createCsrfToken, setCsrfCookieHeader } = require('../../backend/src/middleware/csrf');

module.exports = (req, res) => {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const token = createCsrfToken();
  setCsrfCookieHeader(res, token);
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ csrfToken: token }));
};
