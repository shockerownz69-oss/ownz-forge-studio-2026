'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const source = fs.readFileSync(
  path.join(__dirname, '../website/assets/js/daily-rewards.js'),
  'utf8'
);

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

function createHarness() {
  const elements = new Map();
  const events = new EventTarget();
  const calls = [];
  const pendingClaim = deferred();

  class Element {
    constructor() {
      this.textContent = '';
      this.disabled = false;
      this.style = {};
      this.children = [];
    }
    replaceChildren(...children) {
      this.children = children;
    }
    append(...children) {
      this.children.push(...children);
    }
    addEventListener(type, handler) {
      this['on' + type] = handler;
    }
    click() {
      if (!this.disabled && this.onclick) this.onclick();
    }
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() {
      return new Element();
    },
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events)
  };

  const rewardData = {
    streak: 0,
    next: { claimable: true, streak: 1, xp: 25 },
    rewards: [25, 50, 75, 100, 150, 200, 500]
  };

  const fetch = async (url, options = {}) => {
    calls.push({ url, method: options.method || 'GET' });

    if (url.endsWith('/daily-reward/claim')) {
      return pendingClaim.promise;
    }

    return {
      ok: true,
      json: async () => rewardData
    };
  };

  vm.runInNewContext(source, {
    document,
    fetch,
    CustomEvent,
    console
  });

  events.dispatchEvent(new Event('DOMContentLoaded'));

  return { document, elements, events, calls, pendingClaim };
}

async function flush() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test('Daily Rewards blocks duplicate claim clicks', async () => {
  const h = createHarness();

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-A' } }
  ));

  await flush();

  const button = h.document.getElementById('ownz-daily-claim');

  assert.equal(button.disabled, false);

  button.click();
  button.click();

  await flush();

  const claims = h.calls.filter(
    call => call.url.endsWith('/daily-reward/claim')
  );

  assert.equal(claims.length, 1);

  h.pendingClaim.resolve({
    ok: true,
    json: async () => ({
      awarded: true,
      xp: 25
    })
  });

  await flush();

  assert.equal(claims.length, 1);
});

test('Daily Rewards ignores claim responses after logout', async () => {
  const h = createHarness();
  let xpUpdates = 0;

  h.events.addEventListener('ownz:xp-updated', () => {
    xpUpdates++;
  });

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-A' } }
  ));

  await flush();

  const button = h.document.getElementById('ownz-daily-claim');

  button.click();

  await flush();

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: null } }
  ));

  h.pendingClaim.resolve({
    ok: true,
    json: async () => ({
      awarded: true,
      xp: 25
    })
  });

  await flush();

  assert.equal(xpUpdates, 0);
  assert.equal(button.disabled, true);
  assert.equal(button.textContent, 'LOGIN REQUIRED');
  assert.equal(
    h.document.getElementById('ownz-daily-streak').textContent,
    'Log in to earn daily XP.'
  );
});

test('Daily Rewards isolates pending claims across account switches', async () => {
  const h = createHarness();
  const xpUpdates = [];

  h.events.addEventListener('ownz:xp-updated', event => {
    xpUpdates.push(event.detail.userId);
  });

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-A' } }
  ));

  await flush();

  const button = h.document.getElementById('ownz-daily-claim');
  button.click();

  await flush();

  const initialClaims = h.calls.filter(
    call => call.url.endsWith('/daily-reward/claim')
  );

  assert.equal(initialClaims.length, 1);

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-B' } }
  ));

  await flush();

  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'CLAIM +25 XP');

  h.pendingClaim.resolve({
    ok: true,
    json: async () => ({
      awarded: true,
      xp: 25
    })
  });

  await flush();

  assert.deepEqual(xpUpdates, []);
  assert.equal(button.disabled, false);
  assert.equal(button.textContent, 'CLAIM +25 XP');
});

test('Successful daily claim triggers exactly one XP refresh', async () => {
  const h = createHarness();
  const updates = [];

  h.events.addEventListener('ownz:xp-updated', event => {
    updates.push(event.detail.userId);
  });

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-A' } }
  ));

  await flush();

  h.document.getElementById('ownz-daily-claim').click();

  h.pendingClaim.resolve({
    ok: true,
    json: async () => ({
      success: true,
      awarded: true,
      duplicate: false,
      xp: 25
    })
  });

  await flush();

  assert.deepEqual(updates, ['member-A']);
});

test('Duplicate daily claim does not trigger XP refresh', async () => {
  const h = createHarness();
  const updates = [];

  h.events.addEventListener('ownz:xp-updated', event => {
    updates.push(event.detail.userId);
  });

  h.events.dispatchEvent(new CustomEvent(
    'ownz:member-changed',
    { detail: { userId: 'member-A' } }
  ));

  await flush();

  h.document.getElementById('ownz-daily-claim').click();

  h.pendingClaim.resolve({
    ok: true,
    json: async () => ({
      success: true,
      awarded: false,
      duplicate: true,
      xp: 0
    })
  });

  await flush();

  assert.deepEqual(updates, []);
});

test('Delayed reward response cannot overwrite a newer member session', async () => {
  const elements = new Map();
  const events = new EventTarget();
  const pending = [];

  class Element {
    constructor() {
      this.textContent = '';
      this.disabled = false;
      this.style = {};
      this.children = [];
    }
    replaceChildren(...items) { this.children = items; }
    append(...items) { this.children.push(...items); }
    addEventListener(type, fn) { this['on' + type] = fn; }
  }

  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement() { return new Element(); },
    addEventListener: events.addEventListener.bind(events),
    dispatchEvent: events.dispatchEvent.bind(events)
  };

  const fetch = () => {
    const task = deferred();
    pending.push(task);
    return task.promise;
  };

  vm.runInNewContext(source, { document, fetch, CustomEvent, console });
  events.dispatchEvent(new Event('DOMContentLoaded'));

  events.dispatchEvent(new CustomEvent('ownz:member-changed', {
    detail: { userId: 'member-A' }
  }));

  events.dispatchEvent(new CustomEvent('ownz:member-changed', {
    detail: { userId: 'member-B' }
  }));

  assert.equal(pending.length, 2);

  const response = (streak, xp) => ({
    ok: true,
    json: async () => ({
      streak,
      next: { claimable: true, streak: streak + 1, xp },
      rewards: [25, 50, 75, 100, 150, 200, 500]
    })
  });

  pending[1].resolve(response(3, 100));
  await flush();

  assert.equal(
    document.getElementById('ownz-daily-streak').textContent,
    'CURRENT STREAK: 3 DAYS'
  );

  pending[0].resolve(response(1, 50));
  await flush();

  assert.equal(
    document.getElementById('ownz-daily-streak').textContent,
    'CURRENT STREAK: 3 DAYS'
  );

  assert.equal(
    document.getElementById('ownz-daily-claim').textContent,
    'CLAIM +100 XP'
  );
});
