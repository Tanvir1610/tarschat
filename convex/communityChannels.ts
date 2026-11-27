import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  cleanName,
  fail,
  getActiveCommunity,
  requireRole,
  requireUser,
  slugify,
} from "./lib/community";
import { LIMITS } from "./lib/constants";

const cleanChannelDescription = (raw: string | undefined) => {
  const s = (raw ?? "").trim();
  if (s.length > LIMITS.channelDescMax) fail("INVALID", `Channel description is limited to ${LIMITS.channelDescMax} characters.`);
  if (/[\u0000-\u001f\u007f]/.test(s)) fail("INVALID", "Channel description contains invalid characters.");
  return s || undefined;
};

export const list = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id);
    const rows = await ctx.db
      .query("communityChannels")
      .withIndex("by_community", (q) => q.eq("communityId", communityId))
      .collect();
    return rows.sort((a, b) => a.position - b.position);
  },
});

export const create = mutation({
  args: {
    communityId: v.id("communities"),
    name: v.string(),
    description: v.optional(v.string()),
    postingRestricted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, args.communityId);
    await requireRole(ctx, args.communityId, me._id, "owner");

    const name = cleanName(args.name, "Channel name", 2, LIMITS.channelNameMax);
    const slug = slugify(name);
    if (!slug) fail("INVALID", "Channel name must contain letters or numbers.");

    const existing = await ctx.db
      .query("communityChannels")
      .withIndex("by_community", (q) => q.eq("communityId", args.communityId))
      .collect();
    if (existing.length >= LIMITS.maxChannels) fail("LIMIT", `A community can have up to ${LIMITS.maxChannels} channels.`);
    if (existing.some((c) => c.slug === slug)) fail("CONFLICT", "A channel with that name already exists.");

    return await ctx.db.insert("communityChannels", {
      communityId: args.communityId,
      name: name.toLowerCase(),
      slug,
      description: cleanChannelDescription(args.description),
      kind: "custom",
      postingRestricted: args.postingRestricted ?? false,
      position: Math.max(-1, ...existing.map((c) => c.position)) + 1,
    });
  },
});

export const update = mutation({
  args: {
    channelId: v.id("communityChannels"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    postingRestricted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const channel = await ctx.db.get(args.channelId);
    if (!channel) fail("NOT_FOUND", "Channel not found.");
    await getActiveCommunity(ctx, channel!.communityId);
    await requireRole(ctx, channel!.communityId, me._id, "owner");

    const patch: Record<string, unknown> = {};
    if (args.description !== undefined) patch.description = cleanChannelDescription(args.description);
    // Built-in channels keep their name and posting rules
    if (channel!.kind === "custom") {
      if (args.postingRestricted !== undefined) patch.postingRestricted = args.postingRestricted;
      if (args.name !== undefined) {
        const name = cleanName(args.name, "Channel name", 2, LIMITS.channelNameMax);
        const slug = slugify(name);
        if (!slug) fail("INVALID", "Channel name must contain letters or numbers.");
        const dupes = await ctx.db
          .query("communityChannels")
          .withIndex("by_community_slug", (q) => q.eq("communityId", channel!.communityId).eq("slug", slug))
          .collect();
        if (dupes.some((d) => d._id !== channel!._id)) fail("CONFLICT", "A channel with that name already exists.");
        patch.name = name.toLowerCase();
        patch.slug = slug;
      }
    }
    await ctx.db.patch(channel!._id, patch);
  },
});

export const remove = mutation({
  args: { channelId: v.id("communityChannels") },
  handler: async (ctx, { channelId }) => {
    const me = await requireUser(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) fail("NOT_FOUND", "Channel not found.");
    await requireRole(ctx, channel!.communityId, me._id, "owner");
    if (channel!.kind !== "custom") fail("FORBIDDEN", "Built-in channels can't be deleted.");
    await ctx.db.delete(channelId);
    await ctx.scheduler.runAfter(0, internal.communityChannels.purgeMessages, { channelId });
  },
});

export const purgeMessages = internalMutation({
  args: { channelId: v.id("communityChannels") },
  handler: async (ctx, { channelId }) => {
    const BATCH = 200;
    const rows = await ctx.db.query("communityMessages").withIndex("by_channel", (q) => q.eq("channelId", channelId)).take(BATCH);
    for (const r of rows) await ctx.db.delete(r._id);
    if (rows.length === BATCH) await ctx.scheduler.runAfter(0, internal.communityChannels.purgeMessages, { channelId });
  },
});
