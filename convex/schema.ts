import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const timerControlMode = v.union(v.literal("admin"), v.literal("everyone"));
const extractionStatus = v.union(v.literal("ready"), v.literal("unsupported"), v.literal("error"));

export default defineSchema({
  sessions: defineTable({
    sessionId: v.string(),
    name: v.string(),
    passwordHash: v.optional(v.string()),
    createdAt: v.string(),
    updatedAt: v.string(),
    projectClient: v.optional(v.string()),
    projectBackground: v.optional(v.string()),
    projectNotes: v.optional(v.string()),
    onboardingCompleted: v.boolean(),
    timerControlMode,
    isArchived: v.boolean(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_archived_updated", ["isArchived", "updatedAt"]),

  adminSessions: defineTable({
    sessionId: v.string(),
    createdAt: v.string(),
    expiresAt: v.string(),
  })
    .index("by_session_id", ["sessionId"])
    .index("by_expires_at", ["expiresAt"]),

  cards: defineTable({
    cardId: v.string(),
    sessionId: v.string(),
    section: v.string(),
    content: v.string(),
    orderIndex: v.number(),
    starred: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_card_id", ["cardId"])
    .index("by_session", ["sessionId"])
    .index("by_session_section_order", ["sessionId", "section", "orderIndex"]),

  connections: defineTable({
    connectionId: v.string(),
    sessionId: v.string(),
    fromCardId: v.string(),
    toCardId: v.string(),
    threadId: v.optional(v.string()),
    color: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    createdAt: v.string(),
  })
    .index("by_connection_id", ["connectionId"])
    .index("by_session", ["sessionId"])
    .index("by_from_card", ["fromCardId"])
    .index("by_to_card", ["toCardId"]),

  notes: defineTable({
    noteId: v.string(),
    sessionId: v.string(),
    title: v.string(),
    content: v.string(),
    createdAt: v.string(),
    updatedAt: v.string(),
    createdBy: v.optional(v.object({
      userId: v.optional(v.string()),
      name: v.optional(v.string()),
      role: v.optional(v.union(v.literal("admin"), v.literal("participant"))),
    })),
  })
    .index("by_note_id", ["noteId"])
    .index("by_session_note", ["sessionId", "noteId"])
    .index("by_session", ["sessionId"])
    .index("by_session_updated", ["sessionId", "updatedAt"]),

  attachments: defineTable({
    attachmentId: v.string(),
    sessionId: v.string(),
    name: v.string(),
    mimeType: v.string(),
    size: v.number(),
    uploadedAt: v.string(),
    storageId: v.optional(v.id("_storage")),
    relativePath: v.optional(v.string()),
    extractionStatus,
    extractedText: v.string(),
    summary: v.string(),
    note: v.optional(v.string()),
  })
    .index("by_attachment_id", ["attachmentId"])
    .index("by_session", ["sessionId"])
    .index("by_session_uploaded", ["sessionId", "uploadedAt"]),
});
