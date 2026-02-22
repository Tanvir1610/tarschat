import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get messages for a conversation
export const getMessages = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .order("asc")
      .collect();

    // Enrich with sender data
    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, sender };
      })
    );

    return enriched;
  },
});

// Send a message
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, { conversationId, senderId, content }) => {
    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId,
      content,
      isDeleted: false,
      reactions: [],
    });

    // Update conversation's last message
    await ctx.db.patch(conversationId, {
      lastMessageId: messageId,
      lastMessageTime: Date.now(),
    });

    return messageId;
  },
});

// Soft delete a message
export const deleteMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
  },
  handler: async (ctx, { messageId, userId }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== userId) throw new Error("Not your message");

    await ctx.db.patch(messageId, { isDeleted: true });
  },
});

// Toggle reaction on a message
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    emoji: v.string(),
  },
  handler: async (ctx, { messageId, userId, emoji }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");

    const reactions = message.reactions ?? [];
    const existingReaction = reactions.find((r) => r.emoji === emoji);

    let updatedReactions;
    if (existingReaction) {
      const hasReacted = existingReaction.userIds.includes(userId);
      if (hasReacted) {
        // Remove user's reaction
        const newUserIds = existingReaction.userIds.filter(
          (id) => id !== userId
        );
        if (newUserIds.length === 0) {
          updatedReactions = reactions.filter((r) => r.emoji !== emoji);
        } else {
          updatedReactions = reactions.map((r) =>
            r.emoji === emoji ? { ...r, userIds: newUserIds } : r
          );
        }
      } else {
        // Add user's reaction
        updatedReactions = reactions.map((r) =>
          r.emoji === emoji
            ? { ...r, userIds: [...r.userIds, userId] }
            : r
        );
      }
    } else {
      // New emoji reaction
      updatedReactions = [...reactions, { emoji, userIds: [userId] }];
    }

    await ctx.db.patch(messageId, { reactions: updatedReactions });
  },
});

// Get unread count for a conversation
export const getUnreadCount = query({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const receipt = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .unique();

    const lastReadTime = receipt?.lastReadTime ?? 0;

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) =>
        q.eq("conversationId", conversationId)
      )
      .collect();

    return messages.filter(
      (m) => m._creationTime > lastReadTime && m.senderId !== userId
    ).length;
  },
});

// Mark conversation as read
export const markAsRead = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.id("users"),
  },
  handler: async (ctx, { conversationId, userId }) => {
    const existing = await ctx.db
      .query("readReceipts")
      .withIndex("by_user_conversation", (q) =>
        q.eq("userId", userId).eq("conversationId", conversationId)
      )
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { lastReadTime: Date.now() });
    } else {
      await ctx.db.insert("readReceipts", {
        userId,
        conversationId,
        lastReadTime: Date.now(),
      });
    }
  },
});
