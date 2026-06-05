/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import bcrypt from 'bcryptjs';
import db from './db';
import { DEFAULT_TIMER_CONTROL_MODE, normalizeTimerControlMode, type TimerControlMode } from '../config/timer';

const SALT_ROUNDS = 10;

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string | null): boolean {
  if (!hash) return true; // No password required
  return bcrypt.compareSync(password, hash);
}

export function generateSessionId(): string {
  // Generate 4-character hex string
  const hex = Math.random().toString(16).substring(2, 6).toLowerCase();
  return `bdo-${hex}`;
}

export function generatePassword(): string {
  // Generate 8-character hex password
  return Math.random().toString(16).substring(2, 10).toLowerCase();
}

export interface Session {
  id: string;
  name: string;
  password_hash: string | null;
  created_at: string;
  updated_at: string;
  project_client?: string;
  project_background?: string;
  project_notes?: string;
  onboarding_completed: boolean;
  is_archived: boolean;
  timer_control_mode: TimerControlMode;
}

export interface CreateSessionOptions {
  requirePassword: boolean;
  projectClient?: string;
  projectBackground?: string;
  projectNotes?: string;
  timerControlMode?: TimerControlMode;
}

export interface CreateSessionResult {
  session: Session;
  password: string | null;  // null if requirePassword is false
}

export function createSession(
  id: string,
  name: string,
  options: CreateSessionOptions
): CreateSessionResult {
  const {
    requirePassword,
    projectClient = '',
    projectBackground = '',
    projectNotes = '',
    timerControlMode = DEFAULT_TIMER_CONTROL_MODE,
  } = options;
  
  let password: string | null = null;
  let passwordHash: string | null = null;
  
  if (requirePassword) {
    password = generatePassword();
    passwordHash = hashPassword(password);
  }
  
  const stmt = db.prepare(`
    INSERT INTO sessions (id, name, password_hash, project_client, project_background, project_notes, onboarding_completed, timer_control_mode)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(id, name, passwordHash, projectClient, projectBackground, projectNotes, 0, normalizeTimerControlMode(timerControlMode));
  
  const session: Session = {
    id,
    name,
    password_hash: passwordHash,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    project_client: projectClient,
    project_background: projectBackground,
    project_notes: projectNotes,
    onboarding_completed: false,
    is_archived: false,
    timer_control_mode: normalizeTimerControlMode(timerControlMode)
  };
  
  return { session, password };
}

export function getSession(id: string): Session | null {
  const stmt = db.prepare('SELECT * FROM sessions WHERE id = ? AND is_archived = FALSE');
  return stmt.get(id) as Session | null;
}

export function getAllSessions(): Session[] {
  const stmt = db.prepare('SELECT * FROM sessions WHERE is_archived = FALSE ORDER BY updated_at DESC');
  return stmt.all() as Session[];
}

export function updateSession(
  id: string,
  updates: Partial<Omit<Session, 'id' | 'password_hash' | 'created_at'>>
): boolean {
  const fields = Object.keys(updates).filter(key => updates[key as keyof typeof updates] !== undefined);
  
  if (fields.length === 0) return false;
  
  const setClause = fields.map(field => `${field} = ?`).join(', ');
  const values = fields.map(field => updates[field as keyof typeof updates]);
  
  const stmt = db.prepare(`
    UPDATE sessions 
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
    WHERE id = ?
  `);
  
  const result = stmt.run(...values, id);
  return result.changes > 0;
}

export function updateSessionPassword(id: string, newPassword: string | null): boolean {
  let passwordHash: string | null = null;
  
  if (newPassword) {
    passwordHash = hashPassword(newPassword);
  }
  
  const stmt = db.prepare('UPDATE sessions SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(passwordHash, id);
  return result.changes > 0;
}

export function archiveSession(id: string): boolean {
  const stmt = db.prepare('UPDATE sessions SET is_archived = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function deleteSession(id: string): boolean {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function verifySessionPassword(id: string, password: string): boolean {
  const session = getSession(id);
  if (!session) return false;
  
  // If no password is set, any password works (or empty string)
  if (!session.password_hash) return true;
  
  return verifyPassword(password, session.password_hash);
}

export function completeOnboarding(id: string): boolean {
  const stmt = db.prepare('UPDATE sessions SET onboarding_completed = TRUE, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function isSessionOpen(id: string): boolean {
  const session = getSession(id);
  if (!session) return false;
  return !session.password_hash;
}
