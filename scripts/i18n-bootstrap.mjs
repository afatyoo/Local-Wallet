import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();

// Inputs
const BASE_FILE = process.env.BASE_FILE || path.join(ROOT, 'src', 'locales', 'id.json');
const OUT_DIR = process.env.OUT_DIR || path.join(ROOT, 'public', 'locales');
const META_FILE = path.join(OUT_DIR, '.i18n-meta.json');

const BASE_LANG = 'id';
const DEFAULT_TARGETS = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko'];
const TARGETS = (process.env.I18N_TARGETS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const targets = TARGETS.length ? TARGETS : DEFAULT_TARGETS;

const PROVIDER = (process.env.TRANSLATE_PROVIDER || 'libretranslate').toLowerCase();
const LIBRE_URL = (process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000').replace(/\/$/, '');
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

const WAIT_MAX_MS = Number(process.env.LIBRE_WAIT_MAX_MS || 60000);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  if (!fs.existsSync(filePath)) return {};
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, obj) {
  fs.writeFileSync(filePath, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s ?? ''), 'utf8').digest('hex');
}

function protectPlaceholders(text) {
  const placeholders = [];
  const protectedText = text.replace(/\{[a-zA-Z0-9_]+\}/g, (m) => {
    const token = `__PH_${placeholders.length}__`;
    placeholders.push({ token, value: m });
    return token;
  });
  return { protectedText, placeholders };
}

function restorePlaceholders(text, placeholders) {
  let out = text;
  for (const ph of placeholders) out = out.split(ph.token).join(ph.value);
  return out;
}

async function waitForLibre() {
  if (PROVIDER !== 'libretranslate') return true;

  const start = Date.now();
  while (Date.now() - start < WAIT_MAX_MS) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${LIBRE_URL}/languages`, { signal: controller.signal });
      clearTimeout(t);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function translateLibre(text, source, target) {
  const res = await fetch(`${LIBRE_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(LIBRE_KEY ? { Authorization: `Bearer ${LIBRE_KEY}` } : {}),
    },
    body: JSON.stringify({ q: text, source, target, format: 'text' }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LibreTranslate error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data?.translatedText || '';
}

async function translateText(text, source, target) {
  const { protectedText, placeholders } = protectPlaceholders(text);

  let translated = '';
  if (PROVIDER === 'libretranslate') {
    translated = await translateLibre(protectedText, source, target);
  } else {
    // For now we only support LibreTranslate in docker-compose automation
    throw new Error(`Unsupported TRANSLATE_PROVIDER: ${PROVIDER}`);
  }

  translated = restorePlaceholders(translated, placeholders);
  translated = translated.replace(/\s+/g, ' ').trim();
  return translated;
}

function getWorkKeys(baseDict, targetDict, metaForLang) {
  const work = [];
  for (const k of Object.keys(baseDict)) {
    const srcText = baseDict[k];
    const h = sha1(srcText);
    const missing = !targetDict[k] || String(targetDict[k]).trim() === '';
    const changed = metaForLang?.[k] && metaForLang[k] !== h;
    const noMetaYet = !metaForLang?.[k];
    if (missing || changed || noMetaYet) work.push({ key: k, hash: h });
  }
  return work;
}

async function main() {
  ensureDir(OUT_DIR);

  const base = readJson(BASE_FILE);
  if (!Object.keys(base).length) {
    console.error(`[i18n:bootstrap] Base locale is empty or missing: ${BASE_FILE}`);
    process.exit(1);
  }

  // Always export base as runtime file
  writeJson(path.join(OUT_DIR, `${BASE_LANG}.json`), base);

  const meta = readJson(META_FILE);
  if (!meta.languages) meta.languages = {};

  if (PROVIDER === 'libretranslate') {
    const ok = await waitForLibre();
    if (!ok) {
      console.log(`[i18n:bootstrap] LibreTranslate not reachable at ${LIBRE_URL} -> export base only.`);
      writeJson(META_FILE, meta);
      return;
    }
  }

  for (const lang of targets) {
    if (lang === BASE_LANG) continue;

    const file = path.join(OUT_DIR, `${lang}.json`);
    const target = readJson(file);

    if (!meta.languages[lang]) meta.languages[lang] = {};

    const workKeys = getWorkKeys(base, target, meta.languages[lang]);
    console.log(`\n[${lang}] keys to translate/update: ${workKeys.length}`);

    if (!workKeys.length) {
      console.log(`[${lang}] ✅ up to date`);
      continue;
    }

    for (let i = 0; i < workKeys.length; i++) {
      const { key, hash } = workKeys[i];
      const srcText = base[key];

      try {
        const translated = await translateText(srcText, BASE_LANG, lang);
        target[key] = translated || srcText;
        meta.languages[lang][key] = hash;
        process.stdout.write(`\r[${lang}] ${i + 1}/${workKeys.length}  `);
      } catch (err) {
        console.error(`\n[${lang}] ❌ failed key "${key}": ${err?.message || err}`);
        target[key] = srcText;
        meta.languages[lang][key] = hash;
      }
    }

    console.log(`\n[${lang}] ✅ written: ${path.relative(ROOT, file)}`);
    writeJson(file, target);
  }

  writeJson(META_FILE, meta);
  console.log('\n[i18n:bootstrap] Done.');
}

main().catch((err) => {
  console.error('[i18n:bootstrap] failed:', err?.message || err);
  // Do not fail container hard; let app still run with base locale.
  process.exit(0);
});
