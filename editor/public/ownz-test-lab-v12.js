'use strict';
var ownzOwnerFetch = (...args) => { const fn = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof fn === 'function') return fn(...args); return new Promise((resolve, reject) => { const onReady = () => { const ready = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof ready !== 'function') { reject(new Error('OWNZ owner authentication bridge unavailable')); return; } clearTimeout(timeout); Promise.resolve().then(() => ready(...args)).then(resolve, reject); }; globalThis.addEventListener('ownz-owner-auth-ready', onReady, {once:true}); const timeout = setTimeout(() => { globalThis.removeEventListener('ownz-owner-auth-ready', onReady); reject(new Error('OWNZ owner authentication initialization timed out')); }, 10000); }); };
(()=>{
 function init(){
  if(document.getElementById('ownz-testlab-v12'))return;
  const explorer=document.getElementById('ownz-explorer-content');
  if(!explorer)return;
  const section=document.createElement('details');section.id='ownz-testlab-v12';
  section.style.cssText='margin:14px 8px;padding:12px;border:1px solid #a83246;border-radius:14px;background:#18090f;color:#fff';
  const summary=document.createElement('summary');summary.textContent='⚙ INSTALLER TEST LAB · v1.2';
  summary.style.cssText='cursor:pointer;background:#85172c;padding:14px;border-radius:9px;font-weight:800';
  const note=document.createElement('p');note.textContent='Guarded static archive inspection. Installer execution tests: NOT RUN. No live changes.';
  const refresh=document.createElement('button');refresh.type='button';refresh.textContent='↻ REFRESH REPORT';
  refresh.style.cssText='background:#9d1b32;color:white;padding:12px;border:1px solid #ef5672;border-radius:9px;font-weight:700;min-height:46px';
  const output=document.createElement('div');output.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6;font-size:13px;margin-top:14px';output.setAttribute('aria-live','polite');
  section.append(summary,note,refresh,output);explorer.prepend(section);
  async function load(){output.textContent='Loading report…';try{
   const response=await ownzOwnerFetch('/api/test-lab/status',{cache:'no-store'});
   const data=await response.json();if(!response.ok)throw Error(data.error||'HTTP '+response.status);
   const s=data.summary||{};
   output.textContent='LAST CHECK: '+(data.checkedAt||'Unknown')+'\nPASS: '+(s.pass||0)+'  REVIEW: '+(s.review||0)+'  FAIL: '+(s.fail||0)+'\nEXECUTION TESTS: 0 (NOT RUN)\n';
   for(const f of data.files||[]){const line=document.createElement('div');line.style.cssText='border-top:1px solid #733040;padding:9px 0';
    line.textContent=f.status+' · '+f.name+' · '+f.entries+' entries'+(f.warnings?.length?'\n'+f.warnings.join('\n'):'');output.append(line)}
  }catch(e){output.textContent='Report unavailable: '+e.message}}
  refresh.addEventListener('click',load);section.addEventListener('toggle',()=>{if(section.open)load()});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
