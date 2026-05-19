import type { Request, Response, NextFunction } from "express";
import type { CreateSessionOptions, CreateSessionResult, Session } from "../sessions";
import type { Card } from "../cards";
import type { Connection } from "../connections";
import type { SessionNote } from "../../types";

export interface AdminSession {
  id: string;
  created_at: string;
  expires_at: string;
}

export interface AdminAuthProvider {
  cleanupExpiredSessions(): void;
  verifyAdminPassword(password: string): boolean;
  createAdminSession(): AdminSession;
  deleteAdminSession(sessionId: string): boolean;
  isAdminAuthenticated(req: Request): boolean;
  requireAdminAuth(req: Request, res: Response, next: NextFunction): void;
  createPartyKitAdminToken(sessionId: string): string;
}

export interface SessionStore {
  generateSessionId(): string;
  createSession(id: string, name: string, options: CreateSessionOptions): Promise<CreateSessionResult>;
  getSession(id: string): Promise<Session | null>;
  getAllSessions(): Promise<Session[]>;
  updateSession(
    id: string,
    updates: Partial<Omit<Session, "id" | "password_hash" | "created_at">>
  ): Promise<boolean>;
  deleteSession(id: string): Promise<boolean>;
  verifySessionPassword(id: string, password: string): Promise<boolean>;
  completeOnboarding(id: string): Promise<boolean>;
}

export interface CardStore {
  getCardsBySession(sessionId: string): Promise<Card[]>;
  getNextOrderIndex(sessionId: string, section: string): Promise<number>;
  createCard(
    sessionId: string,
    cardId: string,
    section: string,
    content: string,
    order?: number,
    starred?: boolean
  ): Promise<Card>;
  updateCard(
    sessionId: string,
    cardId: string,
    updates: Partial<Pick<Card, "section" | "order_index" | "starred">>,
    newContent?: string
  ): Promise<boolean>;
  deleteCard(sessionId: string, cardId: string): Promise<boolean>;
  reorderCards(sessionId: string, section: string, cardIds: string[]): Promise<boolean>;
}

export interface ConnectionStore {
  getConnectionsBySession(sessionId: string): Promise<Connection[]>;
  createConnection(sessionId: string, fromCardId: string, toCardId: string, threadId?: string, color?: string, ownerUserId?: string): Promise<Connection>;
  deleteConnection(id: string, sessionId?: string): Promise<boolean>;
  deleteConnectionsForCard(cardId: string, sessionId?: string): Promise<boolean>;
  saveAllConnections(
    sessionId: string,
    connections: Array<{ id: string; from: string; to: string; threadId?: string; color?: string; ownerUserId?: string }>
  ): Promise<void>;
}

export interface SessionFileStore {
  writeSessionMetadata(
    sessionId: string,
    metadata: {
      id: string;
      name: string;
      projectClient?: string;
      projectBackground?: string;
      projectNotes?: string;
      createdAt: string;
      updatedAt: string;
    }
  ): void;
  getSessionDir(sessionId: string): string;
}

export interface AttachmentFileWriteResult {
  relativePath: string;
  fullPath: string;
  cleanup?: () => Promise<void> | void;
}

export interface AttachmentStore {
  listAttachments<T>(sessionId: string): Promise<T[]>;
  saveAttachment<T extends { id: string }>(sessionId: string, attachment: T): Promise<void>;
  updateAttachment<T extends { id: string }>(
    sessionId: string,
    attachmentId: string,
    updater: (attachment: T) => T
  ): Promise<T | null>;
  deleteAttachment<T extends { id: string; relativePath: string }>(
    sessionId: string,
    attachmentId: string
  ): Promise<T | null>;
  writeAttachmentFile(
    sessionId: string,
    fileName: string,
    content: Buffer,
    mimeType?: string
  ): Promise<AttachmentFileWriteResult>;
  readAttachmentFile(sessionId: string, attachmentPath: string): Promise<Buffer>;
  deleteAllSessionAttachments(sessionId: string): Promise<void>;
}

export interface NoteStore {
  listNotes(sessionId: string): Promise<SessionNote[]>;
  upsertNote(sessionId: string, note: Partial<SessionNote>): Promise<SessionNote>;
  deleteNote(sessionId: string, noteId: string): Promise<boolean>;
  replaceNotes(sessionId: string, notes: Partial<SessionNote>[]): Promise<SessionNote[]>;
}

export interface CurrentBackend {
  adminAuth: AdminAuthProvider;
  sessions: SessionStore;
  cards: CardStore;
  connections: ConnectionStore;
  sessionFiles: SessionFileStore;
  attachments: AttachmentStore;
  notes: NoteStore;
}
