'use strict';

// OWNZ FORGE AI — PROJECT INTELLIGENCE SCANNER V1
// Read-only metadata scanning. No AI requests.

const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, 'projects');
const MAX_FILES = 200;
const MAX_DEPTH = 8;

const BLOCKED_DIRS = new Set([
  '.git', '.godot', 'node_modules', '.venv',
  'venv', 'dist', 'build', 'backups',
  '.ownz-history', '.ownz-trash'
]);

const BLOCKED_NAMES = new Set([
  '.env', '.env.local', '.env.production',
  '.env.development', 'credentials.json',
  'secrets.json', 'service-account.json',
  'id_rsa', 'id_ed25519'
]);

const ALLOWED_EXTENSIONS = new Set([
  '.gd', '.tscn', '.tres', '.godot',
  '.gdshader', '.json', '.md', '.txt'
]);

function allowedName(name) {
  const lower = name.toLowerCase();

  if (BLOCKED_NAMES.has(lower)) return false;
  if (lower.includes('.ownz-backup')) return false;
  if (lower.endsWith('.bak')) return false;
  if (lower.endsWith('.tmp')) return false;
  if (lower.endsWith('~')) return false;
  if (lower.startsWith('.env.')) return false;
  if (lower.includes('secret')) return false;
  if (lower.includes('credential')) return false;
  if (lower.endsWith('.key')) return false;
  if (lower.endsWith('.pem')) return false;

  return true;
}

async function scanProject(projectName) {
  if (
    typeof projectName !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(projectName)
  ) {
    throw new Error('Invalid project name');
  }

  const realRoot = await fs.realpath(ROOT);
  const projectPath = path.join(realRoot, projectName);
  const realProject = await fs.realpath(projectPath);

  if (
    realProject !== projectPath ||
    !realProject.startsWith(realRoot + path.sep)
  ) {
    throw new Error('Unsafe project path');
  }

  const files = [];
  let truncated = false;

  async function walk(directory, depth) {
    if (depth > MAX_DEPTH || truncated) {
      truncated = true;
      return;
    }

    const entries = await fs.readdir(directory, {
      withFileTypes: true
    });

    entries.sort((a, b) => a.name.localeCompare(b.name));

    for (const entry of entries) {
      if (files.length >= MAX_FILES) {
        truncated = true;
        break;
      }

      if (entry.isSymbolicLink()) continue;
      if (!allowedName(entry.name)) continue;

      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (BLOCKED_DIRS.has(entry.name.toLowerCase())) {
          continue;
        }

        await walk(fullPath, depth + 1);
      } else if (
        entry.isFile() &&
        ALLOWED_EXTENSIONS.has(
          path.extname(entry.name).toLowerCase()
        )
      ) {
        const stat = await fs.lstat(fullPath);

        if (stat.size > 256 * 1024) continue;

        files.push({
          path: path.relative(realProject, fullPath),
          size: stat.size
        });
      }
    }
  }

  await walk(realProject, 0);

  return {
    project: projectName,
    fileCount: files.length,
    truncated,
    files
  };
}

module.exports = { scanProject };
