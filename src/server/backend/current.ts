import * as files from "../files";
import { getAdminAuthProvider } from "../auth";
import { getAttachmentStore } from "./attachments";
import { getCardStore, getConnectionStore, getNoteStore, getSessionStore } from "./data-store";
import type { CurrentBackend } from "./types";

export function getCurrentBackend(): CurrentBackend {
  return {
    adminAuth: getAdminAuthProvider(),
    sessions: getSessionStore(),
    cards: getCardStore(),
    connections: getConnectionStore(),
    sessionFiles: {
      writeSessionMetadata: files.writeSessionMetadata,
      getSessionDir: files.getSessionDir,
    },
    attachments: getAttachmentStore(),
    notes: getNoteStore(),
  };
}
