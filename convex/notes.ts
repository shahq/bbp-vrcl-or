import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const DEFAULT_NOTE_ID = "session-notes";
const createdBy = v.object({
  userId: v.optional(v.string()),
  name: v.optional(v.string()),
  role: v.optional(v.union(v.literal("admin"), v.literal("participant"))),
});

const noteInput = {
  id: v.optional(v.string()),
  title: v.optional(v.string()),
  content: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  updatedAt: v.optional(v.string()),
  createdBy: v.optional(createdBy),
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeNote(input: any, fallbackId = DEFAULT_NOTE_ID) {
  const now = nowIso();
  return {
    id: String(input.id || fallbackId),
    title: String(input.title || "Notes"),
    content: String(input.content || ""),
    createdAt: String(input.createdAt || input.updatedAt || now),
    updatedAt: String(input.updatedAt || now),
    ...(input.createdBy ? { createdBy: input.createdBy } : {}),
  };
}

function toNote(doc: any) {
  if (!doc) return null;

  return {
    id: doc.noteId,
    title: doc.title,
    content: doc.content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
    ...(doc.createdBy ? { createdBy: doc.createdBy } : {}),
  };
}

async function getNoteDoc(ctx: any, sessionId: string, noteId: string) {
  return await ctx.db
    .query("notes")
    .withIndex("by_session_note", (q: any) => q.eq("sessionId", sessionId).eq("noteId", noteId))
    .first();
}

export const listBySession = queryGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("notes")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    return docs
      .map(toNote)
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.createdAt).localeCompare(String(b.createdAt)));
  },
});

export const upsert = mutationGeneric({
  args: {
    sessionId: v.string(),
    note: v.object(noteInput),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const normalized = normalizeNote({ ...args.note, updatedAt: args.updatedAt });
    const existing = await getNoteDoc(ctx, args.sessionId, normalized.id);
    if (existing) {
      const next: Record<string, unknown> = {
        noteId: normalized.id,
        title: normalized.title,
        content: normalized.content,
        createdAt: existing.createdAt,
        updatedAt: normalized.updatedAt,
      };
      if (normalized.createdBy !== undefined) next.createdBy = normalized.createdBy;
      await ctx.db.patch(existing._id, next);
      return toNote({ ...existing, ...next });
    }

    const payload: Record<string, unknown> = {
      noteId: normalized.id,
      sessionId: args.sessionId,
      title: normalized.title,
      content: normalized.content,
      createdAt: normalized.createdAt,
      updatedAt: normalized.updatedAt,
    };
    if (normalized.createdBy !== undefined) payload.createdBy = normalized.createdBy;
    await ctx.db.insert("notes", payload);

    return normalized;
  },
});

export const remove = mutationGeneric({
  args: { sessionId: v.string(), noteId: v.string() },
  handler: async (ctx, args) => {
    const doc = await getNoteDoc(ctx, args.sessionId, args.noteId);
    if (!doc) return false;
    await ctx.db.delete(doc._id);
    return true;
  },
});

export const replaceBySession = mutationGeneric({
  args: {
    sessionId: v.string(),
    notes: v.array(v.object(noteInput)),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("notes")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    const normalized = args.notes.map((note: any, index: number) =>
      normalizeNote(note, index === 0 ? DEFAULT_NOTE_ID : `note-${index}`)
    );
    for (const note of normalized) {
      const payload: Record<string, unknown> = {
        noteId: note.id,
        sessionId: args.sessionId,
        title: note.title,
        content: note.content,
        createdAt: note.createdAt,
        updatedAt: note.updatedAt,
      };
      if (note.createdBy !== undefined) payload.createdBy = note.createdBy;
      await ctx.db.insert("notes", payload);
    }

    return normalized;
  },
});
