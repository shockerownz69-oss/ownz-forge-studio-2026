'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../editor/index.html'),'utf8');
test('mobile stability styles are installed once',()=>{assert.equal((html.match(/id="ownz-mobile-stability-v1"/g)||[]).length,1)});
test('mobile toolbar and AI response remain present',()=>{assert.match(html,/id="forge-mobile-toolbar"/);assert.match(html,/id="ownz-ai-answer"/)});
test('mobile safeguards include narrow screens and touch targets',()=>{const css=html.split('id="ownz-mobile-stability-v1"')[1].split('</style>')[0];assert.match(css,/max-width:\s*749px/);assert.match(css,/min-height:\s*48px/);assert.match(css,/overflow-wrap:\s*anywhere/)});
