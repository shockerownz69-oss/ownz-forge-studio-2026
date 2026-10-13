"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
require("dotenv").config({quiet:true});
const express=require("express");
const router=require("../ai-api");
const app=express();
app.use("/api",router);
let server;
test.before(async()=>{server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r))});
test.after(()=>server?.close());
function url(p){return "http://127.0.0.1:"+server.address().port+"/api"+p}
test("AI status identifies Groq",async()=>{
 const r=await fetch(url("/ai/status"));
 const d=await r.json();
 assert.equal(r.status,200);
 assert.equal(d.provider,"Groq");
 assert.equal(d.model,"openai/gpt-oss-120b");
});
test("Empty chat request is rejected",async()=>{
 const r=await fetch(url("/ai/chat"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:""})});
 assert.equal(r.status,400);
});
test("Invalid conversation ID is rejected",async()=>{
 const r=await fetch(url("/ai/chat"),{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:"hello",conversationId:"invalid"})});
 assert.equal(r.status,400);
});
