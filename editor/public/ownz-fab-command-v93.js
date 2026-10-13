'use strict';
var ownzOwnerFetch = (...args) => { const fn = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof fn === 'function') return fn(...args); return new Promise((resolve, reject) => { const onReady = () => { const ready = globalThis.OWNZ_FORGE_OWNER_FETCH; if (typeof ready !== 'function') { reject(new Error('OWNZ owner authentication bridge unavailable')); return; } clearTimeout(timeout); Promise.resolve().then(() => ready(...args)).then(resolve, reject); }; globalThis.addEventListener('ownz-owner-auth-ready', onReady, {once:true}); const timeout = setTimeout(() => { globalThis.removeEventListener('ownz-owner-auth-ready', onReady); reject(new Error('OWNZ owner authentication initialization timed out')); }, 10000); }); };
(() => {
  const init = () => {
    if(document.getElementById('fab-v93')) return;
    const anchor=document.getElementById('fatal-role-list');
    if(!anchor) return;
    const host=document.createElement('section');
    host.id='fab-v93';
    host.className='fab93';
    host.innerHTML=`<h3>⚡ FATALACIDBURN — SPECIALIST COMMAND CENTER</h3>
      <p class="fab93-note">Two-stage AI collaboration. Opt-in only; consumes up to two Groq requests. No project files are modified.</p>
      <div class="fab93-stats"><strong id="fab93-count">— specialists</strong><span id="fab93-status" role="status" aria-live="polite">Ready</span></div>
      <label for="fab93-filter">Search specialists</label><input id="fab93-filter" type="search" placeholder="Godot, security, QA…" />
      <div id="fab93-roles" class="fab93-roles" aria-label="Registered specialists"></div>
      <label for="fab93-task">Collaboration task</label><textarea id="fab93-task" maxlength="4000" rows="4" placeholder="Review my Godot inventory code for bugs…"></textarea>
      <label for="fab93-code">Optional code (max 30,000 characters)</label><textarea id="fab93-code" maxlength="30000" rows="5" placeholder="Paste code for review; no files will be changed"></textarea>
      <label class="fab93-consent"><input id="fab93-confirm" type="checkbox"> I approve up to two Groq model requests for this task.</label>
      <div class="fab93-actions"><button type="button" id="fab93-run">⚡ RUN COLLABORATION</button><button type="button" id="fab93-refresh">↻ REFRESH</button></div>
      <div id="fab93-result" class="fab93-result" role="status" aria-live="polite">No collaboration run yet.</div>`;
    anchor.parentElement.appendChild(host);
    const $=id=>host.querySelector('#'+id);
    let roles=[],busy=false;
    const status=s=>{$('fab93-status').textContent=s};
    const showError=e=>{$('fab93-result').textContent=String(e.message||e)};
    function render(){
      const q=$('fab93-filter').value.trim().toLowerCase();
      $('fab93-count').textContent=roles.length+' specialists · '+roles.filter(r=>r.enabled).length+' enabled';
      const list=$('fab93-roles');list.replaceChildren();
      for(const role of roles.filter(r=>r.name.toLowerCase().includes(q)).slice(0,50)){
        const item=document.createElement('div');item.className='fab93-role';
        const name=document.createElement('span');name.textContent=role.name;
        const state=document.createElement('small');state.textContent=role.enabled?'ENABLED':'DISABLED';
        item.append(name,state);list.append(item);
      }
    }
    async function refresh(){
      status('Loading…');
      try {
        const res=await ownzOwnerFetch('/api/ai/roles',{cache:'no-store'});
        if(!res.ok)throw Error('Roles API HTTP '+res.status);
        const data=await res.json();if(!Array.isArray(data.roles))throw Error('Invalid roles response');
        roles=data.roles;render();status('Ready');
      }catch(e){status('API unavailable');showError(e)}
    }
    $('fab93-filter').addEventListener('input',render);
    $('fab93-refresh').addEventListener('click',refresh);
    $('fab93-run').addEventListener('click',async()=>{
      if(busy)return;
      const message=$('fab93-task').value.trim(),code=$('fab93-code').value;
      if(!message){status('Enter a task');return}
      if(!$('fab93-confirm').checked){status('Approve model requests first');return}
      busy=true;$('fab93-run').disabled=true;status('Collaborating…');
      $('fab93-result').textContent='Planning and reviewing. Please wait…';
      try{
        const res=await ownzOwnerFetch('/api/ai/collaborate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,code})});
        const data=await res.json();if(!res.ok)throw Error(data.error||'HTTP '+res.status);
        $('fab93-result').textContent=JSON.stringify(data,null,2);
        status('Response received · code tests not run');
      }catch(e){status('Collaboration incomplete');showError(e)}
      finally{busy=false;$('fab93-run').disabled=false;$('fab93-confirm').checked=false}
    });
    refresh();
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();