/* FatalAcidBurn AI Formatting V2: safe Markdown text nodes, never innerHTML. */
(()=>{'use strict';
const target=document.getElementById('ownz-ai-answer');if(!target)return;
const make=(tag,cls,text)=>{const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el};
let last='',busy=false;
function inline(el,source){
 const re=/(\*\*([^*\n]+)\*\*|`([^`\n]+)`|\*([^*\n]+)\*)/g;
 let from=0,m;
 while((m=re.exec(source))){
  if(m.index>from)el.append(document.createTextNode(source.slice(from,m.index)));
  const tag=m[2]?'strong':m[3]?'code':'em';
  el.append(make(tag,m[3]?'ownz-ai-inline-code':'',m[2]||m[3]||m[4]));
  from=re.lastIndex;
 }
 if(from<source.length)el.append(document.createTextNode(source.slice(from)));
}
function render(raw){
 if(busy||raw===last)return;
 busy=true;
 try{
  const fragment=document.createDocumentFragment(),lines=raw.replace(/\r\n?/g,'\n').split('\n');
  let i=0;
  while(i<lines.length){
   const line=lines[i],fence=line.match(/^\s*```([\w.+-]*)\s*$/);
   if(fence){
    i++;const code=[];
    while(i<lines.length&&!/^\s*```\s*$/.test(lines[i]))code.push(lines[i++]);
    if(i<lines.length)i++;
    const section=make('section','ownz-ai-code'),bar=make('div','ownz-ai-code-bar');
    bar.append(make('span','',fence[1]||'code'));
    const actions=make('div','ownz-ai-code-actions');
    const wrap=make('button','','Wrap: Off');wrap.type='button';wrap.setAttribute('aria-pressed','false');
    const pre=make('pre'),c=make('code','',code.join('\n'));pre.append(c);
    wrap.addEventListener('click',()=>{
     const on=pre.classList.toggle('ownz-ai-wrap');
     wrap.textContent=on?'Wrap: On':'Wrap: Off';wrap.setAttribute('aria-pressed',String(on));
    });
    const copy=make('button','','Copy code');copy.type='button';
    copy.addEventListener('click',async()=>{
     try{await navigator.clipboard.writeText(code.join('\n'));copy.textContent='Copied';}
     catch{copy.textContent='Select code to copy';}
    });
    actions.append(wrap,copy);bar.append(actions);section.append(bar,pre);fragment.append(section);continue;
   }
   const h=line.match(/^\s*(#{1,4})\s+(.+)$/);
   if(h){const el=make('div','ownz-ai-heading');inline(el,h[2]);fragment.append(el);i++;continue}
   const bullet=line.match(/^\s*[-*]\s+(.+)$/),number=line.match(/^\s*(\d+\.\s+)(.+)$/);
   if(bullet||number){
    const el=make('div','ownz-ai-list');
    el.append(document.createTextNode(bullet?'• ':number[1]));
    inline(el,bullet?bullet[1]:number[2]);fragment.append(el);i++;continue;
   }
   if(line.trim()){const el=make('div','ownz-ai-line');inline(el,line);fragment.append(el)}
   else fragment.append(make('div','ownz-ai-blank',' '));
   i++;
  }
  target.classList.add('ownz-ai-formatted');
  target.replaceChildren(fragment);
  last=raw;
 }finally{busy=false}
}
const observer=new MutationObserver(()=>{
 if(busy)return;
 if(target.childNodes.length===1&&target.firstChild.nodeType===Node.TEXT_NODE){
  const raw=target.textContent||'';if(raw!==last)render(raw);
 }
});
observer.observe(target,{childList:true,characterData:true,subtree:true});
if(target.childNodes.length===1&&target.firstChild.nodeType===Node.TEXT_NODE)render(target.textContent||'');
})();
