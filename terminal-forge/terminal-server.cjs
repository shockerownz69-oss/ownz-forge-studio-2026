const {authorize}=require('./owner-raw-guard.cjs');
'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),PORT=3002,HOST='127.0.0.1';
const allowedOrigins=new Set(['http://127.0.0.1:5173','http://localhost:5173']);
const tasks={
 status:{label:'FORGE status',command:process.execPath,args:['-e',`const fs=require('fs');const p=require('./package.json');console.log('FORGE:',process.cwd());console.log('Node:',process.version);console.log('Scripts:',Object.keys(p.scripts||{}).join(', '));console.log('Backend:',fs.existsSync('server.js')?'present':'missing')`],timeout:8000},
 tests:{label:'Run project tests',command:'npm',args:['test'],timeout:60000},
 build:{label:'Vite production build',command:'npm',args:['run','build'],timeout:90000},
 git:{label:'Git status',command:'git',args:['status','--short'],timeout:10000},
 logs:{label:'Backend log (last 60 lines)',internal:'logs'}
};
// No arbitrary shell execution, no user-supplied command or args.
let active=false;
function send(res,status,obj,origin){const data=JSON.stringify(obj);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(data),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})});res.end(data)}
const server=http.createServer((req,res)=>{
 if(!authorize(req,res))return;
 const origin=req.headers.origin;
 if(origin&&!allowedOrigins.has(origin))return send(res,403,{error:'Origin not allowed'});
 if(req.headers.host&&!['127.0.0.1:3002','localhost:3002'].includes(req.headers.host))return send(res,403,{error:'Host not allowed'},origin);
 if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Origin':origin||'http://127.0.0.1:5173','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type','Vary':'Origin'});return res.end()}
 if(req.method==='GET'&&req.url==='/api/terminal/status')return send(res,200,{ready:true,version:'7.2',mode:'restricted-command-console',busy:active,actions:Object.entries(tasks).map(([id,t])=>({id,label:t.label}))},origin);
 if(req.method!=='POST'||req.url!=='/api/terminal/run')return send(res,404,{error:'Not found'},origin);
 if(active)return send(res,409,{error:'Another command is running'},origin);
 let body='';req.on('data',chunk=>{body+=chunk;if(body.length>2048)req.destroy()});req.on('end',()=>{
  let input;try{input=JSON.parse(body)}catch{return send(res,400,{error:'Invalid JSON'},origin)}
  const task=Object.hasOwn(tasks,input.action)?tasks[input.action]:null;
  if(!task)return send(res,400,{error:'Unknown action'},origin);
  if(task.internal==='logs'){
   const f=path.join(root,'logs/backend-restart.log');let lines='Log file not found';try{lines=fs.readFileSync(f,'utf8').split('\n').slice(-60).join('\n')}catch{}
   lines=lines.replace(/gsk_[\w-]+/g,'[REDACTED]').slice(-12000);return send(res,200,{ok:true,action:input.action,output:lines},origin)
  }
  active=true;
  // Never invoke a shell; stdin closed and output capped.
  const child=cp.spawn(task.command,task.args,{cwd:root,shell:false,stdio:['ignore','pipe','pipe'],env:{...process.env,CI:'1',FORCE_COLOR:'0'}});
  let output='',truncated=false,done=false;
  const append=b=>{const s=b.toString('utf8');if(output.length<24000)output+=s.slice(0,24000-output.length);else truncated=true};
  child.stdout.on('data',append);child.stderr.on('data',append);
  const timer=setTimeout(()=>child.kill('SIGKILL'),task.timeout);
  const finish=(code,signal,error)=>{if(done)return;done=true;clearTimeout(timer);active=false;send(res,200,{ok:code===0,action:input.action,exitCode:code,signal,error,output:output.replace(/gsk_[\w-]+/g,'[REDACTED]'),truncated},origin)};
  child.on('error',e=>finish(null,null,e.code||'Spawn error'));
  child.on('close',(code,signal)=>finish(code,signal));
 });
});
server.listen(PORT,HOST,()=>console.log(`OWNZ Terminal Forge v7.2 listening on ${HOST}:${PORT}`));
