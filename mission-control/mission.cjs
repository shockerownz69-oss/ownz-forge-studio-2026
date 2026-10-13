'use strict';
// Mission Control 1.0: deterministic, offline planning only. Never runs generated code.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
const project=process.env.OWNZ_PROJECT || path.resolve(__dirname,'..');
const output=path.join(project,'.ownz-recovery','missions');
function plan(request){
 if(typeof request!=='string'||request.trim().length<12||request.length>4000)throw Error('Mission must be 12-4000 characters');
 const {chooseSpecialists}=require(path.join(project,'fatalacidburn-specialists.js'));
 const provider=require(path.join(project,'ai-providers.js')).getProviderStatus();
 // Role instructions are not guessed: roles must be provided by the existing registry in future integrations.
 const specialists=chooseSpecialists([],request);
 const id='mission-'+new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex');
 const mission={id,version:'1.0',state:'PLAN_ONLY',request:request.trim(),createdAt:new Date().toISOString(),providerAvailability:provider.map(p=>({id:p.id,enabled:p.enabled,configured:p.configured,model:p.model})),specialists,steps:[{id:1,name:'Inspect project',status:'PENDING'},{id:2,name:'Select specialists and architecture',status:'PENDING'},{id:3,name:'Generate changes in disposable workspace',status:'BLOCKED_UNTIL_IMPLEMENTED'},{id:4,name:'Run verification',status:'BLOCKED_UNTIL_IMPLEMENTED'},{id:5,name:'Review proposed patch and approve installation',status:'REQUIRES_APPROVAL'}],restrictions:{writesToLiveProject:false,executesAI:false,executesInstaller:false,publishes:false}};
 return mission;
}
function save(m){fs.mkdirSync(output,{recursive:true,mode:0o700});const file=path.join(output,m.id+'.json');fs.writeFileSync(file,JSON.stringify(m,null,2),{flag:'wx',mode:0o600});return file;}
if(require.main===module){try{const arg=process.argv.slice(2);if(arg[0]==='--self-test'){const p=plan('Build a new inventory feature for Grow Empire');if(p.state!=='PLAN_ONLY'||p.restrictions.executesInstaller)throw Error('self-test failed');console.log('[OWNZ] Mission Control self-test PASS');}else if(arg[0]==='--plan'){const m=plan(arg.slice(1).join(' '));console.log('[OWNZ] Plan created:',save(m));console.log(JSON.stringify({id:m.id,state:m.state,steps:m.steps.length,providers:m.providerAvailability.length},null,2));}else{console.log('Usage: node mission.cjs --self-test | --plan "Describe your task"');process.exitCode=2;}}catch(e){console.error('[OWNZ] '+e.message);process.exitCode=1;}}
module.exports={plan,save};
