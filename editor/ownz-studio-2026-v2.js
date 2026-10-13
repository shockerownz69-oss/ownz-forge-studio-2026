/* SHOCKER OWNZ FORGE Studio 2026 — navigation highlight only. */
(()=>{'use strict';
function init(){
 const nav=document.getElementById('ownz-workspace-nav');
 if(!nav||nav.dataset.studio2026==='1')return;
 nav.dataset.studio2026='1';
 const buttons=[...nav.querySelectorAll('button')];
 buttons.forEach((button)=>{
   button.addEventListener('click',()=>{
     buttons.forEach(b=>b.classList.remove('ownz-studio-active'));
     button.classList.add('ownz-studio-active');
   });
 });
 const code=buttons.find(b=>b.textContent.trim().toLowerCase()==='code');
 if(code)code.classList.add('ownz-studio-active');
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();setTimeout(init,600)},{once:true});
else{init();setTimeout(init,600)}
})();
