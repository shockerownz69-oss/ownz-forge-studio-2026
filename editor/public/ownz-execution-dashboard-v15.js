var ownzOwnerFetch = (...args) => { const fn = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof fn === 'function') return fn(...args); return new Promise((resolve, reject) => { const onReady = () => { const ready = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof ready !== 'function') { reject(new Error('OWNZ owner authentication bridge unavailable')); return; } clearTimeout(timeout); Promise.resolve().then(() => ready(...args)).then(resolve, reject); }; globalThis.addEventListener('ownz-owner-auth-ready', onReady, {once:true}); const timeout = setTimeout(() => { globalThis.removeEventListener('ownz-owner-auth-ready', onReady); reject(new Error('OWNZ owner authentication initialization timed out')); }, 10000); }); };
(()=>{
  'use strict';
  function init(){
    if(document.getElementById('ownz-execution-dashboard-v15'))return;
    const anchor=document.getElementById('ownz-explorer-content');
    if(!anchor){console.warn('[OWNZ] Execution Lab dashboard anchor unavailable');return;}
    const panel=document.createElement('details');
    panel.id='ownz-execution-dashboard-v15';
    panel.style.cssText='margin:12px 0;padding:14px;border:1px solid #8d2626;border-radius:12px;background:#140b0b;color:#f7eaea;font:13px/1.5 system-ui,sans-serif;overflow-wrap:anywhere';
    const summary=document.createElement('summary');
    summary.textContent='⚙ EXECUTION LAB · v1.5 · GUARDED';
    summary.style.cssText='font-weight:800;letter-spacing:.04em;cursor:pointer;color:#ff6a61';
    const note=document.createElement('p');
    note.textContent='Archive inspection and execution planning only. No installers are executed.';
    const refresh=document.createElement('button');
    refresh.type='button';refresh.textContent='↻ REFRESH EXECUTION REPORT';
    refresh.style.cssText='padding:9px 12px;background:#741b1b;color:#fff;border:1px solid #c94848;border-radius:8px;cursor:pointer';
    const output=document.createElement('pre');
    output.setAttribute('role','status');output.setAttribute('aria-live','polite');
    output.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;background:#0c0808;border:1px solid #4c2424;border-radius:8px;padding:12px;max-height:450px;overflow:auto';
    output.textContent='Open to load latest report.';
    panel.append(summary,note,refresh,output);anchor.prepend(panel);
    async function load(){
      output.textContent='Loading…';
      try{
        const response=await ownzOwnerFetch('/api/execution-lab/status',{cache:'no-store'});
        if(!response.ok)throw Error('API HTTP '+response.status);
        const d=await response.json();
        const counts=d.summary||{};
        const lines=[
          `PASS: ${counts.pass??0}   REVIEW: ${counts.review??0}   FAIL: ${counts.fail??0}`,
          `Mode: ${d.mode||'UNKNOWN'}`,
          `Execution tests: ${d.executionTests??'UNKNOWN'}`,
          `Isolation verified: ${d.isolationVerified===true?'YES':'NO'}`,
          `Last check: ${d.checkedAt||'Unknown'}`,
          '',
          ...((Array.isArray(d.files)?d.files:[]).flatMap(f=>[
            `${f.status||'?'} · ${f.name||'Unnamed archive'}`,
            `  Installer: ${(f.installers||[]).join(', ')||'Not detected'}`,
            `  Execution: ${f.execution||'NOT_RUN'}`,
            ...(f.warnings||[]).map(w=>'  ⚠ '+w)
          ]))
        ];
        output.textContent=lines.join('\n');
      }catch(e){output.textContent='Execution Lab report unavailable: '+e.message+'\nRestart the backend after installing this dashboard module.';}
    }
    refresh.addEventListener('click',load);
    panel.addEventListener('toggle',()=>{if(panel.open)load();});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
