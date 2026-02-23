import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

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

    const enriched = await Promise.all(
      messages.map(async (msg) => {
        const sender = await ctx.db.get(msg.senderId);
        return { ...msg, sender };
      })
    );

    return enriched;
  },
});

// Send a message + notify offline members via email
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

    await ctx.db.patch(conversationId, {
      lastMessageId: messageId,
      lastMessageTime: Date.now(),
    });

    // Notify offline members via email
    const conversation = await ctx.db.get(conversationId);
    const sender = await ctx.db.get(senderId);

    if (conversation && sender) {
      for (const memberId of conversation.memberIds) {
        if (memberId === senderId) continue;
        const member = await ctx.db.get(memberId);
        if (member && !member.isOnline && member.email) {
          await ctx.scheduler.runAfter(
            0,
            internal.emails.sendMessageNotificationEmail,
            {
              toEmail: member.email,
              toName: member.name,
              fromName: sender.name,
              messagePreview: content.length > 100 ? content.slice(0, 100) + "..." : content,
              conversationId: conversationId,
            }
          );
        }
      }
    }

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
        const newUserIds = existingReaction.userIds.filter((id) => id !== userId);
        updatedReactions = newUserIds.length === 0
          ? reactions.filter((r) => r.emoji !== emoji)
          : reactions.map((r) => r.emoji === emoji ? { ...r, userIds: newUserIds } : r);
      } else {
        updatedReactions = reactions.map((r) =>
          r.emoji === emoji ? { ...r, userIds: [...r.userIds, userId] } : r
        );
      }
    } else {
      updatedReactions = [...reactions, { emoji, userIds: [userId] }];
    }

    await ctx.db.patch(messageId, { reactions: updatedReactions });
  },
});

// Get unread count
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
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
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
