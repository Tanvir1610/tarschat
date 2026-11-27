import { ConvexError } from "convex/values";
import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import { LIMITS, RESERVED_SLUGS } from "./constants";

export type Ctx = QueryCtx | MutationCtx;
export type Role = "owner" | "moderator" | "member";

const RANK: Record<Role, number> = { owner: 3, moderator: 2, member: 1 };

/** Throw a structured error the UI can display */
export function fail(code: string, message: string): never {
  throw new ConvexError({ code, message });
}

/* ───────── Identity ───────── */

/**
 * The ONLY source of "who is calling". Derived from the verified Clerk JWT —
 * never from a client-supplied user id.
 */
export async function requireUser(ctx: Ctx): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) fail("UNAUTHENTICATED", "Please sign in to continue.");
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity!.subject))
    .unique();
  if (!user) fail("UNAUTHENTICATED", "Your account is still being set up. Try again in a moment.");
  return user!;
}

/* ───────── Community / membership lookups ───────── */

export async function getActiveCommunity(ctx: Ctx, id: Id<"communities">) {
  const c = await ctx.db.get(id);
  if (!c || c.status !== "active") fail("NOT_FOUND", "This community doesn't exist.");
  return c!;
}

export async function getMembership(ctx: Ctx, communityId: Id<"communities">, userId: Id<"users">) {
  return await ctx.db
    .query("communityMembers")
    .withIndex("by_community_user", (q) => q.eq("communityId", communityId).eq("userId", userId))
    .unique();
}

export async function isBanned(ctx: Ctx, communityId: Id<"communities">, userId: Id<"users">) {
  const ban = await ctx.db
    .query("communityBans")
    .withIndex("by_community_user", (q) => q.eq("communityId", communityId).eq("userId", userId))
    .unique();
  return ban !== null;
}

export const atLeast = (role: Role, min: Role) => RANK[role] >= RANK[min];

/** Caller must be a member with at least `min` role. Returns their membership. */
export async function requireRole(
  ctx: Ctx,
  communityId: Id<"communities">,
  userId: Id<"users">,
  min: Role = "member"
) {
  const m = await getMembership(ctx, communityId, userId);
  if (!m) fail("FORBIDDEN", "You need to be a member of this community.");
  if (!atLeast(m!.role, min)) {
    fail("FORBIDDEN", min === "owner" ? "Only the community owner can do that." : "Only moderators can do that.");
  }
  return m!;
}

/** Can `actor` delete a message written by someone whose role is `authorRole`? */
export function canRemoveMessage(opts: {
  actorId: Id<"users">;
  actorRole: Role;
  authorId: Id<"users">;
  authorRole: Role | null; // null = author has since left / been removed
}) {
  if (opts.actorId === opts.authorId) return true;
  if (opts.actorRole === "owner") return true;
  if (opts.actorRole === "moderator") return opts.authorRole === null || opts.authorRole === "member";
  return false;
}

/* ───────── Summaries returned to the client (never expose emails) ───────── */

export async function iconUrl(ctx: Ctx, community: Doc<"communities">) {
  return community.iconStorageId ? await ctx.storage.getUrl(community.iconStorageId) : null;
}

export async function summarize(ctx: Ctx, community: Doc<"communities">, viewerId: Id<"users">) {
  const membership = await getMembership(ctx, community._id, viewerId);
  return {
    _id: community._id,
    name: community.name,
    slug: community.slug,
    description: community.description,
    category: community.category,
    visibility: community.visibility,
    memberCount: community.memberCount,
    iconUrl: await iconUrl(ctx, community),
    isMember: membership !== null,
    role: (membership?.role ?? null) as Role | null,
  };
}

export const publicUser = (u: Doc<"users"> | null) =>
  u ? { _id: u._id, name: u.name, imageUrl: u.imageUrl, isOnline: u.isOnline } : null;

/* ───────── Membership mutation shared by join / invite / accept ───────── */

export async function addMember(
  ctx: MutationCtx,
  communityId: Id<"communities">,
  userId: Id<"users">,
  role: Role = "member"
) {
  const existing = await getMembership(ctx, communityId, userId);
  if (existing) return existing._id;
  if (await isBanned(ctx, communityId, userId)) {
    fail("BANNED", "You have been banned from this community.");
  }
  const joined = await ctx.db
    .query("communityMembers")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .take(LIMITS.maxJoinedCommunities + 1);
  if (joined.length >= LIMITS.maxJoinedCommunities) {
    fail("LIMIT", `You can join up to ${LIMITS.maxJoinedCommunities} communities.`);
  }
  const id = await ctx.db.insert("communityMembers", { communityId, userId, role, joinedAt: Date.now() });
  const c = await ctx.db.get(communityId);
  if (c) await ctx.db.patch(communityId, { memberCount: c.memberCount + 1 });
  return id;
}

export async function removeMember(ctx: MutationCtx, communityId: Id<"communities">, userId: Id<"users">) {
  const m = await getMembership(ctx, communityId, userId);
  if (!m) return;
  await ctx.db.delete(m._id);
  const c = await ctx.db.get(communityId);
  if (c) await ctx.db.patch(communityId, { memberCount: Math.max(0, c.memberCount - 1) });
}

/* ───────── Input validation ───────── */

const CONTROL = /[\u0000-\u001f\u007f]/;
const CONTROL_EXCEPT_NEWLINE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

export function cleanName(raw: string, label = "Name", min: number = LIMITS.nameMin, max: number = LIMITS.nameMax) {
  const s = raw.replace(/\s+/g, " ").trim();
  if (CONTROL.test(s)) fail("INVALID", `${label} contains invalid characters.`);
  if (s.length < min || s.length > max) fail("INVALID", `${label} must be ${min}–${max} characters.`);
  return s;
}

export function cleanDescription(raw: string) {
  const s = raw.trim();
  if (CONTROL_EXCEPT_NEWLINE.test(s)) fail("INVALID", "Description contains invalid characters.");
  if (s.length < LIMITS.descMin || s.length > LIMITS.descMax) {
    fail("INVALID", `Description must be ${LIMITS.descMin}–${LIMITS.descMax} characters.`);
  }
  return s;
}

export function slugProblem(raw: string): string | null {
  const s = raw.trim().toLowerCase();
  if (s.length < LIMITS.slugMin || s.length > LIMITS.slugMax) {
    return `Username must be ${LIMITS.slugMin}–${LIMITS.slugMax} characters.`;
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s)) {
    return "Use lowercase letters, numbers and single hyphens (no spaces).";
  }
  if (RESERVED_SLUGS.has(s)) return "That username is reserved.";
  return null;
}

export function cleanSlug(raw: string) {
  const problem = slugProblem(raw);
  if (problem) fail("INVALID", problem);
  return raw.trim().toLowerCase();
}

export function slugify(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, LIMITS.channelNameMax);
}

export function cleanMessage(raw: string) {
  const s = raw.trim();
  if (s.length === 0) fail("INVALID", "Message is empty.");
  if (s.length > LIMITS.messageMax) fail("INVALID", `Messages are limited to ${LIMITS.messageMax} characters.`);
  if (CONTROL_EXCEPT_NEWLINE.test(s)) fail("INVALID", "Message contains invalid characters.");
  return s;
}

export function clampPagination<T extends { numItems: number }>(opts: T): T {
  return { ...opts, numItems: Math.max(1, Math.min(opts.numItems, LIMITS.pageSizeMax)) };
}

/* ───────── Invite codes ───────── */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
export function generateInviteCode(length = 12) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}
