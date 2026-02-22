import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Internal: upsert user from Clerk webhook
export const upsertUser = internalMutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
      });
    } else {
      await ctx.db.insert("users", {
        clerkId: args.clerkId,
        name: args.name,
        email: args.email,
        imageUrl: args.imageUrl,
        isOnline: false,
        lastSeen: Date.now(),
      });
    }
  },
});

// Internal: delete user
export const deleteUser = internalMutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (user) {
      await ctx.db.delete(user._id);
    }
  },
});

// Get current user by Clerk ID
export const getCurrentUser = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
  },
});

// Get all users except current user
export const getAllUsers = query({
  args: { currentClerkId: v.string() },
  handler: async (ctx, { currentClerkId }) => {
    const allUsers = await ctx.db.query("users").collect();
    return allUsers.filter((u) => u.clerkId !== currentClerkId);
  },
});

// Search users by name
export const searchUsers = query({
  args: { query: v.string(), currentClerkId: v.string() },
  handler: async (ctx, { query, currentClerkId }) => {
    const allUsers = await ctx.db.query("users").collect();
    const q = query.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.clerkId !== currentClerkId && u.name.toLowerCase().includes(q)
    );
  },
});

// Set online/offline status
export const setOnlineStatus = mutation({
  args: { clerkId: v.string(), isOnline: v.boolean() },
  handler: async (ctx, { clerkId, isOnline }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (user) {
      await ctx.db.patch(user._id, {
        isOnline,
        lastSeen: Date.now(),
      });
    }
  },
});

// Ensure user exists (called on first login if webhook hasn't fired yet)
export const ensureUser = mutation({
  args: {
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!existing) {
      await ctx.db.insert("users", {
        ...args,
        isOnline: true,
        lastSeen: Date.now(),
      });
    } else {
      await ctx.db.patch(existing._id, {
        isOnline: true,
        lastSeen: Date.now(),
        imageUrl: args.imageUrl,
        name: args.name,
      });
    }
  },
});
