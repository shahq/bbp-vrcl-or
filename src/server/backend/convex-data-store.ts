import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  DEFAULT_TIMER_CONTROL_MODE,
  normalizeTimerControlMode,
  type TimerControlMode,
} from "../../config/timer";
import type { Card } from "../cards";
import type { Connection } from "../connections";
import {
  generatePassword,
  generateSessionId,
  hashPassword,
  verifyPassword,
  type CreateSessionOptions,
  type CreateSessionResult,
  type Session,
} from "../session-core";
import type { SessionNote } from "../../types";
import type { CardStore, ConnectionStore, NoteStore, SessionStore } from "./types";

const convexRefs = {
  sessions: {
    get: makeFunctionReference("sessions:get"),
    list: makeFunctionReference("sessions:list"),
    create: makeFunctionReference("sessions:create"),
    update: makeFunctionReference("sessions:update"),
    remove: makeFunctionReference("sessions:remove"),
  },
  cards: {
    listBySession: makeFunctionReference("cards:listBySession"),
    nextOrderIndex: makeFunctionReference("cards:nextOrderIndex"),
    create: makeFunctionReference("cards:create"),
    update: makeFunctionReference("cards:update"),
    remove: makeFunctionReference("cards:remove"),
    reorder: makeFunctionReference("cards:reorder"),
  },
  connections: {
    listBySession: makeFunctionReference("connections:listBySession"),
    create: makeFunctionReference("connections:create"),
    remove: makeFunctionReference("connections:remove"),
    removeForCard: makeFunctionReference("connections:removeForCard"),
    replaceBySession: makeFunctionReference("connections:replaceBySession"),
  },
  notes: {
    listBySession: makeFunctionReference("notes:listBySession"),
    upsert: makeFunctionReference("notes:upsert"),
    remove: makeFunctionReference("notes:remove"),
    replaceBySession: makeFunctionReference("notes:replaceBySession"),
  },
};

interface ConvexCreateSessionArgs {
  sessionId: string;
  name: string;
  passwordHash?: string;
  projectClient?: string;
  projectBackground?: string;
  projectNotes?: string;
  timerControlMode: TimerControlMode;
  createdAt: string;
  updatedAt: string;
}

interface ConvexUpdateSessionArgs {
  sessionId: string;
  name?: string;
  projectClient?: string;
  projectBackground?: string;
  projectNotes?: string;
  onboardingCompleted?: boolean;
  timerControlMode?: TimerControlMode;
  isArchived?: boolean;
  passwordHash?: string | null;
  updatedAt: string;
}

interface ConvexCreateCardArgs {
  sessionId: string;
  cardId: string;
  section: string;
  content: string;
  orderIndex: number;
  starred: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ConvexUpdateCardArgs {
  sessionId: string;
  cardId: string;
  section?: string;
  orderIndex?: number;
  starred?: boolean;
  content?: string;
  updatedAt: string;
}

function getConvexUrl() {
  return process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || "";
}

function getConvexClient() {
  const url = getConvexUrl();
  if (!url) {
    throw new Error("DATA_STORE_PROVIDER=convex requires CONVEX_URL or VITE_CONVEX_URL.");
  }

  return new ConvexHttpClient(url);
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map(stripUndefined) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).flatMap(([key, child]) =>
        child === undefined ? [] : [[key, stripUndefined(child)]]
      )
    ) as T;
  }
  return value;
}

async function runQuery<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().query(ref, stripUndefined(args));
}

async function runMutation<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().mutation(ref, stripUndefined(args));
}

function mapSessionUpdates(updates: Partial<Omit<Session, "id" | "password_hash" | "created_at">>): Omit<ConvexUpdateSessionArgs, "sessionId" | "updatedAt"> {
  const mapped: Omit<ConvexUpdateSessionArgs, "sessionId" | "updatedAt"> = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.project_client !== undefined) mapped.projectClient = updates.project_client;
  if (updates.project_background !== undefined) mapped.projectBackground = updates.project_background;
  if (updates.project_notes !== undefined) mapped.projectNotes = updates.project_notes;
  if (updates.onboarding_completed !== undefined) mapped.onboardingCompleted = Boolean(updates.onboarding_completed);
  if (updates.timer_control_mode !== undefined) mapped.timerControlMode = normalizeTimerControlMode(updates.timer_control_mode);
  if (updates.is_archived !== undefined) mapped.isArchived = Boolean(updates.is_archived);
  return mapped;
}

export const convexSessionStore: SessionStore = {
  generateSessionId,

  async createSession(id: string, name: string, options: CreateSessionOptions): Promise<CreateSessionResult> {
    const now = new Date().toISOString();
    const password = options.requirePassword ? generatePassword() : null;
    const passwordHash = password ? hashPassword(password) : undefined;
    const session = await runMutation<Session>(convexRefs.sessions.create, {
      sessionId: id,
      name,
      passwordHash,
      projectClient: options.projectClient ?? "",
      projectBackground: options.projectBackground ?? "",
      projectNotes: options.projectNotes ?? "",
      timerControlMode: DEFAULT_TIMER_CONTROL_MODE,
      createdAt: now,
      updatedAt: now,
    });
    return { session, password };
  },

  async getSession(id: string) {
    return await runQuery(convexRefs.sessions.get, { sessionId: id });
  },

  async getAllSessions() {
    return await runQuery(convexRefs.sessions.list, {});
  },

  async updateSession(id: string, updates: Partial<Omit<Session, "id" | "password_hash" | "created_at">>) {
    return await runMutation(convexRefs.sessions.update, {
      sessionId: id,
      ...mapSessionUpdates(updates),
      updatedAt: new Date().toISOString(),
    });
  },

  async updateSessionPassword(id: string, newPassword: string | null) {
    return await runMutation(convexRefs.sessions.update, {
      sessionId: id,
      passwordHash: newPassword ? hashPassword(newPassword) : null,
      updatedAt: new Date().toISOString(),
    });
  },

  async archiveSession(id: string) {
    return await runMutation(convexRefs.sessions.update, {
      sessionId: id,
      isArchived: true,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteSession(id: string) {
    return await runMutation(convexRefs.sessions.remove, { sessionId: id });
  },

  async verifySessionPassword(id: string, password: string) {
    const session = await this.getSession(id);
    if (!session) return false;
    if (!session.password_hash) return true;
    return verifyPassword(password, session.password_hash);
  },

  async completeOnboarding(id: string) {
    return await runMutation(convexRefs.sessions.update, {
      sessionId: id,
      onboardingCompleted: true,
      updatedAt: new Date().toISOString(),
    });
  },

  async isSessionOpen(id: string) {
    const session = await this.getSession(id);
    return !!session && !session.password_hash;
  },
};

export const convexCardStore: CardStore = {
  async getCardsBySession(sessionId: string) {
    return await runQuery(convexRefs.cards.listBySession, { sessionId });
  },

  async getNextOrderIndex(sessionId: string, section: string) {
    return await runQuery(convexRefs.cards.nextOrderIndex, { sessionId, section });
  },

  async createCard(sessionId: string, cardId: string, section: string, content: string, order = 0, starred = false) {
    const now = new Date().toISOString();
    return await runMutation(convexRefs.cards.create, {
      sessionId,
      cardId,
      section,
      content,
      orderIndex: order,
      starred,
      createdAt: now,
      updatedAt: now,
    });
  },

  async updateCard(
    sessionId: string,
    cardId: string,
    updates: Partial<Pick<Card, "section" | "order_index" | "starred">>,
    newContent?: string
  ) {
    return await runMutation(convexRefs.cards.update, {
      sessionId,
      cardId,
      section: updates.section,
      orderIndex: updates.order_index,
      starred: updates.starred,
      content: newContent,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteCard(sessionId: string, cardId: string) {
    return await runMutation(convexRefs.cards.remove, { sessionId, cardId });
  },

  async reorderCards(sessionId: string, section: string, cardIds: string[]) {
    return await runMutation(convexRefs.cards.reorder, {
      sessionId,
      section,
      cardIds,
      updatedAt: new Date().toISOString(),
    });
  },
};

export const convexConnectionStore: ConnectionStore = {
  async getConnectionsBySession(sessionId: string) {
    return await runQuery<Connection[]>(convexRefs.connections.listBySession, { sessionId });
  },

  async createConnection(
    sessionId: string,
    fromCardId: string,
    toCardId: string,
    threadId?: string,
    color?: string,
    ownerUserId?: string
  ) {
    return await runMutation<Connection>(convexRefs.connections.create, {
      sessionId,
      fromCardId,
      toCardId,
      threadId,
      color,
      ownerUserId,
      createdAt: new Date().toISOString(),
    });
  },

  async deleteConnection(id: string, sessionId?: string) {
    return await runMutation<boolean>(convexRefs.connections.remove, {
      connectionId: id,
      sessionId,
    });
  },

  async deleteConnectionsForCard(cardId: string, sessionId?: string) {
    return await runMutation<boolean>(convexRefs.connections.removeForCard, {
      cardId,
      sessionId,
    });
  },

  async saveAllConnections(
    sessionId: string,
    connections: Array<{ id: string; from: string; to: string; threadId?: string; color?: string; ownerUserId?: string }>
  ) {
    await runMutation(convexRefs.connections.replaceBySession, {
      sessionId,
      connections,
      createdAt: new Date().toISOString(),
    });
  },
};

export const convexNoteStore: NoteStore = {
  async listNotes(sessionId: string) {
    return await runQuery<SessionNote[]>(convexRefs.notes.listBySession, { sessionId });
  },

  async upsertNote(sessionId: string, note: Partial<SessionNote>) {
    return await runMutation<SessionNote>(convexRefs.notes.upsert, {
      sessionId,
      note: note as Record<string, unknown>,
      updatedAt: new Date().toISOString(),
    });
  },

  async deleteNote(sessionId: string, noteId: string) {
    return await runMutation<boolean>(convexRefs.notes.remove, { sessionId, noteId });
  },

  async replaceNotes(sessionId: string, notes: Partial<SessionNote>[]) {
    return await runMutation<SessionNote[]>(convexRefs.notes.replaceBySession, {
      sessionId,
      notes: notes as Record<string, unknown>[],
    });
  },
};
