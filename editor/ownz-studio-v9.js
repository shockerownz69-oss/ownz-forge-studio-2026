(()=>{'use strict';
const $=(s,r=document)=>r.querySelector(s);
function node(tag,cls,text){const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e}
function start(){
 const dash=$('#ownz-v4-dashboard'),nav=$('#ownz-workspace-nav');
 if(!dash||!nav||$('#ownz-v9-command'))return;
 document.body.classList.add('ownz-v9');
 const bar=node('section','ownz-v9-command');bar.id='ownz-v9-command';bar.setAttribute('aria-label','Live studio status');
 const brand=node('div','ownz-v9-command-brand');brand.append(node('span','ownz-v9-sigil','◈'),node('span','', 'MISSION CONTROL'));bar.append(brand);
 const items=[['API','backend'],['AI','ai'],['FILES','files']];
 for(const [label,key] of items){const item=node('div','ownz-v9-chip');const dot=node('i','ownz-v9-led');dot.setAttribute('aria-hidden','true');item.append(dot,node('span','ownz-v9-chip-label',label));const val=node('strong','','—');val.id='ownz-v9-'+key;item.append(val);bar.append(item)}
 const hero=$('.ownz-v4-hero',dash);if(hero)dash.insertBefore(bar,hero);else dash.prepend(bar);
 const subtitle=node('div','ownz-v9-hero-mark');subtitle.textContent='CODE  /  BUILD  /  CREATE  /  DOMINATE';if(hero)hero.append(subtitle);
 function sync(){for(const key of ['backend','ai','files']){const source=$('#v7-'+key),out=$('#ownz-v9-'+key);if(!out)continue;const value=source?.textContent?.trim()||'—';if(out.textContent!==value)out.textContent=value;out.parentElement.dataset.state=key==='backend'?(value==='ONLINE'?'ok':'warn'):key==='ai'?(value==='READY'?'ok':'warn'):'neutral'}}
 const telemetry=$('#ownz-v7-mission');if(telemetry){const obs=new MutationObserver(sync);obs.observe(telemetry,{childList:true,subtree:true,characterData:true});sync()}
 const home=$('.ownz-v4-hero-text h2',dash);if(home)home.textContent='FORGE STUDIO 2026';
 const h=$('.v7-eyebrow',dash);if(h)h.textContent='◈  WORKSPACE INTELLIGENCE  /  LIVE TELEMETRY';
 const refresh=$('.v7-refresh',dash);if(refresh)refresh.setAttribute('aria-label','Refresh Mission Control telemetry');
 const mobile=window.matchMedia('(max-width:749px)');
 function updateNav(){nav.querySelectorAll('button').forEach(b=>{const selected=b.classList.contains('ownz-selected')||b.getAttribute('aria-current')==='page';if(selected)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current')})}
 nav.addEventListener('click',()=>requestAnimationFrame(updateNav));updateNav();
 const editor=$('#editor');if(editor)editor.setAttribute('aria-label','Forge source code editor');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(start,750),{once:true});else setTimeout(start,750);
})();
