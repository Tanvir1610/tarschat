import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

// Get or create a direct conversation between two users
export const getOrCreateDirectConversation = mutation({
  args: {
    currentUserId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { currentUserId, otherUserId }) => {
    // Find existing direct conversation
    const allConversations = await ctx.db.query("conversations").collect();
    const existing = allConversations.find(
      (c) =>
        c.type === "direct" &&
        c.memberIds.includes(currentUserId) &&
        c.memberIds.includes(otherUserId) &&
        c.memberIds.length === 2
    );

    if (existing) return existing._id;

    // Create new conversation
    const id = await ctx.db.insert("conversations", {
      type: "direct",
      memberIds: [currentUserId, otherUserId],
      lastMessageTime: Date.now(),
    });
    return id;
  },
});

// Get all conversations for a user
export const getUserConversations = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const allConversations = await ctx.db.query("conversations").collect();
    const userConvos = allConversations.filter((c) =>
      c.memberIds.includes(userId)
    );

    // Sort by last message time descending
    userConvos.sort(
      (a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0)
    );

    // Enrich with member data and last message
    const enriched = await Promise.all(
      userConvos.map(async (convo) => {
        const members = await Promise.all(
          convo.memberIds.map((id) => ctx.db.get(id))
        );

        let lastMessage = null;
        if (convo.lastMessageId) {
          lastMessage = await ctx.db.get(convo.lastMessageId);
        }

        return {
          ...convo,
          members: members.filter(Boolean),
          lastMessage,
        };
      })
    );

    return enriched;
  },
});

// Create group conversation
export const createGroupConversation = mutation({
  args: {
    name: v.string(),
    memberIds: v.array(v.id("users")),
  },
  handler: async (ctx, { name, memberIds }) => {
    const id = await ctx.db.insert("conversations", {
      type: "group",
      name,
      memberIds,
      lastMessageTime: Date.now(),
    });
    return id;
  },
});

// Get single conversation with members
export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    const convo = await ctx.db.get(conversationId);
    if (!convo) return null;

    const members = await Promise.all(
      convo.memberIds.map((id) => ctx.db.get(id))
    );

    return { ...convo, members: members.filter(Boolean) };
  },
});
