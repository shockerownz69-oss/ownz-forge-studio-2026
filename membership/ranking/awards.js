'use strict';

const crypto = require('node:crypto');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = path.join(__dirname, '..', 'members.sqlite');

const REWARDS = Object.freeze({
  'website:profile_complete': 100,
  'website:welcome': 50
});

function awardXP({ userId, eventType, eventKey }) {
  if (typeof userId !== 'string' || !userId) {
    throw new TypeError('Valid userId required');
  }

  if (typeof eventType !== 'string' ||
      !Object.hasOwn(REWARDS, eventType)) {
    throw new RangeError('Unknown reward event');
  }

  if (typeof eventKey !== 'string' ||
      !/^[a-zA-Z0-9:_-]{1,160}$/.test(eventKey)) {
    throw new TypeError('Invalid event key');
  }

  const xp = REWARDS[eventType];
  const source = eventType.split(':')[0];

  // Event identity is always scoped to this member.
  // Callers must use a server-defined event identifier.
  const scopedEventKey = crypto
    .createHash('sha256')
    .update(JSON.stringify([userId, eventType, eventKey]))
    .digest('hex');

  const db = new DatabaseSync(DB_PATH);

  try {
    db.exec('BEGIN IMMEDIATE');

    const user = db.prepare(
      'SELECT id FROM users WHERE id = ?'
    ).get(userId);

    if (!user) {
      throw new Error('Member not found');
    }

    const existing = db.prepare(
      'SELECT id FROM xp_events WHERE event_key = ?'
    ).get(scopedEventKey);

    if (existing) {
      db.exec('ROLLBACK');
      return { awarded: false, duplicate: true, xp: 0 };
    }

    const column = source === 'gameplay'
      ? 'gameplay_xp'
      : 'website_xp';

    const current = db.prepare(
      'SELECT website_xp, gameplay_xp FROM member_progress WHERE user_id = ?'
    ).get(userId);

    if (!current) {
      throw new Error('Member progression missing');
    }

    const total = current.website_xp + current.gameplay_xp;

    if (!Number.isSafeInteger(total) ||
        !Number.isSafeInteger(total + xp)) {
      throw new RangeError('XP overflow');
    }

    db.prepare(`
      INSERT INTO xp_events
        (id, user_id, source, event_type, event_key, xp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      crypto.randomUUID(),
      userId,
      source,
      eventType,
      scopedEventKey,
      xp
    );

    db.prepare(`
      UPDATE member_progress
      SET ${column} = ${column} + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(xp, userId);

    db.exec('COMMIT');

    return { awarded: true, duplicate: false, xp };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch (_) {}
    throw error;
  } finally {
    db.close();
  }
}

module.exports = { awardXP, REWARDS };
