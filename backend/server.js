import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { unlinkSync } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import { pool } from './db.js';
import { initializeDatabase } from './migrations.js';
import {
  createSession,
  createSessionAuth,
  destroyCurrentSession,
  revokeUserSessions,
} from './session.js';
import { createBackupRouter } from './routes/backup.js';
import { createCrudRouter } from './routes/crud.js';
import { createPlanningRouter, startNotificationWorker } from './routes/planning.js';
import {
  createOtpAuthUri,
  decryptTotpSecret,
  encryptTotpSecret,
  findRecoveryCodeIndex,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from './twoFactor.js';

dotenv.config();
const RECEIPT_DIR = process.env.RECEIPT_DIR || '/app/uploads';

// -------------------------
// Security: JWT_SECRET must be set
// -------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}
const TFA_ENCRYPTION_KEY = process.env.TFA_ENCRYPTION_KEY || JWT_SECRET;
if (!process.env.TFA_ENCRYPTION_KEY) {
  console.warn('TFA_ENCRYPTION_KEY is not set; falling back to JWT_SECRET.');
}

const app = express();

// Requests normally arrive through the Nginx container.
app.set('trust proxy', 1);

// -------------------------
// Security: Helmet (secure HTTP headers)
// -------------------------
app.use(helmet());

// -------------------------
// Security: CORS (restrict origins)
// -------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:8080')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

app.use(express.json({ limit: '6mb' }));

// -------------------------
// Security: Rate Limiting
// -------------------------
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later' },
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login/register attempts per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later' },
});

// -------------------------
// Auth Middleware
// -------------------------
const authenticateToken = createSessionAuth(pool);

function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// -------------------------
// Auth routes
// -------------------------
async function authResponse(user, req, res) {
  await createSession(pool, user, req, res);
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at || new Date().toISOString(),
  };
}

function parseRecoveryHashes(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function verifySecondFactor(user, code) {
  const secret = decryptTotpSecret(user.tfa_secret, TFA_ENCRYPTION_KEY);
  if (verifyTotp(secret, code)) {
    return { valid: true, recoveryIndex: -1 };
  }

  const hashes = parseRecoveryHashes(user.tfa_recovery_codes);
  const recoveryIndex = findRecoveryCodeIndex(code, hashes, TFA_ENCRYPTION_KEY);
  return { valid: recoveryIndex >= 0, recoveryIndex };
}

app.post('/api/auth/register', authLimiter, authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    // Validate username
    if (typeof username !== 'string' || username.trim().length < 3 || username.trim().length > 50) {
      return res.status(400).json({ error: 'Username must be 3-50 characters' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username.trim())) {
      return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
    }

    // Validate password strength
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const role = 'user';

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [id, username.trim(), passwordHash, role]
    );

    // Insert default master data
    const defaultData = {
      kategoriPemasukan: ['Gaji', 'Bonus', 'Investasi', 'Freelance', 'Hadiah', 'Lainnya'],
      kategoriPengeluaran: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
      metodePembayaran: ['Cash', 'Debit', 'Credit', 'E-wallet', 'Transfer', 'Lainnya']
    };

    const inserts = [];
    for (const value of defaultData.kategoriPemasukan) {
      inserts.push([uuidv4(), id, 'kategoriPemasukan', value]);
    }
    for (const value of defaultData.kategoriPengeluaran) {
      inserts.push([uuidv4(), id, 'kategoriPengeluaran', value]);
    }
    for (const value of defaultData.metodePembayaran) {
      inserts.push([uuidv4(), id, 'metodePembayaran', value]);
    }

    if (inserts.length) {
      await pool.query(
        'INSERT INTO master_data (id, user_id, type, value) VALUES ?',
        [inserts]
      );
    }

    res.status(201).json({
      id,
      username: username.trim(),
      role,
      createdAt: new Date().toISOString(),
      tfaEnabled: false,
    });
  } catch (error) {
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows?.[0];
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.tfa_enabled) {
      const challenge = jwt.sign(
        { purpose: 'tfa-login', id: user.id },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.status(202).json({ requiresTwoFactor: true, challenge });
    }

    res.json(await authResponse(user, req, res));
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/tfa/verify-login', authLimiter, async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { challenge, code } = req.body || {};
    if (typeof challenge !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'Challenge and verification code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(challenge, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'TFA challenge expired or invalid' });
    }
    if (payload.purpose !== 'tfa-login' || !payload.id) {
      return res.status(401).json({ error: 'Invalid TFA challenge' });
    }

    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT * FROM users WHERE id = ? FOR UPDATE',
      [payload.id]
    );
    const user = rows[0];
    if (!user?.tfa_enabled || !user.tfa_secret) {
      await connection.rollback();
      return res.status(401).json({ error: 'TFA is not enabled for this account' });
    }

    const verification = verifySecondFactor(user, code);
    if (!verification.valid) {
      await connection.rollback();
      return res.status(401).json({ error: 'Invalid verification or recovery code' });
    }

    if (verification.recoveryIndex >= 0) {
      const hashes = parseRecoveryHashes(user.tfa_recovery_codes);
      hashes.splice(verification.recoveryIndex, 1);
      await connection.query(
        'UPDATE users SET tfa_recovery_codes = ? WHERE id = ?',
        [JSON.stringify(hashes), user.id]
      );
    }
    await connection.commit();
    res.json(await authResponse(user, req, res));
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('TFA login verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

app.get('/api/auth/session', authenticateToken, async (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role,
    createdAt: req.user.created_at,
  });
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    await destroyCurrentSession(pool, req, res);
    res.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/auth/tfa/status', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT tfa_enabled, tfa_recovery_codes FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json({
      enabled: Boolean(rows[0].tfa_enabled),
      recoveryCodesRemaining: parseRecoveryHashes(rows[0].tfa_recovery_codes).length,
    });
  } catch (error) {
    console.error('TFA status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/tfa/setup', authenticateToken, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT username, tfa_enabled FROM users WHERE id = ?',
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.tfa_enabled) return res.status(409).json({ error: 'TFA is already enabled' });

    const secret = generateTotpSecret();
    const setupToken = jwt.sign(
      { purpose: 'tfa-setup', id: req.user.id, secret },
      JWT_SECRET,
      { expiresIn: '10m' }
    );
    res.json({
      setupToken,
      secret,
      otpAuthUri: createOtpAuthUri(user.username, secret),
    });
  } catch (error) {
    console.error('TFA setup error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/tfa/confirm', authenticateToken, async (req, res) => {
  try {
    const { setupToken, code } = req.body || {};
    if (typeof setupToken !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'Setup token and verification code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(setupToken, JWT_SECRET);
    } catch {
      return res.status(400).json({ error: 'TFA setup expired; start again' });
    }
    if (payload.purpose !== 'tfa-setup' || payload.id !== req.user.id || !payload.secret) {
      return res.status(400).json({ error: 'Invalid TFA setup' });
    }
    if (!verifyTotp(payload.secret, code)) {
      return res.status(400).json({ error: 'Invalid authenticator code' });
    }

    const recoveryCodes = generateRecoveryCodes();
    const recoveryHashes = recoveryCodes.map(recoveryCode =>
      hashRecoveryCode(recoveryCode, TFA_ENCRYPTION_KEY)
    );
    const encryptedSecret = encryptTotpSecret(payload.secret, TFA_ENCRYPTION_KEY);
    const [result] = await pool.query(
      `UPDATE users
       SET tfa_secret = ?, tfa_enabled = TRUE, tfa_recovery_codes = ?
       WHERE id = ? AND tfa_enabled = FALSE`,
      [encryptedSecret, JSON.stringify(recoveryHashes), req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(409).json({ error: 'TFA is already enabled' });
    }

    await revokeUserSessions(pool, req.user.id, req.session.id);
    res.json({ enabled: true, recoveryCodes });
  } catch (error) {
    console.error('TFA confirmation error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/tfa/disable', authenticateToken, async (req, res) => {
  try {
    const { password, code } = req.body || {};
    if (typeof password !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ error: 'Password and verification code are required' });
    }

    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.user.id]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!user.tfa_enabled) return res.status(409).json({ error: 'TFA is not enabled' });

    const passwordValid = await bcrypt.compare(password, user.password_hash);
    if (!passwordValid) return res.status(400).json({ error: 'Invalid password' });
    if (!verifySecondFactor(user, code).valid) {
      return res.status(400).json({ error: 'Invalid verification or recovery code' });
    }

    await pool.query(
      `UPDATE users
       SET tfa_secret = NULL, tfa_enabled = FALSE, tfa_recovery_codes = NULL
       WHERE id = ?`,
      [req.user.id]
    );
    await revokeUserSessions(pool, req.user.id, req.session.id);
    res.json({ enabled: false });
  } catch (error) {
    console.error('TFA disable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/backup', createBackupRouter({ pool, authenticate: authenticateToken }));
app.use('/api/planning', createPlanningRouter({ pool, authenticate: authenticateToken }));
app.use('/api', createCrudRouter({ pool, authenticate: authenticateToken }));

// -------------------------
// User management routes (admin only)
// -------------------------
app.get('/api/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, tfa_enabled, created_at FROM users');
    // Convert snake_case to camelCase for frontend consistency
    // Format createdAt as YYYY-MM-DD based on server's local timezone
    const users = rows.map(row => {
      const date = new Date(row.created_at);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return {
        id: row.id,
        username: row.username,
        role: row.role,
        tfaEnabled: Boolean(row.tfa_enabled),
        createdAt: `${year}-${month}-${day}` // format: YYYY-MM-DD (server local date)
      };
    });
    res.json(users);
  } catch (error) {
    console.error('GET /users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const [rows] = await pool.query(
      'SELECT id, username, role, tfa_enabled, created_at FROM users WHERE id = ?',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Convert snake_case to camelCase for frontend consistency
    // Format createdAt as YYYY-MM-DD based on server's local timezone
    const date = new Date(rows[0].created_at);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const user = {
      id: rows[0].id,
      username: rows[0].username,
      role: rows[0].role,
      tfaEnabled: Boolean(rows[0].tfa_enabled),
      createdAt: `${year}-${month}-${day}` // format: YYYY-MM-DD (server local date)
    };
    res.json(user);
  } catch (error) {
    console.error('GET /users/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id/role', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Valid role (admin or user) is required' });
    }

    const [result] = await pool.query('UPDATE users SET role = ? WHERE id = ?', [role, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await revokeUserSessions(pool, userId);
    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('PUT /users/:id/role error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;

    // Prevent deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    const [receipts] = await pool.query(
      'SELECT stored_name FROM receipts WHERE user_id = ?',
      [userId],
    );
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    receipts.forEach((receipt) => {
      try { unlinkSync(path.join(RECEIPT_DIR, receipt.stored_name)); } catch { /* already absent */ }
    });
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('DELETE /users/:id error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/users/:id/password', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }

    // Validate password strength
    if (typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one uppercase letter' });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Password must contain at least one number' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await revokeUserSessions(pool, userId);
    res.json({ message: 'User password updated successfully' });
  } catch (error) {
    console.error('PUT /users/:id/password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/users/:id/tfa', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        error: 'Use account settings to disable TFA on your own account',
      });
    }

    const [result] = await pool.query(
      `UPDATE users
       SET tfa_secret = NULL, tfa_enabled = FALSE, tfa_recovery_codes = NULL
       WHERE id = ?`,
      [req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    await revokeUserSessions(pool, req.params.id);
    res.json({ success: true, message: 'User TFA reset successfully' });
  } catch (error) {
    console.error('DELETE /users/:id/tfa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error?.code === 'LIMIT_FILE_SIZE' || error?.message === 'Unsupported receipt file type') {
    return res.status(400).json({ error: error.message });
  }
  console.error('Unhandled request error:', error);
  return res.status(500).json({ error: 'Internal server error' });
});

const PORT = Number(process.env.PORT || 3001);

initializeDatabase(pool)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
    startNotificationWorker(pool);
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
