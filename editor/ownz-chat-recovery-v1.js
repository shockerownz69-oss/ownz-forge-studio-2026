/* FatalAcidBurn Conversation Recovery V1 — safe, read-only chat history. */
(()=>{'use strict';
const answer=document.getElementById('ownz-ai-answer'),ask=document.getElementById('ownz-ai-ask');
if(!answer||!ask)return;
const key='ownz-fatalacidburn-conversation-v1';
const idOk=s=>typeof s==='string'&&/^[0-9a-f-]{36}$/i.test(s);
const element=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
const box=element('section');box.id='ownz-chat-recovery';
const actions=element('div');actions.className='ownz-recovery-actions';
const restore=element('button','Restore chat'),history=element('button','Chat history');
restore.type=history.type='button';actions.append(restore,history);
const status=element('div');status.className='ownz-recovery-status';status.setAttribute('role','status');
const list=element('div');list.className='ownz-recovery-list';list.hidden=true;
box.append(actions,status,list);answer.parentNode.insertBefore(box,answer);
let request=0,asked=false;
ask.addEventListener('click',()=>{asked=true;request++},true);
async function json(url){
 const res=await fetch(url,{headers:{Accept:'application/json'},cache:'no-store'});
 if(!res.ok)throw Error('HTTP '+res.status);
 return res.json();
}
async function loadConversation(id,auto=false){
 if(!idOk(id)){status.textContent='No saved conversation selected.';return}
 const token=++request;
 if(!auto)status.textContent='Loading saved chat...';
 try{
  const data=await json('/api/ai/conversations/'+encodeURIComponent(id)+'/messages');
  if(token!==request||asked)return;
  const messages=Array.isArray(data.messages)?data.messages:[];
  if(!messages.length){status.textContent='This conversation has no saved messages.';return}
  const latest=[...messages].reverse().find(m=>m.role==='assistant'&&typeof m.content==='string');
  if(!latest){status.textContent='No saved AI response in this conversation.';return}
  answer.textContent=latest.content;
  status.textContent='Restored latest AI answer ('+messages.length+' saved messages available).';
 }catch(e){if(token===request)status.textContent='Could not restore chat: '+e.message}
}
restore.addEventListener('click',()=>{asked=false;loadConversation(localStorage.getItem(key))});
history.addEventListener('click',async()=>{
 if(!list.hidden){list.hidden=true;return}
 list.hidden=false;list.replaceChildren(element('div','Loading conversations...'));
 try{
  const data=await json('/api/ai/conversations');
  const rows=Array.isArray(data.conversations)?data.conversations:[];
  list.replaceChildren();
  if(!rows.length){list.append(element('div','No saved conversations found.'));return}
  for(const row of rows){
   if(!idOk(row.id))continue;
   const b=element('button',row.title||'Untitled conversation');b.type='button';
   b.addEventListener('click',()=>{
    if(!confirm('Open this saved conversation? The editor will refresh.'))return;
    localStorage.setItem(key,row.id);location.reload();
   });
   list.append(b);
  }
 }catch(e){list.replaceChildren(element('div','History unavailable: '+e.message))}
});
let id;try{id=localStorage.getItem(key)}catch{}
if(idOk(id))loadConversation(id,true);
})();
