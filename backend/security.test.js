import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { hasValidFileSignature } from './fileValidation.js';
import { validatePassword } from './passwordPolicy.js';
import { authRateLimitKey } from './rateLimitStore.js';

test('password policy consistently requires 12 mixed-case alphanumeric characters', () => {
  assert.match(validatePassword('Short1'), /12/);
  assert.match(validatePassword('alllowercase123'), /uppercase/);
  assert.match(validatePassword('ALLUPPERCASE123'), /lowercase/);
  assert.match(validatePassword('MixedCaseOnly'), /number/);
  assert.equal(validatePassword('CorrectHorse1'), null);
});

test('auth rate-limit key includes endpoint, normalized IP, and account identifier', () => {
  const request = {
    ip: '127.0.0.1',
    path: '/api/auth/login',
    body: { username: ' Owner ' },
  };
  assert.equal(authRateLimitKey(request), authRateLimitKey({
    ...request,
    body: { username: 'owner' },
  }));
  assert.notEqual(authRateLimitKey(request), authRateLimitKey({
    ...request,
    body: { username: 'another-user' },
  }));
});

test('receipt validation checks file bytes instead of trusting MIME metadata', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'wallet-security-'));
  const validPdf = path.join(directory, 'valid.pdf');
  const fakePdf = path.join(directory, 'fake.pdf');
  try {
    await writeFile(validPdf, Buffer.from('%PDF-1.7\n'));
    await writeFile(fakePdf, Buffer.from('<script>alert(1)</script>'));
    assert.equal(await hasValidFileSignature(validPdf, 'application/pdf'), true);
    assert.equal(await hasValidFileSignature(fakePdf, 'application/pdf'), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
