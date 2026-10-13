const fs = require('fs');
const file = 'editor/index.html';
let html = fs.readFileSync(file, 'utf8');

if (html.includes('id="ownz-phase8-mobile"')) {
  console.log('PHASE 8A ALREADY INSTALLED');
  process.exit(0);
}

const css = `
<style id="ownz-phase8-mobile">
#editor, #forge-tabs {
  min-width: 0;
  max-width: 100%;
}
#forge-tabs {
  -webkit-overflow-scrolling: touch;
}
#editor .cm-editor,
#editor .cm-panels {
  max-width: 100%;
}
#editor .cm-scroller {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}
#editor .cm-panel.cm-search {
  box-sizing: border-box;
  max-width: 100%;
  padding: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  align-items: center;
}
#editor .cm-panel.cm-search input {
  box-sizing: border-box;
  max-width: 100%;
  min-height: 38px;
  font-size: 16px;
}
#editor .cm-panel.cm-search button {
  min-height: 38px;
  padding: 7px 11px;
  border-radius: 6px;
}
#editor .cm-panel.cm-search label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 36px;
}
#editor .cm-panel.cm-search input[type="checkbox"] {
  width: 19px;
  height: 19px;
}
@media (max-width:600px) {
  #recovery-manager, #forge-find, #save-file {
    min-height: 46px;
    touch-action: manipulation;
  }
  #editor .cm-panel.cm-search input[name="search"],
  #editor .cm-panel.cm-search input[name="replace"] {
    flex: 1 1 100%;
    width: 100%;
  }
}
</style>
`;

if (!html.includes('</head>')) {
  console.error('Missing head closing tag. No changes made.');
  process.exit(1);
}

fs.copyFileSync(file, 'backups/index-before-phase8a-fix.html');
html = html.replace('</head>', css + '\n</head>');
fs.writeFileSync(file, html);

console.log('PHASE 8A MOBILE STYLING INSTALLED');
