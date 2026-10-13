const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const router = express.Router();
const history = path.resolve(__dirname, '.ownz-history');
const root = path.resolve(__dirname, 'projects');

function validId(id) {
  return typeof id === 'string' &&
    /^\d{13}-[0-9a-f-]{36}$/i.test(id);
}

async function validFile(file) {
  if (typeof file !== 'string' ||
      !file.startsWith('ECHOBOUND/')) throw Error('Invalid path');
  const target = path.resolve(root, file);
  if (!target.startsWith(root + path.sep)) throw Error('Outside project');
  const real = await fs.realpath(target);
  const base = await fs.realpath(root);
  if (!real.startsWith(base + path.sep)) throw Error('Outside project');
  if (!(await fs.stat(real)).isFile()) throw Error('Not a file');
}

module.exports = {router, history, validId, validFile};

// PHASE 11 — LIST SAVED VERSIONS
router.get('/history', async (req, res) => {
  try {
    const file = req.query.path;
    await validFile(file);

    let names;
    try {
      names = await fs.readdir(history);
    } catch (error) {
      if (error.code === 'ENOENT') return res.json([]);
      throw error;
    }

    const versions = [];

    for (const name of names) {
      if (!name.endsWith('.json')) continue;

      const id = name.slice(0, -5);
      if (!validId(id)) continue;

      try {
        const meta = JSON.parse(
          await fs.readFile(path.join(history, name), 'utf8')
        );

        if (meta.id !== id || meta.projectPath !== file) continue;

        const stat = await fs.lstat(
          path.join(history, id + '.bak')
        );

        if (!stat.isFile() || stat.isSymbolicLink()) continue;

        versions.push({
          id,
          createdAt: meta.createdAt,
          size: stat.size
        });
      } catch (_) {
        // Ignore incomplete backup entries.
      }
    }

    versions.sort((a, b) =>
      String(b.createdAt).localeCompare(String(a.createdAt))
    );

    res.json(versions);
  } catch (error) {
    res.status(400).json({error: error.message});
  }
});

// PHASE 11 — PREVIEW SAVED VERSION
router.get('/history/version', async (req, res) => {
  try {
    const file = req.query.path;
    const id = req.query.id;

    await validFile(file);

    if (!validId(id)) {
      return res.status(400).json({error:'Invalid version ID'});
    }

    const meta = JSON.parse(
      await fs.readFile(path.join(history, id + '.json'), 'utf8')
    );

    if (meta.id !== id || meta.projectPath !== file) {
      return res.status(400).json({error:'Version mismatch'});
    }

    const backup = path.join(history, id + '.bak');
    const stat = await fs.lstat(backup);

    if (!stat.isFile() || stat.isSymbolicLink() ||
        stat.size > 1024 * 1024) {
      return res.status(400).json({error:'Invalid backup'});
    }

    res.json({
      id,
      path:file,
      createdAt:meta.createdAt,
      content:await fs.readFile(backup,'utf8')
    });
  } catch (error) {
    res.status(400).json({error:error.message});
  }
});
