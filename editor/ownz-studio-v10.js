(()=>{'use strict';
const ready=()=>{
 if(document.getElementById('ownz-v10-tools'))return;
 document.body.classList.add('ownz-v10');
 const editor=document.getElementById('editor');
 const panel=editor?.closest('section.panel');
 const save=document.getElementById('save-file');
 const toolbar=save?.parentElement;
 if(panel&&toolbar){
   panel.classList.add('ownz-v10-editor-panel');toolbar.classList.add('ownz-v10-actionbar');
   const toggle=document.createElement('button');toggle.id='ownz-v10-tools';toggle.type='button';toggle.textContent='⚙ TOOLS';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls','ownz-v10-secondary-tools');
   const extras=['recovery-manager','ownz-go-to-line','ownz-function-nav','ownz-wrap-toggle','ownz-version-history'];
   extras.forEach(id=>{const b=document.getElementById(id);if(b)b.classList.add('ownz-v10-secondary')});
   toolbar.insertBefore(toggle,toolbar.firstChild);
   toggle.addEventListener('click',()=>{const open=toolbar.classList.toggle('ownz-v10-tools-open');toggle.setAttribute('aria-expanded',String(open));toggle.textContent=open?'✕ CLOSE':'⚙ TOOLS'});
   toolbar.id='ownz-v10-secondary-tools';
   const label=panel.querySelector('#filename');if(label)label.classList.add('ownz-v10-filetitle');
 }
 const dash=document.getElementById('ownz-v4-dashboard');
 if(dash){dash.classList.add('ownz-v10-dashboard');const hero=dash.querySelector('.ownz-v6-hero');if(hero)hero.classList.add('ownz-v10-hero');}
 const tabs=document.getElementById('forge-tabs');if(tabs)tabs.classList.add('ownz-v10-tabs');
 const mobile=document.getElementById('forge-mobile-toolbar');if(mobile)mobile.classList.add('ownz-v10-shortcuts');
};
let tries=0;function boot(){ready();if(!document.body.classList.contains('ownz-v10')&&tries++<24)setTimeout(boot,250)}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
