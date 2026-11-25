import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";

const attachmentValidator = v.object({
  storageId: v.id("_storage"),
  name: v.string(),
  mimeType: v.string(),
  size: v.number(),
  kind: v.union(v.literal("image"), v.literal("file"), v.literal("audio")),
  durationMs: v.optional(v.number()),
});

const MAX_MESSAGE_LENGTH = 4000;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

// Get messages for a conversation (with sender, reply preview and file URLs)
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

    // Small cache so each sender is only read once per query run
    const userCache = new Map<string, Promise<Doc<"users"> | null>>();
    const getUser = (id: Id<"users">) => {
      const key = id.toString();
      if (!userCache.has(key)) userCache.set(key, ctx.db.get(id));
      return userCache.get(key)!;
    };
    const byId = new Map(messages.map((m) => [m._id.toString(), m]));

    return await Promise.all(
      messages.map(async (msg) => {
        const sender = await getUser(msg.senderId);

        // Deleted messages never leak their body or file to clients
        const content = msg.isDeleted ? "" : msg.content;
        const attachment = msg.isDeleted ? undefined : msg.attachment;
        const attachmentUrl = attachment
          ? await ctx.storage.getUrl(attachment.storageId)
          : null;

        let replyTo: {
          _id: Id<"messages">;
          senderName: string;
          content: string;
          isDeleted: boolean;
          attachmentKind?: "image" | "file" | "audio";
        } | null = null;

        if (msg.replyToId) {
          const original = byId.get(msg.replyToId.toString());
          if (original) {
            const originalSender = await getUser(original.senderId);
            replyTo = {
              _id: original._id,
              senderName: originalSender?.name ?? "Unknown",
              content: original.isDeleted ? "" : original.content.slice(0, 140),
              isDeleted: original.isDeleted,
              attachmentKind: original.isDeleted
                ? undefined
                : original.attachment?.kind,
            };
          }
        }

        return { ...msg, content, attachment, attachmentUrl, sender, replyTo };
      })
    );
  },
});

// Get a one-time URL the client can POST a file to
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

// Send a message + notify offline members via email
export const sendMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    replyToId: v.optional(v.id("messages")),
    forwarded: v.optional(v.boolean()),
    attachment: v.optional(attachmentValidator),
  },
  handler: async (
    ctx,
    { conversationId, senderId, content, replyToId, forwarded, attachment }
  ) => {
    if (content.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters`);
    }
    if (!content.trim() && !attachment) {
      throw new Error("Message is empty");
    }
    if (attachment && attachment.size > MAX_ATTACHMENT_BYTES) {
      throw new Error("Attachments are limited to 10 MB");
    }

    const conversation = await ctx.db.get(conversationId);
    if (!conversation) throw new Error("Conversation not found");
    if (!conversation.memberIds.includes(senderId)) {
      throw new Error("You are not a member of this conversation");
    }

    if (replyToId) {
      const target = await ctx.db.get(replyToId);
      if (!target || target.conversationId !== conversationId) {
        throw new Error("Cannot reply to that message");
      }
    }

    const messageId = await ctx.db.insert("messages", {
      conversationId,
      senderId,
      content,
      isDeleted: false,
      reactions: [],
      ...(replyToId ? { replyToId } : {}),
      ...(forwarded ? { forwarded: true } : {}),
      ...(attachment ? { attachment } : {}),
    });

    await ctx.db.patch(conversationId, {
      lastMessageId: messageId,
      lastMessageTime: Date.now(),
    });

    // Notify offline members via email
    const sender = await ctx.db.get(senderId);
    const preview = content.trim()
      ? content.length > 100
        ? content.slice(0, 100) + "..."
        : content
      : attachment?.kind === "audio"
      ? "Sent a voice message"
      : "Sent an attachment";

    if (sender) {
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
              messagePreview: preview,
              conversationId: conversationId,
            }
          );
        }
      }
    }

    return messageId;
  },
});

// Edit the text of your own message
export const editMessage = mutation({
  args: {
    messageId: v.id("messages"),
    userId: v.id("users"),
    content: v.string(),
  },
  handler: async (ctx, { messageId, userId, content }) => {
    const message = await ctx.db.get(messageId);
    if (!message) throw new Error("Message not found");
    if (message.senderId !== userId) throw new Error("Not your message");
    if (message.isDeleted) throw new Error("Message was deleted");

    const trimmed = content.trim();
    if (!trimmed && !message.attachment) throw new Error("Message is empty");
    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new Error(`Messages are limited to ${MAX_MESSAGE_LENGTH} characters`);
    }
    if (trimmed === message.content) return; // nothing changed

    await ctx.db.patch(messageId, { content: trimmed, editedAt: Date.now() });
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

// Unread counts for every conversation the user is in (one subscription
// instead of one per conversation row)
export const getUnreadCounts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const conversations = (await ctx.db.query("conversations").collect()).filter(
      (c) => c.memberIds.includes(userId)
    );
    const receipts = await ctx.db
      .query("readReceipts")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const lastRead = new Map(
      receipts.map((r) => [r.conversationId.toString(), r.lastReadTime])
    );

    return await Promise.all(
      conversations.map(async (c) => {
        const since = lastRead.get(c._id.toString()) ?? 0;
        const messages = await ctx.db
          .query("messages")
          .withIndex("by_conversation", (q) => q.eq("conversationId", c._id))
          .collect();
        const count = messages.filter(
          (m) => m._creationTime > since && m.senderId !== userId && !m.isDeleted
        ).length;
        return { conversationId: c._id, count };
      })
    );
  },
});
