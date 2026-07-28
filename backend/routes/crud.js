import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  normalizeMysqlDatetime,
  pickColumns,
  sanitizePayload,
  VALIDATORS,
} from '../validation.js';

const TABLES = {
  incomes: ['user_id', 'tanggal', 'bulan', 'sumber', 'kategori', 'metode', 'jumlah', 'catatan', 'saving_id'],
  expenses: ['user_id', 'tanggal', 'bulan', 'nama', 'kategori', 'metode', 'jumlah', 'catatan', 'bill_payment_id', 'saving_id'],
  budgets: ['user_id', 'bulan', 'kategori', 'anggaran', 'rollover'],
  savings: ['user_id', 'tanggal', 'jenis', 'nama_akun', 'setoran', 'penarikan', 'catatan'],
  savings_targets: ['user_id', 'nama_target', 'target_amount', 'start_date', 'target_date', 'linked_account'],
  master_data: ['user_id', 'type', 'value'],
  bills: ['user_id', 'nama', 'kategori', 'jumlah', 'tanggal_jatuh_tempo', 'mulai_dari', 'sampai_dengan', 'catatan', 'is_active'],
  bill_payments: ['bill_id', 'user_id', 'bulan', 'dibayar_pada', 'jumlah_dibayar'],
};

async function validateOwnedReferences(pool, tableName, payload, userId) {
  const references = [];
  if (payload.saving_id) references.push(['savings', payload.saving_id, 'saving_id']);
  if (payload.bill_payment_id) {
    references.push(['bill_payments', payload.bill_payment_id, 'bill_payment_id']);
  }
  if (tableName === 'bill_payments' && payload.bill_id) {
    references.push(['bills', payload.bill_id, 'bill_id']);
  }

  for (const [table, id, field] of references) {
    const [rows] = await pool.query(
      `SELECT id FROM ${table} WHERE id = ? AND user_id = ?`,
      [id, userId],
    );
    if (rows.length === 0) return `${field} tidak valid`;
  }
  return null;
}

function addTableRoutes(router, pool, tableName, columns) {
  router.get(`/${tableName}`, async (req, res) => {
    try {
      const [rows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE user_id = ?`,
        [req.user.id],
      );
      res.json(rows);
    } catch (error) {
      console.error(`GET /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post(`/${tableName}`, async (req, res) => {
    try {
      const id = uuidv4();
      let payload = pickColumns(req.body || {}, columns);
      payload.user_id = req.user.id;
      payload = sanitizePayload(payload);

      const validationError = VALIDATORS[tableName]?.(payload);
      if (validationError) return res.status(400).json({ error: validationError });
      const referenceError = await validateOwnedReferences(
        pool,
        tableName,
        payload,
        req.user.id,
      );
      if (referenceError) return res.status(400).json({ error: referenceError });
      if (payload.dibayar_pada) {
        payload.dibayar_pada = normalizeMysqlDatetime(payload.dibayar_pada);
      }

      const data = { id, ...payload };
      const keys = Object.keys(data);
      await pool.query(
        `INSERT INTO ${tableName} (${keys.join(', ')})
         VALUES (${keys.map(() => '?').join(', ')})`,
        Object.values(data),
      );
      await pool.query(
        `INSERT INTO activity_log
          (id, user_id, action, entity_type, entity_id, summary, payload)
         VALUES (?, ?, 'create', ?, ?, ?, ?)`,
        [uuidv4(), req.user.id, tableName, id, `Menambahkan ${tableName}`, JSON.stringify(data)],
      );
      const [createdRows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [id, req.user.id],
      );
      res.status(201).json(createdRows[0]);
    } catch (error) {
      console.error(`POST /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.put(`/${tableName}/:id`, async (req, res) => {
    try {
      const [existing] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
      );
      if (!existing.length) return res.status(404).json({ error: 'Record not found' });

      let payload = pickColumns(req.body || {}, columns);
      delete payload.user_id;
      payload = sanitizePayload(payload);
      const merged = { ...existing[0], ...payload, user_id: req.user.id };
      const validationError = VALIDATORS[tableName]?.(merged);
      if (validationError) return res.status(400).json({ error: validationError });
      const referenceError = await validateOwnedReferences(
        pool,
        tableName,
        merged,
        req.user.id,
      );
      if (referenceError) return res.status(400).json({ error: referenceError });
      if (payload.dibayar_pada) {
        payload.dibayar_pada = normalizeMysqlDatetime(payload.dibayar_pada);
      }

      const keys = Object.keys(payload);
      if (!keys.length) return res.status(400).json({ error: 'No valid fields to update' });
      await pool.query(
        `UPDATE ${tableName}
         SET ${keys.map((key) => `${key} = ?`).join(', ')}
         WHERE id = ? AND user_id = ?`,
        [...keys.map((key) => payload[key]), req.params.id, req.user.id],
      );
      await pool.query(
        `INSERT INTO activity_log
          (id, user_id, action, entity_type, entity_id, summary, payload)
         VALUES (?, ?, 'update', ?, ?, ?, ?)`,
        [uuidv4(), req.user.id, tableName, req.params.id, `Memperbarui ${tableName}`, JSON.stringify(payload)],
      );
      const [updatedRows] = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
      );
      res.json(updatedRows[0]);
    } catch (error) {
      console.error(`PUT /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.delete(`/${tableName}/:id`, async (req, res) => {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const [rows] = await connection.query(
        `SELECT * FROM ${tableName} WHERE id = ? AND user_id = ? FOR UPDATE`,
        [req.params.id, req.user.id],
      );
      if (!rows.length) {
        await connection.rollback();
        return res.status(404).json({ error: 'Record not found' });
      }
      let trashPayload = rows[0];
      if (tableName === 'bills') {
        const [billPayments] = await connection.query(
          'SELECT * FROM bill_payments WHERE bill_id = ? AND user_id = ?',
          [req.params.id, req.user.id],
        );
        trashPayload = { record: rows[0], billPayments };
      }
      await connection.query(
        `INSERT INTO trashed_records
          (id, user_id, table_name, record_id, payload, expires_at)
         VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))`,
        [uuidv4(), req.user.id, tableName, req.params.id, JSON.stringify(trashPayload)],
      );
      await connection.query(
        `INSERT INTO activity_log
          (id, user_id, action, entity_type, entity_id, summary, payload)
         VALUES (?, ?, 'delete', ?, ?, ?, ?)`,
        [uuidv4(), req.user.id, tableName, req.params.id, `Menghapus ${tableName}`, JSON.stringify(rows[0])],
      );
      await connection.query(
        `DELETE FROM ${tableName} WHERE id = ? AND user_id = ?`,
        [req.params.id, req.user.id],
      );
      await connection.commit();
      res.json({ success: true });
    } catch (error) {
      await connection.rollback().catch(() => {});
      console.error(`DELETE /${tableName} error:`, error);
      res.status(500).json({ error: 'Internal server error' });
    } finally {
      connection.release();
    }
  });
}

export function createCrudRouter({ pool, authenticate }) {
  const router = express.Router();
  router.use(authenticate);
  Object.entries(TABLES).forEach(([tableName, columns]) => {
    addTableRoutes(router, pool, tableName, columns);
  });
  return router;
}
