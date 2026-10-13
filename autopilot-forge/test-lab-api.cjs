'use strict';
const express=require('express');
const fs=require('node:fs');
const path=require('node:path');
const router=express.Router();
const file=path.resolve(__dirname,'../.ownz-recovery/autopilot/installer-test-lab-v12.json');
router.get('/status',(req,res)=>{
 res.set('Cache-Control','no-store');
 try {
  const stat=fs.statSync(file);
  if(stat.size>1024*1024) return res.status(500).json({error:'Report size limit exceeded'});
  const report=JSON.parse(fs.readFileSync(file,'utf8'));
  res.json(report);
 }catch(e){res.status(503).json({error:'No test report yet; run test-lab.py first'});}
});
module.exports=router;
