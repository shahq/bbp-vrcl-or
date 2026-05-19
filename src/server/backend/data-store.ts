import * as cards from "../cards";
import * as connections from "../connections";
import * as sessions from "../sessions";
import {
  completeFirestoreOnboarding,
  createFirestoreSession,
  deleteFirestoreSession,
  getAllFirestoreSessions,
  getFirestoreSession,
  updateFirestoreSession,
  verifyFirestoreSessionPassword,
} from "../data/firestore/sessions";
import {
  createFirestoreCard,
  deleteFirestoreCard,
  getFirestoreCardsBySession,
  getFirestoreNextOrderIndex,
  reorderFirestoreCards,
  updateFirestoreCard,
} from "../data/firestore/cards";
import {
  createFirestoreConnection,
  deleteFirestoreConnection,
  deleteFirestoreConnectionsForCard,
  getFirestoreConnectionsBySession,
  saveAllFirestoreConnections,
} from "../data/firestore/connections";
import {
  deleteFirestoreNote,
  getFirestoreNotes,
  replaceFirestoreNotes,
  upsertFirestoreNote,
} from "../data/firestore/notes";
import {
  deleteNote,
  readNotes,
  replaceNotes,
  upsertNote,
} from "../notes";
import type { CardStore, ConnectionStore, NoteStore, SessionStore } from "./types";

const sqliteSessionStore: SessionStore = {
  generateSessionId: sessions.generateSessionId,
  createSession: async (...args) => sessions.createSession(...args),
  getSession: async (...args) => sessions.getSession(...args),
  getAllSessions: async () => sessions.getAllSessions(),
  updateSession: async (...args) => sessions.updateSession(...args),
  deleteSession: async (...args) => sessions.deleteSession(...args),
  verifySessionPassword: async (...args) => sessions.verifySessionPassword(...args),
  completeOnboarding: async (...args) => sessions.completeOnboarding(...args),
};

const sqliteCardStore: CardStore = {
  getCardsBySession: async (...args) => cards.getCardsBySession(...args),
  getNextOrderIndex: async (...args) => cards.getNextOrderIndex(...args),
  createCard: async (...args) => cards.createCard(...args),
  updateCard: async (_sessionId, ...args) => cards.updateCard(...args),
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

const sqliteNoteStore: NoteStore = {
  listNotes: async (...args) => readNotes(...args),
  upsertNote: async (...args) => upsertNote(...args),
  deleteNote: async (...args) => deleteNote(...args),
  replaceNotes: async (...args) => replaceNotes(...args),
};

const firestoreSessionStore: SessionStore = {
  generateSessionId: sessions.generateSessionId,
  createSession: createFirestoreSession,
  getSession: getFirestoreSession,
  getAllSessions: getAllFirestoreSessions,
  updateSession: updateFirestoreSession,
  deleteSession: deleteFirestoreSession,
  verifySessionPassword: verifyFirestoreSessionPassword,
  completeOnboarding: completeFirestoreOnboarding,
};

const firestoreCardStore: CardStore = {
  getCardsBySession: getFirestoreCardsBySession,
  getNextOrderIndex: getFirestoreNextOrderIndex,
  createCard: createFirestoreCard,
  updateCard: updateFirestoreCard,
  deleteCard: deleteFirestoreCard,
  reorderCards: reorderFirestoreCards,
};

const firestoreConnectionStore: ConnectionStore = {
  getConnectionsBySession: getFirestoreConnectionsBySession,
  createConnection: createFirestoreConnection,
  deleteConnection: async (id, sessionId) => deleteFirestoreConnection(sessionId || "", id),
  deleteConnectionsForCard: async (cardId, sessionId) => deleteFirestoreConnectionsForCard(sessionId || "", cardId),
  saveAllConnections: saveAllFirestoreConnections,
};

const firestoreNoteStore: NoteStore = {
  listNotes: getFirestoreNotes,
  upsertNote: upsertFirestoreNote,
  deleteNote: deleteFirestoreNote,
  replaceNotes: replaceFirestoreNotes,
};

export function getSessionStore(): SessionStore {
  const provider = process.env.DATA_STORE_PROVIDER || "sqlite";
  switch (provider) {
    case "sqlite":
      return sqliteSessionStore;
    case "firestore":
      return firestoreSessionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getCardStore(): CardStore {
  const provider = process.env.DATA_STORE_PROVIDER || "sqlite";
  switch (provider) {
    case "sqlite":
      return sqliteCardStore;
    case "firestore":
      return firestoreCardStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getConnectionStore(): ConnectionStore {
  const provider = process.env.DATA_STORE_PROVIDER || "sqlite";
  switch (provider) {
    case "sqlite":
      return sqliteConnectionStore;
    case "firestore":
      return firestoreConnectionStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}

export function getNoteStore(): NoteStore {
  const provider = process.env.DATA_STORE_PROVIDER || "sqlite";
  switch (provider) {
    case "sqlite":
      return sqliteNoteStore;
    case "firestore":
      return firestoreNoteStore;
    default:
      throw new Error(`Unsupported DATA_STORE_PROVIDER: ${provider}`);
  }
}
