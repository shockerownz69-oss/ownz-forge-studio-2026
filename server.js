require('dotenv').config();
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd();
const server = http.createServer((req, res) => {
  // Forward only same-origin API paths to the local project service.
  // Vite's development proxy already performs this for port 5173.
  if (req.url === '/api' || req.url.startsWith('/api/') || req.url.startsWith('/api?')) {
    const upstream = http.request({hostname:'127.0.0.1',port:3001,method:req.method,path:req.url,
      headers:{...req.headers,host:req.headers.host}}, upstreamResponse => {
      res.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.pipe(res);
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, {'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:'Project API unavailable'}));
    });
    req.pipe(upstream);
    return;
  }
  if (req.url !== '/') {
    res.writeHead(404);
    return res.end('Not found');
  }
  res.writeHead(200, {'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>OwnZ Forge AI</title><style>body{background:#101010;color:#fff;font-family:Arial,sans-serif;margin:0;padding:24px}h1{color:#ff3434}header{border-bottom:2px solid #b21d1d;padding-bottom:14px}.card{background:#202020;border:1px solid #4b2929;border-radius:12px;padding:20px;margin:16px 0}.status{color:#54df86}small{color:#aaa}</style></head><body><header><h1>OWNZ FORGE AI</h1><small>SHOCKER OWNZ DEVELOPMENT STUDIO</small></header><div class="card"><h2 class="status">● LOCAL SERVER ONLINE</h2><p>Your development environment is running on Android.</p></div><div class="card"><h2>PROJECTS</h2><p>ECHOBOUND — Coming next</p></div><div class="card"><h2>CODE VAULT</h2><p>Reusable scripts and components</p></div><div class="card"><h2>VISUAL DESIGNER</h2><p>VB6-inspired interface builder — Planned</p></div><div class="card"><h2>AI ASSISTANT</h2><p>Local model integration — Planned</p></div><small>SHOCKER OWNZ FINDS A WAY.</small></body></html>`);
});
const projectApp = require("express")();
// OWNZ_AUTOSYNC_API_V21
projectApp.use("/api/owner", require("./owner-api.cjs"));
// V4: protect every other API mount, not only FatalAcidBurn.
const {ownerGuard, rejectCrossOrigin} = require("./owner-auth.cjs");
projectApp.use("/api", ownerGuard, rejectCrossOrigin);
projectApp.use("/api/autosync", require("./autosync-api.cjs"));
projectApp.use("/api", require("./project-api"));

projectApp.use("/api", require("./ai-api"));
projectApp.use("/api", require("./intelligence-api"));
projectApp.use("/api", require("./history-api").router);
// OWNZ_INSTALLER_API_V2
projectApp.use("/api", require("./installer-forge/forge-api.cjs"));
// OWNZ_AUTOPILOT_GUARDED_V1
projectApp.use("/api/autopilot", require("./autopilot-forge/autopilot-api.cjs"));
// OWNZ_AUTOPILOT_PREFLIGHT_V11
projectApp.use('/api/autopilot-preflight', require('./autopilot-forge/preflight-api-v11.cjs'));
// OWNZ_TEST_LAB_V12
projectApp.use("/api/test-lab", require("./autopilot-forge/test-lab-api.cjs"));
projectApp.use("/api/execution-lab", require("./autopilot-forge/execution-lab-api.cjs"));
// OWNZ_PHASE57_HEALTH
projectApp.use('/api', require('./phase57-health-router.cjs').makeHealthRouter({express:require('express'),root:__dirname,baseline:require('path').join(require('os').homedir(),'ownz-phase54/baseline.json'),auditor:require('path').join(require('os').homedir(),'ownz-phase54/phase54.cjs')}));
projectApp.use("/api", require("./project-brain-api.cjs"));
const projectServer = projectApp.listen(3001, "127.0.0.1", () => console.log("PROJECT API ONLINE: http://127.0.0.1:3001"));
server.listen(3000, '127.0.0.1', () => console.log('OWNZ FORGE ONLINE: http://127.0.0.1:3000'));
