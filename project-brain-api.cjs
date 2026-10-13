'use strict';
const express=require('express');
const path=require('node:path');
const sessions=require('./membership/sessions');
const {createMissionEvidence}=require('./mission-evidence.cjs');
const {adminGuard,sameOrigin,validateReport}=require('./project-brain-security.cjs');
const APPROVED_FILES=['ai-api.js','ai-router.js','ai-providers.js','fatalacidburn-memory.js','fatalacidburn-specialists.js','mission-control/mission.cjs','mission-control/mission-ai.cjs','editor/src/main.js','editor/index.html','project-api.js'];
const router=express.Router();
const bridge=createMissionEvidence({root:path.resolve(__dirname),allowlist:APPROVED_FILES});
router.use(adminGuard(sessions));
router.get('/project-brain/status',(_req,res)=>res.json({engine:'FatalAcidBurn Project Brain',mode:'READ_ONLY',status:'online',files:bridge.snapshot()}));
router.post('/project-brain/verify',sameOrigin,express.json({limit:'16kb',type:'application/json'}),(req,res)=>{
 if(!validateReport(req.body))return res.status(400).json({error:'Invalid or oversized diagnostic input'});
 const {findings=[],suggestions=[]}=req.body;
 res.json(bridge.diagnosticReport({findings,suggestions}));
});
module.exports=router;
