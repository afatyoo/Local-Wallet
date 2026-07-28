import test from 'node:test';
import assert from 'node:assert/strict';
import {
  decryptTotpSecret,
  encryptTotpSecret,
  findRecoveryCodeIndex,
  generateRecoveryCodes,
  generateTotp,
  hashRecoveryCode,
  verifyTotp,
} from './twoFactor.js';

const RFC_SECRET = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

test('TOTP implementation matches the RFC 6238 SHA-1 test secret', () => {
  assert.equal(generateTotp(RFC_SECRET, 59_000), '287082');
  assert.equal(verifyTotp(RFC_SECRET, '287082', { timestamp: 59_000, window: 0 }), true);
  assert.equal(verifyTotp(RFC_SECRET, '287083', { timestamp: 59_000, window: 0 }), false);
});

test('encrypted TFA secrets round-trip and reject the wrong key', () => {
  const encrypted = encryptTotpSecret(RFC_SECRET, 'correct-key');
  assert.equal(decryptTotpSecret(encrypted, 'correct-key'), RFC_SECRET);
  assert.throws(() => decryptTotpSecret(encrypted, 'wrong-key'));
});

test('recovery codes are unique and can be found from their hashes', () => {
  const codes = generateRecoveryCodes();
  const hashes = codes.map(code => hashRecoveryCode(code, 'recovery-key'));

  assert.equal(codes.length, 8);
  assert.equal(new Set(codes).size, 8);
  assert.equal(findRecoveryCodeIndex(codes[3].toLowerCase(), hashes, 'recovery-key'), 3);
  assert.equal(findRecoveryCodeIndex('WRONG-CODE', hashes, 'recovery-key'), -1);
});
