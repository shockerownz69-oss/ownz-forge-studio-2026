'use strict';
const {inspect,assess}=require('./project-brain.cjs');
function createMissionEvidence({root,allowlist}){
 if(typeof root!=='string'||!Array.isArray(allowlist)||!allowlist.length)throw new TypeError('Invalid configuration');
 const approved=new Set(allowlist);
 function snapshot(){return inspect(root,[...approved]).map(({file,status,sha256,bytes})=>({file,status,sha256,bytes}));}
 function verify(findings){
  if(!Array.isArray(findings))throw new TypeError('Expected findings array');
  return findings.slice(0,100).map(f=>{
   if(!f||typeof f.file!=='string'||!approved.has(f.file)||typeof f.sha256!=='string'||!/^[a-f0-9]{64}$/.test(f.sha256))return {file:typeof f?.file==='string'?f.file:null,verification:'rejected',basis:'none'};
   const state=assess(f,inspect(root,[f.file]));
   return {file:f.file,sha256:f.sha256,verification:state.freshness,basis:'sha256-source-fingerprint'};
  });
 }
 function diagnosticReport({findings=[],suggestions=[]}={}){
  const evidence=verify(findings);
  return {mode:'READ_ONLY',verifiedEvidence:evidence,aiSuggestions:Array.isArray(suggestions)?suggestions.slice(0,20).map(s=>({text:String(s).slice(0,500),verification:'unverified-suggestion'})):[],summary:{current:evidence.filter(x=>x.verification==='current').length,stale:evidence.filter(x=>x.verification==='stale').length,unavailable:evidence.filter(x=>x.verification==='unavailable').length,rejected:evidence.filter(x=>x.verification==='rejected').length}};
 }
 return Object.freeze({snapshot,verify,diagnosticReport});
}
module.exports={createMissionEvidence};
