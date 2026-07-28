import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE = 'wallet_session';
const CSRF_COOKIE = 'wallet_csrf';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseCookies(header = '') {
  return header.split(';').reduce((cookies, item) => {
    const separator = item.indexOf('=');
    if (separator < 0) return cookies;
    const key = item.slice(0, separator).trim();
    const value = item.slice(separator + 1).trim();
    if (key) cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function cookieSecure(req) {
  if (process.env.COOKIE_SECURE === 'true') return true;
  if (process.env.COOKIE_SECURE === 'false') return false;
  return req.secure || req.get('x-forwarded-proto') === 'https';
}

function sessionCookieOptions(req) {
  return {
    httpOnly: true,
    secure: cookieSecure(req),
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/api',
  };
}

function csrfCookieOptions(req) {
  return {
    httpOnly: false,
    secure: cookieSecure(req),
    sameSite: 'lax',
    maxAge: SESSION_TTL_MS,
    path: '/',
  };
}

function clearCookieOptions(options) {
  const { maxAge: _maxAge, ...clearOptions } = options;
  return clearOptions;
}

export async function createSession(pool, user, req, res) {
  const token = randomBytes(32).toString('base64url');
  const csrfToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await pool.query('DELETE FROM sessions WHERE expires_at <= NOW()');
  await pool.query(
    `INSERT INTO sessions
      (id, user_id, token_hash, csrf_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      uuidv4(),
      user.id,
      hash(token),
      hash(csrfToken),
      expiresAt,
      req.ip || null,
      String(req.get('user-agent') || '').slice(0, 255) || null,
    ],
  );

  res.cookie(SESSION_COOKIE, token, sessionCookieOptions(req));
  res.cookie(CSRF_COOKIE, csrfToken, csrfCookieOptions(req));
}

export async function destroyCurrentSession(pool, req, res) {
  if (req.session?.id) {
    await pool.query('DELETE FROM sessions WHERE id = ?', [req.session.id]);
  }
  res.clearCookie(SESSION_COOKIE, clearCookieOptions(sessionCookieOptions(req)));
  res.clearCookie(CSRF_COOKIE, clearCookieOptions(csrfCookieOptions(req)));
}

export async function revokeUserSessions(pool, userId, exceptSessionId = null) {
  if (exceptSessionId) {
    await pool.query(
      'DELETE FROM sessions WHERE user_id = ? AND id <> ?',
      [userId, exceptSessionId],
    );
    return;
  }
  await pool.query('DELETE FROM sessions WHERE user_id = ?', [userId]);
}

function safeHashEqual(left, right) {
  const leftBuffer = Buffer.from(hash(left));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSessionAuth(pool) {
  return async function authenticateSession(req, res, next) {
    try {
      const cookies = parseCookies(req.headers.cookie);
      const token = cookies[SESSION_COOKIE];
      if (!token) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const [rows] = await pool.query(
        `SELECT
           s.id AS session_id, s.csrf_hash, s.expires_at,
           u.id, u.username, u.role, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > NOW()
         LIMIT 1`,
        [hash(token)],
      );
      const session = rows[0];
      if (!session) {
        res.clearCookie(SESSION_COOKIE, clearCookieOptions(sessionCookieOptions(req)));
        res.clearCookie(CSRF_COOKIE, clearCookieOptions(csrfCookieOptions(req)));
        return res.status(401).json({ error: 'Invalid or expired session' });
      }

      if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        const csrfToken = req.get('x-csrf-token');
        if (!csrfToken || !safeHashEqual(csrfToken, session.csrf_hash)) {
          return res.status(403).json({ error: 'Invalid CSRF token' });
        }
      }

      req.session = { id: session.session_id };
      req.user = {
        id: session.id,
        username: session.username,
        role: session.role,
        created_at: session.created_at,
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
