import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

// Dev runner:
// - Runs i18n:auto once on start
// - Starts Vite
// - Watches src/locales/id.json; when changed, re-runs i18n:auto

const ROOT = process.cwd();
const BASE_LOCALE = path.join(ROOT, 'src', 'locales', 'id.json');

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32', ...opts });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
  });
}

async function i18nAuto() {
  await run('node', ['scripts/i18n-auto.mjs']);
}

function startVite() {
  // Pass-through args after "--" if you want: npm run dev -- --host 0.0.0.0
  const extra = process.argv.slice(2);
  const p = spawn('npx', ['vite', ...extra], { stdio: 'inherit', shell: process.platform === 'win32' });
  p.on('exit', (code) => process.exit(code ?? 0));
  return p;
}

function watchBaseLocale() {
  let timer = null;
  if (!fs.existsSync(BASE_LOCALE)) return;

  fs.watch(BASE_LOCALE, { persistent: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      console.log('\n[i18n] id.json changed -> syncing/translating...');
      i18nAuto().catch(() => {});
    }, 400);
  });
}

async function main() {
  await i18nAuto();
  watchBaseLocale();
  startVite();
}

main().catch((err) => {
  console.error('[dev] failed:', err?.message || err);
  // Still try to start Vite so you can keep working
  startVite();
});
