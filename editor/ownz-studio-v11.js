(()=>{'use strict';
function boot(){
 if(document.body.classList.contains('ownz-v11'))return;
 if(!document.body.classList.contains('ownz-v10'))return;
 document.body.classList.add('ownz-v11');
 const toolbar=document.querySelector('.ownz-v10-actionbar');
 if(toolbar){
  const toggle=document.getElementById('ownz-v10-tools');
  if(toggle){toggle.setAttribute('aria-label','Toggle editor tools');toggle.title='Show or hide advanced editor tools';}
  // Preserve original button handlers and inline accessibility attributes.
 }
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
let tries=0;const retry=setInterval(()=>{boot();if(document.body.classList.contains('ownz-v11')||++tries>=20)clearInterval(retry)},300);
})();