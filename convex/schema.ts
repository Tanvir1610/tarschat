import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Users synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  // Chat requests (must be accepted within 24 hours)
  chatRequests: defineTable({
    senderId: v.id("users"),
    receiverId: v.id("users"),
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("rejected"),
      v.literal("expired")
    ),
    expiresAt: v.number(), // 24 hours from creation
  })
    .index("by_receiver", ["receiverId"])
    .index("by_sender", ["senderId"])
    .index("by_sender_receiver", ["senderId", "receiverId"]),

  // Conversations (direct messages or group chats)
  conversations: defineTable({
    type: v.union(v.literal("direct"), v.literal("group")),
    name: v.optional(v.string()),
    memberIds: v.array(v.id("users")),
    adminId: v.optional(v.id("users")), // group admin who can add members
    lastMessageId: v.optional(v.id("messages")),
    lastMessageTime: v.optional(v.number()),
  }).index("by_last_message_time", ["lastMessageTime"]),

  // Messages in conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    senderId: v.id("users"),
    content: v.string(),
    isDeleted: v.boolean(),
    reactions: v.optional(
      v.array(
        v.object({
          emoji: v.string(),
          userIds: v.array(v.id("users")),
        })
      )
    ),
  }).index("by_conversation", ["conversationId"]),

  // Track read status per user per conversation
  readReceipts: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    lastReadTime: v.number(),
  })
    .index("by_user_conversation", ["userId", "conversationId"])
    .index("by_user", ["userId"]),

  // Typing indicators
  typingIndicators: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"]),
});
