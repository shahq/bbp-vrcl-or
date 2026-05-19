import fs from "fs";
import os from "os";
import path from "path";
import * as localFiles from "../files";
import { getFirestoreDb, getStorageBucket } from "../firebase/app";
import type { AttachmentStore } from "./types";

const FIRESTORE_COLLECTION = "sessions";

function getProvider() {
  return process.env.ATTACHMENT_STORE_PROVIDER?.trim().toLowerCase() || "local";
}

function attachmentsCollection(sessionId: string) {
  return getFirestoreDb()
    .collection(FIRESTORE_COLLECTION)
    .doc(sessionId)
    .collection("attachments");
}

function mapAttachmentDocs<T>(snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>) {
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() } as T))
    .sort((a: any, b: any) => String(b.uploadedAt || "").localeCompare(String(a.uploadedAt || "")));
}

function getStorageObjectPath(sessionId: string, fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `sessions/${sessionId}/attachments/${Date.now()}-${safeName}`;
}

function makeTempAttachmentPath(fileName: string) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  return path.join(os.tmpdir(), `bbp-attachment-${Date.now()}-${safeName}`);
}

const localAttachmentStore: AttachmentStore = {
  async listAttachments<T>(sessionId: string) {
    return localFiles.readAttachmentsIndex<T>(sessionId);
  },
  async saveAttachment<T extends { id: string }>(sessionId: string, attachment: T) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const next = [attachment, ...existing.filter((item: any) => item.id !== attachment.id)];
    localFiles.writeAttachmentsIndex(sessionId, next);
  },
  async updateAttachment<T extends { id: string }>(sessionId: string, attachmentId: string, updater: (attachment: T) => T) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const index = existing.findIndex((item: any) => item.id === attachmentId);
    if (index === -1) return null;

    existing[index] = updater(existing[index]);
    localFiles.writeAttachmentsIndex(sessionId, existing);
    return existing[index];
  },
  async deleteAttachment<T extends { id: string; relativePath: string }>(sessionId: string, attachmentId: string) {
    const existing = localFiles.readAttachmentsIndex<T>(sessionId);
    const attachment = existing.find((item: any) => item.id === attachmentId) || null;
    if (!attachment) return null;

    const fullPath = path.join(process.cwd(), attachment.relativePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    localFiles.writeAttachmentsIndex(
      sessionId,
      existing.filter((item: any) => item.id !== attachmentId)
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

const firebaseAttachmentStore: AttachmentStore = {
  async listAttachments<T>(sessionId: string) {
    const snapshot = await attachmentsCollection(sessionId).get();
    return mapAttachmentDocs<T>(snapshot);
  },
  async saveAttachment<T extends { id: string }>(sessionId: string, attachment: T) {
    await attachmentsCollection(sessionId).doc(attachment.id).set(attachment as any, { merge: true });
  },
  async updateAttachment<T extends { id: string }>(sessionId: string, attachmentId: string, updater: (attachment: T) => T) {
    const docRef = attachmentsCollection(sessionId).doc(attachmentId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const current = { id: snapshot.id, ...snapshot.data() } as T;
    const next = updater(current);
    await docRef.set(next as any, { merge: false });
    return next;
  },
  async deleteAttachment<T extends { id: string; relativePath: string }>(sessionId: string, attachmentId: string) {
    const docRef = attachmentsCollection(sessionId).doc(attachmentId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const attachment = { id: snapshot.id, ...snapshot.data() } as T;
    await getStorageBucket().file(attachment.relativePath).delete({ ignoreNotFound: true });
    await docRef.delete();
    return attachment;
  },
  async writeAttachmentFile(sessionId: string, fileName: string, content: Buffer, mimeType?: string) {
    const storagePath = getStorageObjectPath(sessionId, fileName);
    const tempPath = makeTempAttachmentPath(fileName);
    fs.writeFileSync(tempPath, content);

    await getStorageBucket().file(storagePath).save(content, {
      resumable: false,
      metadata: mimeType ? { contentType: mimeType } : undefined,
    });

    return {
      relativePath: storagePath,
      fullPath: tempPath,
      cleanup: () => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      },
    };
  },
  async readAttachmentFile(_sessionId: string, attachmentPath: string) {
    const [buffer] = await getStorageBucket().file(attachmentPath).download();
    return buffer;
  },
  async deleteAllSessionAttachments(sessionId: string) {
    const snapshot = await attachmentsCollection(sessionId).get();
    const files = snapshot.docs.map((doc) => String(doc.data().relativePath || "")).filter(Boolean);

    await Promise.all(
      files.map((filePath) => getStorageBucket().file(filePath).delete({ ignoreNotFound: true }))
    );

    const batch = getFirestoreDb().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  },
};

const ephemeralAttachmentStore: AttachmentStore = {
  async listAttachments<T>(sessionId: string) {
    const snapshot = await attachmentsCollection(sessionId).get();
    return mapAttachmentDocs<T>(snapshot);
  },
  async saveAttachment<T extends { id: string }>(sessionId: string, attachment: T) {
    await attachmentsCollection(sessionId).doc(attachment.id).set(attachment as any, { merge: true });
  },
  async updateAttachment<T extends { id: string }>(sessionId: string, attachmentId: string, updater: (attachment: T) => T) {
    const docRef = attachmentsCollection(sessionId).doc(attachmentId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const current = { id: snapshot.id, ...snapshot.data() } as T;
    const next = updater(current);
    await docRef.set(next as any, { merge: false });
    return next;
  },
  async deleteAttachment<T extends { id: string; relativePath: string }>(sessionId: string, attachmentId: string) {
    const docRef = attachmentsCollection(sessionId).doc(attachmentId);
    const snapshot = await docRef.get();
    if (!snapshot.exists) return null;

    const attachment = { id: snapshot.id, ...snapshot.data() } as T;
    await docRef.delete();
    return attachment;
  },
  async writeAttachmentFile(_sessionId: string, fileName: string, content: Buffer) {
    const tempPath = makeTempAttachmentPath(fileName);
    fs.writeFileSync(tempPath, content);

    return {
      relativePath: `ephemeral://${path.basename(tempPath)}`,
      fullPath: tempPath,
      cleanup: () => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      },
    };
  },
  async readAttachmentFile() {
    throw new Error("Attachment binaries are temporary and are not available for download in ephemeral mode.");
  },
  async deleteAllSessionAttachments(sessionId: string) {
    const snapshot = await attachmentsCollection(sessionId).get();
    const batch = getFirestoreDb().batch();
    snapshot.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  },
};

export function getAttachmentStore(): AttachmentStore {
  const provider = getProvider();
  switch (provider) {
    case "local":
      return localAttachmentStore;
    case "ephemeral":
    case "temporary":
    case "temp":
      return ephemeralAttachmentStore;
    case "firebase":
    case "cloud-storage":
    case "storage":
      return firebaseAttachmentStore;
    default:
      throw new Error(`Unsupported ATTACHMENT_STORE_PROVIDER: ${provider}`);
  }
}
