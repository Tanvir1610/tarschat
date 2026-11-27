import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { mutation, query } from "./_generated/server";
import {
  atLeast,
  canRemoveMessage,
  clampPagination,
  fail,
  getActiveCommunity,
  getMembership,
  publicUser,
  requireRole,
  requireUser,
} from "./lib/community";
import { LIMITS, reportReasonValidator } from "./lib/constants";

const cleanDetails = (raw?: string) => {
  const s = raw?.trim();
  if (!s) return undefined;
  if (s.length > LIMITS.reportDetailsMax) fail("INVALID", `Details are limited to ${LIMITS.reportDetailsMax} characters.`);
  return s;
};

/* ───────── Reports ───────── */

export const reportMessage = mutation({
  args: { messageId: v.id("communityMessages"), reason: reportReasonValidator, details: v.optional(v.string()) },
  handler: async (ctx, { messageId, reason, details }) => {
    const me = await requireUser(ctx);
    const msg = await ctx.db.get(messageId);
    if (!msg) fail("NOT_FOUND", "Message not found.");
    await getActiveCommunity(ctx, msg!.communityId);
    await requireRole(ctx, msg!.communityId, me._id); // only members can report
    if (msg!.senderId === me._id) fail("INVALID", "You can't report your own message.");

    const dupes = await ctx.db.query("communityReports").withIndex("by_reporter_message", (q) => q.eq("reporterId", me._id).eq("messageId", messageId)).take(5);
    if (dupes.some((r) => r.status === "open")) fail("CONFLICT", "You've already reported this message.");

    await ctx.db.insert("communityReports", {
      communityId: msg!.communityId,
      reporterId: me._id,
      reportedUserId: msg!.senderId,
      messageId,
      reason,
      details: cleanDetails(details),
      status: "open",
    });
  },
});

export const reportMember = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users"), reason: reportReasonValidator, details: v.optional(v.string()) },
  handler: async (ctx, { communityId, userId, reason, details }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id);
    if (userId === me._id) fail("INVALID", "You can't report yourself.");
    if (!(await getMembership(ctx, communityId, userId))) fail("NOT_FOUND", "That person isn't a member.");
    await ctx.db.insert("communityReports", {
      communityId,
      reporterId: me._id,
      reportedUserId: userId,
      reason,
      details: cleanDetails(details),
      status: "open",
    });
  },
});

/** Moderation queue — owner and moderators only */
export const listReports = query({
  args: {
    communityId: v.id("communities"),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, { communityId, status, paginationOpts }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "moderator");
    const result = await ctx.db
      .query("communityReports")
      .withIndex("by_community_status", (q) => q.eq("communityId", communityId).eq("status", status))
      .order("desc")
      .paginate(clampPagination(paginationOpts));

    const page = await Promise.all(
      result.page.map(async (r) => {
        const msg = r.messageId ? await ctx.db.get(r.messageId) : null;
        return {
          _id: r._id,
          _creationTime: r._creationTime,
          reason: r.reason,
          details: r.details ?? null,
          status: r.status,
          reporter: publicUser(await ctx.db.get(r.reporterId)),
          reportedUser: publicUser(await ctx.db.get(r.reportedUserId)),
          message: msg ? { _id: msg._id, content: msg.isDeleted ? "" : msg.content, isDeleted: msg.isDeleted } : null,
        };
      })
    );
    return { ...result, page };
  },
});

export const resolveReport = mutation({
  args: {
    reportId: v.id("communityReports"),
    resolution: v.union(v.literal("resolved"), v.literal("dismissed")),
    removeMessage: v.optional(v.boolean()),
  },
  handler: async (ctx, { reportId, resolution, removeMessage }) => {
    const me = await requireUser(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) fail("NOT_FOUND", "Report not found.");
    await getActiveCommunity(ctx, report!.communityId);
    const mine = await requireRole(ctx, report!.communityId, me._id, "moderator");
    if (report!.status !== "open") return;

    if (removeMessage && report!.messageId) {
      const msg = await ctx.db.get(report!.messageId);
      if (msg && !msg.isDeleted) {
        const author = await getMembership(ctx, msg.communityId, msg.senderId);
        if (!canRemoveMessage({ actorId: me._id, actorRole: mine.role, authorId: msg.senderId, authorRole: author?.role ?? null })) {
          fail("FORBIDDEN", "You can't remove this message.");
        }
        await ctx.db.patch(msg._id, { isDeleted: true, deletedBy: me._id });
      }
    }
    await ctx.db.patch(reportId, { status: resolution, resolvedBy: me._id, resolvedAt: Date.now() });
  },
});

/** Open-report count for the settings badge */
export const openReportCount = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    const m = await getMembership(ctx, communityId, me._id);
    if (!m || !atLeast(m.role, "moderator")) return 0;
    const rows = await ctx.db.query("communityReports").withIndex("by_community_status", (q) => q.eq("communityId", communityId).eq("status", "open")).take(100);
    return rows.length;
  },
});

/* ───────── User blocks (hide a person's community messages from you) ───────── */

export const blockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUser(ctx);
    if (userId === me._id) fail("INVALID", "You can't block yourself.");
    if (!(await ctx.db.get(userId))) fail("NOT_FOUND", "That user doesn't exist.");
    const existing = await ctx.db.query("userBlocks").withIndex("by_blocker_blocked", (q) => q.eq("blockerId", me._id).eq("blockedId", userId)).unique();
    if (!existing) await ctx.db.insert("userBlocks", { blockerId: me._id, blockedId: userId });
  },
});

export const unblockUser = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const me = await requireUser(ctx);
    const existing = await ctx.db.query("userBlocks").withIndex("by_blocker_blocked", (q) => q.eq("blockerId", me._id).eq("blockedId", userId)).unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

export const listBlocked = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const rows = await ctx.db.query("userBlocks").withIndex("by_blocker", (q) => q.eq("blockerId", me._id)).take(200);
    return await Promise.all(rows.map(async (b) => publicUser(await ctx.db.get(b.blockedId))!));
  },
});
