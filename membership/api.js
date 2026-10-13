'use strict';

const express = require('express');
const auth = require('./auth');
const sessions = require('./sessions');


const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');

const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');




const ranking = require('./ranking/engine');

const router = express.Router();

// OWNZ MEMBERSHIP SECURITY MIDDLEWARE
router.use(helmet());

router.use((req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    return next();
  }

  const origin = req.get('origin');

  if (origin) {
    try {
      const parsed = new URL(origin);
      const expected = req.get('host');

      if (!expected || parsed.host !== expected ||
          !['http:', 'https:'].includes(parsed.protocol) ||
          (process.env.NODE_ENV === 'production' &&
           parsed.protocol !== 'https:')) {
        return res.status(403).json({ error: 'Origin not allowed' });
      }
    } catch {
      return res.status(403).json({ error: 'Invalid origin' });
    }
  } else if (req.get('sec-fetch-site') === 'cross-site') {
    return res.status(403).json({ error: 'Cross-site request blocked' });
  }

  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many attempts. Try again later.' }
});

router.use(['/register', '/login'], authLimiter);

const json = express.json({ limit: '8kb' });
const COOKIE_NAME = 'ownz_session';

function sessionToken(req) {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)ownz_session=([a-f0-9]{64})(?:;|$)/);
  return match ? match[1] : null;
}

function currentUser(req) {
  const token = sessionToken(req);
  return token ? sessions.getSession(token) : null;
}

function setSessionCookie(res, token) {
  res.clearCookie(COOKIE_NAME, {
    path: '/api/members',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

router.post('/register', json, (req, res) => {
  try {
    const user = auth.register(req.body);
    const session = sessions.createSession(user.id);
    setSessionCookie(res, session.token);
    res.status(201).json({ user });
  } catch (error) {
    if (error.code?.startsWith('SQLITE_CONSTRAINT')) {
      return res.status(409).json({ error: 'Username or email unavailable' });
    }
    res.status(400).json({ error: error.message });
  }
});

router.post('/login', json, (req, res) => {
  try {
    const user = auth.authenticate(
      req.body?.identifier,
      req.body?.password
    );

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const session = sessions.createSession(user.id);
    setSessionCookie(res, session.token);
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Login unavailable' });
  }
});

router.post('/logout', (req, res) => {
  const token = sessionToken(req);
  if (token) sessions.revokeSession(token);

  res.clearCookie(COOKIE_NAME, {
    path: '/',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  res.clearCookie(COOKIE_NAME, {
    path: '/api/members',
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });

  res.json({ success: true });
});

router.get('/me', (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  res.json({ user });
});

router.get('/premium-check', (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  if (!sessions.hasPremiumAccess(user)) {
    return res.status(403).json({ error: 'Premium membership required' });
  }

  res.json({ access: 'granted' });
});

router.get('/admin-check', (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  if (!sessions.isAdmin(user)) {
    return res.status(403).json({ error: 'Administrator required' });
  }

  res.json({ access: 'granted' });
});


// AUTHENTICATED MEMBER PROGRESSION — READ ONLY
router.get('/progress', (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  const db = new DatabaseSync(
    path.join(__dirname, 'members.sqlite'),
    { readOnly: true }
  );

  try {
    const record = db.prepare(`
      SELECT website_xp, gameplay_xp
      FROM member_progress
      WHERE user_id = ?
    `).get(user.id);

    if (!record) {
      return res.status(500).json({
        error: 'Member progression unavailable'
      });
    }

    const progress = ranking.getProgress({
      id: user.id,
      role: user.role,
      website_xp: record.website_xp,
      gameplay_xp: record.gameplay_xp
    });

    res.json({ progress });
  } catch (error) {
    console.error('Member progress error:', error.message);
    res.status(500).json({
      error: 'Member progression unavailable'
    });
  } finally {
    db.close();
  }
});





// AUTHENTICATED MEMBER PROFILES — PHASE 54
const crypto = require('node:crypto');

const profileLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 12,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many profile updates. Try later.' }
});

function profileComplete(profile) {
  return (
    profile.display_name.length >= 3 &&
    profile.bio.length >= 20 &&
    profile.favorite_game.length >= 2
  );
}

router.get('/profile', (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  let db;

  try {
    db = new DatabaseSync(
      path.join(__dirname, 'members.sqlite'),
      { readOnly: true }
    );

    const profile = db.prepare(`
      SELECT display_name, bio, favorite_game, completed_at
      FROM member_profiles
      WHERE user_id = ?
    `).get(user.id);

    res.set('Cache-Control', 'no-store');

    res.json({
      profile: profile || {
        display_name: '',
        bio: '',
        favorite_game: '',
        completed_at: null
      }
    });
  } catch (error) {
    console.error('Profile read error:', error.message);
    res.status(500).json({ error: 'Profile unavailable' });
  } finally {
    if (db) db.close();
  }
});

router.post('/profile', profileLimiter, json, (req, res) => {
  const user = currentUser(req);

  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  const body = req.body;

  if (!body || typeof body !== 'object' ||
      Array.isArray(body) ||
      !['display_name', 'bio', 'favorite_game'].every(
        key => typeof body[key] === 'string'
      )) {
    return res.status(400).json({
      error: 'Valid profile fields required'
    });
  }

  const profile = {
    display_name: body.display_name.trim(),
    bio: body.bio.trim(),
    favorite_game: body.favorite_game.trim()
  };

  if (
    profile.display_name.length > 40 ||
    profile.bio.length > 500 ||
    profile.favorite_game.length > 80 ||
    /[\u0000-\u001f\u007f]/.test(
      profile.display_name + profile.bio + profile.favorite_game
    )
  ) {
    return res.status(400).json({
      error: 'Profile contains invalid or oversized fields'
    });
  }

  let db;
  let transactionOpen = false;

  try {
    db = new DatabaseSync(
      path.join(__dirname, 'members.sqlite')
    );

    db.exec('PRAGMA busy_timeout = 5000');
    db.exec('BEGIN IMMEDIATE');
    transactionOpen = true;

    const complete = profileComplete(profile);

    const previous = db.prepare(`
      SELECT completed_at
      FROM member_profiles
      WHERE user_id = ?
    `).get(user.id);

    db.prepare(`
      INSERT INTO member_profiles
        (user_id, display_name, bio, favorite_game, completed_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        display_name = excluded.display_name,
        bio = excluded.bio,
        favorite_game = excluded.favorite_game,
        completed_at = COALESCE(
          member_profiles.completed_at,
          excluded.completed_at
        ),
        updated_at = CURRENT_TIMESTAMP
    `).run(
      user.id,
      profile.display_name,
      profile.bio,
      profile.favorite_game,
      complete ? new Date().toISOString() : null
    );

    const reward = {
      awarded: false,
      duplicate: false,
      xp: 0
    };

    if (complete) {
      const eventType = 'website:profile_complete';
      const eventKey = 'profile-complete-v1';

      const scopedKey = crypto
        .createHash('sha256')
        .update(JSON.stringify([
          user.id,
          eventType,
          eventKey
        ]))
        .digest('hex');

      const existing = db.prepare(`
        SELECT id FROM xp_events
        WHERE event_key = ?
      `).get(scopedKey);

      if (existing) {
        reward.duplicate = true;
      } else {
        const progress = db.prepare(`
          SELECT website_xp, gameplay_xp
          FROM member_progress
          WHERE user_id = ?
        `).get(user.id);

        if (!progress) {
          throw new Error('Member progression missing');
        }

        const total = progress.website_xp + progress.gameplay_xp;

        if (!Number.isSafeInteger(total) ||
            !Number.isSafeInteger(total + 100)) {
          throw new RangeError('XP overflow');
        }

        db.prepare(`
          INSERT INTO xp_events
            (id, user_id, source, event_type, event_key, xp)
          VALUES (?, ?, 'website', ?, ?, 100)
        `).run(
          crypto.randomUUID(),
          user.id,
          eventType,
          scopedKey
        );

        db.prepare(`
          UPDATE member_progress
          SET website_xp = website_xp + 100,
              updated_at = CURRENT_TIMESTAMP
          WHERE user_id = ?
        `).run(user.id);

        reward.awarded = true;
        reward.xp = 100;
      }
    }

    db.exec('COMMIT');
    transactionOpen = false;

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      complete,
      reward
    });
  } catch (error) {
    if (db && transactionOpen) {
      try { db.exec('ROLLBACK'); } catch (_) {}
    }

    console.error('Profile save error:', error.message);

    res.status(500).json({
      error: 'Profile could not be saved'
    });
  } finally {
    if (db) db.close();
  }
});


// PHASE 55 DAILY LOGIN REWARDS
const dailyRewards = require('./rewards/daily');

const dailyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many reward requests. Try later.' }
});

function dailyDatabase(readOnly = false) {
  const db = new DatabaseSync(
    path.join(__dirname, 'members.sqlite'),
    { readOnly }
  );
  if (!readOnly) {
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
  }
  return db;
}

router.get('/daily-reward', (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  const db = dailyDatabase(true);
  try {
    const previous = db.prepare(
      'SELECT * FROM member_daily_rewards WHERE user_id = ?'
    ).get(user.id);

    const today = dailyRewards.utcDay();
    const next = dailyRewards.calculate(previous, today);

    res.set('Cache-Control', 'no-store');
    res.json({
      today,
      streak: previous?.streak_days ?? 0,
      totalClaims: previous?.total_claims ?? 0,
      completedCycles: previous?.completed_cycles ?? 0,
      lastClaimDate: previous?.last_claim_date ?? null,
      next,
      rewards: dailyRewards.REWARDS
    });
  } catch (error) {
    console.error('Daily reward read error:', error.message);
    res.status(500).json({ error: 'Daily rewards unavailable' });
  } finally {
    db.close();
  }
});

router.post('/daily-reward/claim', dailyLimiter, (req, res) => {
  const user = currentUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Login required' });
  }

  const db = dailyDatabase();
  let transactionOpen = false;

  try {
    db.exec('BEGIN IMMEDIATE');
    transactionOpen = true;

    const today = dailyRewards.utcDay();
    const previous = db.prepare(
      'SELECT * FROM member_daily_rewards WHERE user_id = ?'
    ).get(user.id);

    const next = dailyRewards.calculate(previous, today);

    if (!next.claimable) {
      db.exec('COMMIT');
      transactionOpen = false;
      res.set('Cache-Control', 'no-store');
      return res.json({
        success: true,
        awarded: false,
        duplicate: true,
        streak: next.streak,
        xp: 0,
        today
      });
    }

    const progress = db.prepare(
      'SELECT website_xp, gameplay_xp FROM member_progress WHERE user_id = ?'
    ).get(user.id);

    if (!progress ||
        !Number.isSafeInteger(progress.website_xp) ||
        !Number.isSafeInteger(progress.gameplay_xp) ||
        !Number.isSafeInteger(
          progress.website_xp + progress.gameplay_xp + next.xp
        )) {
      throw new Error('Invalid member progression');
    }

    const eventKey = crypto.createHash('sha256')
      .update(JSON.stringify([
        user.id, 'website:daily_login', today
      ]))
      .digest('hex');

    db.prepare(`
      INSERT INTO xp_events
        (id, user_id, source, event_type, event_key, xp)
      VALUES (?, ?, 'website', 'website:daily_login', ?, ?)
    `).run(crypto.randomUUID(), user.id, eventKey, next.xp);

    db.prepare(`
      INSERT INTO member_daily_rewards
        (user_id, streak_days, last_claim_date,
         total_claims, completed_cycles)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        streak_days = excluded.streak_days,
        last_claim_date = excluded.last_claim_date,
        total_claims = member_daily_rewards.total_claims + 1,
        completed_cycles = member_daily_rewards.completed_cycles +
          excluded.completed_cycles,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      user.id, next.streak, today,
      next.completedCycle ? 1 : 0
    );

    const updated = db.prepare(`
      UPDATE member_progress
      SET website_xp = website_xp + ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(next.xp, user.id);

    if (updated.changes !== 1) {
      throw new Error('Progress update failed');
    }

    db.exec('COMMIT');
    transactionOpen = false;

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      awarded: true,
      duplicate: false,
      streak: next.streak,
      xp: next.xp,
      today,
      completedCycle: next.completedCycle
    });
  } catch (error) {
    if (transactionOpen) {
      try { db.exec('ROLLBACK'); } catch (_) {}
    }
    console.error('Daily claim error:', error.message);
    res.status(500).json({ error: 'Daily reward claim failed' });
  } finally {
    db.close();
  }
});

// PUBLIC GLOBAL LEADERBOARD — READ ONLY
router.get('/leaderboard', (req, res) => {
  const limit = 25;
  const db = new DatabaseSync(
    path.join(__dirname, 'members.sqlite'),
    { readOnly: true }
  );

  try {
    const members = db.prepare(`
      SELECT
        u.id,
        u.username,
        u.role,
        p.website_xp,
        p.gameplay_xp
      FROM member_progress p
      INNER JOIN users u ON u.id = p.user_id
      ORDER BY
        (p.website_xp + p.gameplay_xp) DESC,
        u.username COLLATE NOCASE ASC,
        u.id ASC
      LIMIT ?
    `).all(limit);

    const leaderboard = members.map((member, index) => {
      const progress = ranking.getProgress(member);

      return {
        position: index + 1,
        username: member.username,
        level: progress.level,
        rank: progress.rank,
        title: progress.title,
        avatar: progress.avatar,
        websiteXP: progress.websiteXP,
        gameplayXP: progress.gameplayXP,
        totalXP: progress.totalXP
      };
    });

    res.set('Cache-Control', 'no-store');
    res.json({ leaderboard, limit });
  } catch (error) {
    console.error('Leaderboard error:', error.message);
    res.status(500).json({
      error: 'Leaderboard temporarily unavailable'
    });
  } finally {
    db.close();
  }
});

module.exports = router;
