'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, 'members.sqlite');
const SESSION_SECONDS = 7 * 24 * 60 * 60;

function openDatabase() {
  const db = new DatabaseSync(DB_PATH);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(
    Date.now() + SESSION_SECONDS * 1000
  ).toISOString();

  const db = openDatabase();

  try {
    db.prepare(`
      INSERT INTO sessions (id_hash, user_id, expires_at)
      VALUES (?, ?, ?)
    `).run(tokenHash(token), userId, expiresAt);

    return { token, expiresAt };
  } finally {
    db.close();
  }
}

function getSession(token) {
  if (typeof token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(token)) {
    return null;
  }

  const db = openDatabase();

  try {
    const session = db.prepare(`
      SELECT u.id, u.username, u.email, u.role, s.expires_at
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.id_hash = ?
        AND s.expires_at > ?
    `).get(tokenHash(token), new Date().toISOString());

    return session || null;
  } finally {
    db.close();
  }
}

function revokeSession(token) {
  if (typeof token !== 'string' ||
      !/^[a-f0-9]{64}$/.test(token)) {
    return false;
  }

  const db = openDatabase();

  try {
    const result = db.prepare(
      'DELETE FROM sessions WHERE id_hash = ?'
    ).run(tokenHash(token));

    return result.changes > 0;
  } finally {
    db.close();
  }
}

function hasPremiumAccess(user) {
  return user?.role === 'premium' || user?.role === 'admin';
}

function isAdmin(user) {
  return user?.role === 'admin';
}

module.exports = {
  createSession,
  getSession,
  revokeSession,
  hasPremiumAccess,
  isAdmin
};
