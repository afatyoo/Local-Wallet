import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../src/lib/backupCrypto.ts';

test('encrypted backups round-trip and reject the wrong password', async () => {
  const plainText = JSON.stringify({ version: 3, secret: 'financial data' });
  const encrypted = await encryptBackup(plainText, 'correct-password');
  assert.equal(isEncryptedBackup(encrypted), true);
  assert.equal(await decryptBackup(encrypted, 'correct-password'), plainText);
  await assert.rejects(
    () => decryptBackup(encrypted, 'wrong-password'),
    /incorrect or the file is damaged/,
  );
});

test('plain JSON backups remain compatible', async () => {
  const plainText = JSON.stringify({ version: 3 });
  assert.equal(await decryptBackup(plainText, ''), plainText);
});
