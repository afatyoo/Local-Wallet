import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.cwd();
const LOCALES_DIR = path.join(ROOT, 'src', 'locales');
const META_FILE = path.join(LOCALES_DIR, '.i18n-meta.json');

const BASE_LANG = 'id';
const DEFAULT_TARGETS = ['en', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'hi', 'zh', 'ja', 'ko'];

// Provider:
// - libretranslate (default): needs a LibreTranslate server (can be local via Docker)
//   Env: LIBRETRANSLATE_URL=http://localhost:5000
// - openai (optional): needs OPENAI_API_KEY and OPENAI_MODEL
const PROVIDER = (process.env.TRANSLATE_PROVIDER || 'libretranslate').toLowerCase();

const LIBRE_URL = (process.env.LIBRETRANSLATE_URL || 'http://localhost:5000').replace(/\/$/, '');
const LIBRE_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

const OPENAI_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'; // example, change as needed
const OPENAI_BASE_URL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');

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

function protectPlaceholders(text) {
  // Protect {placeholders} to keep them unchanged in translation
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
  for (const ph of placeholders) {
    out = out.split(ph.token).join(ph.value);
  }
  return out;
}

async function translateLibre(text, source, target) {
  const res = await fetch(`${LIBRE_URL}/translate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(LIBRE_KEY ? { Authorization: `Bearer ${LIBRE_KEY}` } : {}),
    },
    body: JSON.stringify({
      q: text,
      source,
      target,
      format: 'text',
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`LibreTranslate error ${res.status}: ${body}`);
  }

  const data = await res.json();
  return data?.translatedText || '';
}

async function translateOpenAI(text, source, target) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY is missing');

  const system = [
    'You are a professional UI translator.',
    'Rules:',
    '- Keep placeholders like __PH_0__ unchanged.',
    '- Keep punctuation and capitalization natural for the target language.',
    '- Output only the translated text, no quotes, no explanations.',
  ].join('\n');

  const user = `Translate from ${source} to ${target}:\n\n${text}`;

  const res = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }

  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content;
  return (out || '').trim();
}

async function translateText(text, source, target) {
  const { protectedText, placeholders } = protectPlaceholders(text);

  let translated = '';
  if (PROVIDER === 'openai') {
    translated = await translateOpenAI(protectedText, source, target);
  } else {
    translated = await translateLibre(protectedText, source, target);
  }

  translated = restorePlaceholders(translated, placeholders);

  // Small cleanups (sometimes the provider adds extra spaces)
  translated = translated.replace(/\s+/g, ' ').trim();

  return translated;
}

function sha1(s) {
  return crypto.createHash('sha1').update(String(s ?? ''), 'utf8').digest('hex');
}

function getWorkKeys(baseDict, targetDict, metaForLang) {
  const work = [];
  for (const k of Object.keys(baseDict)) {
    const srcText = baseDict[k];
    const h = sha1(srcText);
    const missing = !targetDict[k] || String(targetDict[k]).trim() === '';
    const changed = metaForLang?.[k] && metaForLang[k] !== h;
    // If key never existed in meta -> treat as missing
    const noMetaYet = !metaForLang?.[k];
    if (missing || changed || noMetaYet) work.push({ key: k, hash: h });
  }
  return work;
}

async function main() {
  ensureDir(LOCALES_DIR);

  const meta = readJson(META_FILE);
  if (!meta.languages) meta.languages = {};

  const baseFile = path.join(LOCALES_DIR, `${BASE_LANG}.json`);
  const base = readJson(baseFile);

  if (!Object.keys(base).length) {
    console.error(`Base locale is empty or missing: ${baseFile}`);
    process.exit(1);
  }

  console.log(`Provider: ${PROVIDER}`);
  if (PROVIDER === 'libretranslate') console.log(`LibreTranslate URL: ${LIBRE_URL}`);
  if (PROVIDER === 'openai') console.log(`OpenAI model: ${OPENAI_MODEL}`);

  for (const lang of targets) {
    if (lang === BASE_LANG) continue;

    const file = path.join(LOCALES_DIR, `${lang}.json`);
    const target = readJson(file);

    if (!meta.languages[lang]) meta.languages[lang] = {};
    const workKeys = getWorkKeys(base, target, meta.languages[lang]);
    console.log(`\n[${lang}] to translate/update: ${workKeys.length}`);

    if (!workKeys.length) {
      console.log(`[${lang}] ✅ up to date`);
      continue;
    }

    // Translate sequentially to avoid rate limiting / overload
    for (let i = 0; i < workKeys.length; i++) {
      const { key, hash } = workKeys[i];
      const srcText = base[key];

      try {
        const translated = await translateText(srcText, BASE_LANG, lang);
        target[key] = translated || srcText; // fallback: Indonesian
        meta.languages[lang][key] = hash;
        process.stdout.write(`\r[${lang}] ${i + 1}/${workKeys.length}  `);
      } catch (err) {
        console.error(`\n[${lang}] ❌ failed key "${key}":`, err?.message || err);
        // Keep fallback so app still works
        target[key] = srcText;
        meta.languages[lang][key] = hash;
      }
    }

    console.log(`\n[${lang}] ✅ written: ${path.relative(ROOT, file)}`);
    writeJson(file, target);
  }

  writeJson(META_FILE, meta);

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
