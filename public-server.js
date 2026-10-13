'use strict';

require('dotenv').config();

const express = require('express');
const path = require('node:path');
const helmet = require('helmet');

const app = express();
const website = path.resolve(__dirname, 'website');

app.disable('x-powered-by');

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use('/api/members', require('./membership/api'));


// PROTECTED GROW EMPIRE ROUTE — AUTHENTICATED MEMBERS ONLY
const sessions = require('./membership/sessions');
const protectedGame = path.resolve(__dirname, 'protected-games/grow-empire');

app.use('/games/grow-empire', (req, res, next) => {
  const cookie = req.headers.cookie || '';
  const match = cookie.match(/(?:^|;\s*)ownz_session=([a-f0-9]{64})(?:;|$)/);
  const user = match ? sessions.getSession(match[1]) : null;

  if (!user) {
    return res.status(401).json({
      error: 'Shocker OwnZ membership required',
      register: '/#members'
    });
  }

  next();
});

app.use('/games/grow-empire', express.static(protectedGame, {
  index: 'index.html',
  dotfiles: 'deny',
  fallthrough: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.use(express.static(website, {
  index: 'index.html',
  dotfiles: 'deny',
  fallthrough: false,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  }
}));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);

  res.status(err.status || 500).json({
    error: err.status === 404 ? 'Not found' : 'Request unavailable'
  });
});

const port = 8091;

app.listen(port, '127.0.0.1', () => {
  console.log('SHOCKER OWNZ PUBLIC SERVER ONLINE');
  console.log(`http://127.0.0.1:${port}`);
  console.log('Private Forge APIs are NOT mounted');
});
