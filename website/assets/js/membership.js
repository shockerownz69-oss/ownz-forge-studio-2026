'use strict';

(() => {
  const API = '/api/members';
  const $ = id => document.getElementById(id);

  function message(text, error = false) {
    const el = $('member-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? '#ff8585' : '#83e5a4';
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


  // OWNZ PROFILE EDITOR V1
  let profileTicket = 0;
  let activeProfileUser = null;

  function profileStatus(text, error = false) {
    const el = $('ownz-profile-status');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? '#ff8585' : '#83e5a4';
  }

  function clearProfile() {
    profileTicket++;
    activeProfileUser = null;

    const form = $('ownz-profile-form');
    if (form) form.reset();

    profileStatus('Log in to manage your profile.');

    const reward = $('ownz-profile-reward');
    if (reward) {
      reward.textContent = '◆ PROFILE COMPLETION REWARD: 100 XP';
    }
  }

  async function loadProfile(user) {
    const ticket = ++profileTicket;
    activeProfileUser = user.id;

    profileStatus('Loading your Empire profile...');

    try {
      const data = await request('/profile');

      if (ticket !== profileTicket ||
          activeProfileUser !== user.id) return;

      const profile = data.profile || {};

      const fields = {
        'ownz-profile-name': profile.display_name,
        'ownz-profile-bio': profile.bio,
        'ownz-profile-game': profile.favorite_game
      };

      for (const [id, value] of Object.entries(fields)) {
        const el = $(id);
        if (el) el.value = typeof value === 'string' ? value : '';
      }

      const reward = $('ownz-profile-reward');

      if (reward) {
        reward.textContent = profile.completed_at
          ? '✓ PROFILE COMPLETE — 100 XP REWARD UNLOCKED'
          : '◆ COMPLETE ALL FIELDS TO EARN 100 XP';
      }

      profileStatus(
        profile.completed_at
          ? 'Your Empire profile is complete.'
          : 'Complete your profile to unlock your reward.'
      );
    } catch (error) {
      if (ticket === profileTicket) {
        profileStatus(error.message, true);
      }
    }
  }

  async function saveProfile(event) {
    event.preventDefault();

    const form = $('ownz-profile-form');
    const button = $('ownz-profile-save');

    if (!form || !activeProfileUser) return;

    const userId = activeProfileUser;
    const ticket = profileTicket;

    if (button) button.disabled = true;

    profileStatus('Saving your Empire profile...');

    try {
      const fields = Object.fromEntries(new FormData(form));

      const data = await request('/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });

      if (ticket !== profileTicket ||
          activeProfileUser !== userId) return;

      const reward = $('ownz-profile-reward');

      if (data.reward?.awarded) {
        profileStatus('PROFILE COMPLETE! +100 WEBSITE XP EARNED!');

        if (reward) {
          reward.textContent = '✓ +100 XP AWARDED — PROFILE COMPLETE';
        }
      } else if (data.complete) {
        profileStatus('Empire profile saved successfully.');

        if (reward) {
          reward.textContent = '✓ PROFILE COMPLETE — REWARD ALREADY UNLOCKED';
        }
      } else {
        profileStatus('Profile saved. Complete all fields for 100 XP.');
      }

      loadProgress({ id: userId });
    } catch (error) {
      if (ticket === profileTicket) {
        profileStatus(error.message, true);
      }
    } finally {
      if (button) button.disabled = false;
    }
  }

  function showUser(user) {
    const guest = $('member-guest');
    const dashboard = $('member-dashboard');

    if (guest) guest.hidden = Boolean(user);
    if (dashboard) dashboard.hidden = !user;

    document.dispatchEvent(new CustomEvent('ownz:member-changed', { detail: { userId: user?.id ?? null } }));

    if (user) {
      if ($('member-name')) $('member-name').textContent = user.username;
      if ($('member-role')) $('member-role').textContent = user.role.toUpperCase();
      const founder = $('owner-profile');
      if (founder) founder.hidden = !(user.id === 'd0ffa578-eb47-4ab5-9a0e-08ce1d61d212' && user.role === 'admin');
      message('Welcome to the Shocker OwnZ Empire!');
      loadProgress(user);
      loadProfile(user);
    } else {
      progressRequest++;
      clearProgress();
      clearProfile();
      const founder = $('owner-profile');
      if (founder) founder.hidden = true;
    }
  }

  let progressRequest = 0;

  function clearProgress() {
    const fields = [
      'ownz-level', 'ownz-rank', 'ownz-title',
      'ownz-website-xp', 'ownz-gameplay-xp',
      'ownz-total-xp', 'ownz-xp-label',
      'ownz-premium-status'
    ];
    for (const id of fields) {
      const el = $(id);
      if (el) el.textContent = '—';
    }
    if ($('ownz-xp-fill')) $('ownz-xp-fill').style.width = '0%';
    if ($('ownz-xp-track')) $('ownz-xp-track').setAttribute('aria-valuenow', '0');
    if ($('ownz-progress-error')) $('ownz-progress-error').hidden = true;
  }

  async function loadProgress(user) {
    const ticket = ++progressRequest;
    clearProgress();

    try {
      const data = await request('/progress');

      if (ticket !== progressRequest) return;

      const p = data.progress;
      if (!p || !Number.isSafeInteger(p.level) ||
          !Number.isSafeInteger(p.totalXP) ||
          !Number.isSafeInteger(p.websiteXP) ||
          !Number.isSafeInteger(p.gameplayXP)) {
        throw new Error('Invalid progression response');
      }

      const format = value => value.toLocaleString('en-US');
      const put = (id, value) => {
        const el = $(id);
        if (el) el.textContent = String(value);
      };

      put('ownz-level', p.level);
      put('ownz-rank', p.rank);
      put('ownz-title', p.title || '');
      put('ownz-website-xp', format(p.websiteXP));
      put('ownz-gameplay-xp', format(p.gameplayXP));
      put('ownz-total-xp', format(p.totalXP));

      const start = p.currentLevelXP;
      const target = p.nextLevelXP;

      if (p.level >= 100 || target === null) {
        put('ownz-xp-label', 'MAX LEVEL ACHIEVED');
        if ($('ownz-xp-fill')) $('ownz-xp-fill').style.width = '100%';
        if ($('ownz-xp-track')) $('ownz-xp-track').setAttribute('aria-valuenow', '100');
      } else {
        if (!Number.isSafeInteger(start) ||
            !Number.isSafeInteger(target) ||
            target <= start ||
            p.totalXP < start ||
            p.totalXP >= target) {
          throw new Error('Invalid XP level thresholds');
        }

        const percent = Math.max(0, Math.min(100,
          Math.round(((p.totalXP - start) / Math.max(1, target - start)) * 100)
        ));

        put('ownz-xp-label', format(p.totalXP) + ' / ' + format(target) + ' XP');
        if ($('ownz-xp-fill')) $('ownz-xp-fill').style.width = percent + '%';
        if ($('ownz-xp-track')) $('ownz-xp-track').setAttribute('aria-valuenow', String(percent));
      }

      put('ownz-premium-status',
        p.premiumAccess ? '◆ PREMIUM ACCESS VERIFIED' : 'FREE MEMBERSHIP'
      );
    } catch (error) {
      if (ticket !== progressRequest) return;
      const el = $('ownz-progress-error');
      if (el) {
        el.textContent = 'Progress unavailable: ' + error.message;
        el.hidden = false;
      }
    }
  }

  async function refreshSession() {
    try {
      const data = await request('/me');
      showUser(data.user);
    } catch {
      showUser(null);
    }
  }

  async function submitForm(form, endpoint) {
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;

    message('Processing your request...');

    try {
      const fields = Object.fromEntries(new FormData(form));

      const data = await request(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields)
      });

      form.reset();
      showUser(data.user);
    } catch (error) {
      message(error.message || 'Something went wrong', true);
    } finally {
      if (button) button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    const register = $('member-register-form');
    const login = $('member-login-form');
    const logout = $('member-logout');

    document.addEventListener('ownz:xp-updated', event => {
      const userId = event.detail?.userId;
      if (userId && userId === activeProfileUser) {
        loadProgress({ id: userId });
      }
    });

    const profileForm = $('ownz-profile-form');
    profileForm?.addEventListener('submit', saveProfile);


    register?.addEventListener('submit', event => {
      event.preventDefault();
      submitForm(register, '/register');
    });

    login?.addEventListener('submit', event => {
      event.preventDefault();
      submitForm(login, '/login');
    });

    logout?.addEventListener('click', async () => {
      try {
        await request('/logout', { method: 'POST' });
        showUser(null);
        message('You have been logged out.');
      } catch (error) {
        message(error.message, true);
      }
    });

    refreshSession();
  });
})();
