'use strict';
const MAX_FINDINGS=40,MAX_SUGGESTIONS=20;
function sessionToken(req){
 const cookie=typeof req.headers?.cookie==='string'?req.headers.cookie:'';
 const match=cookie.match(/(?:^|;\s*)ownz_session=([a-f0-9]{64})(?:;|$)/);
 return match?match[1]:null;
}
function adminGuard(sessions){
 if(!sessions||typeof sessions.getSession!=='function'||typeof sessions.isAdmin!=='function')throw new TypeError('Missing session contract');
 return (req,res,next)=>{
  const token=sessionToken(req);
  if(!token)return res.status(401).json({error:'Login required'});
  let user;
  try{user=sessions.getSession(token)}catch(_){return res.status(503).json({error:'Session service unavailable'})}
  if(!user)return res.status(401).json({error:'Login required'});
  if(!sessions.isAdmin(user))return res.status(403).json({error:'Administrator required'});
  next();
 };
}
function sameOrigin(req,res,next){
 const site=req.get('sec-fetch-site');
 if(site==='cross-site')return res.status(403).json({error:'Cross-site request blocked'});
 const origin=req.get('origin');
 if(origin){
  try{
   const parsed=new URL(origin);
   if(!req.get('host')||parsed.host!==req.get('host')||!['http:','https:'].includes(parsed.protocol)||
      (process.env.NODE_ENV==='production'&&parsed.protocol!=='https:'))throw Error('Origin mismatch');
  }catch(_){return res.status(403).json({error:'Origin not allowed'})}
 }else if(site!=='same-origin'&&site!=='none'){
  // Cookie-authenticated POST must have positive browser origin evidence.
  return res.status(403).json({error:'Origin required'});
 }
 next();
}
function validateReport(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return false;
 const {findings=[],suggestions=[]}=body;
 if(!Array.isArray(findings)||!Array.isArray(suggestions)||findings.length>MAX_FINDINGS||suggestions.length>MAX_SUGGESTIONS)return false;
 return findings.every(f=>f&&typeof f==='object'&&!Array.isArray(f)&&typeof f.file==='string'&&f.file.length<=160&&typeof f.sha256==='string'&&f.sha256.length===64)
 && suggestions.every(s=>typeof s==='string'&&s.length<=500);
}
module.exports={adminGuard,sameOrigin,validateReport,sessionToken};
