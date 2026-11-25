import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Conversation ids the user has starred
export const listFavorites = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const rows = await ctx.db
      .query("favorites")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return rows.map((r) => r.conversationId);
  },
});

// Star / unstar a conversation. Returns the new state.
export const toggleFavorite = mutation({
  args: { userId: v.id("users"), conversationId: v.id("conversations") },
  handler: async (ctx, { userId, conversationId }) => {
    const existing = await ctx.db
      .query("favorites")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
      return false;
    }

    const convo = await ctx.db.get(conversationId);
    if (!convo || !convo.memberIds.includes(userId)) {
      throw new Error("Conversation not found");
    }
    await ctx.db.insert("favorites", { userId, conversationId });
    return true;
  },
});
