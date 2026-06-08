import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import {
  DEFAULT_TIMER_CONTROL_MODE,
  normalizeTimerControlMode,
  type TimerControlMode,
} from "../../config/timer";
import type { Card } from "../cards";
import {
  generatePassword,
  generateSessionId,
  hashPassword,
  verifyPassword,
  type CreateSessionOptions,
  type CreateSessionResult,
  type Session,
} from "../sessions";
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

async function runQuery<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().query(ref, args);
}

async function runMutation<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().mutation(ref, args);
}

function unsupportedStore(name: string): never {
  throw new Error(`DATA_STORE_PROVIDER=convex does not implement ${name} yet.`);
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

export const unsupportedConvexConnectionStore: ConnectionStore = {
  getConnectionsBySession: async () => unsupportedStore("ConnectionStore.getConnectionsBySession"),
  createConnection: async () => unsupportedStore("ConnectionStore.createConnection"),
  deleteConnection: async () => unsupportedStore("ConnectionStore.deleteConnection"),
  deleteConnectionsForCard: async () => unsupportedStore("ConnectionStore.deleteConnectionsForCard"),
  saveAllConnections: async () => unsupportedStore("ConnectionStore.saveAllConnections"),
};

export const unsupportedConvexNoteStore: NoteStore = {
  listNotes: async () => unsupportedStore("NoteStore.listNotes"),
  upsertNote: async () => unsupportedStore("NoteStore.upsertNote"),
  deleteNote: async () => unsupportedStore("NoteStore.deleteNote"),
  replaceNotes: async () => unsupportedStore("NoteStore.replaceNotes"),
};
