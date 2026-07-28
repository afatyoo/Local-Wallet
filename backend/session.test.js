import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { createSessionAuth, revokeUserSessions } from './session.js';

function hash(value) {
  return createHash('sha256').update(value).digest('hex');
}

function responseDouble() {
  return {
    statusCode: 200,
    body: null,
    cleared: [],
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
    clearCookie(name) {
      this.cleared.push(name);
    },
  };
}

test('session auth rejects requests without an opaque session cookie', async () => {
  const authenticate = createSessionAuth({ query: async () => [[], []] });
  const response = responseDouble();
  await authenticate({ headers: {}, method: 'GET' }, response, () => {
    assert.fail('next must not be called');
  });
  assert.equal(response.statusCode, 401);
});

test('session auth loads the current database role and validates CSRF', async () => {
  const csrf = 'csrf-value';
  const pool = {
    query: async () => [[{
      session_id: 'session-1',
      csrf_hash: hash(csrf),
      id: 'user-1',
      username: 'owner',
      role: 'user',
      created_at: '2026-01-01',
    }], []],
  };
  const authenticate = createSessionAuth(pool);
  const request = {
    headers: { cookie: 'wallet_session=opaque-token' },
    method: 'PUT',
    get: (name) => name.toLowerCase() === 'x-csrf-token' ? csrf : undefined,
  };
  let called = false;
  await authenticate(request, responseDouble(), () => {
    called = true;
  });
  assert.equal(called, true);
  assert.equal(request.user.role, 'user');
  assert.equal(request.session.id, 'session-1');
});

test('revoking sessions can preserve the current session', async () => {
  const calls = [];
  await revokeUserSessions(
    { query: async (...args) => calls.push(args) },
    'user-1',
    'session-1',
  );
  assert.match(calls[0][0], /id <> \?/);
  assert.deepEqual(calls[0][1], ['user-1', 'session-1']);
});
