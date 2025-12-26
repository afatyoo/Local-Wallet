import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(cors());
app.use(express.json());

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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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

    console.log('Database tables initialized successfully');
  } finally {
    connection.release();
  }
}

// -------------------------
// Auth routes
// -------------------------
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const id = uuidv4();

    await pool.query(
      'INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)',
      [id, username, passwordHash]
    );

    // Insert default master data (idempotent-ish: only when register)
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

    res.json({ id, username, createdAt: new Date().toISOString() });
  } catch (error) {
    // duplicate username
    if (String(error?.code) === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Username already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
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

    res.json({ id: user.id, username: user.username, createdAt: user.created_at });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------
// Helpers
// -------------------------
function normalizeMysqlDatetime(value) {
  if (!value) return value;

  // ISO: 2025-12-25T09:38:22.136Z -> 2025-12-25 09:38:22
  if (typeof value === 'string' && value.includes('T')) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19).replace('T', ' ');
    }
  }

  // "YYYY-MM-DD HH:MM:SS.xxx" -> trim ms
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

// -------------------------
// CRUD routes
// -------------------------
function createCrudRoutes(tableName, columns) {
  // Get all for user
  app.get(`/api/${tableName}/:userId`, async (req, res) => {
    try {
      const userId = req.params.userId;
      const [rows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE user_id = ?`,
        [userId]
      );
      res.json(rows);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // Create
  app.post(`/api/${tableName}`, async (req, res) => {
    try {
      const id = uuidv4();
      const payload = pickColumns(req.body || {}, columns);

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
      res.status(500).json({ error: error.message });
    }
  });

  // Update
  app.put(`/api/${tableName}/:id`, async (req, res) => {
    try {
      const id = req.params.id;
      const payload = pickColumns(req.body || {}, columns);

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
      res.status(500).json({ error: error.message });
    }
  });

  // Delete
  app.delete(`/api/${tableName}/:id`, async (req, res) => {
    try {
      await pool.query(`DELETE FROM ${tableName} WHERE id = ?`, [req.params.id]);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
}

// Routes for all tables
createCrudRoutes('incomes', ['user_id', 'tanggal', 'bulan', 'sumber', 'kategori', 'metode', 'jumlah', 'catatan', 'saving_id',]);
createCrudRoutes('expenses', ['user_id', 'tanggal', 'bulan', 'nama', 'kategori', 'metode', 'jumlah', 'catatan', 'bill_payment_id', 'saving_id',]);
createCrudRoutes('budgets', ['user_id', 'bulan', 'kategori', 'anggaran']);
createCrudRoutes('savings', ['user_id', 'tanggal', 'jenis', 'nama_akun', 'setoran', 'penarikan', 'catatan']);
createCrudRoutes('master_data', ['user_id', 'type', 'value']);
createCrudRoutes('bills', ['user_id', 'nama', 'kategori', 'jumlah', 'tanggal_jatuh_tempo', 'mulai_dari', 'sampai_dengan', 'catatan', 'is_active']);
createCrudRoutes('bill_payments', ['bill_id', 'user_id', 'bulan', 'dibayar_pada', 'jumlah_dibayar']);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

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
