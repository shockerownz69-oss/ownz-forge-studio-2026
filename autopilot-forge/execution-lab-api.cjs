'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const router = express.Router();
const report = path.resolve(__dirname, '..', '.ownz-recovery', 'autopilot', 'execution-lab-v15.json');
router.get('/status', (_req, res) => {
  try {
    const data = fs.readFileSync(report, 'utf8');
    const parsed = JSON.parse(data);
    res.set('Cache-Control', 'no-store');
    res.json(parsed);
  } catch (err) {
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ok:false, error:err.code === 'ENOENT' ? 'Execution Lab report not generated' : 'Report unavailable'});
  }
});
module.exports = router;
