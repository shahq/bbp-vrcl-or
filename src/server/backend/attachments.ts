import fs from "fs";
import path from "path";
import * as localFiles from "../files";
import type { AttachmentStore } from "./types";

function getAttachmentStoreProvider() {
  return process.env.ATTACHMENT_STORE_PROVIDER?.trim().toLowerCase() || "local";
}

const localAttachmentStore: AttachmentStore = {
  async listAttachments<T>(sessionId: string) {
    return localFiles.readAttachmentsIndex<T>(sessionId);
  },

  async saveAttachment<T extends { id: string }>(sessionId: string, attachment: T) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const next = [attachment, ...existing.filter((item) => item.id !== attachment.id)];
    localFiles.writeAttachmentsIndex(sessionId, next);
  },

  async updateAttachment<T extends { id: string }>(
    sessionId: string,
    attachmentId: string,
    updater: (attachment: T) => T
  ) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const index = existing.findIndex((item) => item.id === attachmentId);
    if (index === -1) return null;

    existing[index] = updater(existing[index]);
    localFiles.writeAttachmentsIndex(sessionId, existing);
    return existing[index];
  },

  async deleteAttachment<T extends { id: string; relativePath: string }>(sessionId: string, attachmentId: string) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const attachment = existing.find((item) => item.id === attachmentId) || null;
    if (!attachment) return null;

    const fullPath = path.join(process.cwd(), attachment.relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    localFiles.writeAttachmentsIndex(
      sessionId,
      existing.filter((item) => item.id !== attachmentId)
    );

    return attachment;
  },

  async writeAttachmentFile(sessionId: string, fileName: string, content: Buffer) {
    return localFiles.writeAttachmentFile(sessionId, fileName, content);
  },

  async readAttachmentFile(_sessionId: string, attachmentPath: string) {
    const fullPath = path.isAbsolute(attachmentPath)
      ? attachmentPath
      : path.join(process.cwd(), attachmentPath);
    return fs.readFileSync(fullPath);
  },

  async deleteAllSessionAttachments(sessionId: string) {
    const attachments = localFiles.readAttachmentsIndex<{ relativePath: string }>(sessionId);
    attachments.forEach((attachment) => {
      const fullPath = path.join(process.cwd(), attachment.relativePath);
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      }
    });
    localFiles.writeAttachmentsIndex(sessionId, []);
  },
};

export function getAttachmentStore(): AttachmentStore {
  const provider = getAttachmentStoreProvider();
  switch (provider) {
    case "local":
      return localAttachmentStore;
    default:
      throw new Error(`Unsupported ATTACHMENT_STORE_PROVIDER: ${provider}`);
  }
}
