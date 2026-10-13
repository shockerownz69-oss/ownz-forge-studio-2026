'use strict';
const express=require('express');const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');
const {build,validRel}=require('./installer-forge.cjs');
const router=express.Router();
const {planRequest,validatePlan}=require('./autopilot-v6.cjs');const {stageProposal}=require('./autopilot-v71.cjs');const pending=new Map();router.use((req,res,next)=>{const origin=req.headers.origin;if(origin&&/^http:\/\/127\.0\.0\.1:(?:5173|5174)$/.test(origin)){res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Headers','Content-Type');res.set('Access-Control-Allow-Methods','GET,POST,OPTIONS')}if(req.method==='OPTIONS')return res.sendStatus(204);next()});const root=process.cwd();const outputs=path.join(root,'installer-forge','packages');
const ALLOWED=/\.(?:js|cjs|mjs|json|html|css|gd|ts|tsx|jsx|md|txt|py|sh|toml|yaml|yml|cfg|ini)$/i;
function projectFile(rel){validRel(rel);if(!ALLOWED.test(rel)||rel.split('/').some(x=>x.startsWith('.')||['node_modules','backups','packages','installer-forge','dist','logs'].includes(x)))throw Error('File not allowed');let p=root;for(const part of rel.split('/')){p=path.join(p,part);if(fs.existsSync(p)&&fs.lstatSync(p).isSymbolicLink())throw Error('Symlink rejected')}if(!fs.existsSync(p)||!fs.statSync(p).isFile())throw Error('File not found');return p}
function err(res,e){res.status(400).json({error:e.message})}
router.get('/installer/status',(req,res)=>res.json({ready:true,version:"7.1",mode:'manual-approved',formats:['tar.gz'],root,packages:fs.existsSync(outputs)?fs.readdirSync(outputs).filter(x=>/^ownz-update-[a-f0-9]{12}\.tar\.gz$/.test(x)).slice(-30).reverse():[]}));
// Smart Build v1: deterministic, read-only project file discovery. No AI claims or writes.
const SKIP=new Set(['node_modules','.git','.env','backups','packages','installer-forge','dist','logs','coverage','build','.cache']);
const MAX_VISIT=3500,MAX_FILES=1200,MAX_DEPTH=6;
function discover(){const found=[],stack=[{dir:root,rel:'',depth:0}];let visits=0;while(stack.length&&visits<MAX_VISIT&&found.length<MAX_FILES){const item=stack.pop();let entries;try{entries=fs.readdirSync(item.dir,{withFileTypes:true})}catch{continue}for(const ent of entries){if(++visits>MAX_VISIT)break;if(ent.name.startsWith('.')||SKIP.has(ent.name))continue;const rel=item.rel?item.rel+'/'+ent.name:ent.name;if(ent.isSymbolicLink())continue;if(ent.isDirectory()){if(item.depth<MAX_DEPTH)stack.push({dir:path.join(item.dir,ent.name),rel,depth:item.depth+1})}else if(ent.isFile()&&ALLOWED.test(ent.name)){try{projectFile(rel);found.push(rel)}catch{}}if(found.length>=MAX_FILES)break}}return found}
const STOP=new Set(['the','and','for','with','from','into','this','that','want','make','build','create','please','project','files','code','system','feature','update','change','fix','add','new','ownz','forge','smart']);
function terms(s){return [...new Set((s.toLowerCase().match(/[a-z0-9_]+/g)||[]).filter(w=>w.length>=3&&!STOP.has(w)))].slice(0,16)}
function rankFile(rel,words){const name=rel.toLowerCase();let score=0;const matched=[];for(const word of words){if(name.includes(word)){score+=name.split("/").pop().includes(word)?12:5;matched.push(word)}}return {path:rel,score,matched}}
function codeRank(rel,words){
 const base=rankFile(rel,words);let score=base.score,matched=[...base.matched],evidence=[],imports=[];
 let source='';try{const p=projectFile(rel),stat=fs.statSync(p);if(stat.size<=65536)source=fs.readFileSync(p,'utf8')}catch{}
 if(source){
  const lower=source.toLowerCase();
  const lines=source.split(/\r?\n/);
  for(const word of words){
   if(base.matched.includes(word))continue;
   const found=lines.findIndex(line=>new RegExp('\\b'+word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\b','i').test(line));
   if(found>=0){score+=3;matched.push(word);if(evidence.length<3)evidence.push({line:found+1,text:lines[found].trim().slice(0,130)})}
  }
  for(const m of source.matchAll(/(?:\bimport\s*(?:[^'"\n]*?\sfrom\s*)?|\brequire\s*\()\s*['"]([^'"\n]+)['"]/g)){if(imports.length<30)imports.push(m[1])}
  if(words.some(w=>['navigation','navigate','diagnostics','diagnostic','click','route'].includes(w))&&/(addEventListener\s*\(|\.onclick\s*=|router\.(get|post)\s*\()/i.test(source)){score+=2;evidence.push({line:0,text:'Contains event handlers or API routes'})}
 }
 return {...base,score,matched,evidence,imports};
}
router.post('/installer/smart-plan',express.json({limit:'4kb'}),(req,res)=>{try{
 const request=req.body?.request;if(typeof request!=='string'||request.trim().length<4||request.length>500)throw Error('Describe the change in 4–500 characters');
 const words=terms(request);const candidates=discover();
 const ranked=candidates.map(f=>codeRank(f,words)).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,30);
 const candidateSet=new Set(candidates);for(const item of ranked){item.dependencies=item.imports.filter(i=>i.startsWith('.')).map(i=>path.posix.normalize(path.posix.join(path.posix.dirname(item.path),i))).filter(i=>candidateSet.has(i)||candidateSet.has(i+'.js')||candidateSet.has(i+'.cjs')).slice(0,8);delete item.imports}
 res.json({mode:'read-only-code-aware-plan',request,files:ranked,scanned:candidates.length,truncated:candidates.length>=MAX_FILES,warning:'Heuristic code analysis, not AI-generated code or complete dependency graph. Review every suggestion; no code was modified.'})
}catch(e){err(res,e)}});

// v6: AI plan and proposed changes are read-only. No apply/install endpoint.
router.post('/installer/autopilot/plan',express.json({limit:'4kb'}),async(req,res)=>{
 try{
  const request=req.body?.request;
  if(typeof request!=='string'||request.trim().length<4||request.length>500) return res.status(400).json({error:'Request must be 4–500 characters'});
  const words=terms(request),candidates=discover();
  const ranked=candidates.map(f=>codeRank(f,words)).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.path.localeCompare(b.path)).slice(0,12);
  const inputs=ranked.slice(0,5).map(x=>{let source='';try{source=fs.readFileSync(projectFile(x.path),'utf8').slice(0,7500)}catch{}return {path:x.path,score:x.score,source}});
  const plan=await planRequest({request,inputs});
  const allowed=new Set(inputs.map(x=>x.path));validatePlan(plan,allowed);
  const proposalId=crypto.randomBytes(12).toString('hex');pending.set(proposalId,{plan,allowed,originals:new Map(inputs.map(x=>[x.path,crypto.createHash('sha256').update(fs.readFileSync(projectFile(x.path))).digest('hex')])),created:Date.now()});for(const [id,v] of pending){if(Date.now()-v.created>900000)pending.delete(id)}res.set('Cache-Control','no-store');res.json({proposalId,ok:true,mode:'proposal-only',scanned:candidates.length,filesAnalyzed:inputs.map(x=>x.path),plan,installationRequiresApproval:true,codeChanged:false});
 }catch(e){res.status(e.status||502).json({error:e.publicMessage||'AI planning unavailable; no files changed'})}
});
router.post('/installer/autopilot/stage',express.json({limit:'1kb'}),(req,res)=>{
 try{
  const id=req.body?.proposalId;
  if(typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id))return res.status(400).json({error:'Invalid proposal ID'});
  const saved=pending.get(id);if(!saved||Date.now()-saved.created>900000)return res.status(404).json({error:'Proposal expired; generate a new plan'});
  pending.delete(id);
  validatePlan(saved.plan,saved.allowed);
  for(const [rel,hash] of saved.originals){if(crypto.createHash('sha256').update(fs.readFileSync(projectFile(rel))).digest('hex')!==hash)throw Error('Source changed since planning; regenerate plan')}
  const result=stageProposal({root,plan:saved.plan,build,outputs,projectFile});
  res.set('Cache-Control','no-store');res.json(result);
 }catch(e){res.status(400).json({error:e.message})}
});
router.get('/installer/history',(req,res)=>{try{fs.mkdirSync(outputs,{recursive:true});const packages=fs.readdirSync(outputs).filter(x=>/^ownz-update-[a-f0-9]{12}\.tar\.gz$/.test(x)).map(filename=>{const file=path.join(outputs,filename),stat=fs.statSync(file);if(!stat.isFile())return null;return {id:filename.slice(12,24),filename,bytes:stat.size,created:stat.mtime.toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')}}).filter(Boolean).sort((a,b)=>b.created.localeCompare(a.created)).slice(0,30);res.json({packages})}catch(e){res.status(500).json({error:'History unavailable'})}});
router.get('/installer/verify/:id',(req,res)=>{const id=req.params.id;if(!/^[a-f0-9]{12}$/.test(id))return res.sendStatus(400);const file=path.join(outputs,`ownz-update-${id}.tar.gz`);if(!fs.existsSync(file))return res.sendStatus(404);try{const data=fs.readFileSync(file);res.json({ok:true,filename:path.basename(file),bytes:data.length,sha256:crypto.createHash('sha256').update(data).digest('hex'),note:'Package file fingerprint only; not an install safety or manifest validation'})}catch(e){res.status(500).json({error:'Verification unavailable'})}});
router.post('/installer/build',express.json({limit:'16kb'}),(req,res)=>{try{const files=req.body?.files,name=req.body?.name;if(!Array.isArray(files)||files.length<1||files.length>80||new Set(files).size!==files.length||files.some(x=>typeof x!=='string'))throw Error('Supply 1–80 distinct file paths');files.forEach(projectFile);if(name!==undefined&&(typeof name!=='string'||name.length>80))throw Error('Invalid name');fs.mkdirSync(outputs,{recursive:true});const id=crypto.randomBytes(6).toString('hex');const manifest=path.join(outputs,`manifest-${id}.json`),out=path.join(outputs,`ownz-update-${id}.tar.gz`);try{fs.writeFileSync(manifest,JSON.stringify({name:name||'OWNZ update',files}));const result=build(root,manifest,out);res.json({ok:true,id,filename:path.basename(out),files:result.files,bytes:fs.statSync(out).size})}finally{fs.rmSync(manifest,{force:true})}}catch(e){err(res,e)}});
router.get('/installer/download/:id',(req,res)=>{const id=req.params.id;if(!/^[a-f0-9]{12}$/.test(id))return res.sendStatus(400);const file=path.join(outputs,`ownz-update-${id}.tar.gz`);if(!fs.existsSync(file))return res.sendStatus(404);res.download(file)});
module.exports=router;
