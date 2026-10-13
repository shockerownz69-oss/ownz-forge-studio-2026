'use strict';

// OWNZ FORGE — GODOT DEPENDENCY ENGINE V1
// Offline, read-only dependency analysis.

const fs = require('node:fs/promises');
const path = require('node:path');
const { scanProject } = require('./project-scanner');

const MAX_READ_BYTES = 256 * 1024;
const REFERENCE_PATTERN = /\b(?:res:\/\/[^\s"'<>()[\],;]+|(?:preload|load)\s*\(\s*["']([^"']+)["']\s*\))/g;

async function analyzeDependencies(projectName) {
  const scan = await scanProject(projectName);
  const projectRoot = path.resolve(__dirname, 'projects', projectName);
  const knownFiles = new Set(
    scan.files.map(file => file.path.replace(/\\/g, '/'))
  );

  async function resourceExists(relativePath) {
    const absolute = path.resolve(projectRoot, relativePath);
    const relative = path.relative(projectRoot, absolute);

    if (
      relative === '..' ||
      relative.startsWith('..' + path.sep) ||
      path.isAbsolute(relative)
    ) {
      return false;
    }

    try {
      const stat = await fs.lstat(absolute);
      if (!stat.isFile() || stat.isSymbolicLink()) return false;

      const realProject = await fs.realpath(projectRoot);
      const realFile = await fs.realpath(absolute);

      return realFile.startsWith(realProject + path.sep);
    } catch {
      return false;
    }
  }

  const dependencies = [];
  const missing = [];

  for (const file of scan.files) {
    if (!/\.(gd|tscn|tres|gdshader|godot)$/i.test(file.path)) {
      continue;
    }

    const absolute = path.resolve(projectRoot, file.path);
    const relative = path.relative(projectRoot, absolute);

    if (
      relative.startsWith('..') ||
      path.isAbsolute(relative)
    ) {
      throw new Error('Unsafe dependency path');
    }

    const stat = await fs.lstat(absolute);

    if (!stat.isFile() || stat.isSymbolicLink() ||
        stat.size > MAX_READ_BYTES) {
      continue;
    }

    const realProject = await fs.realpath(projectRoot);
    const realSource = await fs.realpath(absolute);

    if (!realSource.startsWith(realProject + path.sep)) {
      throw new Error('Source escaped project boundary');
    }

    const content = await fs.readFile(absolute, 'utf8');
    const references = new Set();

    for (const match of content.matchAll(REFERENCE_PATTERN)) {
      const raw = match[1] || match[0];

      if (!raw.startsWith('res://')) continue;

      const target = path.posix.normalize(raw.slice(6));

      if (
        target === '..' ||
        target.startsWith('../') ||
        target.startsWith('/') ||
        target.includes('\0')
      ) {
        continue;
      }

      references.add(target);
    }

    for (const target of references) {
      const edge = {
        from: file.path.replace(/\\/g, '/'),
        to: target
      };

      if (knownFiles.has(target) || await resourceExists(target)) {
        dependencies.push(edge);
      } else {
        missing.push(edge);
      }
    }
  }

  return {
    project: projectName,
    scannedFiles: scan.fileCount,
    truncated: scan.truncated,
    dependencies,
    missing
  };
}

module.exports = { analyzeDependencies };
