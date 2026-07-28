import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBackupData } from '../src/lib/backupSchema.ts';

function validBackup() {
  return {
    version: 3,
    exportDate: '2026-07-28T00:00:00.000Z',
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

test('accepts a valid version 3 backup', () => {
  const parsed = parseBackupData(JSON.stringify(validBackup()));
  assert.equal(parsed.version, 3);
  assert.deepEqual(parsed.savingsTargets, []);
});

test('keeps version 2 backups compatible and defaults savings targets', () => {
  const backup = validBackup();
  backup.version = 2;
  delete (backup as Partial<typeof backup>).savingsTargets;

  const parsed = parseBackupData(JSON.stringify(backup));
  assert.deepEqual(parsed.savingsTargets, []);
});

test('rejects malformed collection data', () => {
  const backup = validBackup();
  backup.incomes = [{ jumlah: -1 }] as typeof backup.incomes;

  assert.throws(
    () => parseBackupData(JSON.stringify(backup)),
    /Invalid backup/,
  );
});

test('rejects unknown root fields', () => {
  assert.throws(
    () => parseBackupData(JSON.stringify({ ...validBackup(), admin: true })),
    /Unrecognized key/,
  );
});
