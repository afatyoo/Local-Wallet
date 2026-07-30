import bcrypt from 'bcryptjs';
import express from 'express';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { bcryptRounds, validatePassword } from '../passwordPolicy.js';
import {
  createOtpAuthUri,
  encryptTotpSecret,
  generateRecoveryCodes,
  generateTotpSecret,
  hashRecoveryCode,
  verifyTotp,
} from '../twoFactor.js';
import { createSession } from '../session.js';

const SETUP_AUDIENCE = 'local-wallet-setup';
const SETUP_ISSUER = 'local-wallet-api';

function validUsername(username) {
  const normalized = typeof username === 'string' ? username.trim() : '';
  return normalized.length >= 3
    && normalized.length <= 50
    && /^[a-zA-Z0-9_]+$/.test(normalized);
}

export async function isInitialSetupRequired(connection) {
  const [rows] = await connection.query(
    "SELECT COUNT(*) AS total FROM users WHERE role = 'admin'",
  );
  return Number(rows[0]?.total || 0) === 0;
}

async function insertDefaultMasterData(connection, userId) {
  const defaults = {
    kategoriPemasukan: ['Gaji', 'Bonus', 'Investasi', 'Freelance', 'Hadiah', 'Lainnya'],
    kategoriPengeluaran: ['Makanan', 'Transportasi', 'Belanja', 'Tagihan', 'Hiburan', 'Kesehatan', 'Pendidikan', 'Lainnya'],
    metodePembayaran: ['Cash', 'Debit', 'Credit', 'E-wallet', 'Transfer', 'Lainnya'],
  };
  const rows = Object.entries(defaults).flatMap(([type, values]) =>
    values.map((value) => [uuidv4(), userId, type, value]));
  await connection.query(
    'INSERT INTO master_data (id, user_id, type, value) VALUES ?',
    [rows],
  );
}

export function createSetupRouter({
  pool,
  jwtSecret,
  tfaEncryptionKey,
  limiter,
}) {
  const router = express.Router();

  router.get('/status', async (_req, res) => {
    try {
      res.json({ required: await isInitialSetupRequired(pool) });
    } catch (error) {
      console.error('Initial setup status error:', error);
      res.status(500).json({ error: 'Unable to determine setup status' });
    }
  });

  router.post('/tfa', limiter, async (req, res) => {
    try {
      const username = String(req.body?.username || '').trim();
      if (!validUsername(username)) {
        return res.status(400).json({ error: 'Username must be 3-50 letters, numbers, or underscores' });
      }
      if (!(await isInitialSetupRequired(pool))) {
        return res.status(409).json({ error: 'Initial setup is already complete' });
      }

      const secret = generateTotpSecret();
      const setupToken = jwt.sign(
        { purpose: 'initial-setup', username, secret },
        jwtSecret,
        {
          algorithm: 'HS256',
          audience: SETUP_AUDIENCE,
          issuer: SETUP_ISSUER,
          expiresIn: '10m',
        },
      );
      return res.json({
        setupToken,
        secret,
        otpAuthUri: createOtpAuthUri(username, secret),
      });
    } catch (error) {
      console.error('Initial TFA setup error:', error);
      return res.status(500).json({ error: 'Unable to start initial setup' });
    }
  });

  router.post('/complete', limiter, async (req, res) => {
    const connection = await pool.getConnection();
    let lockAcquired = false;
    try {
      const username = String(req.body?.username || '').trim();
      const { password, setupToken, code } = req.body || {};
      if (!validUsername(username)) {
        return res.status(400).json({ error: 'Username must be 3-50 letters, numbers, or underscores' });
      }
      const passwordError = validatePassword(password);
      if (passwordError) return res.status(400).json({ error: passwordError });
      if (typeof setupToken !== 'string' || typeof code !== 'string') {
        return res.status(400).json({ error: 'TFA setup token and code are required' });
      }

      let payload;
      try {
        payload = jwt.verify(setupToken, jwtSecret, {
          algorithms: ['HS256'],
          audience: SETUP_AUDIENCE,
          issuer: SETUP_ISSUER,
        });
      } catch {
        return res.status(400).json({ error: 'Setup expired; generate a new TFA QR code' });
      }
      if (
        payload.purpose !== 'initial-setup'
        || payload.username !== username
        || !payload.secret
        || !verifyTotp(payload.secret, code)
      ) {
        return res.status(400).json({ error: 'Invalid authenticator code' });
      }

      const [lockRows] = await connection.query(
        "SELECT GET_LOCK('local_wallet_initial_setup', 5) AS acquired",
      );
      lockAcquired = Number(lockRows[0]?.acquired) === 1;
      if (!lockAcquired) {
        return res.status(503).json({ error: 'Setup is busy; try again' });
      }

      await connection.beginTransaction();
      const [admins] = await connection.query(
        "SELECT id FROM users WHERE role = 'admin' FOR UPDATE",
      );
      if (admins.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'Initial setup is already complete' });
      }
      const [duplicate] = await connection.query(
        'SELECT id FROM users WHERE username = ? FOR UPDATE',
        [username],
      );
      if (duplicate.length > 0) {
        await connection.rollback();
        return res.status(409).json({ error: 'Username already exists' });
      }

      const id = uuidv4();
      const recoveryCodes = generateRecoveryCodes();
      const recoveryHashes = recoveryCodes.map((recoveryCode) =>
        hashRecoveryCode(recoveryCode, tfaEncryptionKey));
      const passwordHash = await bcrypt.hash(password, bcryptRounds());
      const encryptedSecret = encryptTotpSecret(payload.secret, tfaEncryptionKey);
      await connection.query(
        `INSERT INTO users
          (id, username, password_hash, role, tfa_secret, tfa_enabled, tfa_recovery_codes)
         VALUES (?, ?, ?, 'admin', ?, TRUE, ?)`,
        [id, username, passwordHash, encryptedSecret, JSON.stringify(recoveryHashes)],
      );
      await insertDefaultMasterData(connection, id);
      await connection.commit();

      const user = {
        id,
        username,
        role: 'admin',
        created_at: new Date().toISOString(),
      };
      await createSession(pool, user, req, res);
      return res.status(201).json({
        user: {
          id,
          username,
          role: 'admin',
          createdAt: user.created_at,
        },
        recoveryCodes,
      });
    } catch (error) {
      await connection.rollback().catch(() => {});
      if (String(error?.code) === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Initial setup was completed by another request' });
      }
      console.error('Complete initial setup error:', error);
      return res.status(500).json({ error: 'Unable to complete initial setup' });
    } finally {
      if (lockAcquired) {
        await connection.query("SELECT RELEASE_LOCK('local_wallet_initial_setup')").catch(() => {});
      }
      connection.release();
    }
  });

  return router;
}
