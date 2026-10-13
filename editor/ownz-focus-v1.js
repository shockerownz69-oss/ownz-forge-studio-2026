/* OWNZ Forge mobile Focus Mode: visual only; never alters editor content. */
(function(){
 'use strict';
 function init(){
   const nav=document.getElementById('ownz-workspace-nav');
   const editor=document.getElementById('editor');
   const ai=document.getElementById('ownz-ai-panel');
   const intelligence=document.getElementById('ownz-intelligence-panel');
   if(!nav||!editor||!ai||!intelligence)return;
   if(document.getElementById('ownz-focus-toggle'))return;
   const explorer=intelligence.closest('section.panel');
   if(!explorer)return;
   explorer.classList.add('ownz-focus-explorer');
   const button=document.createElement('button');
   button.type='button';button.id='ownz-focus-toggle';
   button.setAttribute('aria-pressed','false');
   button.textContent='Focus';
   const setFocus=(on)=>{
     document.body.classList.toggle('ownz-focus-active',on);
     button.setAttribute('aria-pressed',String(on));
     button.textContent=on?'Exit':'Focus';
     if(on)editor.scrollIntoView({block:'start',behavior:'auto'});
   };
   button.addEventListener('click',()=>setFocus(!document.body.classList.contains('ownz-focus-active')));
   nav.append(button);
   for(const b of nav.querySelectorAll('button')){
     if(b!==button)b.addEventListener('click',()=>setFocus(false),{capture:true});
   }
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{init();setTimeout(init,500)},{once:true});
 else{init();setTimeout(init,500)}
})();
