 'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),cp=require('node:child_process');
const {backup}=require('../recovery-center.cjs');
const dashboard=path.join(__dirname,'../recovery-dashboard.cjs');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'ownz85-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir}
function inspect(root,id){return JSON.parse(cp.execFileSync(process.execPath,['-e',`console.log(JSON.stringify(require(${JSON.stringify(dashboard)}).verify(${JSON.stringify(id)})))`],{env:{...process.env,OWNZ_PROJECT_ROOT:root}}).toString())}
test('new-file-only recovery point reports zero checksums transparently',t=>{const root=fixture(t);const b=backup(root,['new.js']);const r=inspect(root,b.id);assert.equal(r.checksums,0);assert.equal(r.newFiles,1);assert.match(r.note,/No previous file contents/)});
test('existing-file recovery point verifies original checksum',t=>{const root=fixture(t);fs.writeFileSync(path.join(root,'a.js'),'ORIGINAL');const b=backup(root,['a.js']);const r=inspect(root,b.id);assert.equal(r.checksums,1);assert.equal(r.newFiles,0)});
test('tampered existing-file backup fails verification',t=>{const root=fixture(t);fs.writeFileSync(path.join(root,'a.js'),'ORIGINAL');const b=backup(root,['a.js']);fs.writeFileSync(path.join(b.location,'original/a.js'),'TAMPER');assert.throws(()=>inspect(root,b.id),/Backup checksum mismatch/)});
test('dashboard has external CSS and editor entry',()=>{const html=fs.readFileSync(path.join(__dirname,'../recovery-dashboard.html'),'utf8');assert.match(html,/href="\/style.css"/);assert.doesNotMatch(html,/<style>/);const editor=fs.readFileSync(path.join(__dirname,'../../editor/index.html'),'utf8');assert.match(editor,/OPEN INSTALLER RECOVERY DASHBOARD/)});
test('dashboard CSS and scripts parse',()=>{assert.doesNotThrow(()=>new (require('node:vm').Script)(fs.readFileSync(path.join(__dirname,'../recovery-dashboard.js'),'utf8')));assert.match(fs.readFileSync(path.join(__dirname,'../recovery-dashboard.css'),'utf8'),/background/)});
