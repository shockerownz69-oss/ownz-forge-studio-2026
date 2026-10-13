'use strict';
(()=>{
 function init(){if(document.getElementById('ownz-autosync-v21'))return;
 const anchor=document.getElementById('ownz-explorer-content')||document.querySelector('.workspace');if(!anchor)return;
 const host=document.createElement('section');host.id='ownz-autosync-v21';host.className='ownz-as21';host.innerHTML=`<div class="ownz-as21-head"><span>🛡 OWNZ AUTOSYNC · CONTROL CENTER</span><span class="ownz-as21-chip">READ ONLY</span></div><button class="ownz-as21-toggle" type="button" aria-expanded="false">▸ BACKUP & RECOVERY DASHBOARD</button><div class="ownz-as21-body" hidden><p class="ownz-as21-note">Real local Git and recovery data. No backup, deletion or publishing commands can run from this panel.</p><div class="ownz-as21-grid"><div><small>LOCAL BRANCH</small><strong data-field="branch">—</strong></div><div><small>GIT COMMIT</small><strong data-field="head">—</strong></div><div><small>GITHUB TRACKING</small><strong data-field="remote">—</strong></div><div><small>QWEN MODEL</small><strong data-field="model">—</strong></div></div><div class="ownz-as21-row"><strong>RECOVERY HISTORY</strong><button type="button" class="ownz-as21-refresh">↻ REFRESH</button></div><p class="ownz-as21-state" role="status" aria-live="polite">Open panel to load local status.</p><div class="ownz-as21-history"></div></div>`;
 anchor.prepend(host);
 const body=host.querySelector('.ownz-as21-body'),toggle=host.querySelector('.ownz-as21-toggle'),state=host.querySelector('.ownz-as21-state'),history=host.querySelector('.ownz-as21-history');
 const set=(key,value)=>{host.querySelector(`[data-field="${key}"]`).textContent=value};
 async function json(url){const r=await fetch(url,{cache:'no-store',credentials:'same-origin'});if(!r.ok)throw Error('API HTTP '+r.status);return r.json()}
 function size(n){return n>=1048576?(n/1048576).toFixed(1)+' MB':(n/1024).toFixed(0)+' KB'}
 let busy=false;async function refresh(){if(busy)return;busy=true;state.textContent='Loading live local data…';try{
 const [s,h]=await Promise.all([json('/api/autosync/status'),json('/api/autosync/history')]);if(!s.ok||!h.ok)throw Error('API unavailable');
 set('branch',s.branch||'—');set('head',s.head||'—');set('remote',s.locallyAligned?'LOCAL = ORIGIN':s.remoteHead?'DIFFERENT':'UNKNOWN');set('model',s.modelPresent&&s.modelIgnored?'PRESENT · IGNORED':'CHECK REQUIRED');
 history.replaceChildren();for(const b of h.bundles){const row=document.createElement('div');row.className='ownz-as21-bundle';const label=document.createElement('span');label.textContent=b.name;const meta=document.createElement('small');meta.textContent=size(b.bytes)+(b.lightweight?' · lightweight':' · large preserved');row.append(label,meta);history.appendChild(row)}
 if(!h.bundles.length)history.textContent='No AutoSync recovery bundles found.';state.textContent=h.count+' recovery bundle(s) found · local read-only view';
 }catch(e){state.textContent='Unable to load AutoSync data. Check backend on port 3001.';history.replaceChildren()}finally{busy=false}}
 toggle.addEventListener('click',()=>{body.hidden=!body.hidden;toggle.setAttribute('aria-expanded',String(!body.hidden));toggle.textContent=body.hidden?'▸ BACKUP & RECOVERY DASHBOARD':'▾ BACKUP & RECOVERY DASHBOARD';if(!body.hidden)refresh()});host.querySelector('.ownz-as21-refresh').addEventListener('click',refresh);
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
