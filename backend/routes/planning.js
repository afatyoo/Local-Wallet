import express from 'express';
import multer from 'multer';
import nodemailer from 'nodemailer';
import { mkdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { v4 as uuidv4 } from 'uuid';

const UPLOAD_DIR = process.env.RECEIPT_DIR || '/app/uploads';
const RESTORABLE_TABLES = new Set([
  'incomes', 'expenses', 'budgets', 'savings', 'savings_targets',
  'master_data', 'bills', 'bill_payments', 'net_worth_items',
  'debts', 'categorization_rules',
]);
mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOAD_DIR,
    filename: (_req, file, callback) => {
      callback(null, `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, callback) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    callback(allowed.includes(file.mimetype) ? null : new Error('Unsupported receipt file type'), allowed.includes(file.mimetype));
  },
});

async function logActivity(connection, userId, action, entityType, entityId, summary, payload = null) {
  await connection.query(
    `INSERT INTO activity_log
      (id, user_id, action, entity_type, entity_id, summary, payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [uuidv4(), userId, action, entityType, entityId, summary, payload ? JSON.stringify(payload) : null],
  );
}

function cleanText(value, max = 255) {
  return String(value || '').replace(/<[^>]*>/g, '').trim().slice(0, max);
}

function isDate(value, optional = false) {
  return optional && !value ? true : /^\d{4}-\d{2}-\d{2}$/.test(String(value));
}

function validatePlanningPayload(table, payload, partial = false) {
  const required = {
    net_worth_items: ['type', 'name', 'category', 'value', 'as_of_date'],
    debts: ['direction', 'name', 'principal', 'remaining', 'interest_rate', 'status'],
    categorization_rules: ['transaction_type', 'pattern', 'category'],
  };
  if (!partial && required[table].some((field) => payload[field] === undefined || payload[field] === '')) {
    return 'Required fields are missing';
  }
  if (table === 'net_worth_items') {
    if (payload.type !== undefined && !['asset', 'liability'].includes(payload.type)) return 'Invalid net worth type';
    if (payload.value !== undefined && (!Number.isFinite(Number(payload.value)) || Number(payload.value) < 0)) return 'Invalid value';
    if (payload.as_of_date !== undefined && !isDate(payload.as_of_date)) return 'Invalid date';
  }
  if (table === 'debts') {
    if (payload.direction !== undefined && !['owed', 'receivable'].includes(payload.direction)) return 'Invalid debt direction';
    if (payload.status !== undefined && !['active', 'paid'].includes(payload.status)) return 'Invalid debt status';
    for (const field of ['principal', 'remaining', 'interest_rate']) {
      if (payload[field] !== undefined && (!Number.isFinite(Number(payload[field])) || Number(payload[field]) < 0)) {
        return `Invalid ${field}`;
      }
    }
    if (payload.due_date !== undefined && !isDate(payload.due_date, true)) return 'Invalid due date';
  }
  if (table === 'categorization_rules'
    && payload.transaction_type !== undefined
    && !['expense', 'income'].includes(payload.transaction_type)) {
    return 'Invalid transaction type';
  }
  return null;
}

function sanitizePlanningPayload(payload) {
  const clean = { ...payload };
  for (const key of ['name', 'category', 'pattern']) {
    if (clean[key] !== undefined) clean[key] = cleanText(clean[key], 100);
  }
  if (clean.notes !== undefined) clean.notes = cleanText(clean.notes, 2000);
  return clean;
}

function createMailer() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

async function sendEmail(to, subject, text) {
  const mailer = createMailer();
  if (!mailer) throw new Error('SMTP is not configured');
  await mailer.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    text,
  });
}

async function generateNotifications(pool, userId) {
  const [preferences] = await pool.query(
    'SELECT * FROM notification_preferences WHERE user_id = ?',
    [userId],
  );
  const pref = preferences[0] || { bill_days: 3, budget_threshold: 80, debt_days: 7 };
  const [bills] = await pool.query(
    `SELECT id, nama, tanggal_jatuh_tempo, jumlah
     FROM bills WHERE user_id = ? AND is_active = TRUE`,
    [userId],
  );
  const [debts] = await pool.query(
    `SELECT id, name, due_date, remaining FROM debts
     WHERE user_id = ? AND status = 'active' AND due_date IS NOT NULL`,
    [userId],
  );
  const [budgets] = await pool.query(
    `SELECT b.id, b.bulan, b.kategori, b.anggaran,
       COALESCE(SUM(e.jumlah), 0) AS spent
     FROM budgets b
     LEFT JOIN expenses e
       ON e.user_id = b.user_id AND e.bulan = b.bulan AND e.kategori = b.kategori
     WHERE b.user_id = ?
     GROUP BY b.id, b.bulan, b.kategori, b.anggaran`,
    [userId],
  );
  const now = new Date();
  const month = now.toISOString().slice(0, 7);
  const candidates = [];
  bills.forEach((bill) => {
    const due = new Date(`${month}-${String(bill.tanggal_jatuh_tempo).padStart(2, '0')}T00:00:00`);
    const days = Math.ceil((due.getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= Number(pref.bill_days)) {
      candidates.push({
        type: 'bill',
        key: `bill:${bill.id}:${month}`,
        title: `Tagihan ${bill.nama}`,
        message: `Jatuh tempo ${days === 0 ? 'hari ini' : `${days} hari lagi`}.`,
      });
    }
  });
  debts.forEach((debt) => {
    const days = Math.ceil((new Date(`${debt.due_date}T00:00:00`).getTime() - now.getTime()) / 86400000);
    if (days >= 0 && days <= Number(pref.debt_days)) {
      candidates.push({
        type: 'debt',
        key: `debt:${debt.id}:${debt.due_date}`,
        title: `Jatuh tempo ${debt.name}`,
        message: `Sisa kewajiban Rp${Number(debt.remaining).toLocaleString('id-ID')}.`,
      });
    }
  });
  budgets.forEach((budget) => {
    const percent = Number(budget.anggaran) > 0
      ? Math.round((Number(budget.spent) / Number(budget.anggaran)) * 100)
      : 0;
    if (budget.bulan === month && percent >= Number(pref.budget_threshold)) {
      candidates.push({
        type: 'budget',
        key: `budget:${budget.id}:${percent >= 100 ? 'over' : 'warning'}`,
        title: `Budget ${budget.kategori}`,
        message: `${percent}% dari anggaran bulan ini sudah terpakai.`,
      });
    }
  });

  for (const item of candidates) {
    const [result] = await pool.query(
      `INSERT IGNORE INTO notifications
        (id, user_id, type, title, message, dedupe_key)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), userId, item.type, item.title, item.message, item.key],
    );
    if (result.affectedRows && pref.email_enabled && pref.email) {
      await sendEmail(pref.email, `[Local Wallet] ${item.title}`, item.message).catch((error) => {
        console.error('Notification email error:', error.message);
      });
    }
  }
}

export function startNotificationWorker(pool) {
  const configuredInterval = Number(process.env.NOTIFICATION_SCAN_INTERVAL_MS || 21600000);
  const interval = Number.isFinite(configuredInterval)
    ? Math.max(configuredInterval, 60000)
    : 21600000;
  let running = false;
  const scan = async () => {
    if (running) return;
    running = true;
    try {
      const [users] = await pool.query('SELECT id FROM users');
      for (const user of users) {
        await generateNotifications(pool, user.id);
      }
    } catch (error) {
      console.error('Notification scan error:', error.message);
    } finally {
      running = false;
    }
  };
  const initialTimer = setTimeout(scan, 10000);
  initialTimer.unref();
  const timer = setInterval(scan, interval);
  timer.unref();
  return () => {
    clearTimeout(initialTimer);
    clearInterval(timer);
  };
}

function genericRoutes(router, pool, config) {
  const { path: routePath, table, columns } = config;
  router.get(routePath, async (req, res) => {
    const [rows] = await pool.query(
      `SELECT * FROM ${table} WHERE user_id = ? ORDER BY ${config.orderBy || 'id'} DESC`,
      [req.user.id],
    );
    res.json(rows);
  });
  router.post(routePath, async (req, res) => {
    let payload = {};
    columns.forEach((column) => {
      if (req.body[column] !== undefined) payload[column] = req.body[column];
    });
    payload = sanitizePlanningPayload(payload);
    const validationError = validatePlanningPayload(table, payload);
    if (validationError) return res.status(400).json({ error: validationError });
    const id = uuidv4();
    const keys = Object.keys(payload);
    await pool.query(
      `INSERT INTO ${table} (id, user_id, ${keys.join(', ')})
       VALUES (?, ?, ${keys.map(() => '?').join(', ')})`,
      [id, req.user.id, ...keys.map((key) => payload[key])],
    );
    await logActivity(pool, req.user.id, 'create', table, id, `Menambahkan ${table}`, payload);
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`, [id, req.user.id]);
    res.status(201).json(rows[0]);
  });
  router.put(`${routePath}/:id`, async (req, res) => {
    let payload = {};
    columns.forEach((column) => {
      if (req.body[column] !== undefined) payload[column] = req.body[column];
    });
    payload = sanitizePlanningPayload(payload);
    const keys = Object.keys(payload);
    if (!keys.length) return res.status(400).json({ error: 'No valid fields' });
    const validationError = validatePlanningPayload(table, payload, true);
    if (validationError) return res.status(400).json({ error: validationError });
    const [result] = await pool.query(
      `UPDATE ${table} SET ${keys.map((key) => `${key} = ?`).join(', ')}
       WHERE id = ? AND user_id = ?`,
      [...keys.map((key) => payload[key]), req.params.id, req.user.id],
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Record not found' });
    await logActivity(pool, req.user.id, 'update', table, req.params.id, `Memperbarui ${table}`, payload);
    const [rows] = await pool.query(`SELECT * FROM ${table} WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
    return res.json(rows[0]);
  });
  router.delete(`${routePath}/:id`, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT * FROM ${table} WHERE id = ? AND user_id = ? FOR UPDATE`,
        [req.params.id, req.user.id],
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Record not found' });
      }
      let trashPayload = rows[0];
      if (table === 'debts') {
        const [debtPayments] = await connection.query(
          'SELECT * FROM debt_payments WHERE debt_id = ? AND user_id = ?',
          [req.params.id, req.user.id],
        );
        trashPayload = { record: rows[0], debtPayments };
      }
      await connection.query(
        `INSERT INTO trashed_records
          (id, user_id, table_name, record_id, payload, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [uuidv4(), req.user.id, table, req.params.id, JSON.stringify(trashPayload)],
      );
      await connection.query(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`, [req.params.id, req.user.id]);
      await logActivity(connection, req.user.id, 'delete', table, req.params.id, `Menghapus ${table}`, rows[0]);
      await connection.commit();
      return res.json({ success: true });
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  });
}

export function createPlanningRouter({ pool, authenticate }) {
  const router = express.Router();
  router.use(authenticate);
  genericRoutes(router, pool, {
    path: '/net-worth',
    table: 'net_worth_items',
    columns: ['type', 'name', 'category', 'value', 'as_of_date', 'notes'],
    orderBy: 'as_of_date',
  });
  genericRoutes(router, pool, {
    path: '/debts',
    table: 'debts',
    columns: ['direction', 'name', 'principal', 'remaining', 'interest_rate', 'due_date', 'status', 'notes'],
    orderBy: 'due_date',
  });
  genericRoutes(router, pool, {
    path: '/rules',
    table: 'categorization_rules',
    columns: ['transaction_type', 'pattern', 'category', 'priority', 'active'],
    orderBy: 'priority',
  });

  router.post('/debts/:id/payments', async (req, res) => {
    const amount = Number(req.body.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        'SELECT * FROM debts WHERE id = ? AND user_id = ? FOR UPDATE',
        [req.params.id, req.user.id],
      );
      const debt = rows[0];
      if (!debt) {
        await connection.rollback();
        return res.status(404).json({ error: 'Debt not found' });
      }
      if (!isDate(req.body.paid_at)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Invalid payment date' });
      }
      if (amount > Number(debt.remaining)) {
        await connection.rollback();
        return res.status(400).json({ error: 'Payment exceeds the remaining balance' });
      }
      const remaining = Math.max(0, Number(debt.remaining) - amount);
      await connection.query(
        `INSERT INTO debt_payments (id, debt_id, user_id, amount, paid_at, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [uuidv4(), debt.id, req.user.id, amount, req.body.paid_at, cleanText(req.body.notes, 2000)],
      );
      await connection.query(
        'UPDATE debts SET remaining = ?, status = ? WHERE id = ?',
        [remaining, remaining === 0 ? 'paid' : 'active', debt.id],
      );
      await logActivity(connection, req.user.id, 'payment', 'debts', debt.id, `Pembayaran ${debt.name}`, { amount });
      await connection.commit();
      res.json({ success: true, remaining });
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  });

  router.get('/debt-payments', async (req, res) => {
    const [rows] = await pool.query(
      'SELECT * FROM debt_payments WHERE user_id = ? ORDER BY paid_at DESC',
      [req.user.id],
    );
    res.json(rows);
  });

  router.get('/preferences', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM notification_preferences WHERE user_id = ?', [req.user.id]);
    res.json(rows[0] || { email: '', email_enabled: false, bill_days: 3, budget_threshold: 80, debt_days: 7 });
  });
  router.put('/preferences', async (req, res) => {
    const email = cleanText(req.body.email, 254);
    await pool.query(
      `INSERT INTO notification_preferences
        (user_id, email, email_enabled, bill_days, budget_threshold, debt_days)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE email=VALUES(email), email_enabled=VALUES(email_enabled),
         bill_days=VALUES(bill_days), budget_threshold=VALUES(budget_threshold),
         debt_days=VALUES(debt_days)`,
      [
        req.user.id, email || null, Boolean(req.body.email_enabled),
        Number(req.body.bill_days || 3), Number(req.body.budget_threshold || 80),
        Number(req.body.debt_days || 7),
      ],
    );
    res.json({ success: true });
  });
  router.post('/email/test', async (req, res) => {
    const [rows] = await pool.query('SELECT email FROM notification_preferences WHERE user_id = ?', [req.user.id]);
    if (!rows[0]?.email) return res.status(400).json({ error: 'Email tujuan belum diisi' });
    await sendEmail(rows[0].email, '[Local Wallet] Test email', 'Konfigurasi email Local Wallet berhasil.');
    res.json({ success: true });
  });
  router.post('/notifications/refresh', async (req, res) => {
    await generateNotifications(pool, req.user.id);
    res.json({ success: true });
  });
  router.get('/notifications', async (req, res) => {
    const [rows] = await pool.query(
      'SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 100',
      [req.user.id],
    );
    res.json(rows);
  });
  router.put('/notifications/:id/read', async (req, res) => {
    await pool.query('UPDATE notifications SET read_at = NOW() WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    res.json({ success: true });
  });

  router.get('/activity', async (req, res) => {
    const [rows] = await pool.query(
      'SELECT * FROM activity_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 200',
      [req.user.id],
    );
    res.json(rows);
  });
  router.get('/trash', async (req, res) => {
    const [expiredReceipts] = await pool.query(
      `SELECT r.id, r.stored_name
       FROM receipts r
       JOIN trashed_records t
         ON t.user_id = r.user_id
        AND t.table_name = 'expenses'
        AND t.record_id = r.expense_record_id
       WHERE r.user_id = ? AND r.expense_id IS NULL AND t.expires_at <= NOW()`,
      [req.user.id],
    );
    if (expiredReceipts.length) {
      await pool.query(
        `DELETE r FROM receipts r
         JOIN trashed_records t
           ON t.user_id = r.user_id
          AND t.table_name = 'expenses'
          AND t.record_id = r.expense_record_id
         WHERE r.user_id = ? AND r.expense_id IS NULL AND t.expires_at <= NOW()`,
        [req.user.id],
      );
      expiredReceipts.forEach((receipt) => {
        try { unlinkSync(path.join(UPLOAD_DIR, receipt.stored_name)); } catch { /* already absent */ }
      });
    }
    await pool.query('DELETE FROM trashed_records WHERE expires_at <= NOW() AND user_id = ?', [req.user.id]);
    const [rows] = await pool.query(
      'SELECT * FROM trashed_records WHERE user_id = ? ORDER BY deleted_at DESC',
      [req.user.id],
    );
    res.json(rows);
  });
  router.post('/trash/:id/restore', async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        'SELECT * FROM trashed_records WHERE id = ? AND user_id = ? FOR UPDATE',
        [req.params.id, req.user.id],
      );
      const item = rows[0];
      if (!item || !RESTORABLE_TABLES.has(item.table_name)) {
        await connection.rollback();
        return res.status(404).json({ error: 'Trash item not found' });
      }
      const storedPayload = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload;
      const payload = storedPayload.record || storedPayload;
      payload.user_id = req.user.id;
      const keys = Object.keys(payload);
      await connection.query(
        `INSERT INTO ${item.table_name} (${keys.join(', ')})
         VALUES (${keys.map(() => '?').join(', ')})`,
        keys.map((key) => payload[key]),
      );
      if (item.table_name === 'expenses') {
        await connection.query(
          `UPDATE receipts SET expense_id = ?
           WHERE user_id = ? AND expense_record_id = ? AND expense_id IS NULL`,
          [item.record_id, req.user.id, item.record_id],
        );
      }
      if (item.table_name === 'bills' && Array.isArray(storedPayload.billPayments)) {
        for (const payment of storedPayload.billPayments) {
          payment.user_id = req.user.id;
          const paymentKeys = Object.keys(payment);
          await connection.query(
            `INSERT INTO bill_payments (${paymentKeys.join(', ')})
             VALUES (${paymentKeys.map(() => '?').join(', ')})`,
            paymentKeys.map((key) => payment[key]),
          );
        }
      }
      if (item.table_name === 'debts' && Array.isArray(storedPayload.debtPayments)) {
        for (const payment of storedPayload.debtPayments) {
          payment.user_id = req.user.id;
          const paymentKeys = Object.keys(payment);
          await connection.query(
            `INSERT INTO debt_payments (${paymentKeys.join(', ')})
             VALUES (${paymentKeys.map(() => '?').join(', ')})`,
            paymentKeys.map((key) => payment[key]),
          );
        }
      }
      await connection.query('DELETE FROM trashed_records WHERE id = ?', [item.id]);
      await logActivity(connection, req.user.id, 'restore', item.table_name, item.record_id, `Memulihkan ${item.table_name}`);
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback().catch(() => {});
      throw error;
    } finally {
      connection.release();
    }
  });

  router.post('/expenses/:id/receipts', upload.single('receipt'), async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'Receipt file is required' });
    const [expenses] = await pool.query('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!expenses.length) {
      unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Expense not found' });
    }
    const id = uuidv4();
    try {
      await pool.query(
        `INSERT INTO receipts
          (id, user_id, expense_id, expense_record_id, original_name, stored_name, mime_type, size)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id, req.user.id, req.params.id, req.params.id, cleanText(req.file.originalname),
          req.file.filename, req.file.mimetype, req.file.size,
        ],
      );
    } catch (error) {
      try { unlinkSync(req.file.path); } catch { /* already absent */ }
      throw error;
    }
    res.status(201).json({ id, original_name: req.file.originalname });
  });
  router.get('/expenses/:id/receipts', async (req, res) => {
    const [rows] = await pool.query(
      'SELECT id, original_name, mime_type, size, created_at FROM receipts WHERE expense_id = ? AND user_id = ?',
      [req.params.id, req.user.id],
    );
    res.json(rows);
  });
  router.get('/receipts', async (req, res) => {
    const [rows] = await pool.query(
      `SELECT id, expense_id, original_name, mime_type, size, created_at
       FROM receipts WHERE user_id = ? AND expense_id IS NOT NULL
       ORDER BY created_at DESC`,
      [req.user.id],
    );
    res.json(rows);
  });
  router.get('/receipts/:id/file', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Receipt not found' });
    return res.download(path.join(UPLOAD_DIR, rows[0].stored_name), rows[0].original_name);
  });
  router.delete('/receipts/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT * FROM receipts WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Receipt not found' });
    await pool.query('DELETE FROM receipts WHERE id = ?', [req.params.id]);
    try { unlinkSync(path.join(UPLOAD_DIR, rows[0].stored_name)); } catch { /* already absent */ }
    return res.json({ success: true });
  });

  return router;
}
