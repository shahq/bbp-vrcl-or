import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function getConnectionId(fromCardId: string, toCardId: string, threadId?: string, color?: string, ownerUserId?: string) {
  const ownerKey = ownerUserId || threadId || color || "shared";
  return `${encodeURIComponent(ownerKey)}-${fromCardId}-${toCardId}`;
}

function toConnection(doc: any) {
  if (!doc) return null;

  return {
    id: doc.connectionId,
    session_id: doc.sessionId,
    from_card_id: doc.fromCardId,
    to_card_id: doc.toCardId,
    thread_id: doc.threadId ?? null,
    color: doc.color ?? null,
    owner_user_id: doc.ownerUserId ?? null,
    created_at: doc.createdAt,
  };
}

async function getConnectionDoc(ctx: any, connectionId: string, sessionId?: string) {
  const doc = await ctx.db
    .query("connections")
    .withIndex("by_connection_id", (q: any) => q.eq("connectionId", connectionId))
    .first();
  if (!doc || (sessionId && doc.sessionId !== sessionId)) return null;
  return doc;
}

export const listBySession = queryGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("connections")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    return docs
      .map(toConnection)
      .filter(Boolean)
      .sort((a: any, b: any) => String(a.created_at).localeCompare(String(b.created_at)));
  },
});

export const create = mutationGeneric({
  args: {
    sessionId: v.string(),
    fromCardId: v.string(),
    toCardId: v.string(),
    threadId: v.optional(v.string()),
    color: v.optional(v.string()),
    ownerUserId: v.optional(v.string()),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const connectionId = getConnectionId(args.fromCardId, args.toCardId, args.threadId, args.color, args.ownerUserId);
    const existing = await getConnectionDoc(ctx, connectionId, args.sessionId);
    const payload: Record<string, unknown> = {
      connectionId,
      sessionId: args.sessionId,
      fromCardId: args.fromCardId,
      toCardId: args.toCardId,
      createdAt: existing?.createdAt ?? args.createdAt,
    };
    if (args.threadId !== undefined) payload.threadId = args.threadId;
    if (args.color !== undefined) payload.color = args.color;
    if (args.ownerUserId !== undefined) payload.ownerUserId = args.ownerUserId;

    if (existing) {
      await ctx.db.patch(existing._id, payload);
    } else {
      await ctx.db.insert("connections", payload);
    }

    return toConnection(await getConnectionDoc(ctx, connectionId, args.sessionId));
  },
});

export const remove = mutationGeneric({
  args: { connectionId: v.string(), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const doc = await getConnectionDoc(ctx, args.connectionId, args.sessionId);
    if (!doc) return false;
    await ctx.db.delete(doc._id);
    return true;
  },
});

export const removeForCard = mutationGeneric({
  args: { cardId: v.string(), sessionId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const fromDocs = await ctx.db
      .query("connections")
      .withIndex("by_from_card", (q: any) => q.eq("fromCardId", args.cardId))
      .collect();
    const toDocs = await ctx.db
      .query("connections")
      .withIndex("by_to_card", (q: any) => q.eq("toCardId", args.cardId))
      .collect();
    const docsById = new Map<string, any>();
    for (const doc of [...fromDocs, ...toDocs]) {
      if (!args.sessionId || doc.sessionId === args.sessionId) {
        docsById.set(doc._id, doc);
      }
    }

    for (const doc of docsById.values()) {
      await ctx.db.delete(doc._id);
    }

    return docsById.size > 0;
  },
});

export const replaceBySession = mutationGeneric({
  args: {
    sessionId: v.string(),
    connections: v.array(v.object({
      id: v.string(),
      from: v.string(),
      to: v.string(),
      threadId: v.optional(v.string()),
      color: v.optional(v.string()),
      ownerUserId: v.optional(v.string()),
    })),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("connections")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }
    for (const connection of args.connections) {
      const payload: Record<string, unknown> = {
        connectionId: connection.id,
        sessionId: args.sessionId,
        fromCardId: connection.from,
        toCardId: connection.to,
        createdAt: args.createdAt,
      };
      if (connection.threadId !== undefined) payload.threadId = connection.threadId;
      if (connection.color !== undefined) payload.color = connection.color;
      if (connection.ownerUserId !== undefined) payload.ownerUserId = connection.ownerUserId;
      await ctx.db.insert("connections", payload);
    }
  },
});
