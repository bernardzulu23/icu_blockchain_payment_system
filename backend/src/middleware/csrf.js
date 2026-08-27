/**
 * ICU Pay — CSRF Protection (double-submit cookie)
 *
 * Needed when auth uses httpOnly JWT cookies — cookies are sent automatically
 * on every same-origin request, including cross-site triggered ones; CSRF closes
 * that gap. The CSRF cookie is readable by JS so the SPA echoes it in
 * x-csrf-token; attackers on other origins cannot read it to forge that header.
 *
 * SameSite on the JWT cookie (set in auth-hardening on login) is the first
 * line of defense:
 *
 *   res.cookie('access_token', token, {
 *     httpOnly: true,
 *     secure: process.env.NODE_ENV === 'production',
 *     sameSite: 'strict',
 *     maxAge: 15 * 60 * 1000,
 *     path: '/',
 *   });
 *
 * npm i cookie-parser (wired in server-hardening.js)
 */const crypto = require('crypto');

const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';

function createCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(req) {
  const header = req.headers?.cookie || '';
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').map((part) => {
      const idx = part.indexOf('=');
      if (idx === -1) return [part.trim(), ''];
      const key = part.slice(0, idx).trim();
      const val = part.slice(idx + 1).trim();
      try {
        return [key, decodeURIComponent(val)];
      } catch {
        return [key, val];
      }
    })
  );
}

function tokensMatch(cookieToken, headerToken) {
  if (!cookieToken || !headerToken) return false;
  const a = String(cookieToken);
  const b = String(headerToken);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function csrfCookieOptions() {
  return {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  };
}

/** Express middleware — issue token (GET /api/auth/csrf, after login, etc.) */
function issueCsrfToken(req, res, next) {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  req.csrfToken = token;
  next();
}

/** Express middleware — verify on state-changing requests */
function verifyCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const cookies = req.cookies?.[CSRF_COOKIE_NAME] != null ? req.cookies : parseCookies(req);
  const cookieToken = cookies[CSRF_COOKIE_NAME];
  const headerToken = req.headers[CSRF_HEADER_NAME];

  if (!tokensMatch(cookieToken, headerToken)) {
    return res.status(403).json({ error: 'CSRF validation failed.' });
  }

  return next();
}

/** Serverless helpers (no cookie-parser) */
function setCsrfCookieHeader(res, token) {
  const opts = csrfCookieOptions();
  const parts = [`${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}`, `Path=${opts.path}`, 'SameSite=Strict'];
  if (opts.secure) parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

function verifyCsrfRequest(req) {
  const cookies = parseCookies(req);
  return tokensMatch(cookies[CSRF_COOKIE_NAME], req.headers[CSRF_HEADER_NAME]);
}

function attachCsrfCookie(res) {
  const token = createCsrfToken();
  res.cookie(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  return token;
}

module.exports = {
  CSRF_COOKIE_NAME,
  CSRF_HEADER_NAME,
  createCsrfToken,
  issueCsrfToken,
  verifyCsrfToken,
  setCsrfCookieHeader,
  verifyCsrfRequest,
  parseCookies,
  attachCsrfCookie,
};
