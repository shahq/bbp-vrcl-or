import fs from "fs";
import os from "os";
import path from "path";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
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

  async writeAttachmentArchiveFile(sessionId: string, fileName: string, content: Buffer) {
    return localFiles.writeAttachmentArchiveFile(sessionId, fileName, content);
  },

  async replaceAllSessionAttachments<T extends { id: string }>(sessionId: string, attachments: T[]) {
    localFiles.writeAttachmentsIndex(sessionId, attachments);
  },

  async readAttachmentFile(_sessionId: string, attachmentPath: string) {
    const fullPath = path.isAbsolute(attachmentPath)
      ? attachmentPath
      : path.join(process.cwd(), attachmentPath);
    return fs.readFileSync(fullPath);
  },

  async deleteAllSessionAttachments(sessionId: string) {
    const attachmentsDir = localFiles.getAttachmentsDir(sessionId);
    fs.rmSync(attachmentsDir, { recursive: true, force: true });
    fs.mkdirSync(attachmentsDir, { recursive: true });
    localFiles.writeAttachmentsIndex(sessionId, []);
  },
};

const convexAttachmentRefs = {
  generateUploadUrl: makeFunctionReference("attachments:generateUploadUrl"),
  getFileUrl: makeFunctionReference("attachments:getFileUrl"),
  listBySession: makeFunctionReference("attachments:listBySession"),
  save: makeFunctionReference("attachments:save"),
  remove: makeFunctionReference("attachments:remove"),
  removeAllForSession: makeFunctionReference("attachments:removeAllForSession"),
};

function getConvexUrl() {
  return process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || "";
}

function getConvexClient() {
  const url = getConvexUrl();
  if (!url) {
    throw new Error("ATTACHMENT_STORE_PROVIDER=convex requires CONVEX_URL or VITE_CONVEX_URL.");
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

function getStorageId(relativePath: string) {
  return relativePath.startsWith("convex-storage://")
    ? relativePath.slice("convex-storage://".length)
    : "";
}

function safeAttachmentFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "upload.bin";
}

async function runQuery<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().query(ref, stripUndefined(args));
}

async function runMutation<Result>(ref: any, args: Record<string, unknown>): Promise<Result> {
  return await getConvexClient().mutation(ref, stripUndefined(args));
}

async function uploadToConvexStorage(fileName: string, content: Buffer, mimeType?: string) {
  const uploadUrl = await runMutation<string>(convexAttachmentRefs.generateUploadUrl, {});
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Type": mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${fileName.replace(/"/g, "_")}"`,
    },
    body: content as any,
  });

  if (!response.ok) {
    throw new Error(`Convex attachment upload failed (${response.status})`);
  }

  const data = await response.json() as { storageId?: string };
  if (!data.storageId) {
    throw new Error("Convex attachment upload did not return storageId.");
  }

  return data.storageId;
}

async function writeTempAttachmentFile(fileName: string, content: Buffer) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "bbp-attachment-"));
  const fullPath = path.join(tempDir, safeAttachmentFileName(fileName));
  fs.writeFileSync(fullPath, content);

  return {
    fullPath,
    cleanup: () => fs.rmSync(tempDir, { recursive: true, force: true }),
  };
}

const convexAttachmentStore: AttachmentStore = {
  async listAttachments<T>(sessionId: string) {
    return await runQuery<T[]>(convexAttachmentRefs.listBySession, { sessionId });
  },

  async saveAttachment<T extends { id: string }>(sessionId: string, attachment: T) {
    const payload = {
      ...(attachment as Record<string, unknown>),
      storageId: getStorageId(String((attachment as any).relativePath || "")) || undefined,
    };
    await runMutation(convexAttachmentRefs.save, { sessionId, attachment: payload });
  },

  async updateAttachment<T extends { id: string }>(
    sessionId: string,
    attachmentId: string,
    updater: (attachment: T) => T
  ) {
    const attachments = await this.listAttachments(sessionId) as T[];
    const current = attachments.find((item) => item.id === attachmentId);
    if (!current) return null;

    const next = updater(current);
    await this.saveAttachment(sessionId, next);
    return next;
  },

  async deleteAttachment<T extends { id: string; relativePath: string }>(sessionId: string, attachmentId: string) {
    return await runMutation<T | null>(convexAttachmentRefs.remove, { sessionId, attachmentId });
  },

  async writeAttachmentFile(_sessionId: string, fileName: string, content: Buffer, mimeType?: string) {
    const storageId = await uploadToConvexStorage(fileName, content, mimeType);
    const tempFile = await writeTempAttachmentFile(fileName, content);

    return {
      relativePath: `convex-storage://${storageId}`,
      ...tempFile,
    };
  },

  async writeAttachmentArchiveFile(_sessionId: string, fileName: string, content: Buffer, mimeType?: string) {
    const storageId = await uploadToConvexStorage(fileName, content, mimeType);
    return {
      relativePath: `convex-storage://${storageId}`,
    };
  },

  async replaceAllSessionAttachments<T extends { id: string }>(sessionId: string, attachments: T[]) {
    await this.deleteAllSessionAttachments(sessionId);
    for (const attachment of attachments) {
      await this.saveAttachment(sessionId, attachment);
    }
  },

  async createDirectUploadTarget() {
    return {
      uploadUrl: await runMutation<string>(convexAttachmentRefs.generateUploadUrl, {}),
    };
  },

  async prepareDirectUploadedFile(_sessionId: string, fileName: string, storageId: string) {
    const content = await this.readAttachmentFile(_sessionId, `convex-storage://${storageId}`);
    const tempFile = await writeTempAttachmentFile(fileName, content);
    return {
      relativePath: `convex-storage://${storageId}`,
      ...tempFile,
    };
  },

  async readAttachmentFile(_sessionId: string, attachmentPath: string) {
    const storageId = getStorageId(attachmentPath);
    if (!storageId) {
      const fullPath = path.isAbsolute(attachmentPath)
        ? attachmentPath
        : path.join(process.cwd(), attachmentPath);
      return fs.readFileSync(fullPath);
    }

    const url = await runQuery<string | null>(convexAttachmentRefs.getFileUrl, { storageId });
    if (!url) {
      throw new Error("Convex attachment file is not available.");
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Convex attachment download failed (${response.status})`);
    }

    return Buffer.from(await response.arrayBuffer());
  },

  async deleteAllSessionAttachments(sessionId: string) {
    await runMutation(convexAttachmentRefs.removeAllForSession, { sessionId });
  },
};

export function getAttachmentStore(): AttachmentStore {
  const provider = getAttachmentStoreProvider();
  switch (provider) {
    case "local":
      return localAttachmentStore;
    case "convex":
      return convexAttachmentStore;
    default:
      throw new Error(`Unsupported ATTACHMENT_STORE_PROVIDER: ${provider}`);
  }
}
