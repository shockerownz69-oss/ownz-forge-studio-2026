'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),os=require('node:os');
const root=path.resolve(__dirname,'..');
const reportDir=path.join(root,'.ownz-recovery','autopilot');
const reportPath=path.join(reportDir,'installer-preflight-v11.json');
const downloads=path.join(os.homedir(),'storage','downloads');
const now=new Date().toISOString();
const result={version:'1.1',mode:'guarded',time:now,checks:[],packages:[],warnings:[],summary:'',safeToAutoInstall:false};
function check(name,ok,detail){result.checks.push({name,ok,detail});}
function command(program,args,opts={}){return cp.spawnSync(program,args,{encoding:'utf8',timeout:12000,maxBuffer:2*1024*1024,...opts});}
try{
 const r=command('git',['-C',root,'branch','--show-current']);check('Git main branch',r.status===0&&r.stdout.trim()==='main',(r.stdout||r.stderr||'').trim().slice(0,160));
 const model=path.join(root,'ai-models','Qwen3.5-4B-Q4_K_M.gguf');check('Qwen model present',fs.existsSync(model)&&fs.statSync(model).size>1000000000,'Local model must remain outside package scans');
 const ignore=command('git',['-C',root,'check-ignore','-q','ai-models/Qwen3.5-4B-Q4_K_M.gguf']);check('Qwen model ignored',ignore.status===0,'Git ignore protection');
 const src=path.join(root,'autopilot-forge','autopilot-run.cjs');const syntax=command(process.execPath,['--check',src]);check('Autopilot engine syntax',syntax.status===0,(syntax.stderr||'OK').slice(0,250));
 if(fs.existsSync(downloads)){
  const archives=fs.readdirSync(downloads).filter(n=>/^ownz-[\w.-]+\.tar\.gz$/i.test(n)).map(n=>({name:n,full:path.join(downloads,n)})).filter(x=>fs.statSync(x.full).isFile()).sort((a,b)=>fs.statSync(b.full).mtimeMs-fs.statSync(a.full).mtimeMs).slice(0,5);
  for(const a of archives){const size=fs.statSync(a.full).size;const item={name:a.name,bytes:size,ok:false,issues:[],files:0};result.packages.push(item);
   if(size>30*1024*1024){item.issues.push('Archive exceeds 30 MB inspection limit');continue;}
   const listing=command('tar',['-tzf',a.full]);if(listing.status!==0){item.issues.push('Archive unreadable or inspection timed out');continue;}
   const lines=listing.stdout.split('\n').filter(Boolean);item.files=lines.length;
   if(lines.length>1000){item.issues.push('More than 1000 entries');continue;}
   for(const n of lines){const parts=n.split('/');if(n.startsWith('/')||parts.includes('..')||n.includes('\\')||n.includes('\0')){item.issues.push('Unsafe archive path');break;}}
   const verbose=command('tar',['-tvzf',a.full]);if(verbose.status!==0){item.issues.push('Unable to inspect archive entry types');continue;}
   if(verbose.stdout.split('\n').some(line=>line&& !['-','d'].includes(line[0]))){item.issues.push('Links or special entries detected');continue;}
   item.ok=item.issues.length===0;
  }
 }else result.warnings.push('Downloads directory unavailable; no installer archives scanned');
 const failures=result.checks.filter(x=>!x.ok).length;const rejected=result.packages.filter(x=>!x.ok).length;
 result.summary=`${result.checks.length-failures}/${result.checks.length} environment checks passed; ${result.packages.length-rejected}/${result.packages.length} archive structures passed`;
 result.status=failures||rejected?'ATTENTION':'PASS';
}catch(e){result.status='ERROR';result.warnings.push(String(e.message).slice(0,250));}
fs.mkdirSync(reportDir,{recursive:true,mode:0o700});const tmp=reportPath+'.'+process.pid+'.tmp';fs.writeFileSync(tmp,JSON.stringify(result,null,2),{mode:0o600});fs.renameSync(tmp,reportPath);
console.log('[OWNZ AUTOPILOT PREFLIGHT]',result.status,result.summary);process.exitCode=result.status==='ERROR'?1:0;
