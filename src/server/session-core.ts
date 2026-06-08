import bcrypt from "bcryptjs";
import type { TimerControlMode } from "../config/timer";

const SALT_ROUNDS = 10;

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
  timer_control_mode: TimerControlMode;
  is_archived: boolean;
}

export interface CreateSessionOptions {
  requirePassword: boolean;
  projectClient?: string;
  projectBackground?: string;
  projectNotes?: string;
}

export interface CreateSessionResult {
  session: Session;
  password: string | null;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, SALT_ROUNDS);
}

export function verifyPassword(password: string, hash: string | null): boolean {
  if (!hash) return true;
  return bcrypt.compareSync(password, hash);
}

export function generateSessionId(): string {
  const hex = Math.random().toString(16).substring(2, 6).toLowerCase();
  return `bdo-${hex}`;
}

export function generatePassword(): string {
  return Math.random().toString(16).substring(2, 10).toLowerCase();
}
