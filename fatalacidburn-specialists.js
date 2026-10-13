'use strict';
// Deterministic, local, read-only routing of saved specialist instructions.
const RULES=[
 {terms:/\b(security|auth|token|secret|injection|vulnerab|permission|xss|csrf)\b/i,pattern:/security|cyber|audit|privacy|secure/i},
 {terms:/\b(test|qa|regression|coverage|assert|verify|bug)\b/i,pattern:/test|quality|qa|verification|debug/i},
 {terms:/\b(godot|gdscript|game|scene|shader|sprite|physics|level)\b/i,pattern:/godot|game|gdscript|engine|gameplay/i},
 {terms:/\b(ui|ux|mobile|android|responsive|accessibility|layout|design)\b/i,pattern:/ui|ux|mobile|android|design|accessib|front.end/i},
 {terms:/\b(database|sqlite|sql|schema|migration|storage)\b/i,pattern:/database|sql|data|storage|backend/i},
 {terms:/\b(install|rollback|deploy|backup|build|release|termux|server|api|node)\b/i,pattern:/devops|install|release|infra|backend|node|termux|deployment|system/i}
];
function chooseSpecialists(roles,request,{max=5}={}){
 if(!Array.isArray(roles)||typeof request!=='string')throw new TypeError('Invalid specialist selection');
 const bounded=Math.max(1,Math.min(5,Number.isFinite(max)?Math.floor(max):5));
 const active=roles.filter(r=>r&&typeof r.name==='string'&&typeof r.instructions==='string');
 const scored=active.map((r,i)=>{
  const name=r.name.toLowerCase();let score=0;
  for(const rule of RULES)if(rule.terms.test(request)&&rule.pattern.test(name))score+=5;
  // Word-boundary match of role-name tokens in request, without regex injection.
  for(const word of name.split(/[^a-z0-9]+/).filter(w=>w.length>=4))if(request.toLowerCase().includes(word))score+=2;
  return {r,i,score};
 });
 scored.sort((a,b)=>b.score-a.score||a.i-b.i);
 return scored.filter(x=>x.score>0).slice(0,bounded).map(({r,score})=>({name:r.name,instructions:r.instructions.slice(0,1200),score}));
}
function specialistPrompt(roles,request){const selected=chooseSpecialists(roles,request);return {selected,content:selected.map((r,i)=>`${i+1}. ${r.name}: ${r.instructions}`).join('\n').slice(0,6500)}}
module.exports={chooseSpecialists,specialistPrompt};
