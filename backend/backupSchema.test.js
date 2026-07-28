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

test('backend accepts version 4 planning records', () => {
  const backup = {
    ...emptyBackup(),
    version: 4,
    netWorthItems: [],
    debts: [{
      id: 'debt-1',
      userId: 'old-user',
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
      userId: 'old-user',
      debtId: 'debt-1',
      amount: 250,
      paidAt: '2026-07-28',
      notes: '',
    }],
    categorizationRules: [],
  };

  assert.equal(parseBackup(backup).debtPayments.length, 1);
});

test('backend rejects unknown debt references', () => {
  const backup = {
    ...emptyBackup(),
    version: 4,
    debtPayments: [{
      id: 'debt-payment-1',
      userId: 'old-user',
      debtId: 'missing',
      amount: 250,
      paidAt: '2026-07-28',
      notes: '',
    }],
  };

  assert.throws(() => parseBackup(backup), /Unknown debt reference/);
});
