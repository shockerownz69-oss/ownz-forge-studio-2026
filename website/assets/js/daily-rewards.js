'use strict';

(() => {
  const API = '/api/members';
  const $ = id => document.getElementById(id);

  let generation = 0;
  let activeUser = null;
  let claiming = false;
  let claimOperation = 0;

  function status(text, error = false) {
    const el = $('ownz-daily-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? '#ff8585' : '#83e5a4';
  }

  function button(text, disabled = true) {
    const el = $('ownz-daily-claim');
    if (!el) return;
    el.textContent = text;
    el.disabled = disabled;
  }

  async function request(endpoint, options = {}) {
    const response = await fetch(API + endpoint, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...options
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  function clear() {
    generation++;
    activeUser = null;
    claiming = false;
    claimOperation++;

    const days = $('ownz-daily-days');
    if (days) days.replaceChildren();

    const streak = $('ownz-daily-streak');
    if (streak) streak.textContent = 'Log in to earn daily XP.';

    button('LOGIN REQUIRED', true);
    status('Log in to view your daily rewards.');
  }

  function render(data) {
    const days = $('ownz-daily-days');
    if (!days) return;

    days.replaceChildren();

    const rewards = data.rewards;

    if (!Array.isArray(rewards) || rewards.length !== 7 ||
        !rewards.every(Number.isSafeInteger)) {
      throw new Error('Invalid reward schedule');
    }

    const current = data.next?.claimable
      ? data.next.streak
      : data.streak;

    if (!Number.isInteger(current) || current < 0 || current > 7) {
      throw new Error('Invalid reward streak');
    }

    rewards.forEach((xp, index) => {
      const day = index + 1;
      const card = document.createElement('div');

      card.style.cssText =
        'min-width:0;padding:10px 2px;text-align:center;' +
        'border:1px solid #75202b;border-radius:9px;' +
        'background:' +
        (day === current ? '#69202a' : '#160b0e') + ';';

      const label = document.createElement('div');
      label.textContent = 'DAY ' + day;
      label.style.cssText =
        'font-size:10px;color:#ddd;overflow-wrap:anywhere';

      const reward = document.createElement('div');
      reward.textContent = xp + ' XP';
      reward.style.cssText =
        'font-size:12px;font-weight:900;color:#ff5366;' +
        'overflow-wrap:anywhere;margin-top:8px';

      card.append(label, reward);
      days.append(card);
    });

    const streak = $('ownz-daily-streak');
    if (streak) {
      streak.textContent =
        'CURRENT STREAK: ' + data.streak + ' DAYS';
    }

    if (data.next?.claimable) {
      button('CLAIM +' + data.next.xp + ' XP', claiming);
      status('Your daily reward is ready!');
    } else {
      button('REWARD CLAIMED TODAY', true);
      status('Come back after midnight UTC for your next reward.');
    }
  }

  async function load(userId) {
    if (activeUser !== userId) {
      claiming = false;
      claimOperation++;
    }
    const ticket = ++generation;
    activeUser = userId;

    button('CHECKING REWARD...', true);
    status('Loading your daily rewards...');

    try {
      const data = await request('/daily-reward');

      if (ticket !== generation || activeUser !== userId) return;

      render(data);
    } catch (error) {
      if (ticket !== generation) return;
      button('REWARD UNAVAILABLE', true);
      status(error.message, true);
    }
  }

  async function claim() {
    if (!activeUser || claiming) return;

    const userId = activeUser;
    const ticket = generation;

    claiming = true;
    const operation = ++claimOperation;
    button('CLAIMING...', true);
    status('Verifying your reward...');

    try {
      const result = await request('/daily-reward/claim', {
        method: 'POST'
      });

      if (ticket !== generation || activeUser !== userId || operation !== claimOperation) return;

      if (result.awarded) {
        document.dispatchEvent(new CustomEvent(
          'ownz:xp-updated',
          { detail: { userId } }
        ));
      }

      await load(userId);
    } catch (error) {
      if (ticket !== generation || activeUser !== userId || operation !== claimOperation) return;
      button('CHECKING REWARD...', true);
      status('Checking whether your reward was recorded...');
      await load(userId);
    } finally {
      if (operation !== claimOperation || activeUser !== userId) return;
      claiming = false;
      if (activeUser === userId) {
        const currentButton = $('ownz-daily-claim');
        if (currentButton) {
          if (currentButton.textContent.startsWith('CLAIM +')) {
            currentButton.disabled = false;
          } else if (currentButton.textContent === 'CLAIMING...') {
            currentButton.disabled = true;
          }
        }
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    $('ownz-daily-claim')?.addEventListener('click', claim);
    clear();
  });

  document.addEventListener('ownz:member-changed', event => {
    const userId = event.detail?.userId;

    if (typeof userId === 'string' && userId.length > 0) {
      load(userId);
    } else {
      clear();
    }
  });
})();
