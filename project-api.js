const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

// PHASE 13 — CONTENT VERSION FINGERPRINT
function ownzFingerprint(content) {
  return crypto.createHash('sha256').update(content, 'utf8').digest('hex');
}


const router = express.Router();
const root = path.resolve(__dirname, 'projects');

// PHASE 13 — SERIALIZE SAVES PER FILE
const ownzSaveQueues = new Map();

async function ownzQueueSave(file, operation) {
  const previous = ownzSaveQueues.get(file) || Promise.resolve();
  const current = previous.catch(() => {}).then(operation);
  const settled = current.then(() => {}, () => {});
  ownzSaveQueues.set(file, settled);
  try {
    return await current;
  } finally {
    if (ownzSaveQueues.get(file) === settled) {
      ownzSaveQueues.delete(file);
    }
  }
}



async function safePath(relative = '') {
  if (typeof relative !== 'string') throw new Error('Invalid path');
  const target = path.resolve(root, relative);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error('Outside workspace');
  }
  const realRoot = await fs.realpath(root);
  const realTarget = await fs.realpath(target);
  if (realTarget !== realRoot && !realTarget.startsWith(realRoot + path.sep)) {
    throw new Error('Outside workspace');
  }
  return realTarget;
}

router.get('/files', async (req, res) => {
  try {
    const dir = await safePath(req.query.path || '');
    const entries = await fs.readdir(dir, { withFileTypes: true });
    res.json(entries.filter(e => !e.isSymbolicLink() && !e.name.includes('.ownz-backup')).map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'folder' : 'file'
    })));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/file', async (req, res) => {
  try {
    const file = await safePath(req.query.path);
    const stat = await fs.stat(file);
    if (!stat.isFile() || stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'Unsupported file' });
    }
    const content = await fs.readFile(file, 'utf8');
    res.json({ content, version: ownzFingerprint(content) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});


router.put('/file', express.json({ limit: '1mb' }), async (req, res) => {
  try {
    const relative = req.query.path;
    if (typeof relative !== 'string' ||
        !relative.startsWith('ECHOBOUND/')) {
      return res.status(400).json({ error: 'Invalid project path' });
    }

    const file = await safePath(relative);
    const stat = await fs.stat(file);

    if (!stat.isFile() || stat.size > 1024 * 1024) {
      return res.status(400).json({ error: 'Unsupported file' });
    }

    if (typeof req.body?.content !== 'string' ||
        Buffer.byteLength(req.body.content, 'utf8') > 1024 * 1024) {
      return res.status(400).json({ error: 'Invalid content' });
    }

    await ownzQueueSave(file, async () => {
      // PHASE 13 — VERIFY EXPECTED FILE VERSION
      const currentContent = await fs.readFile(file, 'utf8');
      const currentVersion = ownzFingerprint(currentContent);
      if (req.body.expectedVersion !== currentVersion) {
        const conflict = new Error('File changed since it was opened. Reload or recover your edits before saving.');
        conflict.code = 'OWNZ_VERSION_CONFLICT';
        throw conflict;
      }

      
      // PHASE 27 — PROTECT AGAINST ACCIDENTAL EMPTY SAVES
      if (currentContent.length > 0 && req.body.content.length === 0 && req.body.confirmEmptySave !== true) {
        const error = new Error("Empty-file overwrite blocked. Explicit confirmation required.");
        error.code = "OWNZ_EMPTY_SAVE_BLOCKED";
        throw error;
      }

      // PHASE 11 — VERSIONED SAVE BACKUPS
    const backupDir = path.resolve(__dirname, '.ownz-history');
    await fs.mkdir(backupDir, { recursive: true, mode: 0o700 });

    const crypto = require('node:crypto');
    const backupId =
      Date.now() + '-' + crypto.randomUUID();

    const backupFile = path.join(backupDir, backupId + '.bak');
    const metadataFile = path.join(backupDir, backupId + '.json');

    await fs.copyFile(file, backupFile, fs.constants.COPYFILE_EXCL);

    await fs.writeFile(metadataFile, JSON.stringify({
      id: backupId,
      projectPath: relative,
      createdAt: new Date().toISOString(),
      size: stat.size
    }), { flag: 'wx', mode: 0o600 });

    const backup = file + '.ownz-backup';
    await fs.copyFile(file, backup);
    const temporary = file + '.ownz-tmp-' + crypto.randomUUID();
    try {
      await fs.writeFile(temporary, req.body.content, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600
      });
      await fs.rename(temporary, file);
    } finally {
      await fs.rm(temporary, { force: true });
    }

    });

      res.json({ success: true, path: relative, version: ownzFingerprint(req.body.content) });
  } catch (error) {
    res.status(error.code === 'OWNZ_VERSION_CONFLICT' ? 409 : 400).json({ error: error.message, code: error.code || 'SAVE_ERROR' });
  }
});


async function safeNewPath(relative) {
  if (typeof relative !== 'string' ||
      !relative.startsWith('ECHOBOUND/') ||
      relative.includes('\\') ||
      relative.includes('\0')) {
    throw new Error('Invalid project path');
  }

  const parts = relative.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) {
    throw new Error('Invalid path component');
  }

  const parent = await safePath(parts.slice(0, -1).join('/'));
  const stat = await fs.stat(parent);

  if (!stat.isDirectory()) {
    throw new Error('Parent is not a directory');
  }


  const newName = parts[parts.length - 1];

  if (
    !newName ||
    newName === '.' ||
    newName === '..' ||
    /[.\s]$/.test(newName) ||
    /[\x00-\x1f\x7f]/.test(newName)
  ) {
    throw new Error('Invalid filename: remove trailing periods or spaces');
  }

  const target = path.join(parent, parts[parts.length - 1]);
  return target;
}

router.post('/create-file', express.json({limit:'1mb'}), async (req,res) => {
  try {
    const target = await safeNewPath(req.body?.path);
    const content = req.body?.content ?? '';

    if (typeof content !== 'string' ||
        Buffer.byteLength(content, 'utf8') > 1024 * 1024) {
      return res.status(400).json({error:'Invalid content'});
    }

    await fs.writeFile(target, content, {flag:'wx'});
    res.status(201).json({success:true,path:req.body.path});
  } catch (error) {
    res.status(error.code === 'EEXIST' ? 409 : 400)
       .json({error:error.message});
  }
});

router.post('/create-folder', express.json({limit:'16kb'}), async (req,res) => {
  try {
    const target = await safeNewPath(req.body?.path);
    await fs.mkdir(target);
    res.status(201).json({success:true,path:req.body.path});
  } catch (error) {
    res.status(error.code === 'EEXIST' ? 409 : 400)
       .json({error:error.message});
  }
});


router.post('/rename', express.json({limit:'16kb'}), async (req,res) => {
  try {
    const oldPath = req.body?.path;
    const newName = req.body?.newName;

    if (typeof oldPath !== 'string' ||
        !oldPath.startsWith('ECHOBOUND/') ||
        oldPath.includes('\\') ||
        oldPath.includes('\0')) {
      throw new Error('Invalid source path');
    }

    if (typeof newName !== 'string' ||
        !newName ||
        newName === '.' ||
        newName === '..' ||
        /[\\/\x00-\x1f\x7f]/.test(newName) ||
        /[.\s]$/.test(newName)) {
      throw new Error('Invalid new name');
    }

    const parts = oldPath.split('/');
    if (parts.some(p => !p || p === '.' || p === '..')) {
      throw new Error('Invalid source components');
    }

    const original = await safePath(oldPath);
    const originalStat = await fs.lstat(original);
    if (originalStat.isSymbolicLink()) {
      throw new Error('Symbolic links cannot be renamed');
    }

    const newPath = parts.slice(0,-1).concat(newName).join('/');
    const destination = await safeNewPath(newPath);

    if (original === destination) {
      throw new Error('Choose a different name');
    }

    try {
      await fs.lstat(destination);
      return res.status(409).json({error:'Destination already exists'});
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }

    await fs.rename(original,destination);
    res.json({success:true,oldPath,newPath});
  } catch (error) {
    res.status(400).json({error:error.message});
  }
});


router.post('/trash', express.json({limit:'16kb'}), async (req,res) => {
  try {
    const relative = req.body?.path;

    if (typeof relative !== 'string' ||
        !relative.startsWith('ECHOBOUND/') ||
        relative.includes('\\') ||
        relative.split('/').some(p => !p || p === '.' || p === '..') ||
        relative.includes('.ownz-backup')) {
      throw new Error('Invalid file path');
    }

    const target = await safePath(relative);
    const stat = await fs.lstat(target);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Only regular files can be trashed');
    }

    const crypto = require('crypto');
    const id = crypto.randomUUID();
    const trashDir = path.resolve(__dirname, '.ownz-trash');
    const destination = path.join(trashDir, id);
    const metadata = path.join(trashDir, id + '.json');

    await fs.writeFile(metadata, JSON.stringify({
      id,
      originalPath: relative,
      deletedAt: new Date().toISOString()
    }), {flag:'wx'});

    try {
      await fs.rename(target, destination);
    } catch (error) {
      await fs.unlink(metadata).catch(() => {});
      throw error;
    }

    res.json({success:true,id,path:relative});
  } catch (error) {
    res.status(400).json({error:error.message});
  }
});


// OWNZ_RESTORE_API_V1
router.get('/trash', async (req, res) => {
  try {
    const trashDir = path.resolve(__dirname, '.ownz-trash');
    const entries = await fs.readdir(trashDir);
    const items = [];

    for (const name of entries) {
      if (!/^[0-9a-f-]{36}\.json$/i.test(name)) continue;

      try {
        const metadata = JSON.parse(
          await fs.readFile(path.join(trashDir, name), 'utf8')
        );

        const id = name.slice(0, -5);
        if (metadata.id !== id ||
            typeof metadata.originalPath !== 'string') continue;

        const stat = await fs.lstat(path.join(trashDir, id));
        if (!stat.isFile() || stat.isSymbolicLink()) continue;

        items.push({
          id,
          originalPath: metadata.originalPath,
          deletedAt: metadata.deletedAt
        });
      } catch (_) {}
    }

    items.sort((a, b) =>
      String(b.deletedAt).localeCompare(String(a.deletedAt))
    );

    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/restore', express.json({limit:'16kb'}), async (req, res) => {
  try {
    const id = req.body?.id;
    if (typeof id !== 'string' ||
        !/^[0-9a-f-]{36}$/i.test(id)) {
      return res.status(400).json({error:'Invalid trash ID'});
    }

    const trashDir = path.resolve(__dirname, '.ownz-trash');
    const metadataFile = path.join(trashDir, id + '.json');
    const metadata = JSON.parse(
      await fs.readFile(metadataFile, 'utf8')
    );

    if (metadata.id !== id ||
        typeof metadata.originalPath !== 'string' ||
        !metadata.originalPath.startsWith('ECHOBOUND/')) {
      throw new Error('Invalid recovery metadata');
    }

    const relative = metadata.originalPath;
    const destination = path.resolve(root, relative);

    if (!destination.startsWith(root + path.sep)) {
      throw new Error('Invalid restore destination');
    }

    // Parent must already exist and remain inside the workspace.
    const parent = await safePath(path.dirname(relative));
    const sourceFile = path.join(trashDir, id);
    const stat = await fs.lstat(sourceFile);

    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error('Invalid trash file');
    }

    // Exclusive copy refuses to overwrite an existing file.
    await fs.copyFile(
      sourceFile,
      path.join(parent, path.basename(destination)),
      require('fs').constants.COPYFILE_EXCL
    );

    await fs.unlink(sourceFile);
    await fs.unlink(metadataFile);

    res.json({success:true, path:relative});
  } catch (error) {
    res.status(error.code === 'EEXIST' ? 409 : 400)
      .json({error:error.message});
  }
});

module.exports = router;
