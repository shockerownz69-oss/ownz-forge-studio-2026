'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function inspect(root, paths){
 const base=fs.realpathSync(root);
 return paths.map(name=>{
  if(typeof name!=='string'||!name||path.isAbsolute(name)||name.split(/[\\/]/).includes('..'))return {file:name,status:'rejected'};
  const full=path.resolve(base,name);
  if(!full.startsWith(base+path.sep))return {file:name,status:'rejected'};
  try{
   const st=fs.lstatSync(full);
   if(!st.isFile()||st.isSymbolicLink()||st.size>150000)return {file:name,status:'rejected'};
   const real=fs.realpathSync(full);
   if(!real.startsWith(base+path.sep))return {file:name,status:'rejected'};
   return {file:name,status:'verified',sha256:hash(fs.readFileSync(full)),bytes:st.size};
  }catch(e){return {file:name,status:e.code==='ENOENT'?'missing':'unavailable'};}
 });
}
function assess(finding, snapshot){
 const file=snapshot.find(x=>x.file===finding.file);
 if(!file||file.status!=='verified')return {...finding,freshness:'unavailable'};
 return {...finding,freshness:file.sha256===finding.sha256?'current':'stale'};
}
module.exports={inspect,assess};
