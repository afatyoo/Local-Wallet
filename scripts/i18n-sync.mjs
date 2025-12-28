import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');

const BASE_LANG = 'id';
const DEFAULT_TARGETS = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko'];

const TARGETS = (process.env.I18N_TARGETS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const targets = TARGETS.length ? TARGETS : DEFAULT_TARGETS;

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf-8');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function main() {
  ensureDir(LOCALES_DIR);

  const baseFile = path.join(LOCALES_DIR, `${BASE_LANG}.json`);
  const base = readJson(baseFile);

  if (!Object.keys(base).length) {
    console.error(`Base locale is empty or missing: ${baseFile}`);
    process.exit(1);
  }

  for (const lang of targets) {
    if (lang === BASE_LANG) continue;
    const file = path.join(LOCALES_DIR, `${lang}.json`);
    const current = readJson(file);

    // Ensure file exists; do NOT overwrite existing translations
    if (!fs.existsSync(file)) {
      writeJson(file, current);
      console.log(`Created: ${path.relative(ROOT, file)}`);
    } else {
      console.log(`OK:      ${path.relative(ROOT, file)}`);
    }
  }
}

main();
