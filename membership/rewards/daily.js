'use strict';

const REWARDS = Object.freeze([25, 50, 75, 100, 150, 200, 500]);

function utcDay(date = new Date()) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) {
    throw new TypeError('Invalid date');
  }
  return date.toISOString().slice(0, 10);
}

function calculate(previous, today = utcDay()) {
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(today) ||
      utcDay(new Date(today + 'T00:00:00Z')) !== today) {
    throw new TypeError('Invalid UTC day');
  }

  const last = previous?.last_claim_date ?? null;
  const oldStreak = previous?.streak_days ?? 0;

  if (!Number.isInteger(oldStreak) ||
      oldStreak < 0 || oldStreak > 7) {
    throw new RangeError('Invalid streak');
  }

  if (last === today) {
    return { claimable: false, streak: oldStreak, xp: 0 };
  }

  let consecutive = false;

  if (last) {
    const date = new Date(last + 'T00:00:00Z');

    if (!Number.isFinite(date.getTime())) {
      throw new TypeError('Invalid previous claim date');
    }

    const difference =
      (Date.parse(today + 'T00:00:00Z') - date.getTime()) / 86400000;

    if (difference < 0) {
      throw new RangeError('Claim date is in the future');
    }

    consecutive = difference === 1;
  }

  const streak = consecutive
    ? (oldStreak % 7) + 1
    : 1;

  return {
    claimable: true,
    streak,
    xp: REWARDS[streak - 1],
    completedCycle: streak === 7
  };
}

module.exports = { REWARDS, utcDay, calculate };
