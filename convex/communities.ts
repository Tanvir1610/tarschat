import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { internal } from "./_generated/api";
import { internalMutation, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  addMember,
  clampPagination,
  cleanDescription,
  cleanName,
  cleanSlug,
  fail,
  getActiveCommunity,
  getMembership,
  isBanned,
  requireRole,
  requireUser,
  slugProblem,
  summarize,
  removeMember,
  type Ctx,
} from "./lib/community";
import { ALLOWED_ICON_TYPES, CATEGORIES, LIMITS, categoryValidator, visibilityValidator } from "./lib/constants";

const DAY = 86_400_000;

/* ───────── helpers ───────── */

/** Make sure an uploaded icon really is a small image (checked server-side, not trusted from the client) */
async function validateIcon(ctx: Ctx & { storage: any }, storageId: Id<"_storage">) {
  const meta = await ctx.db.system.get(storageId);
  if (!meta) fail("INVALID", "The uploaded image could not be found.");
  const ok = ALLOWED_ICON_TYPES.includes(meta!.contentType ?? "") && meta!.size <= LIMITS.iconMaxBytes;
  if (!ok) {
    await (ctx as any).storage.delete(storageId);
    fail("INVALID", "Icon must be a PNG, JPG, WEBP or GIF under 2 MB.");
  }
}

async function inviteGrantsAccess(ctx: Ctx, community: Doc<"communities">, userId: Id<"users">, code?: string) {
  const now = Date.now();
  if (code) {
    const inv = await ctx.db.query("communityInvites").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (
      inv &&
      inv.communityId === community._id &&
      inv.status === "pending" &&
      inv.expiresAt > now &&
      (inv.maxUses === undefined || inv.uses < inv.maxUses) &&
      (inv.inviteeId === undefined || inv.inviteeId === userId)
    ) {
      return true;
    }
  }
  const direct = await ctx.db
    .query("communityInvites")
    .withIndex("by_invitee", (q) => q.eq("inviteeId", userId).eq("status", "pending"))
    .take(50);
  return direct.some((i) => i.communityId === community._id && i.expiresAt > now);
}

/* ───────── discovery (public communities only) ───────── */

export const listPublic = query({
  args: { category: v.optional(categoryValidator), paginationOpts: paginationOptsValidator },
  handler: async (ctx, { category, paginationOpts }) => {
    const me = await requireUser(ctx);
    const opts = clampPagination(paginationOpts);
    const result = category
      ? await ctx.db
          .query("communities")
          .withIndex("by_category_members", (q) =>
            q.eq("category", category).eq("visibility", "public").eq("status", "active")
          )
          .order("desc")
          .paginate(opts)
      : await ctx.db
          .query("communities")
          .withIndex("by_public_members", (q) => q.eq("visibility", "public").eq("status", "active"))
          .order("desc")
          .paginate(opts);
    return { ...result, page: await Promise.all(result.page.map((c) => summarize(ctx, c, me._id))) };
  },
});

export const search = query({
  args: { query: v.string(), category: v.optional(categoryValidator) },
  handler: async (ctx, { query: text, category }) => {
    const me = await requireUser(ctx);
    const term = text.trim().slice(0, 80);
    if (term.length < 2) return [];

    const run = (index: "search_name" | "search_description", field: "name" | "description") =>
      ctx.db
        .query("communities")
        .withSearchIndex(index, (q) => {
          const base = q.search(field, term).eq("visibility", "public").eq("status", "active");
          return category ? base.eq("category", category) : base;
        })
        .take(20);

    const [byName, byDesc] = await Promise.all([run("search_name", "name"), run("search_description", "description")]);

    // Matching a category label ("music") should surface that category too
    const lowered = term.toLowerCase();
    const cat = CATEGORIES.find((c) => c.id === lowered || c.label.toLowerCase() === lowered);
    const byCategory =
      cat && (!category || category === cat.id)
        ? await ctx.db
            .query("communities")
            .withIndex("by_category_members", (q) =>
              q.eq("category", cat.id).eq("visibility", "public").eq("status", "active")
            )
            .order("desc")
            .take(20)
        : [];

    const seen = new Set<string>();
    const merged = [...byName, ...byCategory, ...byDesc].filter((c) => {
      if (seen.has(c._id)) return false;
      seen.add(c._id);
      return true;
    });
    return await Promise.all(merged.slice(0, 30).map((c) => summarize(ctx, c, me._id)));
  },
});

/** Featured = the largest public communities */
export const featured = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const top = await ctx.db
      .query("communities")
      .withIndex("by_public_members", (q) => q.eq("visibility", "public").eq("status", "active"))
      .order("desc")
      .take(6);
    return await Promise.all(top.map((c) => summarize(ctx, c, me._id)));
  },
});

/** Trending = most new members + messages in the last 7 days (bounded scan of the 100 largest communities) */
export const trending = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const since = Date.now() - 7 * DAY;
    const candidates = await ctx.db
      .query("communities")
      .withIndex("by_public_members", (q) => q.eq("visibility", "public").eq("status", "active"))
      .order("desc")
      .take(100);

    const scored = await Promise.all(
      candidates.map(async (c) => {
        const [messages, joins] = await Promise.all([
          ctx.db
            .query("communityMessages")
            .withIndex("by_community", (q) => q.eq("communityId", c._id).gt("_creationTime", since))
            .take(101),
          ctx.db
            .query("communityMembers")
            .withIndex("by_community_joined", (q) => q.eq("communityId", c._id).gt("joinedAt", since))
            .take(101),
        ]);
        return { c, score: messages.length + joins.length * 3 };
      })
    );
    const top = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score).slice(0, 6);
    return await Promise.all(top.map(async ({ c, score }) => ({ ...(await summarize(ctx, c, me._id)), score })));
  },
});

/** Communities I belong to (private ones included — only mine) */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const me = await requireUser(ctx);
    const memberships = await ctx.db
      .query("communityMembers")
      .withIndex("by_user", (q) => q.eq("userId", me._id))
      .take(LIMITS.maxJoinedCommunities);
    const out = (
      await Promise.all(
        memberships.map(async (m) => {
          const c = await ctx.db.get(m.communityId);
          return c && c.status === "active" ? await summarize(ctx, c, me._id) : null;
        })
      )
    ).filter((c): c is NonNullable<typeof c> => c !== null);
    return out.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const isSlugAvailable = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    await requireUser(ctx);
    const problem = slugProblem(slug);
    if (problem) return { available: false, reason: problem };
    const existing = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug.trim().toLowerCase()))
      .unique();
    return existing ? { available: false, reason: "That username is taken." } : { available: true, reason: null };
  },
});

/**
 * Community page data. Private communities look identical to non-existent ones
 * unless you are a member or hold a valid invitation — so slugs can't be probed.
 */
export const getPreview = query({
  args: { slug: v.string(), inviteCode: v.optional(v.string()) },
  handler: async (ctx, { slug, inviteCode }) => {
    const me = await requireUser(ctx);
    const community = await ctx.db
      .query("communities")
      .withIndex("by_slug", (q) => q.eq("slug", slug.trim().toLowerCase()))
      .unique();
    if (!community || community.status !== "active") return { status: "unavailable" as const };

    const membership = await getMembership(ctx, community._id, me._id);
    if (!membership && (await isBanned(ctx, community._id, me._id))) {
      return { status: "banned" as const, name: community.name };
    }
    const invited = !membership && (await inviteGrantsAccess(ctx, community, me._id, inviteCode));
    if (community.visibility === "private" && !membership && !invited) return { status: "unavailable" as const };

    const channels = await ctx.db
      .query("communityChannels")
      .withIndex("by_community", (q) => q.eq("communityId", community._id))
      .collect();
    return {
      status: "ok" as const,
      community: await summarize(ctx, community, me._id),
      myRole: membership?.role ?? null,
      invited,
      channels: channels
        .sort((a, b) => a.position - b.position)
        .map((c) => ({
          _id: c._id,
          name: c.name,
          slug: c.slug,
          description: c.description ?? null,
          kind: c.kind,
          postingRestricted: c.postingRestricted,
        })),
    };
  },
});

/* ───────── create / update ───────── */

export const generateIconUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.storage.generateUploadUrl();
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.string(),
    category: categoryValidator,
    visibility: visibilityValidator,
    iconStorageId: v.optional(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const name = cleanName(args.name);
    const slug = cleanSlug(args.slug);
    const description = cleanDescription(args.description);

    const owned = await ctx.db
      .query("communities")
      .withIndex("by_owner", (q) => q.eq("ownerId", me._id))
      .take(LIMITS.maxOwnedCommunities + 1);
    if (owned.filter((c) => c.status === "active").length >= LIMITS.maxOwnedCommunities) {
      fail("LIMIT", `You can own up to ${LIMITS.maxOwnedCommunities} communities.`);
    }

    // Mutations are transactional, so this check-then-insert can't race
    const taken = await ctx.db.query("communities").withIndex("by_slug", (q) => q.eq("slug", slug)).unique();
    if (taken) fail("CONFLICT", "That username is taken.");

    if (args.iconStorageId) await validateIcon(ctx as any, args.iconStorageId);

    const communityId = await ctx.db.insert("communities", {
      name,
      slug,
      description,
      category: args.category,
      visibility: args.visibility,
      iconStorageId: args.iconStorageId,
      ownerId: me._id,
      memberCount: 0,
      status: "active",
    });
    await addMember(ctx, communityId, me._id, "owner");

    const defaults = [
      { name: "general", kind: "general", restricted: false, description: "Chat about anything" },
      { name: "announcements", kind: "announcements", restricted: true, description: "News from the moderators" },
      { name: "discussion", kind: "discussion", restricted: false, description: "Deeper conversations" },
    ] as const;
    for (const [i, d] of defaults.entries()) {
      await ctx.db.insert("communityChannels", {
        communityId,
        name: d.name,
        slug: d.name,
        description: d.description,
        kind: d.kind,
        postingRestricted: d.restricted,
        position: i,
      });
    }
    return { communityId, slug };
  },
});

export const update = mutation({
  args: {
    communityId: v.id("communities"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(categoryValidator),
    visibility: v.optional(visibilityValidator),
    iconStorageId: v.optional(v.id("_storage")),
    removeIcon: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const me = await requireUser(ctx);
    const community = await getActiveCommunity(ctx, args.communityId);
    await requireRole(ctx, community._id, me._id, "owner");

    const patch: Partial<Doc<"communities">> = {};
    if (args.name !== undefined) patch.name = cleanName(args.name);
    if (args.description !== undefined) patch.description = cleanDescription(args.description);
    if (args.category !== undefined) patch.category = args.category;
    if (args.visibility !== undefined) patch.visibility = args.visibility;

    if (args.iconStorageId) {
      await validateIcon(ctx as any, args.iconStorageId);
      if (community.iconStorageId) await ctx.storage.delete(community.iconStorageId);
      patch.iconStorageId = args.iconStorageId;
    } else if (args.removeIcon && community.iconStorageId) {
      await ctx.storage.delete(community.iconStorageId);
      patch.iconStorageId = undefined;
    }
    await ctx.db.patch(community._id, patch);
  },
});

/* ───────── membership ───────── */

export const join = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    const community = await getActiveCommunity(ctx, communityId);
    if (community.visibility !== "public") {
      fail("FORBIDDEN", "This community is private. You need an invitation to join.");
    }
    await addMember(ctx, community._id, me._id);
    return { slug: community.slug };
  },
});

export const leave = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    const membership = await requireRole(ctx, communityId, me._id);
    if (membership.role === "owner") {
      fail("FORBIDDEN", "Owners can't leave. Transfer ownership or delete the community first.");
    }
    await removeMember(ctx, communityId, me._id);
  },
});

export const transferOwnership = mutation({
  args: { communityId: v.id("communities"), newOwnerId: v.id("users") },
  handler: async (ctx, { communityId, newOwnerId }) => {
    const me = await requireUser(ctx);
    const community = await getActiveCommunity(ctx, communityId);
    const mine = await requireRole(ctx, community._id, me._id, "owner");
    if (newOwnerId === me._id) fail("INVALID", "You already own this community.");
    const target = await getMembership(ctx, community._id, newOwnerId);
    if (!target) fail("INVALID", "The new owner must be a member of the community.");

    await ctx.db.patch(target!._id, { role: "owner" });
    await ctx.db.patch(mine._id, { role: "moderator" });
    await ctx.db.patch(community._id, { ownerId: newOwnerId });
  },
});

/* ───────── deletion (hide immediately, purge in batches) ───────── */

export const deleteCommunity = mutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const me = await requireUser(ctx);
    const community = await getActiveCommunity(ctx, communityId);
    await requireRole(ctx, community._id, me._id, "owner");
    await ctx.db.patch(community._id, { status: "deleting" });
    if (community.iconStorageId) await ctx.storage.delete(community.iconStorageId);
    await ctx.scheduler.runAfter(0, internal.communities.purge, { communityId });
  },
});

export const purge = internalMutation({
  args: { communityId: v.id("communities") },
  handler: async (ctx, { communityId }) => {
    const BATCH = 100;
    let more = false;
    const sweep = async (rows: { _id: any }[]) => {
      for (const r of rows) await ctx.db.delete(r._id);
      if (rows.length === BATCH) more = true;
    };
    await sweep(await ctx.db.query("communityMessages").withIndex("by_community", (q) => q.eq("communityId", communityId)).take(BATCH));
    await sweep(await ctx.db.query("communityMembers").withIndex("by_community_role", (q) => q.eq("communityId", communityId)).take(BATCH));
    await sweep(await ctx.db.query("communityChannels").withIndex("by_community", (q) => q.eq("communityId", communityId)).take(BATCH));
    await sweep(await ctx.db.query("communityInvites").withIndex("by_community", (q) => q.eq("communityId", communityId)).take(BATCH));
    await sweep(await ctx.db.query("communityBans").withIndex("by_community", (q) => q.eq("communityId", communityId)).take(BATCH));
    await sweep(await ctx.db.query("communityReports").withIndex("by_community_status", (q) => q.eq("communityId", communityId)).take(BATCH));

    if (more) await ctx.scheduler.runAfter(0, internal.communities.purge, { communityId });
    else await ctx.db.delete(communityId);
  },
});
