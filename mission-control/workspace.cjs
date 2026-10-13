'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, '.ownz-recovery', 'workspaces');

const FILES = [
  'editor/src/main.js',
  'editor/index.html'
];

function sha256(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

function createWorkspace() {
  const id = 'forge-' + Date.now() + '-' +
    crypto.randomBytes(4).toString('hex');

  fs.mkdirSync(BASE, {recursive:true, mode:0o700});

  const directory = path.join(BASE, id);
  fs.mkdirSync(directory, {mode:0o700});

  const manifest = {
    id,
    version:'1.0',
    project:'OWNZ FORGE Studio 2026',
    state:'ISOLATED_COPY_READY',
    createdAt:new Date().toISOString(),
    liveProjectModified:false,
    files:[]
  };

  for (const relative of FILES) {
    const source = path.join(ROOT, relative);
    const target = path.join(directory, relative);

    const stat = fs.lstatSync(source);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw Error('Unsafe source file: ' + relative);
    }

    const data = fs.readFileSync(source);
    const hash = sha256(data);

    fs.mkdirSync(path.dirname(target), {
      recursive:true,
      mode:0o700
    });

    fs.writeFileSync(target, data, {
      flag:'wx',
      mode:0o600
    });

    if (sha256(fs.readFileSync(target)) !== hash) {
      throw Error('Workspace copy verification failed');
    }

    manifest.files.push({
      path:relative,
      sha256:hash,
      bytes:data.length
    });
  }

  fs.writeFileSync(
    path.join(directory,'workspace-manifest.json'),
    JSON.stringify(manifest,null,2),
    {flag:'wx',mode:0o600}
  );

  return {directory,manifest};
}

if (require.main === module) {
  const {directory,manifest} = createWorkspace();

  console.log('[OWNZ] Engineering workspace created');
  console.log('[OWNZ] Workspace:',directory);
  console.log('[OWNZ] Files copied:',manifest.files.length);
  console.log('[OWNZ] Source hashes verified: YES');
  console.log('[OWNZ] Live editor modified: NO');
}

module.exports = {createWorkspace};
