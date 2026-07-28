import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const TOTP_PERIOD_SECONDS = 30;

function normalizeRecoveryCode(code) {
  return String(code || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function deriveKey(keyMaterial) {
  return createHash('sha256').update(keyMaterial).digest();
}

export function encodeBase32(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }

  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function decodeBase32(secret) {
  const normalized = String(secret || '').replace(/[\s=-]/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const output = [];

  for (const character of normalized) {
    const index = BASE32_ALPHABET.indexOf(character);
    if (index < 0) throw new Error('Invalid Base32 secret');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }

  return Buffer.from(output);
}

export function generateTotpSecret() {
  return encodeBase32(randomBytes(20));
}

export function generateTotp(secret, timestamp = Date.now()) {
  const counter = Math.floor(timestamp / 1000 / TOTP_PERIOD_SECONDS);
  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigUInt64BE(BigInt(counter));

  const digest = createHmac('sha1', decodeBase32(secret)).update(counterBuffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotp(secret, code, options = {}) {
  const normalized = String(code || '').replace(/\s/g, '');
  if (!/^\d{6}$/.test(normalized)) return false;

  const timestamp = options.timestamp ?? Date.now();
  const window = options.window ?? 1;
  const submitted = Buffer.from(normalized);

  for (let offset = -window; offset <= window; offset += 1) {
    const expected = Buffer.from(
      generateTotp(secret, timestamp + offset * TOTP_PERIOD_SECONDS * 1000),
    );
    if (timingSafeEqual(submitted, expected)) return true;
  }
  return false;
}

export function createOtpAuthUri(username, secret) {
  const issuer = 'My Local Wallet';
  const label = encodeURIComponent(`${issuer}:${username}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function encryptTotpSecret(secret, keyMaterial) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveKey(keyMaterial), iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptTotpSecret(payload, keyMaterial) {
  const [version, ivValue, tagValue, encryptedValue] = String(payload || '').split('.');
  if (version !== 'v1' || !ivValue || !tagValue || !encryptedValue) {
    throw new Error('Invalid encrypted TFA secret');
  }

  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveKey(keyMaterial),
    Buffer.from(ivValue, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function generateRecoveryCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const raw = randomBytes(5).toString('hex').toUpperCase();
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function hashRecoveryCode(code, keyMaterial) {
  return createHmac('sha256', deriveKey(keyMaterial))
    .update(normalizeRecoveryCode(code))
    .digest('base64url');
}

export function findRecoveryCodeIndex(code, hashes, keyMaterial) {
  const submitted = Buffer.from(hashRecoveryCode(code, keyMaterial));
  return hashes.findIndex((hash) => {
    const expected = Buffer.from(String(hash));
    return submitted.length === expected.length && timingSafeEqual(submitted, expected);
  });
}
