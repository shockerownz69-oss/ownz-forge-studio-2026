'use strict';
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');const cp=require('node:child_process');const crypto=require('node:crypto');const {validateArchive}=require('./tar-preflight.cjs');
function validRel(s){if(typeof s!=='string'||!s||s.includes('\\')||s.includes('\0')||path.posix.isAbsolute(s)||s.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe relative path: '+s);return s}
function inside(root,rel){const p=path.resolve(root,validRel(rel));if(!p.startsWith(path.resolve(root)+path.sep))throw Error('Path escapes root');return p}
function checkPath(root,rel,allowMissing=false){let p=path.resolve(root);for(const part of validRel(rel).split('/')){p=path.join(p,part);if(!fs.existsSync(p)){if(allowMissing)continue;throw Error('Missing path: '+rel)}if(fs.lstatSync(p).isSymbolicLink())throw Error('Symlink not allowed: '+rel)}return p}
function sha(b){return crypto.createHash('sha256').update(b).digest('hex')}
function build(project,manifest,out){const root=path.resolve(project),m=JSON.parse(fs.readFileSync(manifest,'utf8'));if(!Array.isArray(m.files)||!m.files.length)throw Error('Manifest must list files');if(new Set(m.files).size!==m.files.length)throw Error('Duplicate manifest file paths');const files=[];const stage=fs.mkdtempSync(path.join(os.tmpdir(),'ownz-build-'));try{fs.mkdirSync(path.join(stage,'payload'));for(const rel of m.files){validRel(rel);const src=checkPath(root,rel),st=fs.statSync(src);if(!st.isFile())throw Error('Not a regular file: '+rel);const dest=inside(path.join(stage,'payload'),rel);fs.mkdirSync(path.dirname(dest),{recursive:true});const data=fs.readFileSync(src);fs.writeFileSync(dest,data);files.push({path:rel,sha256:sha(data),bytes:data.length})}fs.writeFileSync(path.join(stage,'manifest.json'),JSON.stringify({format:1,name:String(m.name||'OWNZ update'),files},null,2));fs.copyFileSync(__filename,path.join(stage,'installer-forge.cjs'));fs.copyFileSync(path.join(__dirname,'tar-preflight.cjs'),path.join(stage,'tar-preflight.cjs'));const output=path.resolve(out);fs.mkdirSync(path.dirname(output),{recursive:true});cp.execFileSync('tar',['-czf',output,'-C',stage,'manifest.json','payload','installer-forge.cjs','tar-preflight.cjs']);return {output,files:files.length}}finally{fs.rmSync(stage,{recursive:true,force:true})}}
function install(pkg,target,opts={}){const root=path.resolve(target),temp=fs.mkdtempSync(path.join(os.tmpdir(),'ownz-install-'));let backup=null;let written=[];try{validateArchive(path.resolve(pkg));cp.execFileSync('tar',['-tzf',path.resolve(pkg)],{stdio:'pipe'}).toString().split('\n').filter(Boolean).forEach(n=>{if(n.endsWith('/'))n=n.slice(0,-1);if(n&&n!=='manifest.json'&&n!=='installer-forge.cjs'&&n!=='tar-preflight.cjs'&&n!=='payload'&&!n.startsWith('payload/'))throw Error('Unexpected archive entry');if(n.startsWith('payload/'))validRel(n.slice(8))});cp.execFileSync('tar',['-xzf',path.resolve(pkg),'-C',temp]);const m=JSON.parse(fs.readFileSync(path.join(temp,'manifest.json')));if(m.format!==1||!Array.isArray(m.files)||!m.files.length)throw Error('Invalid manifest');if(m.files.some(f=>!f||typeof f.path!=='string')||new Set(m.files.map(f=>f.path)).size!==m.files.length)throw Error('Duplicate or invalid manifest file paths');for(const f of m.files){const src=checkPath(path.join(temp,'payload'),f.path);if(!fs.statSync(src).isFile()||sha(fs.readFileSync(src))!==f.sha256)throw Error('Checksum mismatch: '+f.path);checkPath(root,f.path,true)}const previous=[];
for(const f of m.files){
 const dest=inside(root,f.path);
 const existed=fs.existsSync(dest);
 if(existed){const old=checkPath(root,f.path);if(!fs.statSync(old).isFile())throw Error('Destination not regular file')}
 previous.push({path:f.path,existed});
}
const backupParent=path.join(root,'backups');
fs.mkdirSync(backupParent,{recursive:true});
backup=fs.mkdtempSync(path.join(backupParent,'ownz-installer-'));
try{
 for(const f of previous){
  if(!f.existed)continue;
  const old=checkPath(root,f.path);
  const copy=inside(backup,f.path);
  fs.mkdirSync(path.dirname(copy),{recursive:true});
  fs.copyFileSync(old,copy);
  if(sha(fs.readFileSync(old))!==sha(fs.readFileSync(copy)))throw Error('Backup checksum mismatch: '+f.path);
 }
}catch(err){fs.rmSync(backup,{recursive:true,force:true});throw Error('Backup preparation failed: '+err.message)}
try{for(const f of m.files){const dest=inside(root,f.path);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(inside(path.join(temp,'payload'),f.path),dest);written.push(f.path)}if(opts.test){cp.execFileSync(process.execPath,[...opts.test],{cwd:root,stdio:'inherit',env:{...process.env,NODE_TEST_CONTEXT:''}})}fs.writeFileSync(path.join(backup,'restore-manifest.json'),JSON.stringify(previous,null,2));return {installed:written.length,backup}}catch(err){for(const f of previous.reverse()){const dest=inside(root,f.path);if(f.existed)fs.copyFileSync(inside(backup,f.path),dest);else fs.rmSync(dest,{force:true})}throw Error('Rolled back after failure: '+err.message)}}finally{fs.rmSync(temp,{recursive:true,force:true})}}
if(require.main===module){try{const [cmd,...args]=process.argv.slice(2);if(cmd==='build'){if(args.length!==3)throw Error('Usage: build PROJECT MANIFEST OUTPUT.tar.gz');console.log(JSON.stringify(build(...args)))}else if(cmd==='install'){if(args.length<2)throw Error('Usage: install PACKAGE TARGET [test-file ...]');console.log(JSON.stringify(install(args[0],args[1],{test:args.slice(2)})))}else throw Error('Commands: build, install')}catch(e){console.error('OWNZ INSTALLER FORGE:',e.message);process.exitCode=1}}
module.exports={build,install,validRel};
