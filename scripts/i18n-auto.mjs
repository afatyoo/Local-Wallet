import { spawn } from 'node:child_process';

// Fully-automatic i18n pipeline:
// - Always sync locale files (create missing target JSON)
// - Auto-translate missing/outdated keys if a translator provider is reachable
//
// Controls:
// - AUTO_TRANSLATE=0   -> only sync, no translation
// - TRANSLATE_PROVIDER=libretranslate|openai
// - LIBRETRANSLATE_URL=http://localhost:5000

const AUTO = String(process.env.AUTO_TRANSLATE ?? '1').toLowerCase();
const PROVIDER = String(process.env.TRANSLATE_PROVIDER ?? 'libretranslate').toLowerCase();
const LIBRE_URL = String(process.env.LIBRETRANSLATE_URL ?? 'http://localhost:5000').replace(/\/$/, '');
const OPENAI_KEY = String(process.env.OPENAI_API_KEY ?? '');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

async function reachableLibre() {
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${LIBRE_URL}/languages`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  // 1) Always sync locale files
  await run('node', ['scripts/i18n-sync.mjs']);

  // 2) Translation is optional
  if (AUTO === '0' || AUTO === 'false' || AUTO === 'no') {
    console.log('\n[i18n:auto] AUTO_TRANSLATE disabled -> done (sync only).');
    return;
  }

  // Decide if provider is usable
  if (PROVIDER === 'openai') {
    if (!OPENAI_KEY) {
      console.log('\n[i18n:auto] OPENAI_API_KEY missing -> skip translation (sync only).');
      return;
    }
  } else {
    const ok = await reachableLibre();
    if (!ok) {
      console.log(`\n[i18n:auto] LibreTranslate not reachable at ${LIBRE_URL} -> skip translation (sync only).`);
      console.log('[i18n:auto] Tip: start it via Docker: docker run -p 5000:5000 libretranslate/libretranslate');
      return;
    }
  }

  // 3) Translate missing keys
  await run('node', ['scripts/i18n-translate.mjs']);
}

main().catch((err) => {
  console.error('\n[i18n:auto] failed:', err?.message || err);
  // Do not block dev/build if translation fails.
  process.exit(0);
});
