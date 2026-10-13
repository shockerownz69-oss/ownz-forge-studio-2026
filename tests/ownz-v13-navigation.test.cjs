'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../editor/ownz-studio-v13.js'),'utf8');
test('V13 navigation script parses',()=>assert.doesNotThrow(()=>new vm.Script(source)));
test('V13 uses distinct title for Projects and Files active states',()=>{assert.match(source,/button\.dataset\.title===activeTitle/);assert.match(source,/route==='Files'\?'Files'/)});
test('V13 never uses HTML interpolation for route labels',()=>assert.doesNotMatch(source,/innerHTML\s*=/));
test('V13 routes via existing workspace controls, not new unimplemented endpoints',()=>{assert.match(source,/source\.click\(\)/);assert.doesNotMatch(source,/fetch\s*\(/)});
test('V13 only reports Focus active when the focus class is present',()=>assert.match(source,/classList\.contains\('ownz-focus-active'\)/));
test('V13 avoids duplicate shell and retries delayed navigation',()=>{assert.match(source,/getElementById\('ownz-v13-shell'\)/);assert.match(source,/count>=40/)});
