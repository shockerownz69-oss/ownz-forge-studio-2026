'use strict';

const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');

const DB_PATH = path.join(__dirname, 'members.sqlite');
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const KEY_LENGTH = 64;

function openDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(32);
  const hash = crypto.scryptSync(
    password, salt, KEY_LENGTH, SCRYPT_OPTIONS
  );
  return `scrypt$16384$8$1$${salt.toString('hex')}$${hash.toString('hex')}`;
}

function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, saltHex, hashHex] = stored.split('$');

    if (algorithm !== 'scrypt' ||
        n !== '16384' || r !== '8' || p !== '1' ||
        !/^[a-f0-9]{64}$/.test(saltHex) ||
        !/^[a-f0-9]{128}$/.test(hashHex)) {
      return false;
    }

    const expected = Buffer.from(hashHex, 'hex');
    const actual = crypto.scryptSync(
      password,
      Buffer.from(saltHex, 'hex'),
      expected.length,
      SCRYPT_OPTIONS
    );

    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

function register({ username, email, password } = {}) {
  if (typeof username !== 'string' ||
      !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
    throw new Error('Username must be 3-24 letters, numbers or underscores');
  }

  if (typeof email !== 'string' ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Invalid email address');
  }

  if (typeof password !== 'string' ||
      password.length < 12 ||
      Buffer.byteLength(password, 'utf8') > 1024) {
    throw new Error('Password must be at least 12 characters');
  }

  const id = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  const db = openDatabase();

  try {
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, email, password_hash, role)
      VALUES (?, ?, ?, ?, 'free')
    `);

    const insertProgress = db.prepare(`
      INSERT INTO member_progress (user_id, website_xp, gameplay_xp)
      VALUES (?, 0, 0)
    `);

    db.exec('BEGIN IMMEDIATE');

    try {
      insertUser.run(id, username, email, passwordHash);
      insertProgress.run(id);

      // Registration is the server-verified welcome event.
      // Award inside this transaction to keep account creation atomic.
      const welcomeXP = 50;

      db.prepare(`
        INSERT INTO xp_events
          (id, user_id, source, event_type, event_key, xp)
        VALUES (?, ?, 'website', 'website:welcome', ?, ?)
      `).run(
        crypto.randomUUID(),
        id,
        crypto.createHash('sha256')
          .update(JSON.stringify([id, 'website:welcome', 'welcome']))
          .digest('hex'),
        welcomeXP
      );

      db.prepare(`
        UPDATE member_progress
        SET website_xp = website_xp + ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
      `).run(welcomeXP, id);

      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }

    return {
      id,
      username,
      email,
      role: 'free',
      level: 1,
      rank: 'INITIATE',
      website_xp: 50,
      gameplay_xp: 0
    };
  } finally {
    db.close();
  }
}

function authenticate(identifier, password) {
  if (typeof identifier !== 'string' ||
      identifier.length > 254 ||
      typeof password !== 'string' ||
      Buffer.byteLength(password, 'utf8') > 1024) {
    return null;
  }

  const db = openDatabase();

  try {
    const user = db.prepare(`
      SELECT id, username, email, password_hash, role
      FROM users
      WHERE username = ? COLLATE NOCASE
         OR email = ? COLLATE NOCASE
    `).get(identifier, identifier);

    if (!user || !verifyPassword(password, user.password_hash)) {
      return null;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role
    };
  } finally {
    db.close();
  }
}

module.exports = {
  register,
  authenticate,
  hashPassword,
  verifyPassword
};
