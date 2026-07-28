import assert from 'node:assert/strict';
import test from 'node:test';
import { parseBackup } from './backupSchema.js';

function emptyBackup() {
  return {
    version: 3,
    exportDate: new Date().toISOString(),
    incomes: [],
    expenses: [],
    budgets: [],
    savings: [],
    savingsTargets: [],
    masterData: [],
    bills: [],
    billPayments: [],
  };
}

test('backend accepts a complete empty backup', () => {
  assert.equal(parseBackup(emptyBackup()).version, 3);
});

test('backend rejects broken financial references', () => {
  const backup = emptyBackup();
  backup.billPayments.push({
    id: 'payment-1',
    userId: 'old-user',
    billId: 'missing-bill',
    bulan: '2026-07',
    dibayarPada: '2026-07-01T00:00:00.000Z',
    jumlahDibayar: 100,
  });
  assert.throws(() => parseBackup(backup), /Unknown bill reference/);
});
