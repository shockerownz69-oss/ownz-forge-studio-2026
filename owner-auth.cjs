'use strict';
const crypto=require('node:crypto');
const COOKIE='ownz_owner_session';
const TTL=12*60*60*1000;
const attempts=new Map();
function secret(){const s=process.env.OWNZ_FORGE_OWNER_TOKEN;return typeof s==='string'&&s.length>=32?s:null}
function eq(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function signature(s,payload){return crypto.createHmac('sha256',s).update('ownz-owner-v2:'+payload).digest('hex')}
function cookieValue(s,now=Date.now()){const payload=String(now+TTL);return payload+'.'+signature(s,payload)}
function validCookie(s,value,now=Date.now()){
 if(typeof value!=='string'||value.length>200)return false;
 const m=/^(\d{13})\.([0-9a-f]{64})$/.exec(value);if(!m)return false;
 const exp=Number(m[1]);return exp>now&&exp<=now+TTL&&eq(m[2],signature(s,m[1]));
}
function sessionFromRequest(req){const header=req.headers?.cookie||'';const match=header.match(/(?:^|;\s*)ownz_owner_session=([^;]+)/);return match?.[1]||''}
function ownerGuard(req,res,next){
 const s=secret();res.setHeader('Cache-Control','no-store');
 if(!s)return res.status(503).json({error:'Owner authentication is not configured'});
 const bearer=/^Bearer ([^\s]+)$/.exec(req.headers?.authorization||'')?.[1];
 if(eq(bearer,s)||validCookie(s,sessionFromRequest(req)))return next();
 return res.status(401).json({error:'Owner authentication required'});
}
function rejectCrossOrigin(req,res,next){
 if(!['POST','PUT','PATCH','DELETE'].includes(req.method))return next();
 if(req.headers?.['sec-fetch-site']==='cross-site')return res.status(403).json({error:'Cross-site request blocked'});
 const origin=req.headers?.origin;
 if(origin){try{const u=new URL(origin);if(!['http:','https:'].includes(u.protocol)||!(u.host===req.headers?.host||(u.origin==='http://127.0.0.1:5173'&&['127.0.0.1:3000','127.0.0.1:3001'].includes(req.headers?.host)&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket?.remoteAddress))))return res.status(403).json({error:'Origin not allowed'});}catch(_){return res.status(403).json({error:'Origin not allowed'});}}
 else if(sessionFromRequest(req)&&!req.headers?.authorization)return res.status(403).json({error:'Origin required for browser session writes'});
 next();
}

// Optional locally enrolled password. Never stored in browser code or logged.
function passwordMatches(candidate){
 if(typeof candidate!=='string'||candidate.length>256)return false;
 try{
  const fs=require('node:fs'),path=require('node:path');
  const file=path.join(require('node:os').homedir(),'.config','ownz-forge','owner-password.json');
  const v=JSON.parse(fs.readFileSync(file,'utf8'));
  if(v.version!==1||!(/^[0-9a-f]{32}$/.test(v.salt))||!(/^[0-9a-f]{128}$/.test(v.hash)))return false;
  const expected=Buffer.from(v.hash,'hex');
  const actual=crypto.scryptSync(candidate,Buffer.from(v.salt,'hex'),64,{N:16384,r:8,p:1});
  return crypto.timingSafeEqual(actual,expected);
 }catch(_){return false;}
}

function ownerLogin(req,res){
 res.setHeader('Cache-Control','no-store');const s=secret();if(!s)return res.status(503).json({error:'Owner authentication is not configured'});
 const key=req.socket?.remoteAddress||'unknown';const now=Date.now();let entry=attempts.get(key)||{count:0,until:now+15*60*1000};
 if(entry.until<now)entry={count:0,until:now+15*60*1000};
 if(entry.count>=8)return res.status(429).json({error:'Too many attempts'});
 if(!(eq(req.body?.token,s)||passwordMatches(req.body?.password))){entry.count++;attempts.set(key,entry);return res.status(401).json({error:'Invalid credentials'});}
 attempts.delete(key);
 const secure=Boolean(req.secure);
 res.setHeader('Set-Cookie',COOKIE+'='+cookieValue(s)+'; HttpOnly; SameSite=Strict; Path=/api; Max-Age=43200'+(secure?'; Secure':''));
 res.json({ok:true});
}
function ownerLogout(req,res){res.setHeader('Set-Cookie',COOKIE+'=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0'+(req.secure?'; Secure':''));res.setHeader('Cache-Control','no-store');res.json({ok:true})}
module.exports={ownerGuard,rejectCrossOrigin,ownerLogin,ownerLogout,cookieValue,validCookie};
