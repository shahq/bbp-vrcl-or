import * as cards from "../cards";
import * as connections from "../connections";
import {
  deleteNote,
  readNotes,
  replaceNotes,
  upsertNote,
} from "../notes";
import * as sessions from "../sessions";
import type { CardStore, ConnectionStore, NoteStore, SessionStore } from "./types";

function getDataStoreProvider() {
  return process.env.DATA_STORE_PROVIDER?.trim().toLowerCase() || "sqlite";
}

const sqliteSessionStore: SessionStore = {
  generateSessionId: sessions.generateSessionId,
  createSession: async (...args) => sessions.createSession(...args),
  getSession: async (...args) => sessions.getSession(...args),
  getAllSessions: async () => sessions.getAllSessions(),
  updateSession: async (...args) => sessions.updateSession(...args),
  updateSessionPassword: async (...args) => sessions.updateSessionPassword(...args),
  archiveSession: async (...args) => sessions.archiveSession(...args),
  deleteSession: async (...args) => sessions.deleteSession(...args),
  verifySessionPassword: async (...args) => sessions.verifySessionPassword(...args),
  completeOnboarding: async (...args) => sessions.completeOnboarding(...args),
  isSessionOpen: async (...args) => sessions.isSessionOpen(...args),
};

const sqliteCardStore: CardStore = {
  getCardsBySession: async (...args) => cards.getCardsBySession(...args),
  getNextOrderIndex: async (...args) => cards.getNextOrderIndex(...args),
  createCard: async (...args) => cards.createCard(...args),
  updateCard: async (_sessionId, cardId, updates, newContent) => cards.updateCard(cardId, updates, newContent),
  deleteCard: async (_sessionId, cardId) => cards.deleteCard(cardId),
  reorderCards: async (...args) => cards.reorderCards(...args),
};

const sqliteConnectionStore: ConnectionStore = {
  getConnectionsBySession: async (...args) => connections.getConnectionsBySession(...args),
  createConnection: async (...args) => connections.createConnection(...args),
  deleteConnection: async (id) => connections.deleteConnection(id),
  deleteConnectionsForCard: async (cardId) => connections.deleteConnectionsForCard(cardId),
  saveAllConnections: async (...args) => {
    connections.saveAllConnections(...args);
  },
};

const localNoteStore: NoteStore = {
  listNotes: async (...args) => readNotes(...args),
  upsertNote: async (...args) => upsertNote(...args),
  deleteNote: async (...args) => deleteNote(...args),
  replaceNotes: async (...args) => replaceNotes(...args),
};

export function getSessionStore(): SessionStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteSessionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getCardStore(): CardStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteCardStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getConnectionStore(): ConnectionStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return sqliteConnectionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getNoteStore(): NoteStore {
  const provider = getDataStoreProvider();
  switch (provider) {
    case "sqlite":
      return localNoteStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}
