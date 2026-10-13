'use strict';
const express=require('express'),fs=require('node:fs'),path=require('node:path');
const router=express.Router();
router.get('/report',(req,res)=>{res.set('Cache-Control','no-store');try{const p=path.join(__dirname,'..','.ownz-recovery','autopilot','installer-preflight-v11.json');const s=fs.statSync(p);if(s.size>100000)throw Error('Report too large');res.type('json').send(fs.readFileSync(p,'utf8'));}catch(e){res.status(503).json({error:'No preflight report available yet'});}});
module.exports=router;
