(()=>{
'use strict';
function setup(){
 const actions=document.getElementById('forge-create-actions');
 if(actions&&!actions.dataset.ownzV3){
  actions.dataset.ownzV3='1';
  const config=[['forge-delete','▤','Delete'],['forge-rename','✎','Rename'],['forge-refresh','⟳','Refresh'],['forge-new-file','⊕','New File'],['forge-new-folder','▣','New Folder']];
  for(const [id,icon,label] of config){
   const b=document.getElementById(id);if(!b)continue;
   b.textContent='';
   const ico=document.createElement('span');ico.className='ownz-action-icon';ico.setAttribute('aria-hidden','true');ico.textContent=icon;
   const txt=document.createElement('span');txt.className='ownz-action-label';txt.textContent=label;
   b.append(ico,txt);b.setAttribute('aria-label',label);b.title=label;
   if(id==='forge-new-file')b.dataset.ownzPrimary='true';
  }
 }
 const trash=document.getElementById('forge-trash-panel');
 if(trash&&!trash.dataset.ownzV3){
  trash.dataset.ownzV3='1';
  const title=trash.firstElementChild;
  if(title){
   title.classList.add('ownz-trash-heading');
   title.setAttribute('role','button');title.tabIndex=0;
   title.setAttribute('aria-expanded','false');
   const body=document.createElement('div');body.className='ownz-trash-body';body.hidden=true;
   while(title.nextSibling)body.appendChild(title.nextSibling);
   trash.appendChild(body);
   const toggle=()=>{body.hidden=!body.hidden;title.setAttribute('aria-expanded',String(!body.hidden));};
   title.addEventListener('click',toggle);
   title.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle()}});
  }
 }
 const nav=document.getElementById('ownz-workspace-nav');
 if(nav&&!nav.dataset.ownzV3){
  nav.dataset.ownzV3='1';
  const buttons=[...nav.querySelectorAll('button')];
  buttons.forEach(b=>b.addEventListener('click',()=>{buttons.forEach(x=>x.classList.remove('ownz-studio-active'));b.classList.add('ownz-studio-active')}));
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup,{once:true});else setup();
setTimeout(setup,900);
})();