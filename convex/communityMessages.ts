import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  atLeast,
  canRemoveMessage,
  clampPagination,
  cleanMessage,
  fail,
  getActiveCommunity,
  getMembership,
  publicUser,
  requireRole,
  requireUser,
  type Role,
} from "./lib/community";
import { LIMITS } from "./lib/constants";

/** Newest first, paginated. Members only. Blocked senders are hidden server-side. */
export const list = query({
  args: { channelId: v.id("communityChannels"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { channelId, paginationOpts }) => {
    const me = await requireUser(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) fail("NOT_FOUND", "Channel not found.");
    await getActiveCommunity(ctx, channel!.communityId);
    const myMembership = await requireRole(ctx, channel!.communityId, me._id);

    const blocks = await ctx.db.query("userBlocks").withIndex("by_blocker", (q) => q.eq("blockerId", me._id)).take(500);
    const blocked = new Set<string>(blocks.map((b) => b.blockedId));

    const result = await ctx.db
      .query("communityMessages")
      .withIndex("by_channel", (q) => q.eq("channelId", channelId))
      .order("desc")
      .paginate(clampPagination(paginationOpts));

    const users = new Map<string, Promise<Doc<"users"> | null>>();
    const roles = new Map<string, Promise<Role | null>>();
    const getUser = (id: Id<"users">) => (users.get(id) ?? users.set(id, ctx.db.get(id)).get(id)!);
    const getRole = (id: Id<"users">) =>
      roles.get(id) ??
      roles.set(id, getMembership(ctx, channel!.communityId, id).then((m) => m?.role ?? null)).get(id)!;

    const page = await Promise.all(
      result.page.map(async (m) => {
        const authorRole = await getRole(m.senderId);
        const isBlocked = blocked.has(m.senderId) && m.senderId !== me._id;
        const hidden = m.isDeleted || isBlocked;
        return {
          _id: m._id,
          _creationTime: m._creationTime,
          senderId: m.senderId,
          sender: publicUser(await getUser(m.senderId)),
          senderRole: authorRole,
          content: hidden ? "" : m.content, // deleted/blocked bodies never reach the client
          isDeleted: m.isDeleted,
          deletedByModerator: m.isDeleted && m.deletedBy !== undefined && m.deletedBy !== m.senderId,
          blocked: isBlocked && !m.isDeleted,
          canRemove:
            !m.isDeleted &&
            canRemoveMessage({ actorId: me._id, actorRole: myMembership.role, authorId: m.senderId, authorRole }),
        };
      })
    );
    return { ...result, page };
  },
});

export const send = mutation({
  args: { channelId: v.id("communityChannels"), content: v.string() },
  handler: async (ctx, { channelId, content }) => {
    const me = await requireUser(ctx);
    const channel = await ctx.db.get(channelId);
    if (!channel) fail("NOT_FOUND", "Channel not found.");
    const community = await getActiveCommunity(ctx, channel!.communityId);
    const membership = await requireRole(ctx, community._id, me._id);

    if (channel!.postingRestricted && !atLeast(membership.role, "moderator")) {
      fail("FORBIDDEN", `Only moderators can post in #${channel!.name}.`);
    }
    const text = cleanMessage(content);

    // Flood control
    const recent = await ctx.db
      .query("communityMessages")
      .withIndex("by_community_sender", (q) => q.eq("communityId", community._id).eq("senderId", me._id))
      .order("desc")
      .take(LIMITS.rateLimitCount);
    const now = Date.now();
    if (
      recent.length >= LIMITS.rateLimitCount &&
      now - recent[LIMITS.rateLimitCount - 1]._creationTime < LIMITS.rateLimitWindowMs
    ) {
      fail("RATE_LIMITED", "You're sending messages too quickly. Slow down a little.");
    }

    return await ctx.db.insert("communityMessages", {
      communityId: community._id,
      channelId,
      senderId: me._id,
      content: text,
      isDeleted: false,
    });
  },
});

export const remove = mutation({
  args: { messageId: v.id("communityMessages") },
  handler: async (ctx, { messageId }) => {
    const me = await requireUser(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg) fail("NOT_FOUND", "Message not found.");
    await getActiveCommunity(ctx, msg!.communityId);
    const mine = await requireRole(ctx, msg!.communityId, me._id);
    const author = await getMembership(ctx, msg!.communityId, msg!.senderId);

    if (!canRemoveMessage({ actorId: me._id, actorRole: mine.role, authorId: msg!.senderId, authorRole: author?.role ?? null })) {
      fail("FORBIDDEN", "You can't remove this message.");
    }
    if (msg!.isDeleted) return;
    await ctx.db.patch(messageId, { isDeleted: true, deletedBy: me._id });
  },
});
