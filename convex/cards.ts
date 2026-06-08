import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

function toCard(doc: any) {
  if (!doc) return null;

  return {
    id: doc.cardId,
    session_id: doc.sessionId,
    section: doc.section,
    file_path: `convex://${doc.cardId}`,
    order_index: doc.orderIndex,
    starred: doc.starred,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    content: doc.content,
  };
}

async function getCardDoc(ctx: any, cardId: string) {
  return await ctx.db
    .query("cards")
    .withIndex("by_card_id", (q: any) => q.eq("cardId", cardId))
    .first();
}

export const listBySession = queryGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("cards")
      .withIndex("by_session", (q: any) => q.eq("sessionId", args.sessionId))
      .collect();

    return docs
      .map(toCard)
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const sectionCompare = String(a.section).localeCompare(String(b.section));
        return sectionCompare || Number(a.order_index) - Number(b.order_index);
      });
  },
});

export const nextOrderIndex = queryGeneric({
  args: { sessionId: v.string(), section: v.string() },
  handler: async (ctx, args) => {
    const docs = await ctx.db
      .query("cards")
      .withIndex("by_session_section_order", (q: any) =>
        q.eq("sessionId", args.sessionId).eq("section", args.section)
      )
      .order("desc")
      .take(1);

    return docs.length > 0 ? docs[0].orderIndex + 1 : 0;
  },
});

export const create = mutationGeneric({
  args: {
    sessionId: v.string(),
    cardId: v.string(),
    section: v.string(),
    content: v.string(),
    orderIndex: v.number(),
    starred: v.boolean(),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await getCardDoc(ctx, args.cardId);
    if (existing) {
      throw new Error(`Card already exists: ${args.cardId}`);
    }

    await ctx.db.insert("cards", args);
    return toCard(await getCardDoc(ctx, args.cardId));
  },
});

export const update = mutationGeneric({
  args: {
    sessionId: v.string(),
    cardId: v.string(),
    section: v.optional(v.string()),
    orderIndex: v.optional(v.number()),
    starred: v.optional(v.boolean()),
    content: v.optional(v.string()),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await getCardDoc(ctx, args.cardId);
    if (!doc || doc.sessionId !== args.sessionId) return false;

    const patch: Record<string, unknown> = { updatedAt: args.updatedAt };
    if (args.section !== undefined) patch.section = args.section;
    if (args.orderIndex !== undefined) patch.orderIndex = args.orderIndex;
    if (args.starred !== undefined) patch.starred = args.starred;
    if (args.content !== undefined) patch.content = args.content;

    await ctx.db.patch(doc._id, patch);
    return true;
  },
});

export const remove = mutationGeneric({
  args: { sessionId: v.string(), cardId: v.string() },
  handler: async (ctx, args) => {
    const doc = await getCardDoc(ctx, args.cardId);
    if (!doc || doc.sessionId !== args.sessionId) return false;
    await ctx.db.delete(doc._id);
    return true;
  },
});

export const reorder = mutationGeneric({
  args: { sessionId: v.string(), section: v.string(), cardIds: v.array(v.string()), updatedAt: v.string() },
  handler: async (ctx, args) => {
    for (let index = 0; index < args.cardIds.length; index++) {
      const doc = await getCardDoc(ctx, args.cardIds[index]);
      if (!doc || doc.sessionId !== args.sessionId || doc.section !== args.section) continue;
      await ctx.db.patch(doc._id, { orderIndex: index, updatedAt: args.updatedAt });
    }
    return true;
  },
});
