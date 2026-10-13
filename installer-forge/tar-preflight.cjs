'use strict';
const fs=require('node:fs'),zlib=require('node:zlib');
const MAX_COMPRESSED=20*1024*1024,MAX_UNPACKED=40*1024*1024;
function validateArchive(filename){
 const stat=fs.statSync(filename);if(stat.size>MAX_COMPRESSED)throw Error('Archive exceeds compressed size limit');
 const data=zlib.gunzipSync(fs.readFileSync(filename),{maxOutputLength:MAX_UNPACKED});
 let offset=0,entries=0;const names=new Set();
 while(offset+512<=data.length){const h=data.subarray(offset,offset+512);if(h.every(b=>b===0))break;
  const field=(start,len)=>h.subarray(start,start+len).toString('utf8').split('\0')[0];
  const oct=(start,len)=>{const x=field(start,len).trim();if(!/^[0-7]+$/.test(x))throw Error('Invalid tar numeric field');return parseInt(x,8)};
  const stored=oct(148,8);let sum=0;for(let i=0;i<512;i++)sum+=(i>=148&&i<156)?32:h[i];if(stored!==sum)throw Error('Invalid tar header checksum');
  const name=field(345,155);const full=(name?name+'/':'')+field(0,100);const type=String.fromCharCode(h[156]);
  if(!['0','5','\0'].includes(type))throw Error('Archive contains link, metadata, or special entry');
  const clean=full.replace(/\/$/,'');if(!clean||clean.startsWith('/')||clean.includes('\\')||clean.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('Unsafe tar entry path');
  if(!['manifest.json','installer-forge.cjs','tar-preflight.cjs','payload'].includes(clean)&&!clean.startsWith('payload/'))throw Error('Unexpected tar entry');
  if(names.has(clean))throw Error('Duplicate tar entry');names.add(clean);
  const size=oct(124,12);if(type==='5'&&size!==0)throw Error('Directory with payload bytes');
  offset+=512+Math.ceil(size/512)*512;if(offset>data.length)throw Error('Truncated tar entry');
  if(++entries>2000)throw Error('Too many archive entries');
 }
 if(!names.has('manifest.json'))throw Error('Archive manifest missing');
 return {entries};
}
module.exports={validateArchive};
