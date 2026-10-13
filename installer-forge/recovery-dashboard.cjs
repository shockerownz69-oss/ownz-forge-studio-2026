 'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const recovery=require('./recovery-center.cjs');
const {authorize}=require('../terminal-forge/owner-raw-guard.cjs');
const {cookieValue,validCookie}=require('../owner-auth.cjs');
const ROOT=path.resolve(process.env.OWNZ_PROJECT_ROOT||path.join(__dirname,'..'));
const PORT=Number(process.env.OWNZ_RECOVERY_PORT||3004);
const HTML=path.join(__dirname,'recovery-dashboard.html');
const CSS=path.join(__dirname,'recovery-dashboard.css');
const MAX_BODY=4096;
const loginAttempts=new Map();
const LOGIN_WINDOW_MS=15*60*1000;
const LOGIN_LIMIT=8;
function verify(id){
 const {manifest,location}=recovery.read(ROOT,id);let checked=0,created=0;
 const seen=new Set();
 for(const f of manifest.files){
  if(!f||typeof f.path!=='string'||typeof f.existed!=='boolean'||!f.path||f.path.includes('\\')||f.path.startsWith('/')||f.path.split('/').some(s=>!s||s==='.'||s==='..')||seen.has(f.path))throw Error('Invalid recovery manifest path');
  seen.add(f.path);
  if(f.existed){
   const file=path.resolve(location,'original',f.path);
   if(!file.startsWith(path.resolve(location,'original')+path.sep)||!fs.existsSync(file)||!fs.lstatSync(file).isFile()||fs.realpathSync(file)!==file)throw Error('Missing or unsafe backup file');
   const actual=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
   if(actual!==f.sha256)throw Error('Backup checksum mismatch: '+f.path);
   checked++;
  }else{if(f.sha256!==null)throw Error('Invalid new-file recovery entry: '+f.path);created++}
 }
 return {id,verified:true,files:manifest.files.length,checksums:checked,newFiles:created,restorable:true,note:checked===0?'No previous file contents to checksum; this recovery point records newly added files for removal during restore.':'Existing file backups verified.'};
}
function createServer(){return http.createServer(async(req,res)=>{
 const origin=req.headers.origin;const host=req.headers.host;
 const activePort=res.socket?.localPort||PORT;
 if(!host||!['127.0.0.1:'+activePort,'localhost:'+activePort].includes(host)){res.writeHead(403);return res.end('Invalid host')}
 if(origin&&origin!=='http://'+host){res.writeHead(403);return res.end('Cross-origin request rejected')}
 const url=new URL(req.url,'http://'+host);
 const secret=process.env.OWNZ_FORGE_OWNER_TOKEN;
 const rawCookie=/(?:^|;\s*)ownz_recovery_session=([^;]+)/.exec(req.headers.cookie||'')?.[1];
 const recoverySession=!!(secret&&secret.length>=32&&validCookie(secret,rawCookie));
 const recoveryReq=Object.create(req);
 recoveryReq.headers={...req.headers};
 if(recoverySession){recoveryReq.headers.cookie=(req.headers.cookie||'')+'; ownz_owner_session='+rawCookie;}
 if(req.method==='POST'&&url.pathname==='/api/recovery-login'){
  if(origin!=='http://'+host){res.writeHead(403);return res.end('Origin required')}
  let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096){res.writeHead(413);return res.end('Too large')}}
  let body;try{body=JSON.parse(raw)}catch{res.writeHead(400);return res.end('Invalid JSON')}
  const key=req.socket.remoteAddress||'local';
  const now=Date.now();let attempt=loginAttempts.get(key);
  if(!attempt||now-attempt.started>LOGIN_WINDOW_MS){attempt={started:now,count:0};loginAttempts.set(key,attempt)}
  if(attempt.count>=LOGIN_LIMIT){res.writeHead(429,{'Cache-Control':'no-store','Retry-After':'900'});return res.end('Too many login attempts')}
  const submitted=body?.token;
  const a=Buffer.from(typeof submitted==='string'?submitted:'');const b=Buffer.from(secret||'');
  const ok=!!secret&&secret.length>=32&&a.length===b.length&&crypto.timingSafeEqual(a,b);
  if(!ok){attempt.count++;res.writeHead(401,{'Cache-Control':'no-store'});return res.end('Invalid owner credentials')}
  loginAttempts.delete(key);
  res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':'ownz_recovery_session='+cookieValue(secret)+'; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200'});
  return res.end(JSON.stringify({ok:true}));
 }
 if(req.method==='GET'&&url.pathname==='/login'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; script-src 'unsafe-inline'; connect-src 'self'; style-src 'unsafe-inline'; form-action 'none'; frame-ancestors 'none'"});
  return res.end(`<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><title>OWNZ Recovery Login</title><style>body{font:16px system-ui;background:#161616;color:white;max-width:440px;margin:12vh auto;padding:20px}input,button{box-sizing:border-box;width:100%;padding:14px;margin:12px 0;background:#282828;color:white;border:1px solid #777}button{background:#a22}</style><h1>OWNZ Recovery</h1><p>Owner authentication required</p><form id=f><input id=t type=password autocomplete=off placeholder="Owner token" required><button>Sign in</button></form><p id=m role=alert></p><script>f.onsubmit=async e=>{e.preventDefault();try{const r=await fetch('/api/recovery-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:t.value})});t.value='';if(!r.ok)throw Error('Sign-in failed');location.replace('/')}catch(e){m.textContent=e.message}}</script>`);
 }
 if(!recoverySession && !req.headers.authorization && req.method==='GET' && ['/', '/style.css','/app.js'].includes(url.pathname)){
  res.writeHead(302,{'Location':'/login','Cache-Control':'no-store'});return res.end();
 }
 if(!authorize(recoveryReq,res,{allowedOrigins:['http://'+host]}))return;
 const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"});res.end(JSON.stringify(data))};
 try{
  if(req.method==='GET'&&url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"});return res.end(fs.readFileSync(HTML))}
  if(req.method==='GET'&&url.pathname==='/style.css'){res.writeHead(200,{'Content-Type':'text/css; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(fs.readFileSync(CSS))}
  if(req.method==='GET'&&url.pathname==='/app.js'){res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8','Cache-Control':'no-store'});return res.end(fs.readFileSync(path.join(__dirname,'recovery-dashboard.js')))}
  if(req.method==='GET'&&url.pathname==='/api/list')return reply(200,{backups:recovery.list(ROOT)});
  if(req.method==='GET'&&url.pathname==='/api/verify')return reply(200,verify(url.searchParams.get('id')||''));
  if(req.method==='GET'&&url.pathname==='/api/session')return reply(404,{error:'Not found'});
  if(req.method==='POST'&&url.pathname==='/api/restore'){
   if(origin!=='http://'+host||req.headers['x-ownz-approval']!=='RESTORE-CONFIRMED')return reply(403,{error:'Local approval required'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>MAX_BODY)return reply(413,{error:'Request too large'})}
   const body=JSON.parse(raw);if(!body||typeof body.id!=='string'||body.confirm!==('RESTORE '+body.id))return reply(400,{error:'Exact restore confirmation required'});
   verify(body.id);const result=recovery.restore(ROOT,body.id,body.confirm);return reply(200,result)
  }
  return reply(404,{error:'Not found'});
 }catch(err){return reply(400,{error:err.message})}
})}
if(require.main===module){createServer().listen(PORT,'127.0.0.1',()=>console.log('OWNZ Recovery Dashboard: http://127.0.0.1:'+PORT))}
module.exports={createServer,verify};
