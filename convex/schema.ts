import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { categoryValidator, reportReasonValidator, roleValidator, visibilityValidator } from "./lib/constants";

export default defineSchema({
  // Users synced from Clerk
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    isOnline: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"])
    .searchIndex("search_name", { searchField: "name" }),

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
    editedAt: v.optional(v.number()),
    replyToId: v.optional(v.id("messages")),
    forwarded: v.optional(v.boolean()),
    attachment: v.optional(
      v.object({
        storageId: v.id("_storage"),
        name: v.string(),
        mimeType: v.string(),
        size: v.number(),
        kind: v.union(v.literal("image"), v.literal("file"), v.literal("audio")),
        durationMs: v.optional(v.number()),
      })
    ),
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

  // Per-user favourite conversations
  favorites: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
  })
    .index("by_user", ["userId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // Typing indicators
  typingIndicators: defineTable({
    userId: v.id("users"),
    conversationId: v.id("conversations"),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_conversation", ["userId", "conversationId"]),

  // ───────── Tars Communities ─────────
  communities: defineTable({
    name: v.string(),
    slug: v.string(), // unique, immutable, lowercase
    description: v.string(),
    category: categoryValidator,
    visibility: visibilityValidator,
    iconStorageId: v.optional(v.id("_storage")),
    ownerId: v.id("users"),
    memberCount: v.number(), // denormalised; kept in sync by join/leave/remove/ban
    status: v.union(v.literal("active"), v.literal("deleting")),
  })
    .index("by_slug", ["slug"])
    .index("by_owner", ["ownerId"])
    .index("by_public_members", ["visibility", "status", "memberCount"])
    .index("by_category_members", ["category", "visibility", "status", "memberCount"])
    .searchIndex("search_name", {
      searchField: "name",
      filterFields: ["visibility", "status", "category"],
    })
    .searchIndex("search_description", {
      searchField: "description",
      filterFields: ["visibility", "status", "category"],
    }),

  communityChannels: defineTable({
    communityId: v.id("communities"),
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    kind: v.union(
      v.literal("general"),
      v.literal("announcements"),
      v.literal("discussion"),
      v.literal("custom")
    ),
    postingRestricted: v.boolean(), // true = only owner/moderators may post
    position: v.number(),
  })
    .index("by_community", ["communityId"])
    .index("by_community_slug", ["communityId", "slug"]),

  communityMembers: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"),
    role: roleValidator,
    joinedAt: v.number(),
  })
    .index("by_community_user", ["communityId", "userId"])
    .index("by_community_role", ["communityId", "role"])
    .index("by_community_joined", ["communityId", "joinedAt"])
    .index("by_user", ["userId"]),

  communityBans: defineTable({
    communityId: v.id("communities"),
    userId: v.id("users"),
    bannedBy: v.id("users"),
    reason: v.optional(v.string()),
  })
    .index("by_community", ["communityId"])
    .index("by_community_user", ["communityId", "userId"]),

  communityMessages: defineTable({
    communityId: v.id("communities"),
    channelId: v.id("communityChannels"),
    senderId: v.id("users"),
    content: v.string(),
    isDeleted: v.boolean(),
    deletedBy: v.optional(v.id("users")),
  })
    .index("by_channel", ["channelId"])
    .index("by_community", ["communityId"])
    .index("by_community_sender", ["communityId", "senderId"]),

  communityInvites: defineTable({
    communityId: v.id("communities"),
    code: v.string(),
    inviterId: v.id("users"),
    inviteeId: v.optional(v.id("users")), // set = direct invitation to one person
    status: v.union(
      v.literal("pending"),
      v.literal("accepted"),
      v.literal("declined"),
      v.literal("revoked")
    ),
    expiresAt: v.number(),
    maxUses: v.optional(v.number()),
    uses: v.number(),
  })
    .index("by_code", ["code"])
    .index("by_community", ["communityId"])
    .index("by_invitee", ["inviteeId", "status"]),

  communityReports: defineTable({
    communityId: v.id("communities"),
    reporterId: v.id("users"),
    reportedUserId: v.id("users"),
    messageId: v.optional(v.id("communityMessages")),
    reason: reportReasonValidator,
    details: v.optional(v.string()),
    status: v.union(v.literal("open"), v.literal("resolved"), v.literal("dismissed")),
    resolvedBy: v.optional(v.id("users")),
    resolvedAt: v.optional(v.number()),
  })
    .index("by_community_status", ["communityId", "status"])
    .index("by_reporter_message", ["reporterId", "messageId"]),

  // User-level blocks: hide someone's community messages from the blocker
  userBlocks: defineTable({
    blockerId: v.id("users"),
    blockedId: v.id("users"),
  })
    .index("by_blocker", ["blockerId"])
    .index("by_blocker_blocked", ["blockerId", "blockedId"]),
});
