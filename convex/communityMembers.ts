import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  clampPagination,
  fail,
  getActiveCommunity,
  getMembership,
  publicUser,
  removeMember,
  requireRole,
  requireUser,
} from "./lib/community";
import { LIMITS } from "./lib/constants";

type MemberRow = Doc<"communityMembers">;
const shape = async (ctx: any, m: MemberRow) => {
  const u = (await ctx.db.get(m.userId)) as Doc<"users"> | null;
  return { userId: m.userId, role: m.role, joinedAt: m.joinedAt, user: publicUser(u) };
};

/** Owner + moderators (small, always shown first) */
export const listStaff = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id);
    const [owners, mods] = await Promise.all(
      (["owner", "moderator"] as const).map((role) =>
        ctx.db
          .query("communityMembers")
          .withIndex("by_community_role", (q) => q.eq("communityId", communityId).eq("role", role))
          .take(LIMITS.maxModerators + 1)
      )
    );
    return await Promise.all([...owners, ...mods].map((m) => shape(ctx, m)));
  },
});

/** Regular members, newest first, paginated */
export const listMembers = query({
  args: { communityId: v.id("communities"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { communityId, paginationOpts }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id);
    const result = await ctx.db
      .query("communityMembers")
      .withIndex("by_community_role", (q) => q.eq("communityId", communityId).eq("role", "member"))
      .order("desc")
      .paginate(clampPagination(paginationOpts));
    return { ...result, page: await Promise.all(result.page.map((m) => shape(ctx, m))) };
  },
});

export const setRole = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users"), role: v.union(v.literal("moderator"), v.literal("member")) },
  handler: async (ctx, { communityId, userId, role }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "owner");
    const target = await getMembership(ctx, communityId, userId);
    if (!target) fail("NOT_FOUND", "That person isn't a member.");
    if (target!.role === "owner") fail("FORBIDDEN", "The owner's role can't be changed.");
    if (target!.role === role) return;

    if (role === "moderator") {
      const mods = await ctx.db
        .query("communityMembers")
        .withIndex("by_community_role", (q) => q.eq("communityId", communityId).eq("role", "moderator"))
        .take(LIMITS.maxModerators + 1);
      if (mods.length >= LIMITS.maxModerators) fail("LIMIT", `A community can have up to ${LIMITS.maxModerators} moderators.`);
    }
    await ctx.db.patch(target!._id, { role });
  },
});

export const remove = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users") },
  handler: async (ctx, { communityId, userId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "owner");
    const target = await getMembership(ctx, communityId, userId);
    if (!target) fail("NOT_FOUND", "That person isn't a member.");
    if (target!.role === "owner") fail("FORBIDDEN", "The owner can't be removed.");
    await removeMember(ctx, communityId, userId);
  },
});

export const ban = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users"), reason: v.optional(v.string()) },
  handler: async (ctx, { communityId, userId, reason }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "owner");
    if (userId === me._id) fail("INVALID", "You can't ban yourself.");
    const target = await getMembership(ctx, communityId, userId);
    if (target?.role === "owner") fail("FORBIDDEN", "The owner can't be banned.");
    const cleaned = reason?.trim().slice(0, 200) || undefined;

    await removeMember(ctx, communityId, userId);
    const existing = await ctx.db
      .query("communityBans")
      .withIndex("by_community_user", (q) => q.eq("communityId", communityId).eq("userId", userId))
      .unique();
    if (!existing) await ctx.db.insert("communityBans", { communityId, userId, bannedBy: me._id, reason: cleaned });

    // Revoke any invitations that would let them straight back in
    const invites = await ctx.db.query("communityInvites").withIndex("by_community", (q) => q.eq("communityId", communityId)).collect();
    for (const i of invites) {
      if (i.inviteeId === userId && i.status === "pending") await ctx.db.patch(i._id, { status: "revoked" });
    }
  },
});

export const unban = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users") },
  handler: async (ctx, { communityId, userId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "owner");
    const ban = await ctx.db
      .query("communityBans")
      .withIndex("by_community_user", (q) => q.eq("communityId", communityId).eq("userId", userId))
      .unique();
    if (ban) await ctx.db.delete(ban._id);
  },
});

export const listBans = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "owner");
    const bans = await ctx.db.query("communityBans").withIndex("by_community", (q) => q.eq("communityId", communityId)).take(100);
    return await Promise.all(
      bans.map(async (b) => ({ userId: b.userId, reason: b.reason ?? null, user: publicUser(await ctx.db.get(b.userId)) }))
    );
  },
});
