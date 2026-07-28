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

test('accepts planning records in a version 4 backup', () => {
  const backup = {
    ...validBackup(),
    version: 4,
    netWorthItems: [{
      id: 'worth-1',
      userId: 'user-1',
      type: 'asset',
      name: 'Emergency cash',
      category: 'Cash',
      value: 500,
      asOfDate: '2026-07-28',
      notes: '',
    }],
    debts: [{
      id: 'debt-1',
      userId: 'user-1',
      direction: 'owed',
      name: 'Loan',
      principal: 1000,
      remaining: 750,
      interestRate: 0,
      status: 'active',
      notes: '',
    }],
    debtPayments: [{
      id: 'debt-payment-1',
      userId: 'user-1',
      debtId: 'debt-1',
      amount: 250,
      paidAt: '2026-07-28',
      notes: '',
    }],
    categorizationRules: [{
      id: 'rule-1',
      userId: 'user-1',
      transactionType: 'expense',
      pattern: 'market',
      category: 'Groceries',
      priority: 0,
      active: true,
    }],
  };

  const parsed = parseBackupData(JSON.stringify(backup));
  assert.equal(parsed.version, 4);
  assert.equal(parsed.debtPayments[0].debtId, 'debt-1');
});

test('rejects debt payments with unknown debt references', () => {
  const backup = {
    ...validBackup(),
    version: 4,
    netWorthItems: [],
    debts: [],
    categorizationRules: [],
    debtPayments: [{
      id: 'debt-payment-1',
      userId: 'user-1',
      debtId: 'missing',
      amount: 250,
      paidAt: '2026-07-28',
      notes: '',
    }],
  };

  assert.throws(
    () => parseBackupData(JSON.stringify(backup)),
    /unknown debt/,
  );
});
