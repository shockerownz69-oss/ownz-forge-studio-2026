'use strict';

const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const cp=require('node:child_process');

const {createWorkspace}=require('./workspace.cjs');
const {applyPatch}=require('./patch-engine.cjs');
const {selectProvider}=require('../ai-router');

const ROOT=path.resolve(__dirname,'..');
const ALLOWED=['editor/src/main.js','editor/index.html'];

const hash=x=>crypto.createHash('sha256').update(x).digest('hex');

function validateProposal(p,source,file){
  if(!p||typeof p!=='object')throw Error('Invalid proposal');
  if(p.file!==file)throw Error('Unexpected target file');
  if(typeof p.search!=='string'||!p.search.length)
    throw Error('Missing search anchor');
  if(typeof p.replacement!=='string'||!p.replacement.length)
    throw Error('Missing replacement');
  if(p.search.length>12000||p.replacement.length>16000)
    throw Error('Patch too large');
  if(source.indexOf(p.search)<0)
    throw Error('Anchor not found');
  if(source.indexOf(p.search,source.indexOf(p.search)+p.search.length)!==-1)
    throw Error('Ambiguous anchor');
  return true;
}

async function generate(request){
  if(typeof request!=='string'||request.length<12||request.length>1000)
    throw Error('Request must be 12-1000 characters');

  const file='editor/src/main.js';
  const original=fs.readFileSync(path.join(ROOT,file),'utf8');

  // First mission targets a small, bounded excerpt.
  const excerpt=original.slice(0,4500);

  // Basic outbound credential guard.
  if(/(?:api[_-]?key|bearer\s+|private[_-]?key|password\s*[:=]|process\.env)/i.test(excerpt))
    throw Error('Potential secret in excerpt; request blocked');

  const provider=selectProvider('groq');

  const response=await fetch(
    'https://api.groq.com/openai/v1/chat/completions',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:'Bearer '+process.env.GROQ_API_KEY
      },
      signal:AbortSignal.timeout(90000),
      body:JSON.stringify({
        model:provider.model,
        temperature:0.1,
        max_completion_tokens:3000,
        response_format:{type:'json_object'},
        messages:[
          {
            role:'system',
            content:'You are FatalAcidBurn, a careful JavaScript engineer. Return JSON with file, search, replacement, explanation. Produce one minimal, non-destructive edit using an exact search anchor from the supplied excerpt. Never modify security controls, authentication, network destinations, or file permissions. Do not claim code was tested.'
          },
          {
            role:'user',
            content:JSON.stringify({request,file,excerpt})
          }
        ]
      })
    }
  );

  if(!response.ok)throw Error('AI provider HTTP '+response.status);

  const data=await response.json();
  if(data.choices?.[0]?.finish_reason==='length')
    throw Error('AI response truncated');

  const proposal=JSON.parse(data.choices?.[0]?.message?.content||'null');
  validateProposal(proposal,original,file);

  const {directory,manifest}=createWorkspace();
  const record=manifest.files.find(f=>f.path===file);

  const result=applyPatch(
    manifest.id,file,record.sha256,
    proposal.search,proposal.replacement
  );

  const patched=path.join(directory,file);
  // OWNZ_ESM_SYNTAX_V11
const syntax=cp.spawnSync(process.execPath,['--input-type=module','--check'],{input:fs.readFileSync(patched,'utf8'),
    encoding:'utf8',timeout:15000
  });

  const report={
    version:'1.0',
    state:syntax.status===0?'PATCH_SYNTAX_PASS':'PATCH_SYNTAX_FAIL',
    request,
    workspace:manifest.id,
    file,
    before:result.before,
    after:result.after,
    explanation:String(proposal.explanation||'').slice(0,1000),
    syntaxPassed:syntax.status===0,
    syntaxError:syntax.status===0?null:String(syntax.stderr).slice(0,1500),
    liveInstalled:false,
    functionalTestsRun:false,
    approvalRequired:true
  };

  fs.writeFileSync(
    path.join(directory,'ai-patch-report.json'),
    JSON.stringify(report,null,2),
    {flag:'wx',mode:0o600}
  );

  console.log(JSON.stringify(report,null,2));

  if(!report.syntaxPassed)process.exitCode=1;
}

function selfTest(){
  const source='function example(){ return 1; }';
  validateProposal({
    file:'editor/src/main.js',
    search:'return 1;',
    replacement:'return 2;'
  },source,'editor/src/main.js');

  let rejected=false;
  try{
    validateProposal({
      file:'../../server.js',
      search:'return 1;',
      replacement:'return 2;'
    },source,'editor/src/main.js');
  }catch{rejected=true}

  if(!rejected)throw Error('Unapproved target accepted');

  console.log('[PASS] Proposal validation');
  console.log('[PASS] Unapproved target rejected');
  console.log('[OWNZ] AI Patch Pipeline v1.0 READY');
}

if(require.main===module){
  const args=process.argv.slice(2);
  if(args[0]==='--self-test')selfTest();
  else if(args[0]==='--run')
    generate(args.slice(1).join(' ')).catch(e=>{
      console.error('[OWNZ] '+e.message);
      process.exitCode=1;
    });
  else{
    console.log('Usage: --self-test | --run "request"');
    process.exitCode=2;
  }
}

module.exports={generate,validateProposal};
