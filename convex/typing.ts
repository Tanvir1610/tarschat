import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Set typing indicator
export const setTyping = mutation({
  args: {
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    isTyping: v.boolean(),
  },
  handler: async (ctx, { userId, conversationId, isTyping }) => {
    const existing = await ctx.db
      .query("typingIndicators")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .unique();

    if (isTyping) {
      if (existing) {
        await ctx.db.patch(existing._id, { updatedAt: Date.now() });
      } else {
        await ctx.db.insert("typingIndicators", {
          userId,
          conversationId,
          updatedAt: Date.now(),
        });
      }
    } else {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
    }
  },
});

// Get who is typing in a conversation
export const getTypingUsers = query({
  args: {
    conversationId: v.id("conversations"),
    currentUserId: v.id("users"),
  },
  handler: async (ctx, { conversationId, currentUserId }) => {
    const twoSecondsAgo = Date.now() - 2000;

    const indicators = await ctx.db
      .query("typingIndicators")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect();

    // Filter: not current user, and updated within last 2 seconds
    const active = indicators.filter(
      (i) => i.userId !== currentUserId && i.updatedAt > twoSecondsAgo
    );

    const users = await Promise.all(active.map((i) => ctx.db.get(i.userId)));
    return users.filter(Boolean);
  },
});
