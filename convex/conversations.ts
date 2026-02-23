import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Get or create a direct conversation (only if request is accepted)
export const getOrCreateDirectConversation = mutation({
  args: {
    currentUserId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { currentUserId, otherUserId }) => {
    const allConversations = await ctx.db.query("conversations").collect();
    const existing = allConversations.find(
      (c) =>
        c.type === "direct" &&
        c.memberIds.includes(currentUserId) &&
        c.memberIds.includes(otherUserId) &&
        c.memberIds.length === 2
    );

    if (existing) return existing._id;

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

    userConvos.sort(
      (a, b) => (b.lastMessageTime ?? 0) - (a.lastMessageTime ?? 0)
    );

    const enriched = await Promise.all(
      userConvos.map(async (convo) => {
        const members = await Promise.all(
          convo.memberIds.map((id) => ctx.db.get(id))
        );
        let lastMessage = null;
        if (convo.lastMessageId) {
          lastMessage = await ctx.db.get(convo.lastMessageId);
        }
        return { ...convo, members: members.filter(Boolean), lastMessage };
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
    adminId: v.id("users"),
  },
  handler: async (ctx, { name, memberIds, adminId }) => {
    const id = await ctx.db.insert("conversations", {
      type: "group",
      name,
      memberIds,
      adminId,
      lastMessageTime: Date.now(),
    });
    return id;
  },
});

// Add members to existing group (admin only)
export const addMembersToGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
    requesterId: v.id("users"),
    newMemberIds: v.array(v.id("users")),
  },
  handler: async (ctx, { conversationId, requesterId, newMemberIds }) => {
    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error("Conversation not found");
    if (convo.type !== "group") throw new Error("Not a group chat");
    if (convo.adminId !== requesterId) throw new Error("Only admin can add members");

    // Add only new members not already in the group
    const existingIds = new Set(convo.memberIds.map((id) => id.toString()));
    const toAdd = newMemberIds.filter((id) => !existingIds.has(id.toString()));

    if (toAdd.length === 0) return;

    await ctx.db.patch(conversationId, {
      memberIds: [...convo.memberIds, ...toAdd],
    });
  },
});

// Remove a member from group (admin only)
export const removeMemberFromGroup = mutation({
  args: {
    conversationId: v.id("conversations"),
    requesterId: v.id("users"),
    memberId: v.id("users"),
  },
  handler: async (ctx, { conversationId, requesterId, memberId }) => {
    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error("Conversation not found");
    if (convo.type !== "group") throw new Error("Not a group chat");
    if (convo.adminId !== requesterId) throw new Error("Only admin can remove members");

    await ctx.db.patch(conversationId, {
      memberIds: convo.memberIds.filter((id) => id !== memberId),
    });
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
