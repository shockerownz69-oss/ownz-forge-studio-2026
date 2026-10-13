(()=>{'use strict';
const E=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e};
const state={loaded:false,busy:false};
const glyph={projects:'▱',files:'▤',folders:'▣',ai:'✦',status:'◉',code:'</>',activity:'⌁'};
function card(key,label,icon){const c=E('article','v7-stat v7-stat-'+key);c.append(E('span','v7-stat-icon',glyph[icon]||'◈'),E('span','v7-stat-label',label));const val=E('strong','v7-stat-value','—');val.id='v7-'+key;const note=E('small','v7-stat-note','Checking…');note.id='v7-'+key+'-note';c.append(val,note);return c}
function update(key,val,note,status){const v=document.getElementById('v7-'+key),n=document.getElementById('v7-'+key+'-note');if(v)v.textContent=String(val);if(n)n.textContent=note||'';if(v&&status)v.dataset.state=status;const hv=document.getElementById('v7-'+key+'-health'),hn=document.getElementById('v7-'+key+'-health-note');if(hv)hv.textContent=String(val);if(hn)hn.textContent=note||''}
async function json(url){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),6500);try{const r=await fetch(url,{cache:'no-store',signal:controller.signal,credentials:'same-origin'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json()}finally{clearTimeout(t)}}
const WORKSPACE='ECHOBOUND', MAX_FOLDERS=180, MAX_DEPTH=12;
function safeName(v){return typeof v==='string'&&v!=='.'&&v!=='..'&&!v.includes('/')&&!v.includes('\\')&&!v.includes('\0')}
async function walk(){
 const queue=[{path:WORKSPACE,depth:0}], visited=new Set(), totals={files:0,folders:0,rootFiles:0,rootFolders:0,types:{},projects:0}, errors=[];
 while(queue.length){
  const item=queue.shift();if(visited.has(item.path))continue;visited.add(item.path);
  if(visited.size>MAX_FOLDERS){errors.push('Scan limit reached');break}
  let entries;try{entries=await json('/api/files?path='+encodeURIComponent(item.path));if(!Array.isArray(entries))throw Error('Unexpected listing')}
  catch(e){errors.push(item.path+': '+e.message);continue}
  for(const e of entries){
   if(!e||!safeName(e.name))continue;
   if(e.type==='folder'){
    totals.folders++;if(item.depth===0)totals.rootFolders++;
    if(item.depth<MAX_DEPTH)queue.push({path:item.path+'/'+e.name,depth:item.depth+1});
    else errors.push('Depth limit reached');
   }else{
    totals.files++;if(item.depth===0)totals.rootFiles++;
    const ext=/\.([a-z0-9]+)$/i.exec(e.name);
    if(ext)totals.types[ext[1].toLowerCase()]=(totals.types[ext[1].toLowerCase()]||0)+1;
    if(e.name==='project.godot')totals.projects++;
   }
  }
 }
 return {totals,errors,visited:visited.size};
}
async function refresh(){
 if(state.busy)return;state.busy=true;
 const stamp=document.getElementById('v7-updated');if(stamp)stamp.textContent='Scanning ECHOBOUND workspace…';
 const jobs=[
 (async()=>{const start=performance.now();try{
  const {totals:t,errors,visited}=await walk();
  const partial=errors.length>0;
  update('folders',partial?'≥'+t.folders:t.folders,'Folders inside ECHOBOUND'+(partial?' · partial scan':''));
  update('files',partial?'≥'+t.files:t.files,'Files across workspace'+(partial?' · partial scan':''));
  update('projects',partial?'≥'+t.projects:t.projects,'Godot project.godot files'+(partial?' · partial scan':''));
  update('backend',partial?'PARTIAL':'ONLINE',Math.round(performance.now()-start)+' ms · '+visited+' directories scanned',partial?'warn':'ok');
  const langs=Object.entries(t.types).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const el=document.getElementById('v7-filetypes');if(el)el.textContent=langs.length?langs.map(([k,n])=>'.'+k+' '+n).join('  ·  '):'No file extensions found';
  const root=document.getElementById('v8-scope');if(root)root.textContent='ECHOBOUND · '+t.rootFolders+' top-level folders · '+t.rootFiles+' top-level files'+(partial?' · INCOMPLETE':'');
 }catch(e){
  for(const k of ['folders','files','projects'])update(k,'—','Scan unavailable');
  update('backend','OFFLINE','Could not scan workspace','bad');
 }})(),
 (async()=>{try{const data=await json('/api/ai/status');update('provider',data.provider||'None',data.model||'No model reported',data.ready?'ok':'warn');update('ai',data.ready?'READY':'NOT READY',data.ready?'Provider configured (not a live generation test)':'Provider unavailable',data.ready?'ok':'warn')}catch(e){update('provider','—','AI status unavailable');update('ai','UNKNOWN','Could not contact AI API','warn')}})(),
 (async()=>{try{const data=await json('/api/ai/conversations');if(!Array.isArray(data.conversations))throw Error('Unexpected response');update('sessions',data.conversations.length,'Saved conversations returned · max 50')}catch(e){update('sessions','—','Conversation count unavailable')}})()
 ];
 await Promise.allSettled(jobs);
 if(stamp)stamp.textContent='Last checked '+new Date().toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+' · Tap refresh for latest';
 state.last=Date.now();state.busy=false;
}
function init(){const dash=document.getElementById('ownz-v4-dashboard');if(!dash||document.getElementById('ownz-v7-mission'))return;const root=E('section','ownz-v7-mission ownz-v8-mission');root.id='ownz-v7-mission';const heading=E('div','v7-mission-head');const copy=E('div');copy.append(E('span','v7-eyebrow','◈ LIVE DEVELOPMENT TELEMETRY'),E('h2','v7-title','MISSION CONTROL'));const refreshBtn=E('button','v7-refresh','↻ REFRESH');refreshBtn.type='button';refreshBtn.addEventListener('click',refresh);heading.append(copy,refreshBtn);root.append(heading);
 const scope=E('p','v8-scope','ECHOBOUND · Scanning workspace…');scope.id='v8-scope';root.append(scope);const grid=E('div','v7-stat-grid');[['projects','Godot projects','projects'],['files','Workspace files','files'],['sessions','AI conversations','ai'],['ai','FatalAcidBurn','status']].forEach(([k,l,i])=>grid.append(card(k,l,i)));root.append(grid);
 const health=E('div','v7-health');health.append(E('h3','','⌁ SYSTEM HEALTH'));const rows=E('div','v7-health-grid');[['backend','Forge file API','status'],['provider','AI provider','ai'],['folders','Workspace folders','folders']].forEach(([k,l,i])=>{const r=E('div','v7-health-row');r.append(E('span','',l));const v=E('strong','', '—');v.id='v7-'+k+'-health';const sub=E('small','');sub.id='v7-'+k+'-health-note';r.append(v,sub);rows.append(r)});health.append(rows);root.append(health);
 const types=E('div','v7-types');types.append(E('span','','⌁ FILE TYPES'),E('span','', 'Checking…'));types.lastChild.id='v7-filetypes';root.append(types);const stamp=E('p','v7-stamp','Awaiting live data');stamp.id='v7-updated';root.append(stamp);
 const hero=dash.querySelector('.ownz-v4-hero');if(hero)hero.after(root);else dash.prepend(root);
 // Reflect values in health panel without duplicating requests.
 const observer=new MutationObserver(()=>{for(const k of ['backend','provider','folders']){const source=document.getElementById('v7-'+k),target=document.getElementById('v7-'+k+'-health'),note=document.getElementById('v7-'+k+'-health-note');if(source&&target&&target.textContent!==source.textContent)target.textContent=source.textContent;const sn=document.getElementById('v7-'+k+'-note');if(sn&&note&&note.textContent!==sn.textContent)note.textContent=sn.textContent}});
 observer.observe(root,{childList:true,characterData:true,subtree:true});
 refresh();document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-(state.last||0)>60000){refresh()}});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,550),{once:true});else setTimeout(init,550);
})();
