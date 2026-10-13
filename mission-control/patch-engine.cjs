
'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {createWorkspace}=require('./workspace.cjs');
const ROOT=path.resolve(__dirname,'..');
const BASE=path.join(ROOT,'.ownz-recovery','workspaces');
const ALLOWED=['editor/src/main.js','editor/index.html'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');

function applyPatch(id,file,expectedHash,search,replacement){
  if(!/^forge-[0-9]+-[a-f0-9]{8}$/.test(id))throw Error('Invalid workspace');
  if(!ALLOWED.includes(file))throw Error('File not approved');
  if(typeof search!=='string'||!search.length||typeof replacement!=='string')
    throw Error('Invalid patch');
  if(search.length>20000||replacement.length>30000)
    throw Error('Patch exceeds size limit');

  const dir=path.join(BASE,id);
  const manifestPath=path.join(dir,'workspace-manifest.json');
  const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
  if(manifest.id!==id||!manifest.files.some(f=>f.path===file))
    throw Error('Manifest mismatch');

  const target=path.join(dir,file);
  for(const p of [BASE,dir,path.join(dir,'editor'),path.dirname(target),target]){
    if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink rejected');
  }
  const current=fs.readFileSync(target,'utf8');
  if(hash(current)!==expectedHash)throw Error('Source version mismatch');

  const pos=current.indexOf(search);
  if(pos<0||current.indexOf(search,pos+search.length)!==-1)
    throw Error('Patch anchor missing or ambiguous');

  const updated=current.slice(0,pos)+replacement+current.slice(pos+search.length);
  if(updated===current)throw Error('No change');

  fs.writeFileSync(target,updated,{mode:0o600});
  return {file,before:hash(current),after:hash(updated),liveModified:false};
}

function selfTest(){
  const originals=ALLOWED.map(f=>hash(fs.readFileSync(path.join(ROOT,f))));
  const {directory,manifest}=createWorkspace();
  const file='editor/src/main.js';
  const record=manifest.files.find(f=>f.path===file);
  const original=fs.readFileSync(path.join(directory,file),'utf8');
  const anchor=original.slice(0,Math.min(80,original.length));
  if(!anchor)throw Error('Empty editor source');

  const result=applyPatch(manifest.id,file,record.sha256,
    anchor,anchor+'\n/* FORGE PATCH SELF TEST */');

  if(hash(fs.readFileSync(path.join(directory,file)))!==result.after)
    throw Error('Workspace verification failed');
  if(ALLOWED.some((f,i)=>hash(fs.readFileSync(path.join(ROOT,f)))!==originals[i]))
    throw Error('Live source changed');

  let staleRejected=false;
  try{applyPatch(manifest.id,file,record.sha256,anchor,anchor+'x')}
  catch(e){staleRejected=/version mismatch/.test(e.message)}
  if(!staleRejected)throw Error('Stale patch was not rejected');

  console.log('[PASS] Workspace created');
  console.log('[PASS] Patch applied to disposable copy');
  console.log('[PASS] Result hash verified');
  console.log('[PASS] Stale patch rejected');
  console.log('[PASS] Live editor unchanged');
  console.log('[OWNZ] Patch Engine v1.0 READY');
}
if(require.main===module)selfTest();
module.exports={applyPatch};
