import * as files from "../files";
import { getAdminAuthProvider } from "../auth";
import { getAttachmentStore } from "./attachments";
import { getCardStore, getConnectionStore, getNoteStore, getSessionStore } from "./data-store";
import type { CurrentBackend, SessionFileStore } from "./types";

const localSessionFileStore: SessionFileStore = {
  writeSessionMetadata: files.writeSessionMetadata,
  getSessionDir: files.getSessionDir,
};

const noOpSessionFileStore: SessionFileStore = {
  writeSessionMetadata() {},
  getSessionDir: files.getSessionDir,
};

function getSessionFileStoreProvider() {
  const configured = process.env.SESSION_FILE_STORE_PROVIDER?.trim().toLowerCase();
  if (configured) return configured;

  const dataProvider = process.env.DATA_STORE_PROVIDER?.trim().toLowerCase();
  return process.env.VERCEL && dataProvider === "convex" ? "none" : "local";
}

function getSessionFileStore() {
  const provider = getSessionFileStoreProvider();
  switch (provider) {
    case "local":
      return localSessionFileStore;
    case "none":
      return noOpSessionFileStore;
    default:
      throw new Error(`Unsupported SESSION_FILE_STORE_PROVIDER: ${provider}`);
  }
}

export function getCurrentBackend(): CurrentBackend {
  return {
    adminAuth: getAdminAuthProvider(),
    sessions: getSessionStore(),
    cards: getCardStore(),
    connections: getConnectionStore(),
    sessionFiles: getSessionFileStore(),
    attachments: getAttachmentStore(),
    notes: getNoteStore(),
  };
}
