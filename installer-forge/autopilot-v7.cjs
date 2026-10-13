'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
function stageProposal({root,plan,build,outputs,projectFile}){
 const changes=plan.changes.filter(x=>typeof x.proposedSource==='string'&&x.proposedSource.trim());
 if(!changes.length)throw Error('AI supplied no complete replacement source; nothing to stage');
 const seen=new Set(),tmp=fs.mkdtempSync(path.join(os.tmpdir(),'ownz-v7-stage-'));
 const checks=[];
 try{
  for(const c of changes){
   if(seen.has(c.path))throw Error('Duplicate proposed file');seen.add(c.path);
   const original=fs.readFileSync(projectFile(c.path),'utf8');
   if(original===c.proposedSource)throw Error('Proposed source is identical: '+c.path);
   const dest=path.join(tmp,c.path);fs.mkdirSync(path.dirname(dest),{recursive:true});
   fs.writeFileSync(dest,c.proposedSource,{mode:0o600});
   if(/\.(?:js|cjs|mjs)$/.test(c.path)){
    try{cp.execFileSync(process.execPath,['--check',dest],{timeout:8000,stdio:'pipe'});checks.push({path:c.path,check:'JavaScript syntax',passed:true})}
    catch(e){throw Error('Syntax check failed for '+c.path+': '+String(e.stderr||e.message).slice(0,400))}
   }else checks.push({path:c.path,check:'Syntax validation unavailable for this file type',passed:false});
  }
  if(checks.some(x=>!x.passed))throw Error('Cannot package unvalidated file types in v7');
  const id=crypto.randomBytes(6).toString('hex'),filename='ownz-update-'+id+'.tar.gz';
  fs.mkdirSync(outputs,{recursive:true});
  const manifest=path.join(tmp,'manifest-input.json');
  fs.writeFileSync(manifest,JSON.stringify({name:'FatalAcidBurn v7 proposed update — approval required',files:[...seen]}));
  const output=path.join(outputs,filename);
  build(tmp,manifest,output);
  return {ok:true,mode:'staged-preview',filename,id,bytes:fs.statSync(output).size,files:[...seen],checks,unitTestsExecuted:false,behaviorVerified:false,installationRequiresApproval:true,installed:false,sha256:sha(fs.readFileSync(output)),warning:'Syntax checks passed; unit/integration tests and requested behavior are NOT verified. Package is a review-only candidate. Do not install without further testing and explicit approval.'};
 }finally{fs.rmSync(tmp,{recursive:true,force:true})}
}
module.exports={stageProposal};
