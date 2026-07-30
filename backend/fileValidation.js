import { open } from 'node:fs/promises';

const SIGNATURES = {
  'image/jpeg': (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  'image/png': (bytes) =>
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (bytes) =>
    bytes.subarray(0, 4).toString('ascii') === 'RIFF'
    && bytes.subarray(8, 12).toString('ascii') === 'WEBP',
  'application/pdf': (bytes) => bytes.subarray(0, 5).toString('ascii') === '%PDF-',
};

export const RECEIPT_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

export async function hasValidFileSignature(filePath, mimeType) {
  const matches = SIGNATURES[mimeType];
  if (!matches) return false;

  const handle = await open(filePath, 'r');
  try {
    const bytes = Buffer.alloc(16);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    return bytesRead >= 5 && matches(bytes.subarray(0, bytesRead));
  } finally {
    await handle.close();
  }
}
