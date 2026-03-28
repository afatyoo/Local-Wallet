import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';

dotenv.config();

// -------------------------
// Security: JWT_SECRET must be set
// -------------------------
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Refusing to start.');
  process.exit(1);
}

const app = express();

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
// Helpers
// -------------------------
function normalizeMysqlDatetime(value) {
  if (!value) return value;
  if (typeof value === 'string' && value.includes('T')) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
  }
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+/.test(value)) {
    return value.slice(0, 19);
  }
  return value;
}

function pickColumns(body, allowedCols) {
  const out = {};
  for (const col of allowedCols) {
    if (Object.prototype.hasOwnProperty.call(body, col)) {
      out[col] = body[col];
    }
  }
  return out;
}

/** Strip HTML tags from a string to prevent XSS in stored data */
function stripHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>/g, '');
}

/** Validate date format YYYY-MM-DD */
function isValidDate(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/** Validate month format YYYY-MM */
function isValidMonth(str) {
  return typeof str === 'string' && /^\d{4}-\d{2}$/.test(str);
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
// Input Validation for each entity
// -------------------------
const VALIDATORS = {
  incomes: (body) => {
    if (!body.tanggal || !isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!body.sumber || typeof body.sumber !== 'string' || !body.sumber.trim()) return 'sumber wajib diisi';
    if (!body.kategori || typeof body.kategori !== 'string' || !body.kategori.trim()) return 'kategori wajib diisi';
    if (!body.metode || typeof body.metode !== 'string' || !body.metode.trim()) return 'metode wajib diisi';
    if (body.jumlah === undefined || body.jumlah === null || Number(body.jumlah) < 0) return 'jumlah harus >= 0';
    return null;
  },
  expenses: (body) => {
    if (!body.tanggal || !isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!body.nama || typeof body.nama !== 'string' || !body.nama.trim()) return 'nama wajib diisi';
    if (!body.kategori || typeof body.kategori !== 'string' || !body.kategori.trim()) return 'kategori wajib diisi';
    if (!body.metode || typeof body.metode !== 'string' || !body.metode.trim()) return 'metode wajib diisi';
    if (body.jumlah === undefined || body.jumlah === null || Number(body.jumlah) < 0) return 'jumlah harus >= 0';
    return null;
  },
  budgets: (body) => {
    if (!body.bulan || !isValidMonth(body.bulan)) return 'bulan harus format YYYY-MM';
    if (!body.kategori || typeof body.kategori !== 'string' || !body.kategori.trim()) return 'kategori wajib diisi';
    if (body.anggaran === undefined || body.anggaran === null || Number(body.anggaran) < 0) return 'anggaran harus >= 0';
    return null;
  },
  savings: (body) => {
    if (!body.tanggal || !isValidDate(body.tanggal)) return 'tanggal harus format YYYY-MM-DD';
    if (!body.jenis || !['Tabungan', 'Investasi'].includes(body.jenis)) return 'jenis harus Tabungan atau Investasi';
    if (!body.nama_akun || typeof body.nama_akun !== 'string' || !body.nama_akun.trim()) return 'nama_akun wajib diisi';
    return null;
  },
  master_data: (body) => {
    if (!body.type || !['kategoriPemasukan', 'kategoriPengeluaran', 'metodePembayaran'].includes(body.type)) return 'type tidak valid';
    if (!body.value || typeof body.value !== 'string' || !body.value.trim()) return 'value wajib diisi';
    return null;
  },
  bills: (body) => {
    if (!body.nama || typeof body.nama !== 'string' || !body.nama.trim()) return 'nama wajib diisi';
    if (!body.kategori || typeof body.kategori !== 'string' || !body.kategori.trim()) return 'kategori wajib diisi';
    if (body.jumlah === undefined || body.jumlah === null || Number(body.jumlah) < 0) return 'jumlah harus >= 0';
    if (body.tanggal_jatuh_tempo === undefined || Number(body.tanggal_jatuh_tempo) < 1 || Number(body.tanggal_jatuh_tempo) > 31) return 'tanggal_jatuh_tempo harus 1-31';
    if (!body.mulai_dari || !isValidMonth(body.mulai_dari)) return 'mulai_dari harus format YYYY-MM';
    return null;
  },
  bill_payments: (body) => {
    if (!body.bill_id || typeof body.bill_id !== 'string') return 'bill_id wajib diisi';
    if (!body.bulan || !isValidMonth(body.bulan)) return 'bulan harus format YYYY-MM';
    if (body.jumlah_dibayar === undefined || body.jumlah_dibayar === null || Number(body.jumlah_dibayar) < 0) return 'jumlah_dibayar harus >= 0';
    return null;
  },
};

// Text fields that should be sanitized (strip HTML)
const TEXT_FIELDS = ['catatan', 'nama', 'sumber', 'nama_akun', 'value', 'kategori'];

function sanitizePayload(payload) {
  const sanitized = { ...payload };
  for (const field of TEXT_FIELDS) {
    if (sanitized[field] !== undefined) {
      sanitized[field] = stripHtml(sanitized[field]);
    }
  }
  return sanitized;
}

// -------------------------
// Auth routes
// -------------------------
app.post('/api/auth/register', authLimiter, async (req, res) => {
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

    // Check if this is the first user to assign admin role
    const [countRows] = await pool.query('SELECT COUNT(*) as count FROM users');
    const isFirstUser = countRows[0].count === 0;
    const role = isFirstUser ? 'admin' : 'user';

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

    const token = jwt.sign(
      { id, username: username.trim(), role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ id, username: username.trim(), role, createdAt: new Date().toISOString(), token });
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

    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      createdAt: user.created_at,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// -------------------------
// Authenticated CRUD routes (with ownership verification)
// -------------------------
function createCrudRoutes(tableName, columns) {
  // All CRUD routes require authentication
  const router = express.Router();
  router.use(authenticateToken);

  // Get all for user — uses token user ID, ignores URL param for security
  router.get(`/${tableName}/:userId`, async (req, res) => {
    try {
      const tokenUserId = req.user.id;
      const requestedUserId = req.params.userId;

      // Ownership check: user can only access their own data
      if (tokenUserId !== requestedUserId) {
        return res.status(403).json({ error: 'Access denied: you can only access your own data' });
      }

      const [rows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE user_id = ?`,
        [tokenUserId]
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

      // Validate input
      const validator = VALIDATORS[tableName];
      if (validator) {
        const validationError = validator(payload);
        if (validationError) {
          return res.status(400).json({ error: validationError });
        }
      }

      // Sanitize text fields
      payload = sanitizePayload(payload);

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

      res.json(data);
    } catch (error) {
      console.error(`POST /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update — with ownership check
  router.put(`/${tableName}/:id`, async (req, res) => {
    try {
      const id = req.params.id;

      // Ownership check: verify this row belongs to the authenticated user
      const [existing] = await pool.query(
        `SELECT user_id FROM ${tableName} WHERE id = ?`,
        [id]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }
      if (existing[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied: you can only modify your own data' });
      }

      let payload = pickColumns(req.body || {}, columns);

      // Prevent changing user_id
      delete payload.user_id;

      // Sanitize text fields
      payload = sanitizePayload(payload);

      if (payload.dibayar_pada) {
        payload.dibayar_pada = normalizeMysqlDatetime(payload.dibayar_pada);
      }

      const keys = Object.keys(payload);
      if (!keys.length) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const updates = keys.map((k) => `${k} = ?`).join(', ');
      const values = [...keys.map((k) => payload[k]), id];

      await pool.query(
        `UPDATE ${tableName} SET ${updates} WHERE id = ?`,
        values
      );

      res.json({ id, ...payload });
    } catch (error) {
      console.error(`PUT /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Delete — with ownership check
  router.delete(`/${tableName}/:id`, async (req, res) => {
    try {
      const id = req.params.id;

      // Ownership check
      const [existing] = await pool.query(
        `SELECT user_id FROM ${tableName} WHERE id = ?`,
        [id]
      );
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }
      if (existing[0].user_id !== req.user.id) {
        return res.status(403).json({ error: 'Access denied: you can only delete your own data' });
      }

      await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
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
createCrudRoutes('master_data', ['user_id', 'type', 'value']);
createCrudRoutes('bills', ['user_id', 'nama', 'kategori', 'jumlah', 'tanggal_jatuh_tempo', 'mulai_dari', 'sampai_dengan', 'catatan', 'is_active']);
createCrudRoutes('bill_payments', ['bill_id', 'user_id', 'bulan', 'dibayar_pada', 'jumlah_dibayar']);

// -------------------------
// User management routes (admin only)
// -------------------------
app.get('/api/users', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM users');
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
    const [rows] = await pool.query('SELECT id, username, role, created_at FROM users WHERE id = ?', [userId]);

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
