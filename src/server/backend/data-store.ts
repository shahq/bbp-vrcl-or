import { generateSessionId } from "../session-core";
import {
  convexCardStore,
  convexConnectionStore,
  convexNoteStore,
  convexSessionStore,
} from "./convex-data-store";
import type { CardStore, ConnectionStore, NoteStore, SessionStore } from "./types";

function getDataStoreProvider() {
  return process.env.DATA_STORE_PROVIDER?.trim().toLowerCase() || "sqlite";
}

const sqliteSessionStore: SessionStore = {
  generateSessionId,
  createSession: async (...args) => (await import("../sessions")).createSession(...args),
  getSession: async (...args) => (await import("../sessions")).getSession(...args),
  getAllSessions: async () => (await import("../sessions")).getAllSessions(),
  updateSession: async (...args) => (await import("../sessions")).updateSession(...args),
  updateSessionPassword: async (...args) => (await import("../sessions")).updateSessionPassword(...args),
  archiveSession: async (...args) => (await import("../sessions")).archiveSession(...args),
  deleteSession: async (...args) => (await import("../sessions")).deleteSession(...args),
  verifySessionPassword: async (...args) => (await import("../sessions")).verifySessionPassword(...args),
  completeOnboarding: async (...args) => (await import("../sessions")).completeOnboarding(...args),
  isSessionOpen: async (...args) => (await import("../sessions")).isSessionOpen(...args),
};

const sqliteCardStore: CardStore = {
  getCardsBySession: async (...args) => (await import("../cards")).getCardsBySession(...args),
  getNextOrderIndex: async (...args) => (await import("../cards")).getNextOrderIndex(...args),
  createCard: async (...args) => (await import("../cards")).createCard(...args),
  updateCard: async (_sessionId, cardId, updates, newContent) =>
    (await import("../cards")).updateCard(cardId, updates, newContent),
  deleteCard: async (_sessionId, cardId) => (await import("../cards")).deleteCard(cardId),
  reorderCards: async (...args) => (await import("../cards")).reorderCards(...args),
};

const sqliteConnectionStore: ConnectionStore = {
  getConnectionsBySession: async (...args) => (await import("../connections")).getConnectionsBySession(...args),
  createConnection: async (...args) => (await import("../connections")).createConnection(...args),
  deleteConnection: async (id) => (await import("../connections")).deleteConnection(id),
  deleteConnectionsForCard: async (cardId) => (await import("../connections")).deleteConnectionsForCard(cardId),
  saveAllConnections: async (...args) => {
    (await import("../connections")).saveAllConnections(...args);
  },
};

const localNoteStore: NoteStore = {
  listNotes: async (...args) => (await import("../notes")).readNotes(...args),
  upsertNote: async (...args) => (await import("../notes")).upsertNote(...args),
  deleteNote: async (...args) => (await import("../notes")).deleteNote(...args),
  replaceNotes: async (...args) => (await import("../notes")).replaceNotes(...args),
};

export function getSessionStore(): SessionStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteSessionStore;
    case "convex":
      return convexSessionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getCardStore(): CardStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteCardStore;
    case "convex":
      return convexCardStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getConnectionStore(): ConnectionStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteConnectionStore;
    case "convex":
      return convexConnectionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getNoteStore(): NoteStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return localNoteStore;
    case "convex":
      return convexNoteStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}
