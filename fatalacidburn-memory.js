'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const vault = path.join(__dirname, 'fatalacidburn-memory');
const filename = path.join(vault, 'fatalacidburn.sqlite');

function openDatabase() {
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}

function validateText(value, name, max = 4000) {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    value.length > max
  ) {
    throw new TypeError(`Invalid ${name}`);
  }
  return value.trim();
}

function createConversation(title = 'New conversation') {
  title = validateText(title, 'title', 200);
  const id = crypto.randomUUID();
  const db = openDatabase();

  try {
    db.prepare(
      'INSERT INTO conversations (id, title) VALUES (?, ?)'
    ).run(id, title);

    return id;
  } finally {
    db.close();
  }
}

function saveMessage(conversationId, role, content) {
  conversationId = validateText(conversationId, 'conversation ID', 100);
  content = validateText(content, 'message', 30000);

  if (!['user', 'assistant'].includes(role)) {
    throw new TypeError('Invalid message role');
  }

  const db = openDatabase();

  try {
    db.exec('BEGIN IMMEDIATE');

    const result = db.prepare(`
      INSERT INTO messages (conversation_id, role, content)
      VALUES (?, ?, ?)
    `).run(conversationId, role, content);

    db.prepare(`
      UPDATE conversations
      SET updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(conversationId);

    db.exec('COMMIT');
    return Number(result.lastInsertRowid);
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  } finally {
    db.close();
  }
}

function getRecentMessages(conversationId, limit = 6) {
  conversationId = validateText(conversationId, 'conversation ID', 100);
  limit = Math.max(1, Math.min(20, Number(limit) || 6));

  const db = openDatabase();

  try {
    return db.prepare(`
      SELECT role, content, created_at
      FROM (
        SELECT id, role, content, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY id DESC
        LIMIT ?
      )
      ORDER BY id ASC
    `).all(conversationId, limit);
  } finally {
    db.close();
  }
}

function listConversations(limit = 30) {
  limit = Math.max(1, Math.min(100, Number(limit) || 30));
  const db = openDatabase();

  try {
    return db.prepare(`
      SELECT id, title, created_at, updated_at
      FROM conversations
      ORDER BY updated_at DESC
      LIMIT ?
    `).all(limit);
  } finally {
    db.close();
  }
}

function saveRole(name, instructions) {
  name = validateText(name, 'role name', 100);
  instructions = validateText(instructions, 'role instructions', 3000);

  const db = openDatabase();

  try {
    db.prepare(`
      INSERT INTO roles (name, instructions, enabled)
      VALUES (?, ?, 1)
      ON CONFLICT(name) DO UPDATE SET
        instructions = excluded.instructions,
        enabled = 1,
        updated_at = CURRENT_TIMESTAMP
    `).run(name, instructions);

    return { name, enabled: true };
  } finally {
    db.close();
  }
}

function getActiveRoles() {
  const db = openDatabase();

  try {
    return db.prepare(`
      SELECT id, name, instructions
      FROM roles
      WHERE enabled = 1
      ORDER BY id ASC
    `).all();
  } finally {
    db.close();
  }
}

function listRoles() {
  const db = openDatabase();

  try {
    return db.prepare(`
      SELECT id, name, instructions, enabled,
             created_at, updated_at
      FROM roles
      ORDER BY id ASC
    `).all();
  } finally {
    db.close();
  }
}

function setRoleEnabled(name, enabled) {
  name = validateText(name, 'role name', 100);
  const db = openDatabase();

  try {
    return db.prepare(`
      UPDATE roles
      SET enabled = ?, updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(enabled ? 1 : 0, name).changes > 0;
  } finally {
    db.close();
  }
}

function saveMemory(category, content, conversationId = null) {
  category = validateText(category, 'memory category', 100);
  content = validateText(content, 'memory content', 3000);

  if (conversationId !== null) {
    conversationId = validateText(conversationId, 'conversation ID', 100);
  }

  const db = openDatabase();

  try {
    const result = db.prepare(`
      INSERT INTO memories
        (category, content, source_conversation_id)
      VALUES (?, ?, ?)
    `).run(category, content, conversationId);

    return Number(result.lastInsertRowid);
  } finally {
    db.close();
  }
}

function listMemories(limit = 30) {
  limit = Math.max(1, Math.min(100, Number(limit) || 30));
  const db = openDatabase();

  try {
    return db.prepare(`
      SELECT id, category, content, created_at
      FROM memories
      ORDER BY id DESC
      LIMIT ?
    `).all(limit);
  } finally {
    db.close();
  }
}

module.exports = {
  createConversation,
  saveMessage,
  getRecentMessages,
  listConversations,
  saveRole,
  getActiveRoles,
  listRoles,
  setRoleEnabled,
  saveMemory,
  listMemories
};
