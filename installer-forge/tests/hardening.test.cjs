'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const {build,install}=require('../installer-forge.cjs');

function hash(file){
 return crypto.createHash('sha256')
  .update(fs.readFileSync(file)).digest('hex');
}

function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ownz-regression-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const source=path.join(root,'source');
 const target=path.join(root,'target');
 fs.mkdirSync(source);
 fs.mkdirSync(target);
 return {root,source,target};
}

function packageUpdate(f,files){
 for(const [name,content] of Object.entries(files)){
  const file=path.join(f.source,name);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,content);
 }
 const manifest=path.join(f.source,'input.json');
 fs.writeFileSync(manifest,JSON.stringify({files:Object.keys(files)}));
 const archive=path.join(f.root,'update.tar.gz');
 build(f.source,manifest,archive);
 return archive;
}

test('hardened builder rejects duplicate file paths',t=>{
 const f=fixture(t);
 fs.writeFileSync(path.join(f.source,'a.js'),'NEW');
 const manifest=path.join(f.source,'input.json');
 fs.writeFileSync(manifest,JSON.stringify({files:['a.js','a.js']}));
 assert.throws(
  ()=>build(f.source,manifest,path.join(f.root,'duplicate.tar.gz')),
  /Duplicate manifest file paths/
 );
});

test('hardened installer preserves original backup checksum',t=>{
 const f=fixture(t);
 const archive=packageUpdate(f,{'a.js':'NEW'});
 const dest=path.join(f.target,'a.js');
 fs.writeFileSync(dest,'ORIGINAL');
 const before=hash(dest);
 const result=install(archive,f.target);
 assert.equal(fs.readFileSync(dest,'utf8'),'NEW');
 assert.equal(hash(path.join(result.backup,'a.js')),before);
});

test('hardened installer restores original checksum on failed test',t=>{
 const f=fixture(t);
 const archive=packageUpdate(f,{'a.js':'NEW'});
 const dest=path.join(f.target,'a.js');
 fs.writeFileSync(dest,'ORIGINAL');
 fs.writeFileSync(path.join(f.target,'fail.cjs'),'process.exit(1)');
 const before=hash(dest);
 assert.throws(
  ()=>install(archive,f.target,{test:['fail.cjs']}),
  /Rolled back/
 );
 assert.equal(hash(dest),before);
});

test('rollback removes newly introduced files',t=>{
 const f=fixture(t);
 const archive=packageUpdate(f,{'new.js':'NEW'});
 fs.writeFileSync(path.join(f.target,'fail.cjs'),'process.exit(1)');
 assert.throws(
  ()=>install(archive,f.target,{test:['fail.cjs']}),
  /Rolled back/
 );
 assert.equal(fs.existsSync(path.join(f.target,'new.js')),false);
});

test('corrupt package cannot overwrite existing files',t=>{
 const f=fixture(t);
 const archive=path.join(f.root,'corrupt.tar.gz');
 const dest=path.join(f.target,'a.js');
 fs.writeFileSync(dest,'ORIGINAL');
 fs.writeFileSync(archive,'INVALID ARCHIVE');
 const before=hash(dest);
 assert.throws(()=>install(archive,f.target));
 assert.equal(hash(dest),before);
});

test('directory destination rejection does not create incomplete backup',t=>{
 const f=fixture(t);
 const archive=packageUpdate(f,{'a.js':'NEW'});
 fs.mkdirSync(path.join(f.target,'a.js'));
 fs.writeFileSync(path.join(f.target,'a.js','keep.txt'),'ORIGINAL');
 assert.throws(()=>install(archive,f.target),/Destination not regular file/);
 assert.equal(fs.readFileSync(path.join(f.target,'a.js','keep.txt'),'utf8'),'ORIGINAL');
 const backups=path.join(f.target,'backups');
 assert.equal(fs.existsSync(backups)?fs.readdirSync(backups).length:0,0);
});
