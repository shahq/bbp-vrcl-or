/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'sessions.db');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
// db.pragma('journal_mode = WAL');

// Create tables if they don't exist
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    password_hash TEXT,               -- NULL = open session (no password required)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    project_client TEXT,
    project_background TEXT,
    project_notes TEXT,
    onboarding_completed BOOLEAN DEFAULT FALSE,  -- NEW: Tracks if admin has completed onboarding
    is_archived BOOLEAN DEFAULT FALSE
  );

  CREATE TABLE IF NOT EXISTS admin_sessions (
    id TEXT PRIMARY KEY,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );

  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    section TEXT NOT NULL,
    file_path TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    starred BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    from_card_id TEXT NOT NULL,
    to_card_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (from_card_id) REFERENCES cards(id) ON DELETE CASCADE,
    FOREIGN KEY (to_card_id) REFERENCES cards(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_cards_session ON cards(session_id);
  CREATE INDEX IF NOT EXISTS idx_cards_section ON cards(section);
  CREATE INDEX IF NOT EXISTS idx_connections_session ON connections(session_id);
`);

const connectionColumns = db.prepare(`PRAGMA table_info(connections)`).all() as Array<{ name: string }>;
const hasConnectionColumn = (name: string) => connectionColumns.some((column) => column.name === name);
const sessionColumns = db.prepare(`PRAGMA table_info(sessions)`).all() as Array<{ name: string }>;
const hasSessionColumn = (name: string) => sessionColumns.some((column) => column.name === name);

if (!hasSessionColumn('timer_control_mode')) {
  db.exec(`ALTER TABLE sessions ADD COLUMN timer_control_mode TEXT DEFAULT 'admin'`);
}

if (!hasConnectionColumn('thread_id')) {
  db.exec(`ALTER TABLE connections ADD COLUMN thread_id TEXT`);
}

if (!hasConnectionColumn('color')) {
  db.exec(`ALTER TABLE connections ADD COLUMN color TEXT`);
}

if (!hasConnectionColumn('owner_user_id')) {
  db.exec(`ALTER TABLE connections ADD COLUMN owner_user_id TEXT`);
}

export default db;
