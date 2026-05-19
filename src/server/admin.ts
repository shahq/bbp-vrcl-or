/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import db from './db';

const SESSION_DURATION_HOURS = 8;
const PARTYKIT_TOKEN_DURATION_MS = 15 * 60 * 1000;

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'shazam!';
}

function getPartyKitAdminSecret(): string {
  return process.env.PARTYKIT_ADMIN_SECRET || getAdminPassword();
}

export interface AdminSession {
  id: string;
  created_at: string;
  expires_at: string;
}

export function generateSessionId(): string {
  return `admin_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export function createAdminSession(): AdminSession {
  const id = generateSessionId();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  
  const stmt = db.prepare(`
    INSERT INTO admin_sessions (id, expires_at)
    VALUES (?, ?)
  `);
  
  stmt.run(id, expiresAt.toISOString());
  
  return {
    id,
    created_at: now.toISOString(),
    expires_at: expiresAt.toISOString()
  };
}

export function getAdminSession(sessionId: string): AdminSession | null {
  const stmt = db.prepare("SELECT * FROM admin_sessions WHERE id = ? AND expires_at > datetime('now')");
  return stmt.get(sessionId) as AdminSession | null;
}

export function deleteAdminSession(sessionId: string): boolean {
  const stmt = db.prepare('DELETE FROM admin_sessions WHERE id = ?');
  const result = stmt.run(sessionId);
  return result.changes > 0;
}

export function cleanupExpiredSessions(): void {
  const stmt = db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')");
  stmt.run();
}

export function verifyAdminPassword(password: string): boolean {
  return password === getAdminPassword();
}

export function createPartyKitAdminToken(sessionId: string): string {
  const payload = {
    role: 'admin',
    sessionId,
    exp: Date.now() + PARTYKIT_TOKEN_DURATION_MS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getPartyKitAdminSecret())
    .update(encodedPayload)
    .digest('base64url');

  return `${encodedPayload}.${signature}`;
}

// Express middleware to check admin authentication
export function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  const sessionId = req.headers['x-admin-session'] as string || req.cookies?.adminSession;
  
  if (!sessionId) {
    res.status(401).json({ error: 'Admin authentication required' });
    return;
  }
  
  const session = getAdminSession(sessionId);
  
  if (!session) {
    res.status(401).json({ error: 'Admin session expired or invalid' });
    return;
  }
  
  // Attach session to request for use in handlers
  (req as any).adminSession = session;
  next();
}

// Check if admin is authenticated (for conditional logic, doesn't reject)
export function isAdminAuthenticated(req: Request): boolean {
  const sessionId = req.headers['x-admin-session'] as string || req.cookies?.adminSession;
  if (!sessionId) return false;
  return getAdminSession(sessionId) !== null;
}
