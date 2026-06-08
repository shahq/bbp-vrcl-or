import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const attachmentInput = {
  id: v.string(),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
  uploadedAt: v.string(),
  relativePath: v.string(),
  storageId: v.optional(v.id("_storage")),
  extractionStatus: v.union(v.literal("ready"), v.literal("unsupported"), v.literal("error")),
  extractedText: v.string(),
  summary: v.string(),
  note: v.optional(v.string()),
};

function toAttachment(doc: any) {
  if (!doc) return null;

  return {
    id: doc.attachmentId,
    name: doc.name,
    mimeType: doc.mimeType,
    size: doc.size,
    uploadedAt: doc.uploadedAt,
    relativePath: doc.relativePath ?? "",
    storageId: doc.storageId,
    extractionStatus: doc.extractionStatus,
    extractedText: doc.extractedText,
    summary: doc.summary,
    note: doc.note ?? "",
  };
}

async function getAttachmentDoc(ctx: any, sessionId: string, attachmentId: string) {
  const docs = await ctx.db
    .query("attachments")
    .withIndex("by_session", (q: any) => q.eq("sessionId", sessionId))
    .collect();
  return docs.find((doc: any) => doc.attachmentId === attachmentId) ?? null;
}

function toDocument(sessionId: string, attachment: any) {
  const doc: Record<string, unknown> = {
    attachmentId: attachment.id,
    sessionId,
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploadedAt: attachment.uploadedAt,
    relativePath: attachment.relativePath,
    extractionStatus: attachment.extractionStatus,
    extractedText: attachment.extractedText,
    summary: attachment.summary,
    note: attachment.note ?? "",
  };
  if (attachment.storageId) doc.storageId = attachment.storageId;
  return doc;
}

export const generateUploadUrl = mutationGeneric({
  args: {},
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

export const getFileUrl = queryGeneric({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => await ctx.storage.getUrl(args.storageId),
});

export const listBySession = queryGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("attachments")
      .withIndex("by_session_uploaded", (q: any) => q.eq("sessionId", args.sessionId))
      .order("desc")
      .collect();

    return docs.map(toAttachment).filter(Boolean);
  },
});

export const save = mutationGeneric({
  args: { sessionId: v.string(), attachment: v.object(attachmentInput) },
  handler: async (ctx, args) => {
    const existing = await getAttachmentDoc(ctx, args.sessionId, args.attachment.id);
    const doc = toDocument(args.sessionId, args.attachment);
    if (existing) {
      await ctx.db.patch(existing._id, doc);
    } else {
      await ctx.db.insert("attachments", doc);
    }
  },
});

export const remove = mutationGeneric({
  args: { sessionId: v.string(), attachmentId: v.string() },
  handler: async (ctx, args) => {
    const existing = await getAttachmentDoc(ctx, args.sessionId, args.attachmentId);
    if (!existing) return null;

    await ctx.db.delete(existing._id);
    if (existing.storageId) {
      await ctx.storage.delete(existing.storageId as any);
    }

    return toAttachment(existing);
  },
});

export const removeAllForSession = mutationGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("attachments")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    for (const doc of docs) {
      await ctx.db.delete(doc._id);
      if (doc.storageId) {
        await ctx.storage.delete(doc.storageId as any);
      }
    }
  },
});
