'use strict';
const fs=require('node:fs'),cp=require('node:child_process');
function makeHealthRouter({express,root,baseline,auditor}){
 if(!express?.Router||![root,baseline,auditor].every(x=>typeof x==='string'&&x))throw Error('Invalid health configuration');
 const router=express.Router();
 router.get('/project-brain/health',(_req,res)=>{
  res.set('Cache-Control','no-store');
  try{
   if(!fs.statSync(root).isDirectory()||![baseline,auditor].every(p=>fs.statSync(p).isFile()))throw Error('Missing dependency');
   const run=cp.spawnSync(process.execPath,[auditor,root,baseline],{encoding:'utf8',timeout:10000,maxBuffer:1048576,env:{PATH:process.env.PATH||'',HOME:process.env.HOME||''}});
   const marker='--- JSON REPORT ---',idx=(run.stdout||'').lastIndexOf(marker);
   if(run.error||run.signal||idx<0)throw Error('Audit unavailable');
   const data=JSON.parse(run.stdout.slice(idx+marker.length));
   if(!Array.isArray(data.checks)||!Array.isArray(data.changes))throw Error('Bad report');
   const failed=data.checks.filter(c=>c?.pass!==true).map(c=>({name:String(c.name||'unknown').slice(0,80)}));
   const changed=data.changes.filter(c=>c?.status==='CHANGED').map(c=>({file:String(c.file||'unknown').slice(0,160),status:'CHANGED'}));
   const verified=run.status===0&&failed.length===0&&changed.length===0;
   return res.status(200).json({phase:57,mode:'READ_ONLY',health:verified?'PASS':'DEGRADED',verifiedEvidence:verified,baseline:'phase54-historical',summary:{passed:data.checks.length-failed.length,total:data.checks.length,changed:changed.length},failedChecks:failed,changedFiles:changed});
  }catch{return res.status(503).json({phase:57,error:'Health inspection unavailable'});}
 });
 return router;
}
module.exports={makeHealthRouter};
