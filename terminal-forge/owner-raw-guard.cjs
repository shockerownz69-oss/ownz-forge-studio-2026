'use strict';
const crypto=require('node:crypto');
const {validCookie}=require('../owner-auth.cjs');
function equal(a,b){if(typeof a!=='string'||typeof b!=='string')return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&crypto.timingSafeEqual(x,y)}
function reject(res,status,message){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify({error:message}));return false}
function authorize(req,res,options={}){
 const secret=process.env.OWNZ_FORGE_OWNER_TOKEN;
 if(!secret||secret.length<32)return reject(res,503,'Owner authentication not configured');
 const bearer=/^Bearer ([^\s]+)$/.exec(req.headers.authorization||'')?.[1];
 const cookie=/(?:^|;\s*)ownz_owner_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];
 const byBearer=equal(bearer,secret);
 if(!byBearer&&!validCookie(secret,cookie))return reject(res,401,'Owner authentication required');
 if(!byBearer&&['POST','PUT','PATCH','DELETE'].includes(req.method)){
  const origin=req.headers.origin;
  if(!origin||!(options.allowedOrigins||['http://127.0.0.1:5173','http://localhost:5173']).includes(origin))return reject(res,403,'Origin not allowed');
 }
 return true;
}
module.exports={authorize};
