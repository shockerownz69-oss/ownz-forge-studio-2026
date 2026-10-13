const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const src=fs.readFileSync(path.join(root,'editor/ownz-tile-navigation-fix.js'),'utf8');
const html=fs.readFileSync(path.join(root,'editor/index.html'),'utf8');
test('four launcher routes are explicitly defined',()=>assert.match(src,/\['Files','Code','AI','Check'\]/));
test('launcher uses stable route indices instead of decorated text',()=>assert.match(src,/tile\.dataset\.ownzRoute=route/));
test('legacy click handler is suppressed to avoid double routing',()=>assert.match(src,/stopImmediatePropagation\(\)/));
test('workspace state is explicitly reconciled',()=>assert.match(src,/classList\.add\('ownz-v5-'\+route\.toLowerCase\(\)\)/));
test('new navigation module is loaded',()=>assert.match(html,/ownz-tile-navigation-fix\.js/));
