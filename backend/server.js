import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
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
import {
  normalizeMysqlDatetime,
  pickColumns,
  sanitizePayload,
  VALIDATORS,
} from './validation.js';

dotenv.config();

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

app.use(express.json({ limit: '1mb' }));

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
// MySQL connection pool
// -------------------------
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.MYSQL_PORT || 3306),
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'finance_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// -------------------------
// DB init (tables)
// -------------------------
async function initDatabase() {
  const connection = await pool.getConnection();
  try {
    await connection.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role ENUM('admin','user') NOT NULL DEFAULT 'user',
        tfa_secret TEXT NULL,
        tfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        tfa_recovery_codes JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Migration: add role column if table existed before role was added
    const [cols] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role'`
    );
    if (cols.length === 0) {
      await connection.query(
        `ALTER TABLE users ADD COLUMN role ENUM('admin','user') NOT NULL DEFAULT 'user' AFTER password_hash`
      );
      console.log('Migration: added role column to users table');
    }

    const [userColumns] = await connection.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );
    const existingUserColumns = new Set(userColumns.map(column => column.COLUMN_NAME));
    const tfaMigrations = [
      ['tfa_secret', 'ALTER TABLE users ADD COLUMN tfa_secret TEXT NULL AFTER role'],
      ['tfa_enabled', 'ALTER TABLE users ADD COLUMN tfa_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER tfa_secret'],
      ['tfa_recovery_codes', 'ALTER TABLE users ADD COLUMN tfa_recovery_codes JSON NULL AFTER tfa_enabled'],
    ];
    for (const [column, statement] of tfaMigrations) {
      if (!existingUserColumns.has(column)) {
        await connection.query(statement);
        console.log(`Migration: added ${column} column to users table`);
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS incomes (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        tanggal VARCHAR(10) NOT NULL,
        bulan VARCHAR(7) NOT NULL,
        sumber VARCHAR(100) NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        metode VARCHAR(50) NOT NULL,
        jumlah DECIMAL(15,2) NOT NULL,
        catatan TEXT,
        saving_id VARCHAR(36), 
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        tanggal VARCHAR(10) NOT NULL,
        bulan VARCHAR(7) NOT NULL,
        nama VARCHAR(100) NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        metode VARCHAR(50) NOT NULL,
        jumlah DECIMAL(15,2) NOT NULL,
        catatan TEXT,
        bill_payment_id VARCHAR(36),
        saving_id VARCHAR(36),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        bulan VARCHAR(7) NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        anggaran DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS savings (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        tanggal VARCHAR(10) NOT NULL,
        jenis ENUM('Tabungan','Investasi') NOT NULL,
        nama_akun VARCHAR(100) NOT NULL,
        setoran DECIMAL(15,2) DEFAULT 0,
        penarikan DECIMAL(15,2) DEFAULT 0,
        catatan TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS savings_targets (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        nama_target VARCHAR(100) NOT NULL,
        target_amount DECIMAL(15,2) NOT NULL,
        start_date VARCHAR(10) NOT NULL,
        target_date VARCHAR(10) NOT NULL,
        linked_account VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS master_data (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        type ENUM('kategoriPemasukan','kategoriPengeluaran','metodePembayaran') NOT NULL,
        value VARCHAR(100) NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bills (
        id VARCHAR(36) PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL,
        nama VARCHAR(100) NOT NULL,
        kategori VARCHAR(50) NOT NULL,
        jumlah DECIMAL(15,2) NOT NULL,
        tanggal_jatuh_tempo INT NOT NULL,
        mulai_dari VARCHAR(7) NOT NULL,
        sampai_dengan VARCHAR(10) NOT NULL,
        catatan TEXT,
        is_active BOOLEAN DEFAULT TRUE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS bill_payments (
        id VARCHAR(36) PRIMARY KEY,
        bill_id VARCHAR(36) NOT NULL,
        user_id VARCHAR(36) NOT NULL,
        bulan VARCHAR(7) NOT NULL,
        dibayar_pada TIMESTAMP NOT NULL,
        jumlah_dibayar DECIMAL(15,2) NOT NULL,
        FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // Seed default admin user if not exists, or ensure role is admin
    const [existingAdmin] = await connection.query(
      'SELECT id, role FROM users WHERE username = ?', ['admin']
    );
    if (existingAdmin.length === 0) {
      const adminId = uuidv4();
      const adminHash = await bcrypt.hash('admin', 10);
      await connection.query(
        'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
        [adminId, 'admin', adminHash, 'admin']
      );
      console.log('Default admin user created (username: admin, password: admin)');
    } else if (existingAdmin[0].role !== 'admin') {
      const adminHash = await bcrypt.hash('admin', 10);
      await connection.query(
        'UPDATE users SET role = ?, password_hash = ? WHERE username = ?', ['admin', adminHash, 'admin']
      );
      console.log('Existing admin user promoted to admin role with default password');
    }

    console.log('Database tables initialized successfully');
  } finally {
    connection.release();
  }
}

// -------------------------
// Auth Middleware
// -------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    if (user.purpose && user.purpose !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }
    req.user = user;
    next();
  });
}

function authorizeAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// -------------------------
// Auth routes
// -------------------------
function issueAccessToken(user) {
  return jwt.sign(
    {
      purpose: 'access',
      id: user.id,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authResponse(user) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.created_at || new Date().toISOString(),
    token: issueAccessToken(user),
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

    res.json(authResponse(user));
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
    res.json(authResponse(user));
  } catch (error) {
    await connection.rollback().catch(() => {});
    console.error('TFA login verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
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
    res.json({ enabled: false });
  } catch (error) {
    console.error('TFA disable error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Authenticated CRUD routes (with ownership verification)
// -------------------------
async function validateOwnedReferences(tableName, payload, userId) {
  const references = [];
  if (payload.saving_id) {
    references.push(['savings', payload.saving_id, 'saving_id']);
  }
  if (payload.bill_payment_id) {
    references.push(['bill_payments', payload.bill_payment_id, 'bill_payment_id']);
  }
  if (tableName === 'bill_payments' && payload.bill_id) {
    references.push(['bills', payload.bill_id, 'bill_id']);
  }

  for (const [table, id, field] of references) {
    const [rows] = await pool.query(
      `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`,
      [id, userId]
    );
    if (rows.length === 0) return `${field} tidak valid`;
  }
  return null;
}

function createCrudRoutes(tableName, columns) {
  // All CRUD routes require authentication
  const router = express.Router();
  router.use(authenticateToken);

  // The authenticated token is the only source of user ownership.
  router.get(`/${tableName}`, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE user_id = ?`,
        [req.user.id]
      );
      res.json(rows);
    } catch (error) {
      console.error(`GET /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create — force user_id from token
  router.post(`/${tableName}`, async (req, res) => {
    try {
      const id = uuidv4();
      let payload = pickColumns(req.body || {}, columns);

      // Force user_id from authenticated user (ignore body.user_id)
      payload.user_id = req.user.id;

      // Sanitize before validation so markup-only values cannot pass required checks.
      payload = sanitizePayload(payload);

      const validator = VALIDATORS[tableName];
      if (validator) {
        const validationError = validator(payload);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
      }

      const referenceError = await validateOwnedReferences(tableName, payload, req.user.id);
      if (referenceError) {
        return res.status(400).json({ error: referenceError });
      }

      // Special normalize for bill_payments
      if (payload.dibayar_pada) {
        payload.dibayar_pada = normalizeMysqlDatetime(payload.dibayar_pada);
      }

      const data = { id, ...payload };

      const cols = Object.keys(data);
      const vals = Object.values(data);
      const placeholders = cols.map(() => '?').join(', ');

      await pool.query(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`,
        vals
      );

      const [createdRows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      res.status(201).json(createdRows[0]);
    } catch (error) {
      console.error(`POST /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update — with ownership check
  router.put(`/${tableName}/:id`, async (req, res) => {
    try {
      const id = req.params.id;

      const [existing] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      let payload = pickColumns(req.body || {}, columns);

      // Prevent changing user_id
      delete payload.user_id;

      // Sanitize text fields
      payload = sanitizePayload(payload);

      const validator = VALIDATORS[tableName];
      if (validator) {
        const validationError = validator({ ...existing[0], ...payload, user_id: req.user.id });
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
      }

      const referenceError = await validateOwnedReferences(
        tableName,
        { ...existing[0], ...payload },
        req.user.id
      );
      if (referenceError) {
        return res.status(400).json({ error: referenceError });
      }

      if (payload.dibayar_pada) {
        payload.dibayar_pada = normalizeMysqlDatetime(payload.dibayar_pada);
      }

      const keys = Object.keys(payload);
      if (!keys.length) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const updates = keys.map((k) => `${k} = ?`).join(', ');
      const values = [...keys.map((k) => payload[k]), id, req.user.id];

      await pool.query(
        `UPDATE ${tableName} SET ${updates} WHERE id = ? AND user_id = ?`,
        values
      );

      const [updatedRows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      res.json(updatedRows[0]);
    } catch (error) {
      console.error(`PUT /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete — with ownership check
  router.delete(`/${tableName}/:id`, async (req, res) => {
    try {
      const id = req.params.id;

      const [existing] = await pool.query(
        `SELECT id FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      await pool.query(
        `DELETE FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id]
      );
      res.json({ success: true });
    } catch (error) {
      console.error(`DELETE /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.use('/api', router);
}

// Health check — public, no auth required. Must be before createCrudRoutes.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes for all tables
createCrudRoutes('incomes', ['user_id', 'tanggal', 'bulan', 'sumber', 'kategori', 'metode', 'jumlah', 'catatan', 'saving_id']);
createCrudRoutes('expenses', ['user_id', 'tanggal', 'bulan', 'nama', 'kategori', 'metode', 'jumlah', 'catatan', 'bill_payment_id', 'saving_id']);
createCrudRoutes('budgets', ['user_id', 'bulan', 'kategori', 'anggaran']);
createCrudRoutes('savings', ['user_id', 'tanggal', 'jenis', 'nama_akun', 'setoran', 'penarikan', 'catatan']);
createCrudRoutes('savings_targets', ['user_id', 'nama_target', 'target_amount', 'start_date', 'target_date', 'linked_account']);
createCrudRoutes('master_data', ['user_id', 'type', 'value']);
createCrudRoutes('bills', ['user_id', 'nama', 'kategori', 'jumlah', 'tanggal_jatuh_tempo', 'mulai_dari', 'sampai_dengan', 'catatan', 'is_active']);
createCrudRoutes('bill_payments', ['bill_id', 'user_id', 'bulan', 'dibayar_pada', 'jumlah_dibayar']);

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

    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

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
    res.json({ success: true, message: 'User TFA reset successfully' });
  } catch (error) {
    console.error('DELETE /users/:id/tfa error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check is registered inside createCrudRoutes before the authenticated router

const PORT = Number(process.env.PORT || 3001);

initDatabase()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Backend server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });
