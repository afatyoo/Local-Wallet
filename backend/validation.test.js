import test from 'node:test';
import assert from 'node:assert/strict';
import { VALIDATORS, pickColumns, sanitizePayload } from './validation.js';

test('pickColumns ignores fields outside the allowlist', () => {
  assert.deepEqual(
    pickColumns({ nama: 'Valid', user_id: 'spoofed', role: 'admin' }, ['nama']),
    { nama: 'Valid' },
  );
});

test('sanitizePayload strips markup and trims user text', () => {
  assert.deepEqual(
    sanitizePayload({ nama: '  <b>Target</b>  ', jumlah: 100 }),
    { nama: 'Target', jumlah: 100 },
  );
});

test('transaction validators reject malformed dates and non-finite numbers', () => {
  const base = {
    tanggal: '2026-02-30',
    sumber: 'Salary',
    kategori: 'Income',
    metode: 'Transfer',
    jumlah: 'Infinity',
  };

  assert.equal(VALIDATORS.incomes(base), 'tanggal harus format YYYY-MM-DD');
  assert.equal(
    VALIDATORS.incomes({ ...base, tanggal: '2026-02-28' }),
    'jumlah harus berupa angka >= 0',
  );
});

test('savings target requires a positive amount and ordered dates', () => {
  const target = {
    nama_target: 'Emergency fund',
    target_amount: 1000000,
    start_date: '2026-07-01',
    target_date: '2026-06-01',
    linked_account: 'Main savings',
  };

  assert.equal(
    VALIDATORS.savings_targets(target),
    'target_date tidak boleh sebelum start_date',
  );
  assert.equal(
    VALIDATORS.savings_targets({ ...target, target_date: '2026-12-01', target_amount: 0 }),
    'target_amount harus berupa angka > 0',
  );
  assert.equal(
    VALIDATORS.savings_targets({ ...target, target_date: '2026-12-01' }),
    null,
  );
});
