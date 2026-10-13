/* FORGE Studio 2026 — home launcher routing hotfix.
   Bind directly to real workspace controls; don't infer routes from decorated text. */
(()=>{'use strict';
 const targets=['Files','Code','AI','Check'];
 function boot(){
  const launcher=document.querySelector('.ownz-v6-launcher');
  const nav=document.getElementById('ownz-workspace-nav');
  if(!launcher||!nav)return false;
  if(launcher.dataset.ownzTileFix==='1')return true;
  launcher.dataset.ownzTileFix='1';
  const tiles=[...launcher.querySelectorAll('.ownz-v6-tile')];
  for(let i=0;i<Math.min(tiles.length,targets.length);i++){
   const tile=tiles[i],route=targets[i];
   tile.dataset.ownzRoute=route;
   tile.addEventListener('click',event=>{
    // Suppress legacy tile listener: it guessed navigation from rendered button text.
    event.stopImmediatePropagation();
    event.preventDefault();
    const button=[...nav.querySelectorAll('button')].find(b=>
      (b.dataset.ownzLabel||b.getAttribute('aria-label')||b.querySelector('.ownz-v6-caption')?.textContent||b.querySelector('.ownz-v4-label')?.textContent||'').trim().toLowerCase()===route.toLowerCase());
    if(!button){console.error('FORGE: missing navigation destination',route);return;}
    button.click();
    // Explicitly reconcile workspace state even if an older navigation listener
    // attached before the controls were decorated with SVG icons.
    document.body.classList.remove('ownz-v4-home','ownz-v5-code','ownz-v5-files','ownz-v5-ai','ownz-v5-check','ownz-v5-focus');
    document.body.classList.add('ownz-v5-'+route.toLowerCase());
    for(const item of nav.querySelectorAll('button')){
      const name=(item.dataset.ownzLabel||item.getAttribute('aria-label')||item.querySelector('.ownz-v6-caption')?.textContent||item.querySelector('.ownz-v4-label')?.textContent||'').trim();
      const active=name.toLowerCase()===route.toLowerCase();
      item.classList.toggle('ownz-selected',active);
      if(active)item.setAttribute('aria-current','page');else item.removeAttribute('aria-current');
    }
    window.scrollTo({top:0,behavior:'instant'});
   },{capture:true});
  }
  return true;
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,500),{once:true});else setTimeout(boot,500);
 let attempts=0;const retry=setInterval(()=>{if(boot()||++attempts>30)clearInterval(retry)},250);
})();
