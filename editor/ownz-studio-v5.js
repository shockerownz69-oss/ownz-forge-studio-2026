(()=>{
'use strict';
function init(){
 if(document.body.dataset.ownzV5)return;
 const nav=document.getElementById('ownz-workspace-nav');
 const dash=document.getElementById('ownz-v4-dashboard');
 if(!nav||!dash)return;
 document.body.dataset.ownzV5='1';
 const make=(tag,cl,text)=>{const el=document.createElement(tag);if(cl)el.className=cl;if(text!==undefined)el.textContent=text;return el};
 // Use the existing functional V4 actions; no cloned dead controls.
 const hero=dash.querySelector('.ownz-v4-hero');
 if(hero){hero.setAttribute('aria-label','Shocker OwnZ gas-mask hero art');}
 const panel=document.getElementById('editor')?.closest('.panel');
 const explorer=document.getElementById('ownz-explorer-content')?.closest('.panel');
 function mode(m){
  document.body.classList.toggle('ownz-v5-code',m==='Code');
  document.body.classList.toggle('ownz-v5-files',m==='Files');
  document.body.classList.toggle('ownz-v5-ai',m==='AI');
  document.body.classList.toggle('ownz-v5-check',m==='Check');
  document.body.classList.toggle('ownz-v5-focus',m==='Focus');
  nav.querySelectorAll('button').forEach(b=>{
   const active=b.textContent.trim().toLowerCase()===m.toLowerCase();
   b.classList.toggle('ownz-selected',active);
   if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  if(m==='Code'||m==='Files'){window.scrollTo({top:0,behavior:'instant'});}
 }
 const buttons=[...nav.querySelectorAll('button')];
 for(const b of buttons){
  const label=b.textContent.trim();
  if(label==='Code'||label==='Files'||label==='AI'||label==='Check'||label==='Home'){
   b.addEventListener('click',()=>{requestAnimationFrame(()=>mode(label))});
  }
 }
 if(!buttons.some(b=>b.textContent.trim()==='Focus')){
  const b=make('button','ownz-v4-button');
  b.type='button';b.append(make('span','ownz-v4-icon','◎'),make('span','ownz-v4-label','Focus'));
  b.addEventListener('click',()=>{
   document.body.classList.remove('ownz-v4-home');
   const target=document.getElementById('ownz-focus-panel');
   mode('Focus');if(target)target.scrollIntoView({block:'start'});
  });
  nav.append(b);
 }
 // Home dashboard buttons lead to the real workspaces.
 dash.querySelectorAll('[data-ownz-target]').forEach(b=>{
  b.addEventListener('click',()=>{
   const target=b.dataset.ownzTarget;
   if(target==='editor'||target==='ownz-explorer-content')requestAnimationFrame(()=>mode(target==='editor'?'Code':'Files'));
  });
 });
 const brand=document.querySelector('.ownz-brand-studio');
 if(brand)brand.textContent='FORGE STUDIO 2026  ·  CODE / BUILD / CREATE / DOMINATE';
 // Preserve original event listeners while giving the mobile code screen priority.
 const style=document.createElement('style');
 style.textContent=`
 body.ownz-v5-code .ownz-v4-dashboard,body.ownz-v5-files .ownz-v4-dashboard{display:none!important}
 body.ownz-v5-code .workspace>section:first-child{display:none!important}
 body.ownz-v5-files .workspace>section:not(:first-child){display:none!important}
 body.ownz-v5-code .workspace,body.ownz-v5-files .workspace{display:block!important}
 body.ownz-v5-code .ownz-v4-content,body.ownz-v5-files .ownz-v4-content{padding-top:5px!important}
 body.ownz-v5-code #editor{scroll-margin-top:0!important}
 @media(min-width:1000px){body.ownz-v5-code .workspace{max-width:1200px!important;margin:auto!important}}
 `;
 document.head.append(style);
 const initial=document.body.classList.contains('ownz-v4-home')?'Home':'Code';
 mode(initial);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{setTimeout(init,80)},{once:true});else setTimeout(init,80);
})();
