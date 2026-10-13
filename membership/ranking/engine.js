'use strict';

const OWNER_ID = 'd0ffa578-eb47-4ab5-9a0e-08ce1d61d212';

const RANKS = Object.freeze([
  { level: 1, name: 'INITIATE', avatar: 'initiate.png' },
  { level: 5, name: 'OPERATIVE', avatar: 'operative.png' },
  { level: 10, name: 'ENFORCER', avatar: 'enforcer.png' },
  { level: 20, name: 'WARLORD', avatar: 'warlord.png' },
  { level: 35, name: 'OVERLORD', avatar: 'overlord.png' },
  { level: 100, name: 'FATALACIDBURN', avatar: 'fatalacidburn.png' }
]);

const XP_ANCHORS = Object.freeze([
  [1, 0],
  [5, 600],
  [10, 2700],
  [20, 16000],
  [30, 49000],
  [40, 110000],
  [50, 210000],
  [60, 365000],
  [75, 740000],
  [100, 1850000]
]);

function xpForLevel(level) {
  if (!Number.isSafeInteger(level) || level < 1 || level > 100) {
    throw new RangeError('Level must be an integer from 1 to 100');
  }

  for (let i = 1; i < XP_ANCHORS.length; i++) {
    const [endLevel, endXP] = XP_ANCHORS[i];
    const [startLevel, startXP] = XP_ANCHORS[i - 1];

    if (level <= endLevel) {
      const progress = (level - startLevel) / (endLevel - startLevel);
      return Math.round(startXP + (endXP - startXP) * progress);
    }
  }

  return XP_ANCHORS.at(-1)[1];
}

function levelForXP(xp) {
  if (!Number.isSafeInteger(xp) || xp < 0) {
    throw new RangeError('XP must be a nonnegative safe integer');
  }

  let level = 1;

  while (level < 100 && xp >= xpForLevel(level + 1)) {
    level++;
  }

  return level;
}

function rankForLevel(level) {
  if (!Number.isSafeInteger(level) || level < 1 || level > 100) {
    throw new RangeError('Invalid level');
  }

  return [...RANKS].reverse().find(rank => level >= rank.level);
}

function getProgress(user) {
  const websiteXP = user.website_xp ?? 0;
  const gameplayXP = user.gameplay_xp ?? 0;

  if (![websiteXP, gameplayXP].every(
    xp => Number.isSafeInteger(xp) && xp >= 0
  )) {
    throw new RangeError('Invalid XP totals');
  }

  const totalXP = websiteXP + gameplayXP;

  if (!Number.isSafeInteger(totalXP)) {
    throw new RangeError('XP total overflow');
  }

  const level = levelForXP(totalXP);
  const rank = rankForLevel(level);
  const owner = user.id === OWNER_ID && user.role === 'admin';

  return {
    level,
    websiteXP,
    gameplayXP,
    totalXP,
    currentLevelXP: xpForLevel(level),
    nextLevelXP: level < 100 ? xpForLevel(level + 1) : null,
    rank: owner ? 'MASTER' : rank.name,
    title: owner ? 'OWNER' : null,
    avatar: owner ? 'owner-avatar.png' : rank.avatar,
    premiumAccess: user.role === 'premium' || user.role === 'admin'
  };
}

module.exports = {
  RANKS,
  XP_ANCHORS,
  xpForLevel,
  levelForXP,
  rankForLevel,
  getProgress
};
