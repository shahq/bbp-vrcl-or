import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

const timerControlMode = v.union(v.literal("admin"), v.literal("everyone"));

function toSession(doc: any) {
  if (!doc || doc.isArchived) return null;

  return {
    id: doc.sessionId,
    name: doc.name,
    password_hash: doc.passwordHash ?? null,
    created_at: doc.createdAt,
    updated_at: doc.updatedAt,
    project_client: doc.projectClient ?? "",
    project_background: doc.projectBackground ?? "",
    project_notes: doc.projectNotes ?? "",
    onboarding_completed: doc.onboardingCompleted,
    timer_control_mode: doc.timerControlMode,
    is_archived: doc.isArchived,
  };
}

async function getSessionDoc(ctx: any, sessionId: string) {
  return await ctx.db
    .query("sessions")
    .withIndex("by_session_id", (q: any) => q.eq("sessionId", sessionId))
    .first();
}

export const get = queryGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => toSession(await getSessionDoc(ctx, args.sessionId)),
});

export const list = queryGeneric({
  args: {},
  handler: async (ctx) => {
    const docs = await ctx.db
      .query("sessions")
      .withIndex("by_archived_updated", (q: any) => q.eq("isArchived", false))
      .order("desc")
      .collect();
    return docs.map(toSession).filter(Boolean);
  },
});

export const create = mutationGeneric({
  args: {
    sessionId: v.string(),
    name: v.string(),
    passwordHash: v.optional(v.string()),
    projectClient: v.optional(v.string()),
    projectBackground: v.optional(v.string()),
    projectNotes: v.optional(v.string()),
    timerControlMode: timerControlMode,
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await getSessionDoc(ctx, args.sessionId);
    if (existing) {
      throw new Error(`Session already exists: ${args.sessionId}`);
    }

    await ctx.db.insert("sessions", {
      sessionId: args.sessionId,
      name: args.name,
      passwordHash: args.passwordHash,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      projectClient: args.projectClient ?? "",
      projectBackground: args.projectBackground ?? "",
      projectNotes: args.projectNotes ?? "",
      onboardingCompleted: false,
      timerControlMode: args.timerControlMode,
      isArchived: false,
    });

    return toSession(await getSessionDoc(ctx, args.sessionId));
  },
});

export const update = mutationGeneric({
  args: {
    sessionId: v.string(),
    name: v.optional(v.string()),
    projectClient: v.optional(v.string()),
    projectBackground: v.optional(v.string()),
    projectNotes: v.optional(v.string()),
    onboardingCompleted: v.optional(v.boolean()),
    timerControlMode: v.optional(timerControlMode),
    isArchived: v.optional(v.boolean()),
    passwordHash: v.optional(v.union(v.string(), v.null())),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await getSessionDoc(ctx, args.sessionId);
    if (!doc) return false;

    const patch: Record<string, unknown> = { updatedAt: args.updatedAt };
    if (args.name !== undefined) patch.name = args.name;
    if (args.projectClient !== undefined) patch.projectClient = args.projectClient;
    if (args.projectBackground !== undefined) patch.projectBackground = args.projectBackground;
    if (args.projectNotes !== undefined) patch.projectNotes = args.projectNotes;
    if (args.onboardingCompleted !== undefined) patch.onboardingCompleted = args.onboardingCompleted;
    if (args.timerControlMode !== undefined) patch.timerControlMode = args.timerControlMode;
    if (args.isArchived !== undefined) patch.isArchived = args.isArchived;
    if (args.passwordHash !== undefined) patch.passwordHash = args.passwordHash ?? undefined;

    await ctx.db.patch(doc._id, patch);
    return true;
  },
});

export const remove = mutationGeneric({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const doc = await getSessionDoc(ctx, args.sessionId);
    if (!doc) return false;
    await ctx.db.delete(doc._id);
    return true;
  },
});
