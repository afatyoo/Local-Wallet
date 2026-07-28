const FORMAT = 'local-wallet-encrypted-backup';
const ITERATIONS = 310_000;

interface EncryptedBackup {
  format: typeof FORMAT;
  version: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function deriveKey(password: string, salt: Uint8Array, usage: KeyUsage[]) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt,
      iterations: ITERATIONS,
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    usage,
  );
}

export async function encryptBackup(plainText: string, password: string): Promise<string> {
  if (password.length < 8) {
    throw new Error('Backup password must be at least 8 characters');
  }
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ['encrypt']);
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plainText),
  );
  const envelope: EncryptedBackup = {
    format: FORMAT,
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: toBase64(salt),
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
  return JSON.stringify(envelope, null, 2);
}

export function isEncryptedBackup(value: string): boolean {
  try {
    return JSON.parse(value)?.format === FORMAT;
  } catch {
    return false;
  }
}

export async function decryptBackup(value: string, password: string): Promise<string> {
  if (!isEncryptedBackup(value)) return value;
  if (!password) throw new Error('Backup password is required');

  const envelope = JSON.parse(value) as EncryptedBackup;
  if (
    envelope.version !== 1
    || envelope.kdf !== 'PBKDF2-SHA256'
    || envelope.iterations !== ITERATIONS
  ) {
    throw new Error('Unsupported encrypted backup format');
  }

  try {
    const salt = fromBase64(envelope.salt);
    const iv = fromBase64(envelope.iv);
    const key = await deriveKey(password, salt, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      fromBase64(envelope.ciphertext),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error('Backup password is incorrect or the file is damaged');
  }
}
