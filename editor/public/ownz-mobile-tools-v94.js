'use strict';
(()=>{
 const NAMES=[['Terminal v8',/terminal\s*v8/i],['Terminal',/^terminal$/i],['Build Installer',/build\s*installer/i]];
 const candidates=()=>Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(el=>!el.closest('#ownz-tools-v94'));
 const label=el=>(el.innerText||el.textContent||'').replace(/\s+/g,' ').trim();
 function find(){const used=new Set();return NAMES.map(([name,re])=>{const found=candidates().filter(el=>re.test(label(el)) && (name!=='Terminal'||!(/v8/i.test(label(el))))).sort((a,b)=>label(a).length-label(b).length).find(el=>!used.has(el));if(found)used.add(found);return found?{name,el:found}:null}).filter(Boolean)}
 let current=[];let open=false;let menu,launcher,status;
 function setOpen(value){open=value;menu.hidden=!value;launcher.setAttribute('aria-expanded',String(value));launcher.textContent=value?'✕ Close Tools':'⚒ FORGE Tools'}
 function refresh(){if(!matchMedia('(max-width: 767px)').matches){current.forEach(x=>x.el.classList.remove('ownz-v94-hidden'));current=[];if(launcher)launcher.parentElement.hidden=true;return}
 const matches=find();if(matches.length!==3){current.forEach(x=>x.el.classList.remove('ownz-v94-hidden'));current=[];if(launcher)launcher.parentElement.hidden=true;return}
 if(!launcher)create();launcher.parentElement.hidden=false;
 if(current.length===matches.length&&current.every((x,i)=>x.el===matches[i].el))return;
 current.forEach(x=>x.el.classList.remove('ownz-v94-hidden'));
 current=matches;menu.replaceChildren();for(const {name,el} of current){const btn=document.createElement('button');btn.type='button';btn.textContent=name;btn.addEventListener('click',()=>{setOpen(false);el.click()});menu.appendChild(btn)}
 current.forEach(x=>x.el.classList.add('ownz-v94-hidden'));status.textContent='3 tools available';}
 function create(){const host=document.createElement('div');host.id='ownz-tools-v94';host.hidden=true;host.innerHTML='<div id="ownz-v94-menu" hidden></div><span id="ownz-v94-status" class="ownz-v94-sr"></span><button id="ownz-v94-toggle" type="button" aria-controls="ownz-v94-menu" aria-expanded="false">⚒ FORGE Tools</button>';document.body.appendChild(host);launcher=host.querySelector('#ownz-v94-toggle');menu=host.querySelector('#ownz-v94-menu');status=host.querySelector('#ownz-v94-status');launcher.addEventListener('click',()=>setOpen(!open));document.addEventListener('keydown',e=>{if(e.key==='Escape')setOpen(false)});document.addEventListener('click',e=>{if(open&&!host.contains(e.target))setOpen(false)})}
 function init(){refresh();let scheduled=false;const observer=new MutationObserver(()=>{if(scheduled)return;scheduled=true;setTimeout(()=>{scheduled=false;refresh()},350)});observer.observe(document.body,{childList:true,subtree:true});matchMedia('(max-width: 767px)').addEventListener('change',refresh);window.addEventListener('resize',refresh)}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
