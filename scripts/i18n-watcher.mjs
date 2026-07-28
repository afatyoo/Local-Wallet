import { spawn } from 'node:child_process';

const intervalSeconds = Math.max(Number(process.env.I18N_SYNC_INTERVAL || 3600), 60);

function runScript(script) {
  return new Promise((resolve) => {
    const child = spawn('node', [script], {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (error) => {
      console.error('[i18n:watcher] Failed to start sync:', error.message);
      resolve();
    });
    child.on('exit', (code) => {
      if (code !== 0) {
        console.error(`[i18n:watcher] Sync exited with code ${code}`);
      }
      resolve();
    });
  });
}

async function syncLocales() {
  await runScript('scripts/i18n-auto.mjs');
  await runScript('scripts/i18n-bootstrap.mjs');
}

async function main() {
  console.log(`[i18n:watcher] Sync interval: ${intervalSeconds}s`);
  while (true) {
    await syncLocales();
    await new Promise((resolve) => setTimeout(resolve, intervalSeconds * 1000));
  }
}

main().catch((error) => {
  console.error('[i18n:watcher] Fatal error:', error);
  process.exit(1);
});
