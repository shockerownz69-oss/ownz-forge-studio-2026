/* OWNZ Forge Workspace V2 repair: render navigation independently of panel initialization. */
(function () {
  'use strict';
  function initialize() {
    if (document.getElementById('ownz-workspace-nav')) return;
    const nav = document.createElement('nav');
    nav.id = 'ownz-workspace-nav';
    nav.setAttribute('aria-label', 'Workspace quick navigation');
    const items = [
      ['Files', 'ownz-explorer-content'],
      ['Code', 'editor'],
      ['Check', 'ownz-intelligence-panel'],
      ['AI', 'ownz-ai-panel']
    ];
    for (const [label, targetId] of items) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.addEventListener('click', function () {
        const target = document.getElementById(targetId);
        if (!target) { console.warn('OWNZ workspace target missing:', targetId); return; }
        if (targetId === 'ownz-explorer-content' && (target.hidden || getComputedStyle(target).display === 'none')) {
          document.getElementById('ownz-explorer-toggle')?.click();
        }
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
      nav.appendChild(button);
    }
    document.body.appendChild(nav);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
