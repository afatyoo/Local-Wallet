import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function columnExists(connection, table, column) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column],
  );
  return rows.length > 0;
}

async function indexExists(connection, table, index) {
  const [rows] = await connection.query(
    `SELECT 1
     FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
    [table, index],
  );
  return rows.length > 0;
}

async function addIndex(connection, table, index, columns, unique = false) {
  if (await indexExists(connection, table, index)) return;
  await connection.query(
    `CREATE ${unique ? 'UNIQUE ' : ''}INDEX ${index} ON ${table} (${columns})`,
  );
}

const migrations = [
  {
    id: '001_initial_schema',
    up: async (connection) => {
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
    },
  },
  {
    id: '002_legacy_user_columns',
    up: async (connection) => {
      const columns = [
        ['role', "ALTER TABLE users ADD COLUMN role ENUM('admin','user') NOT NULL DEFAULT 'user' AFTER password_hash"],
        ['tfa_secret', 'ALTER TABLE users ADD COLUMN tfa_secret TEXT NULL AFTER role'],
        ['tfa_enabled', 'ALTER TABLE users ADD COLUMN tfa_enabled BOOLEAN NOT NULL DEFAULT FALSE AFTER tfa_secret'],
        ['tfa_recovery_codes', 'ALTER TABLE users ADD COLUMN tfa_recovery_codes JSON NULL AFTER tfa_enabled'],
      ];
      for (const [column, sql] of columns) {
        if (!(await columnExists(connection, 'users', column))) {
          await connection.query(sql);
        }
      }
    },
  },
  {
    id: '003_server_sessions',
    up: async (connection) => {
      await connection.query(`
        CREATE TABLE IF NOT EXISTS sessions (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          token_hash CHAR(64) UNIQUE NOT NULL,
          csrf_hash CHAR(64) NOT NULL,
          expires_at DATETIME NOT NULL,
          ip_address VARCHAR(64) NULL,
          user_agent VARCHAR(255) NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await addIndex(connection, 'sessions', 'idx_sessions_user', 'user_id');
      await addIndex(connection, 'sessions', 'idx_sessions_expiry', 'expires_at');
    },
  },
  {
    id: '004_finance_indexes',
    up: async (connection) => {
      await addIndex(connection, 'incomes', 'idx_incomes_user_month', 'user_id, bulan');
      await addIndex(connection, 'incomes', 'idx_incomes_user_date', 'user_id, tanggal');
      await addIndex(connection, 'expenses', 'idx_expenses_user_month', 'user_id, bulan');
      await addIndex(connection, 'expenses', 'idx_expenses_user_date', 'user_id, tanggal');
      await addIndex(connection, 'budgets', 'idx_budgets_user_month', 'user_id, bulan');
      await addIndex(connection, 'savings', 'idx_savings_user_date', 'user_id, tanggal');
      await addIndex(connection, 'savings_targets', 'idx_targets_user_dates', 'user_id, start_date, target_date');
      await addIndex(connection, 'master_data', 'idx_master_user_type', 'user_id, type');
      await addIndex(connection, 'bills', 'idx_bills_user_active', 'user_id, is_active');
      await addIndex(connection, 'bill_payments', 'idx_payments_user_month', 'user_id, bulan');
      await addIndex(connection, 'bill_payments', 'uq_payments_bill_month', 'bill_id, bulan', true);
    },
  },
  {
    id: '005_planning_and_activity',
    up: async (connection) => {
      if (!(await columnExists(connection, 'budgets', 'rollover'))) {
        await connection.query(
          'ALTER TABLE budgets ADD COLUMN rollover BOOLEAN NOT NULL DEFAULT FALSE AFTER anggaran',
        );
      }
      await connection.query(`
        CREATE TABLE IF NOT EXISTS net_worth_items (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          type ENUM('asset','liability') NOT NULL,
          name VARCHAR(100) NOT NULL,
          category VARCHAR(50) NOT NULL,
          value DECIMAL(15,2) NOT NULL,
          as_of_date VARCHAR(10) NOT NULL,
          notes TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS debts (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          direction ENUM('owed','receivable') NOT NULL DEFAULT 'owed',
          name VARCHAR(100) NOT NULL,
          principal DECIMAL(15,2) NOT NULL,
          remaining DECIMAL(15,2) NOT NULL,
          interest_rate DECIMAL(7,3) NOT NULL DEFAULT 0,
          due_date VARCHAR(10) NULL,
          status ENUM('active','paid') NOT NULL DEFAULT 'active',
          notes TEXT,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS debt_payments (
          id VARCHAR(36) PRIMARY KEY,
          debt_id VARCHAR(36) NOT NULL,
          user_id VARCHAR(36) NOT NULL,
          amount DECIMAL(15,2) NOT NULL,
          paid_at VARCHAR(10) NOT NULL,
          notes TEXT,
          FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS categorization_rules (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          transaction_type ENUM('expense','income') NOT NULL DEFAULT 'expense',
          pattern VARCHAR(100) NOT NULL,
          category VARCHAR(100) NOT NULL,
          priority INT NOT NULL DEFAULT 0,
          active BOOLEAN NOT NULL DEFAULT TRUE,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS notification_preferences (
          user_id VARCHAR(36) PRIMARY KEY,
          email VARCHAR(254) NULL,
          email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          bill_days INT NOT NULL DEFAULT 3,
          budget_threshold INT NOT NULL DEFAULT 80,
          debt_days INT NOT NULL DEFAULT 7,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS notifications (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          type VARCHAR(30) NOT NULL,
          title VARCHAR(150) NOT NULL,
          message TEXT NOT NULL,
          dedupe_key VARCHAR(190) NOT NULL,
          read_at DATETIME NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uq_notification_user_key (user_id, dedupe_key),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS receipts (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          expense_id VARCHAR(36) NOT NULL,
          original_name VARCHAR(255) NOT NULL,
          stored_name VARCHAR(100) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          size INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS activity_log (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          action VARCHAR(30) NOT NULL,
          entity_type VARCHAR(50) NOT NULL,
          entity_id VARCHAR(36) NULL,
          summary VARCHAR(255) NOT NULL,
          payload JSON NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await connection.query(`
        CREATE TABLE IF NOT EXISTS trashed_records (
          id VARCHAR(36) PRIMARY KEY,
          user_id VARCHAR(36) NOT NULL,
          table_name VARCHAR(50) NOT NULL,
          record_id VARCHAR(36) NOT NULL,
          payload JSON NOT NULL,
          deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          expires_at DATETIME NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);
      await addIndex(connection, 'net_worth_items', 'idx_net_worth_user_date', 'user_id, as_of_date');
      await addIndex(connection, 'debts', 'idx_debts_user_status_due', 'user_id, status, due_date');
      await addIndex(connection, 'categorization_rules', 'idx_rules_user_type', 'user_id, transaction_type, priority');
      await addIndex(connection, 'notifications', 'idx_notifications_user_read', 'user_id, read_at, created_at');
      await addIndex(connection, 'activity_log', 'idx_activity_user_created', 'user_id, created_at');
      await addIndex(connection, 'trashed_records', 'idx_trash_user_expiry', 'user_id, expires_at');
    },
  },
  {
    id: '006_receipt_trash_support',
    up: async (connection) => {
      if (!(await columnExists(connection, 'receipts', 'expense_record_id'))) {
        await connection.query(
          'ALTER TABLE receipts ADD COLUMN expense_record_id VARCHAR(36) NULL AFTER expense_id',
        );
      }
      await connection.query(
        'UPDATE receipts SET expense_record_id = expense_id WHERE expense_record_id IS NULL',
      );
      await connection.query(
        'ALTER TABLE receipts MODIFY expense_record_id VARCHAR(36) NOT NULL',
      );

      const [foreignKeys] = await connection.query(
        `SELECT CONSTRAINT_NAME
         FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'receipts'
           AND COLUMN_NAME = 'expense_id'
           AND REFERENCED_TABLE_NAME = 'expenses'`,
      );
      for (const foreignKey of foreignKeys) {
        const constraint = String(foreignKey.CONSTRAINT_NAME).replaceAll('`', '``');
        await connection.query(`ALTER TABLE receipts DROP FOREIGN KEY \`${constraint}\``);
      }
      await connection.query('ALTER TABLE receipts MODIFY expense_id VARCHAR(36) NULL');
      await connection.query(
        `ALTER TABLE receipts
         ADD CONSTRAINT fk_receipts_expense
         FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE SET NULL`,
      );
      await addIndex(
        connection,
        'receipts',
        'idx_receipts_user_record',
        'user_id, expense_record_id',
      );
    },
  },
];

async function runMigrations(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id VARCHAR(100) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const [appliedRows] = await connection.query('SELECT id FROM schema_migrations');
  const applied = new Set(appliedRows.map((row) => row.id));

  for (const migration of migrations) {
    if (applied.has(migration.id)) continue;
    await migration.up(connection);
    await connection.query('INSERT INTO schema_migrations (id) VALUES (?)', [migration.id]);
    console.log(`Migration applied: ${migration.id}`);
  }
}

async function ensureDefaultAdmin(connection) {
  const [existingAdmin] = await connection.query(
    'SELECT id, role FROM users WHERE username = ?',
    ['admin'],
  );
  if (existingAdmin.length === 0) {
    const adminHash = await bcrypt.hash('admin', 10);
    await connection.query(
      'INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), 'admin', adminHash, 'admin'],
    );
    console.log('Default admin user created (username: admin, password: admin)');
  } else if (existingAdmin[0].role !== 'admin') {
    const adminHash = await bcrypt.hash('admin', 10);
    await connection.query(
      'UPDATE users SET role = ?, password_hash = ? WHERE username = ?',
      ['admin', adminHash, 'admin'],
    );
    console.log('Existing admin user promoted to admin role with default password');
  }
}

export async function initializeDatabase(pool) {
  const connection = await pool.getConnection();
  try {
    await runMigrations(connection);
    await ensureDefaultAdmin(connection);
    console.log('Database initialized successfully');
  } finally {
    connection.release();
  }
}
