const crypto = require('crypto');

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Per-session CSRF tokens.
 *
 * A token is minted once per session and exposed to views as `csrfToken`.
 * Every state-changing request must echo it back, either in a `_csrf` form
 * field or an `X-CSRF-Token` header. Comparison is constant-time so the
 * token cannot be recovered by timing the responses.
 */
function issueToken(req) {
  if (!req.session) return '';
  if (!req.session.csrfSecret) {
    req.session.csrfSecret = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfSecret;
}

function tokensMatch(expected, provided) {
  if (typeof expected !== 'string' || typeof provided !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

exports.csrfProtection = (req, res, next) => {
  const token = issueToken(req);
  res.locals.csrfToken = token;

  if (SAFE_METHODS.has(req.method)) return next();

  const provided =
    (req.body && req.body._csrf) ||
    req.get('x-csrf-token') ||
    req.get('x-xsrf-token');

  if (!tokensMatch(token, provided)) {
    const err = new Error('Invalid or missing CSRF token. Please reload the page and try again.');
    err.status = 403;
    err.code = 'EBADCSRFTOKEN';
    return next(err);
  }

  return next();
};
