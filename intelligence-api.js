'use strict';

// OWNZ FORGE — PROJECT INTELLIGENCE API V1
// Read-only project metadata and dependency analysis.

const express = require('express');
const { scanProject } = require('./project-scanner');
const { analyzeDependencies } = require('./godot-dependencies');

const router = express.Router();

function validProject(name) {
  return typeof name === 'string' &&
    /^[a-zA-Z0-9_-]{1,64}$/.test(name);
}

router.get('/intelligence/scan', async (req, res) => {
  if (!validProject(req.query.project)) {
    return res.status(400).json({
      error: 'Invalid project name'
    });
  }

  try {
    const result = await scanProject(req.query.project);
    res.json(result);
  } catch {
    res.status(400).json({
      error: 'Project scan unavailable'
    });
  }
});

router.get('/intelligence/dependencies', async (req, res) => {
  if (!validProject(req.query.project)) {
    return res.status(400).json({
      error: 'Invalid project name'
    });
  }

  try {
    const result = await analyzeDependencies(req.query.project);
    res.json(result);
  } catch {
    res.status(400).json({
      error: 'Dependency analysis unavailable'
    });
  }
});


const fsPromises = require('node:fs/promises');
const path = require('node:path');
const { analyzeScript } = require('./godot-diagnostics');

router.get('/intelligence/diagnostics', async (req, res) => {
  if (!validProject(req.query.project)) {
    return res.status(400).json({ error: 'Invalid project name' });
  }

  const root = path.resolve(__dirname, 'projects');
  const projectDir = path.resolve(root, req.query.project);

  try {
    const rootReal = await fsPromises.realpath(root);
    const projectStat = await fsPromises.lstat(projectDir);

    if (!projectStat.isDirectory() || projectStat.isSymbolicLink()) {
      throw new Error('Invalid project directory');
    }

    const projectReal = await fsPromises.realpath(projectDir);

    if (path.dirname(projectReal) !== rootReal) {
      throw new Error('Project escapes root');
    }

    const files = [];
    const warnings = [];
    const queue = [{ dir: projectReal, depth: 0 }];
    let inspected = 0;

    while (queue.length && inspected < 200) {
      const current = queue.shift();
      const entries = await fsPromises.readdir(current.dir, {
        withFileTypes: true
      });

      for (const entry of entries) {
        if (inspected >= 200) break;

        if (entry.isSymbolicLink()) continue;

        const absolute = path.join(current.dir, entry.name);
        const relative = path.relative(projectReal, absolute);

        if (entry.isDirectory()) {
          if (
            current.depth < 8 &&
            !['.git', '.godot', 'node_modules'].includes(entry.name)
          ) {
            queue.push({ dir: absolute, depth: current.depth + 1 });
          }
          continue;
        }

        if (!entry.isFile() || !entry.name.endsWith('.gd')) continue;

        const stat = await fsPromises.lstat(absolute);

        if (!stat.isFile() || stat.size > 262144) continue;

        const real = await fsPromises.realpath(absolute);

        if (!real.startsWith(projectReal + path.sep)) continue;

        const content = await fsPromises.readFile(real, 'utf8');
        if (Buffer.byteLength(content, 'utf8') > 262144) continue;

        inspected++;

        const result = analyzeScript(content);

        files.push({
          path: relative,
          lineCount: result.lineCount,
          warningCount: result.warningCount
        });

        for (const warning of result.warnings) {
          warnings.push({
            file: relative,
            ...warning
          });
        }
      }
    }

    res.json({
      project: req.query.project,
      engine: 'offline-heuristic-v1',
      filesAnalyzed: files.length,
      warningCount: warnings.length,
      files,
      warnings
    });
  } catch {
    res.status(400).json({
      error: 'Diagnostics unavailable'
    });
  }
});


/* OWNZ FORGE — UNSAVED CODE DIAGNOSTICS V1
   Local heuristic analysis. No disk writes or AI calls. */
router.post('/intelligence/check-code',
  express.json({ limit: '300kb' }),
  (req, res) => {
    const code = req.body?.code;

    if (typeof code !== 'string') {
      return res.status(400).json({
        error: 'Code must be a string'
      });
    }

    if (Buffer.byteLength(code, 'utf8') > 262144) {
      return res.status(413).json({
        error: 'Code exceeds 256 KiB limit'
      });
    }

    try {
      const result = analyzeScript(code);

      return res.json({
        engine: 'offline-heuristic-v1',
        ...result
      });
    } catch {
      return res.status(400).json({
        error: 'Code analysis unavailable'
      });
    }
  }
);

module.exports = router;
