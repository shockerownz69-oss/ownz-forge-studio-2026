'use strict';
const express=require('express');const router=express.Router();
const {ownerLogin,ownerLogout,rejectCrossOrigin}=require('./owner-auth.cjs');
router.use(rejectCrossOrigin);
router.post('/login',express.json({limit:'2kb'}),ownerLogin);
router.post('/logout',ownerLogout);
module.exports=router;
