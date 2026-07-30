import assert from 'node:assert/strict';
import test from 'node:test';
import { isInitialSetupRequired } from './routes/setup.js';

test('fresh databases require initial setup when no administrator exists', async () => {
  const pool = {
    query: async () => [[{ total: 0 }], []],
  };
  assert.equal(await isInitialSetupRequired(pool), true);
});

test('existing installations bypass initial setup when an administrator exists', async () => {
  const pool = {
    query: async () => [[{ total: 1 }], []],
  };
  assert.equal(await isInitialSetupRequired(pool), false);
});
