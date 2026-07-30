import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4 } from 'uuid';

const SESSION_COOKIE = 'wallet_session';
const CSRF_COOKIE = 'wallet_csrf';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SESSION_ROTATION_MS = 24 * 60 * 60 * 1000;
const PREVIOUS_TOKEN_GRACE_MS = 2 * 60 * 1000;

function positiveIntegerEnv(name, fallback) {
  const value = Number(process.env[name] || fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function idleTimeoutMs() {
  return positiveIntegerEnv('SESSION_IDLE_TIMEOUT_MINUTES', 30) * 60 * 1000;
}

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

export async function listUserSessions(pool, userId, currentSessionId) {
  const [rows] = await pool.query(
    `SELECT id, ip_address, user_agent, created_at, last_seen_at, expires_at
     FROM sessions
     WHERE user_id = ? AND expires_at > NOW() AND last_seen_at > ?
     ORDER BY last_seen_at DESC`,
    [userId, new Date(Date.now() - idleTimeoutMs())],
  );
  return rows.map((row) => ({
    id: row.id,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    current: row.id === currentSessionId,
  }));
}

export async function revokeSession(pool, userId, sessionId) {
  const [result] = await pool.query(
    'DELETE FROM sessions WHERE id = ? AND user_id = ?',
    [sessionId, userId],
  );
  return result.affectedRows > 0;
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
           s.id AS session_id, s.token_hash, s.csrf_hash, s.expires_at,
           s.last_seen_at, s.rotated_at,
           u.id, u.username, u.role, u.created_at
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         WHERE (
           s.token_hash = ?
           OR (s.previous_token_hash = ? AND s.previous_token_expires_at > NOW())
         )
           AND s.expires_at > NOW()
           AND s.last_seen_at > ?
         LIMIT 1`,
        [hash(token), hash(token), new Date(Date.now() - idleTimeoutMs())],
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

      const currentTokenHash = hash(token);
      const rotatedAt = new Date(session.rotated_at).getTime();
      if (
        session.token_hash === currentTokenHash
        && Number.isFinite(rotatedAt)
        && Date.now() - rotatedAt >= SESSION_ROTATION_MS
      ) {
        const nextToken = randomBytes(32).toString('base64url');
        const nextCsrfToken = randomBytes(32).toString('base64url');
        const [rotation] = await pool.query(
          `UPDATE sessions
           SET previous_token_hash = token_hash,
               previous_token_expires_at = ?,
               token_hash = ?,
               csrf_hash = ?,
               rotated_at = NOW(),
               last_seen_at = NOW()
           WHERE id = ? AND token_hash = ?`,
          [
            new Date(Date.now() + PREVIOUS_TOKEN_GRACE_MS),
            hash(nextToken),
            hash(nextCsrfToken),
            session.session_id,
            currentTokenHash,
          ],
        );
        if (rotation.affectedRows > 0) {
          res.cookie(SESSION_COOKIE, nextToken, sessionCookieOptions(req));
          res.cookie(CSRF_COOKIE, nextCsrfToken, csrfCookieOptions(req));
        }
      } else {
        await pool.query('UPDATE sessions SET last_seen_at = NOW() WHERE id = ?', [session.session_id]);
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
