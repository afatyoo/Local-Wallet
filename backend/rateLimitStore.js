import { createHash } from 'node:crypto';
import { ipKeyGenerator } from 'express-rate-limit';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function authRateLimitKey(req) {
  const ip = ipKeyGenerator(req.ip || 'unknown');
  const identifier = String(req.body?.username || req.body?.challenge || 'anonymous')
    .trim()
    .toLowerCase();
  return hash(`${req.path}:${ip}:${identifier}`);
}

export class MySqlRateLimitStore {
  constructor(pool) {
    this.pool = pool;
    this.windowMs = 15 * 60 * 1000;
  }

  init(options) {
    this.windowMs = options.windowMs;
  }

  async increment(key) {
    const windowSeconds = Math.ceil(this.windowMs / 1000);
    await this.pool.query('DELETE FROM auth_rate_limits WHERE expires_at <= NOW()');
    await this.pool.query(
      `INSERT INTO auth_rate_limits (key_hash, attempts, expires_at)
       VALUES (?, 1, DATE_ADD(NOW(), INTERVAL ? SECOND))
       ON DUPLICATE KEY UPDATE
         attempts = IF(expires_at <= NOW(), 1, attempts + 1),
         expires_at = IF(expires_at <= NOW(), DATE_ADD(NOW(), INTERVAL ? SECOND), expires_at)`,
      [key, windowSeconds, windowSeconds],
    );
    const [rows] = await this.pool.query(
      'SELECT attempts, expires_at FROM auth_rate_limits WHERE key_hash = ?',
      [key],
    );
    return {
      totalHits: Number(rows[0]?.attempts || 1),
      resetTime: new Date(rows[0]?.expires_at || Date.now() + this.windowMs),
    };
  }

  async decrement(key) {
    await this.pool.query(
      'UPDATE auth_rate_limits SET attempts = GREATEST(attempts - 1, 0) WHERE key_hash = ?',
      [key],
    );
  }

  async resetKey(key) {
    await this.pool.query('DELETE FROM auth_rate_limits WHERE key_hash = ?', [key]);
  }
}
