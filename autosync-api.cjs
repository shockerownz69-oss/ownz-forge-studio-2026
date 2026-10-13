'use strict';
const express=require('express');
const fs=require('node:fs/promises');
const path=require('node:path');
const {execFile}=require('node:child_process');
const {promisify}=require('node:util');
const exec=promisify(execFile);
const router=express.Router();
const root=path.resolve(__dirname);
const dir=path.join(root,'.ownz-recovery','autosync');
const model=path.join(root,'ai-models','Qwen3.5-4B-Q4_K_M.gguf');
router.use((req,res,next)=>{res.set('Cache-Control','no-store');res.set('X-Content-Type-Options','nosniff');next()});
async function git(args){const r=await exec('git',args,{cwd:root,timeout:4500,maxBuffer:100000,env:{...process.env,GIT_OPTIONAL_LOCKS:'0',GIT_TERMINAL_PROMPT:'0'}});return r.stdout.trim()}
router.get('/status',async(req,res)=>{
 try{
 const [branch,head,remoteHead,ignored,modelStat]=await Promise.all([
 git(['branch','--show-current']),git(['rev-parse','--short','HEAD']),git(['rev-parse','--short','refs/remotes/origin/main']).catch(()=>null),
 git(['check-ignore','ai-models/Qwen3.5-4B-Q4_K_M.gguf']).then(()=>true).catch(()=>false),
 fs.stat(model).catch(()=>null)]);
 res.json({ok:true,branch,head,remoteHead,locallyAligned:!!remoteHead&&head===remoteHead,modelPresent:!!modelStat&&modelStat.size>0,modelIgnored:ignored,mode:'read-only',publishEnabled:false});
 }catch(e){res.status(503).json({ok:false,error:'Local Git status unavailable'})}
});
router.get('/history',async(req,res)=>{
 try{const entries=await fs.readdir(dir,{withFileTypes:true}).catch(e=>e.code==='ENOENT'?[]:Promise.reject(e));
 const bundles=[];for(const ent of entries){if(!ent.isFile()||!/^pre-sync-[0-9]{8}-[0-9]{6}-[0-9]+\.bundle$/.test(ent.name))continue;
 const st=await fs.lstat(path.join(dir,ent.name));if(st.isSymbolicLink()||!st.isFile())continue;
 bundles.push({name:ent.name,bytes:st.size,modified:st.mtime.toISOString(),lightweight:st.size<=100*1024*1024});}
 bundles.sort((a,b)=>b.name.localeCompare(a.name));res.json({ok:true,bundles:bundles.slice(0,100),count:bundles.length,mode:'read-only'});
 }catch(e){res.status(503).json({ok:false,error:'Recovery history unavailable'})}
});
module.exports=router;
