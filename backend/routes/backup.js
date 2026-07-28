import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { parseBackup } from '../backupSchema.js';
import { normalizeMysqlDatetime } from '../validation.js';

const CHUNK_SIZE = 500;

async function insertRows(connection, table, columns, rows) {
  for (let offset = 0; offset < rows.length; offset += CHUNK_SIZE) {
    const chunk = rows.slice(offset, offset + CHUNK_SIZE);
    if (!chunk.length) continue;
    const placeholders = chunk
      .map(() => `(${columns.map(() => '?').join(', ')})`)
      .join(', ');
    await connection.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${placeholders}`,
      chunk.flat(),
    );
  }
}

export function createBackupRouter({ pool, authenticate }) {
  const router = express.Router();
  router.use(authenticate);

  router.put('/restore', async (req, res) => {
    let backup;
    try {
      backup = parseBackup(req.body);
    } catch (error) {
      return res.status(error.statusCode || 400).json({ error: error.message });
    }

    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const userId = req.user.id;

      await connection.query('DELETE FROM bill_payments WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM expenses WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM incomes WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM budgets WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM savings_targets WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM master_data WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM bills WHERE user_id = ?', [userId]);
      await connection.query('DELETE FROM savings WHERE user_id = ?', [userId]);

      const savingIds = new Map(backup.savings.map((item) => [item.id, uuidv4()]));
      const billIds = new Map(backup.bills.map((item) => [item.id, uuidv4()]));
      const paymentIds = new Map(backup.billPayments.map((item) => [item.id, uuidv4()]));

      await insertRows(
        connection,
        'savings',
        ['id', 'user_id', 'tanggal', 'jenis', 'nama_akun', 'setoran', 'penarikan', 'catatan'],
        backup.savings.map((item) => [
          savingIds.get(item.id), userId, item.tanggal, item.jenis, item.namaAkun,
          item.setoran, item.penarikan, item.catatan,
        ]),
      );
      await insertRows(
        connection,
        'bills',
        [
          'id', 'user_id', 'nama', 'kategori', 'jumlah', 'tanggal_jatuh_tempo',
          'mulai_dari', 'sampai_dengan', 'catatan', 'is_active',
        ],
        backup.bills.map((item) => [
          billIds.get(item.id), userId, item.nama, item.kategori, item.jumlah,
          item.tanggalJatuhTempo, item.mulaiDari, item.sampaiDengan, item.catatan,
          item.isActive,
        ]),
      );
      await insertRows(
        connection,
        'bill_payments',
        ['id', 'bill_id', 'user_id', 'bulan', 'dibayar_pada', 'jumlah_dibayar'],
        backup.billPayments.map((item) => [
          paymentIds.get(item.id), billIds.get(item.billId), userId, item.bulan,
          normalizeMysqlDatetime(item.dibayarPada), item.jumlahDibayar,
        ]),
      );
      await insertRows(
        connection,
        'incomes',
        [
          'id', 'user_id', 'tanggal', 'bulan', 'sumber', 'kategori', 'metode',
          'jumlah', 'catatan', 'saving_id',
        ],
        backup.incomes.map((item) => [
          uuidv4(), userId, item.tanggal, item.bulan, item.sumber, item.kategori,
          item.metode, item.jumlah, item.catatan,
          item.savingId ? savingIds.get(item.savingId) : null,
        ]),
      );
      await insertRows(
        connection,
        'expenses',
        [
          'id', 'user_id', 'tanggal', 'bulan', 'nama', 'kategori', 'metode',
          'jumlah', 'catatan', 'bill_payment_id', 'saving_id',
        ],
        backup.expenses.map((item) => [
          uuidv4(), userId, item.tanggal, item.bulan, item.nama, item.kategori,
          item.metode, item.jumlah, item.catatan,
          item.billPaymentId ? paymentIds.get(item.billPaymentId) : null,
          item.savingId ? savingIds.get(item.savingId) : null,
        ]),
      );
      await insertRows(
        connection,
        'budgets',
        ['id', 'user_id', 'bulan', 'kategori', 'anggaran'],
        backup.budgets.map((item) => [
          uuidv4(), userId, item.bulan, item.kategori, item.anggaran,
        ]),
      );
      await insertRows(
        connection,
        'savings_targets',
        [
          'id', 'user_id', 'nama_target', 'target_amount', 'start_date',
          'target_date', 'linked_account',
        ],
        backup.savingsTargets.map((item) => [
          uuidv4(), userId, item.namaTarget, item.targetAmount, item.startDate,
          item.targetDate, item.linkedAccount,
        ]),
      );
      await insertRows(
        connection,
        'master_data',
        ['id', 'user_id', 'type', 'value'],
        backup.masterData.map((item) => [uuidv4(), userId, item.type, item.value]),
      );

      await connection.commit();
      res.json({
        success: true,
        restoredRecords:
          backup.incomes.length
          + backup.expenses.length
          + backup.budgets.length
          + backup.savings.length
          + backup.savingsTargets.length
          + backup.masterData.length
          + backup.bills.length
          + backup.billPayments.length,
      });
    } catch (error) {
      await connection.rollback().catch(() => {});
      console.error('Backup restore error:', error);
      res.status(500).json({ error: 'Backup restore failed; existing data was preserved' });
    } finally {
      connection.release();
    }
  });

  return router;
}
