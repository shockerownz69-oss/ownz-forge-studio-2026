'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {inspectForge} = require('./source-intelligence.cjs');

const ROOT = path.resolve(__dirname, '..');
const MAX_TOTAL_CHARS = 24000;
const MAX_PER_FILE = 7000;

function buildContext(request) {
  if (typeof request !== 'string' || !request.trim()) {
    throw Error('Mission request required');
  }

  const report = inspectForge();
  if (report.errors.length) throw Error('Source inspection incomplete');

  const words = [...new Set(
    request.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) || []
  )].filter(w => ![
    'with','from','that','this','into','only','existing',
    'forge','ownz','source','files','code','improve'
  ].includes(w));

  const files = [];
  let remaining = MAX_TOTAL_CHARS;

  for (const info of report.files) {
    if (remaining <= 0) break;

    const absolute = path.join(ROOT, info.file);
    const lines = fs.readFileSync(absolute, 'utf8').split(/\r?\n/);
    const matches = [];

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase();
      if (words.some(w => lower.includes(w))) matches.push(i);
    }

    const selected = new Set();

    for (const index of matches.slice(0, 15)) {
      for (let j = Math.max(0,index-3); j <= Math.min(lines.length-1,index+5); j++) {
        selected.add(j);
      }
    }

    let excerpt = '';
    for (const index of [...selected].sort((a,b)=>a-b)) {
      const line = `${index+1}: ${lines[index]}\n`;
      if (excerpt.length + line.length > MAX_PER_FILE ||
          excerpt.length + line.length > remaining) break;
      excerpt += line;
    }

    if (excerpt) {
      files.push({
        file: info.file,
        sha256: info.sha256,
        excerpt
      });
      remaining -= excerpt.length;
    }
  }

  return {
    mode: 'READ_ONLY_SOURCE_CONTEXT',
    project: report.project,
    files,
    characters: MAX_TOTAL_CHARS - remaining
  };
}

if (require.main === module) {
  const request = process.argv.slice(2).join(' ') ||
    'Improve editor save reliability and mobile usability';

  const result = buildContext(request);

  console.log('[OWNZ] Source Context v1.0');
  console.log('[OWNZ] Files with excerpts:', result.files.length);
  console.log('[OWNZ] Context characters:', result.characters);
  console.log('[OWNZ] Live source modified: NO');
}

module.exports = {buildContext};
