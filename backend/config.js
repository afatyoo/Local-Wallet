import { readFileSync } from 'node:fs';

export function readSecret(name) {
  const filePath = process.env[`${name}_FILE`]?.trim();
  if (filePath) {
    return readFileSync(filePath, 'utf8').trim();
  }
  return process.env[name]?.trim() || '';
}
