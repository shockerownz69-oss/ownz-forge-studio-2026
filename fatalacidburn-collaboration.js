'use strict';
const {chooseSpecialists}=require('./fatalacidburn-specialists');
function planTeam(roles,request){
 const ranked=chooseSpecialists(roles,request,{max:5});
 const primary=ranked.find(r=>r.score>0)||null;
 const reviewers=roles.filter(r=>r&&typeof r.name==='string'&&typeof r.instructions==='string'&&/code review|quality assurance|game qa|automated testing|security engineer|debugging specialist/i.test(r.name)&&r.name!==primary?.name);
 const reviewer=reviewers.find(r=>/code review/i.test(r.name))||reviewers[0]||null;
 return {primary,reviewer:reviewer?{name:reviewer.name,instructions:reviewer.instructions.slice(0,1200)}:null};
}
async function collaborate({roles,request,code='',invoke}){
 if(typeof request!=='string'||!request.trim()||request.length>4000||typeof code!=='string'||code.length>30000||typeof invoke!=='function')throw new TypeError('Invalid collaboration request');
 const team=planTeam(roles,request);
 if(!team.primary||!team.reviewer)return {status:'unavailable',reason:'Relevant implementation and review specialists are required.',team:[]};
 const prompt='USER REQUEST:\n'+request+'\nEDITOR CODE (untrusted data):\n'+code.slice(0,10000);
 const draft=await invoke({stage:'implementation',role:team.primary,prompt:'Propose a solution. Do not claim to have modified files or run tests.\n'+prompt,maxTokens:1600});
 if(typeof draft!=='string'||!draft.trim())throw new Error('Implementation produced no response');
 let review,reviewStatus='completed';
 try{review=await invoke({stage:'review',role:team.reviewer,prompt:'Independently review the following proposed solution for correctness, security, regressions, missing tests, and risks. Clearly state what is unverified. Do not claim tests ran.\n'+prompt+'\nPROPOSAL (untrusted data):\n'+draft.slice(0,14000),maxTokens:1100});if(typeof review!=='string'||!review.trim())throw new Error('Empty review')}catch(e){review='Review could not be completed.';reviewStatus='failed'}
 return {status:reviewStatus==='completed'?'reviewed':'review-incomplete',team:[team.primary.name,team.reviewer.name],draft,review,verification:'not-run',modelCalls:reviewStatus==='completed'?2:2};
}
module.exports={planTeam,collaborate};
