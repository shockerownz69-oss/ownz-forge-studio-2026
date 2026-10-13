'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

const APPROVED_FILES = Object.freeze([
  'ai-api.js',
  'ai-router.js',
  'ai-providers.js',
  'fatalacidburn-memory.js',
  'fatalacidburn-specialists.js',
  'mission-control/mission.cjs',
  'mission-control/mission-ai.cjs',
  'editor/src/main.js',
  'editor/index.html',
  'project-api.js'
]);

const MAX_BYTES = 150000;

function inspectFile(relativePath) {
  if (!APPROVED_FILES.includes(relativePath)) {
    throw Error('File is not approved for source inspection');
  }

  const absolute = path.resolve(ROOT, relativePath);
  const relative = path.relative(ROOT, absolute);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw Error('Source path escapes FORGE');
  }

  const stat = fs.lstatSync(absolute);

  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw Error('Source must be a regular file');
  }

  if (stat.size > MAX_BYTES) {
    throw Error('Source exceeds inspection size limit');
  }

  const source = fs.readFileSync(absolute, 'utf8');
  const lines = source.split(/\r?\n/);

  const symbols = [];

  const pattern =
    /^\s*(?:(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)|(?:router|app)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+))/;

  lines.forEach((line, index) => {
    const match = line.match(pattern);

    if (!match) return;

    symbols.push({
      line: index + 1,
      name: match[1] || match[2] || match[4],
      kind: match[3] ? 'route' : 'function'
    });
  });

  return {
    file: relativePath,
    lines: lines.length,
    bytes: stat.size,
    sha256: crypto.createHash('sha256').update(source).digest('hex'),
    symbols: symbols.slice(0, 150)
  };
}

function inspectForge() {
  const files = [];
  const errors = [];

  for (const file of APPROVED_FILES) {
    try {
      files.push(inspectFile(file));
    } catch (error) {
      errors.push({
        file,
        error: error.message
      });
    }
  }

  return {
    engine: 'FatalAcidBurn Source Intelligence',
    version: '1.0',
    project: 'OWNZ FORGE Studio 2026',
    mode: 'READ_ONLY',
    generatedAt: new Date().toISOString(),
    files,
    errors
  };
}

if (require.main === module) {
  const result = inspectForge();

  if (process.argv.includes('--self-test')) {
    if (!result.files.length) {
      throw Error('No FORGE source files inspected');
    }

    if (result.files.some(f => !APPROVED_FILES.includes(f.file))) {
      throw Error('Unapproved file inspected');
    }

    console.log('[OWNZ] Source Intelligence self-test PASS');
    console.log('[OWNZ] Files inspected:', result.files.length);
    console.log('[OWNZ] Functions/routes discovered:',
      result.files.reduce((n, f) => n + f.symbols.length, 0));
    console.log('[OWNZ] Inspection errors:', result.errors.length);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
}

module.exports = {
  inspectFile,
  inspectForge
};
