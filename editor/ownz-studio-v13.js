/* FORGE Studio 2026 — V13 navigation stability repair.
 * Keeps the existing workspace navigation as the single source of routing truth.
 */
(()=>{'use strict';
const ROUTES=[['Dashboard','Home','⌂'],['Projects','Files','▱'],['Files','Files','▤'],['AI Assistant','AI','✦'],['Diagnostics','Check','⬡'],['Code Editor','Code','⌘'],['Focus Mode','Focus','◎']];
const LABELS={Home:'MISSION CONTROL',Files:'PROJECT EXPLORER',Code:'CODE EDITOR',AI:'FATALACIDBURN AI',Check:'DIAGNOSTICS',Focus:'FOCUS MODE'};
function boot(){
 if(document.getElementById('ownz-v13-shell'))return true;
 const original=document.getElementById('ownz-workspace-nav');
 if(!original||!document.body.classList.contains('ownz-design-v12'))return false;
 const shell=document.createElement('div');shell.id='ownz-v13-shell';
 const sidebar=document.createElement('aside');sidebar.id='ownz-v13-sidebar';sidebar.setAttribute('aria-label','Forge Studio desktop navigation');
 const brand=document.createElement('div');brand.className='ownz-v13-sidebrand';brand.textContent='// FORGE CONTROL';sidebar.append(brand);
 const entries=[];
 const find=(label)=>[...original.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()===label.toLowerCase());
 for(const [title,route,glyph] of ROUTES){
   if(!find(route))continue;
   const button=document.createElement('button');button.type='button';button.className='ownz-v13-route';button.dataset.route=route;button.dataset.title=title;
   const icon=document.createElement('span');icon.className='ownz-v13-glyph';icon.setAttribute('aria-hidden','true');icon.textContent=glyph;
   const text=document.createElement('span');text.textContent=title;button.append(icon,text);
   button.addEventListener('click',()=>{
     const source=find(route)||(route==='Focus'?find('Exit'):null);
     if(!source||source.disabled)return;
     source.click();
     // Focus toggles between modes; never claim Focus is active when it was exited.
     queueMicrotask(()=>activate(document.body.classList.contains('ownz-focus-active')?'Focus':route,title));
   });
   sidebar.append(button);entries.push(button);
 }
 const foot=document.createElement('div');foot.className='ownz-v13-foot';foot.textContent='SHOCKER OWNZ / FORGE 2026';sidebar.append(foot);
 const top=document.createElement('header');top.id='ownz-v13-top';const label=document.createElement('div');label.className='ownz-v13-title';
 const strong=document.createElement('strong');strong.textContent='FORGE STUDIO 2026';const sub=document.createElement('span');sub.textContent='CODE / BUILD / CREATE / DOMINATE';label.append(strong,sub);top.append(label);
 const right=document.createElement('div');right.className='ownz-v13-right';const current=document.createElement('span');current.id='ownz-v13-current';right.append(current);top.append(right);
 shell.append(sidebar,top);document.body.prepend(shell);
 let activeRoute='Home',activeTitle='Dashboard';
 function activate(route,title){
   activeRoute=route;activeTitle=title||({Home:'Dashboard',Files:'Files',Code:'Code Editor',AI:'AI Assistant',Check:'Diagnostics',Focus:'Focus Mode'})[route];
   for(const button of entries){
     const selected=button.dataset.title===activeTitle;
     button.classList.toggle('active',selected);
     if(selected)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');
   }
   current.textContent=LABELS[activeRoute]||'FORGE STUDIO';
 }
 original.addEventListener('click',event=>{
   const button=event.target.closest?.('button');if(!button||!original.contains(button))return;
   const route=button.textContent.trim();if(!Object.hasOwn(LABELS,route)&&route!=='Exit')return;
   queueMicrotask(()=>{
     const focusing=document.body.classList.contains('ownz-focus-active');
     if(focusing)activate('Focus','Focus Mode');
     else if(route==='Exit')activate('Code','Code Editor');
     else activate(route,route==='Files'?'Files':undefined);
   });
 });
 activate(document.body.classList.contains('ownz-focus-active')?'Focus':'Home');
 document.body.classList.add('ownz-v13');
 return true;
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
let count=0;const timer=setInterval(()=>{if(boot()||++count>=40)clearInterval(timer)},250);
})();
