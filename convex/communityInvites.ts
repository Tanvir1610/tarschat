import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import {
  addMember,
  fail,
  generateInviteCode,
  getActiveCommunity,
  getMembership,
  isBanned,
  publicUser,
  requireRole,
  requireUser,
  summarize,
} from "./lib/community";

const HOUR = 3_600_000;

type Invite = Doc<"communityInvites">;
const usable = (i: Invite, now: number) =>
  i.status === "pending" && i.expiresAt > now && (i.maxUses === undefined || i.uses < i.maxUses);

/** Shareable link (reusable until it expires / hits maxUses / is revoked). Owner or moderator. */
export const createLink = mutation({
  args: {
    communityId: v.id("communities"),
    expiresInHours: v.optional(v.number()),
    maxUses: v.optional(v.number()),
  },
  handler: async (ctx, { communityId, expiresInHours, maxUses }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "moderator");

    const hours = expiresInHours ?? 24 * 7;
    if (!Number.isFinite(hours) || hours < 1 || hours > 24 * 30) fail("INVALID", "Expiry must be between 1 hour and 30 days.");
    if (maxUses !== undefined && (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000)) {
      fail("INVALID", "Max uses must be a whole number between 1 and 1000.");
    }
    const code = generateInviteCode();
    await ctx.db.insert("communityInvites", {
      communityId,
      code,
      inviterId: me._id,
      status: "pending",
      expiresAt: Date.now() + hours * HOUR,
      maxUses,
      uses: 0,
    });
    return { code };
  },
});

/** Invite one specific person (they get it in their Communities inbox). Owner or moderator. */
export const inviteUser = mutation({
  args: { communityId: v.id("communities"), userId: v.id("users") },
  handler: async (ctx, { communityId, userId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "moderator");

    if (!(await ctx.db.get(userId))) fail("NOT_FOUND", "That user doesn't exist.");
    if (await getMembership(ctx, communityId, userId)) fail("CONFLICT", "They're already a member.");
    if (await isBanned(ctx, communityId, userId)) fail("FORBIDDEN", "That user is banned from this community.");

    const now = Date.now();
    const mine = await ctx.db.query("communityInvites").withIndex("by_invitee", (q) => q.eq("inviteeId", userId).eq("status", "pending")).take(50);
    if (mine.some((i) => i.communityId === communityId && i.expiresAt > now)) {
      fail("CONFLICT", "They already have a pending invitation.");
    }
    await ctx.db.insert("communityInvites", {
      communityId,
      code: generateInviteCode(),
      inviterId: me._id,
      inviteeId: userId,
      status: "pending",
      expiresAt: now + 7 * 24 * HOUR,
      uses: 0,
    });
  },
});

/** People who could be invited (no emails exposed) */
export const searchUsers = query({
  args: { communityId: v.id("communities"), query: v.string() },
  handler: async (ctx, { communityId, query: text }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "moderator");
    const term = text.trim().slice(0, 50);
    if (term.length < 2) return [];
    const found = await ctx.db.query("users").withSearchIndex("search_name", (q) => q.search("name", term)).take(15);
    const out = [];
    for (const u of found) {
      if (u._id === me._id) continue;
      if (await getMembership(ctx, communityId, u._id)) continue;
      if (await isBanned(ctx, communityId, u._id)) continue;
      out.push(publicUser(u)!);
    }
    return out;
  },
});

export const listForCommunity = query({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, communityId, me._id, "moderator");
    const now = Date.now();
    const rows = await ctx.db.query("communityInvites").withIndex("by_community", (q) => q.eq("communityId", communityId)).order("desc").take(100);
    return await Promise.all(
      rows
        .filter((i) => usable(i, now))
        .map(async (i) => ({
          _id: i._id,
          code: i.code,
          expiresAt: i.expiresAt,
          maxUses: i.maxUses ?? null,
          uses: i.uses,
          invitee: i.inviteeId ? publicUser(await ctx.db.get(i.inviteeId)) : null,
        }))
    );
  },
});

export const revoke = mutation({
  args: { inviteId: v.id("communityInvites") },
  handler: async (ctx, { inviteId }) => {
    const me = await requireUser(ctx);
    const inv = await ctx.db.get(inviteId);
    if (!inv) fail("NOT_FOUND", "Invitation not found.");
    await requireRole(ctx, inv!.communityId, me._id, "moderator");
    if (inv!.status === "pending") await ctx.db.patch(inviteId, { status: "revoked" });
  },
});

/** My pending direct invitations */
export const myInvites = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const now = Date.now();
    const rows = await ctx.db.query("communityInvites").withIndex("by_invitee", (q) => q.eq("inviteeId", me._id).eq("status", "pending")).take(50);
    const out = [];
    for (const i of rows) {
      if (i.expiresAt <= now) continue;
      const c = await ctx.db.get(i.communityId);
      if (!c || c.status !== "active") continue;
      out.push({
        _id: i._id,
        community: await summarize(ctx, c, me._id),
        invitedBy: publicUser(await ctx.db.get(i.inviterId))?.name ?? "Someone",
      });
    }
    return out;
  },
});

export const respond = mutation({
  args: { inviteId: v.id("communityInvites"), accept: v.boolean() },
  handler: async (ctx, { inviteId, accept }) => {
    const me = await requireUser(ctx);
    const inv = await ctx.db.get(inviteId);
    // Same error for "not yours" and "doesn't exist" so ids can't be probed
    if (!inv || inv.inviteeId !== me._id) fail("NOT_FOUND", "Invitation not found.");
    if (!usable(inv!, Date.now())) fail("EXPIRED", "This invitation is no longer valid.");
    const community = await getActiveCommunity(ctx, inv!.communityId);

    if (!accept) {
      await ctx.db.patch(inviteId, { status: "declined" });
      return null;
    }
    await addMember(ctx, community._id, me._id);
    await ctx.db.patch(inviteId, { status: "accepted", uses: inv!.uses + 1 });
    return { slug: community.slug };
  },
});

/** Look up what a code leads to before joining (valid codes only) */
export const previewCode = query({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const me = await requireUser(ctx);
    const inv = await ctx.db.query("communityInvites").withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase())).unique();
    if (!inv || !usable(inv, Date.now()) || (inv.inviteeId && inv.inviteeId !== me._id)) return null;
    const c = await ctx.db.get(inv.communityId);
    if (!c || c.status !== "active") return null;
    if (await isBanned(ctx, c._id, me._id)) return null;
    return await summarize(ctx, c, me._id);
  },
});

export const joinWithCode = mutation({
  args: { code: v.string() },
  handler: async (ctx, { code }) => {
    const me = await requireUser(ctx);
    const inv = await ctx.db.query("communityInvites").withIndex("by_code", (q) => q.eq("code", code.trim().toUpperCase())).unique();
    if (!inv || (inv.inviteeId && inv.inviteeId !== me._id)) fail("NOT_FOUND", "That invite link isn't valid.");
    if (!usable(inv!, Date.now())) fail("EXPIRED", "That invite link has expired or was already used up.");
    const community = await getActiveCommunity(ctx, inv!.communityId);

    const already = await getMembership(ctx, community._id, me._id);
    if (!already) {
      await addMember(ctx, community._id, me._id); // throws if banned
      await ctx.db.patch(inv!._id, {
        uses: inv!.uses + 1,
        // a direct invite is single-use
        ...(inv!.inviteeId ? { status: "accepted" as const } : {}),
      });
    }
    return { slug: community.slug };
  },
});
