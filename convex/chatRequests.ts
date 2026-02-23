import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

// Send a chat request
export const sendChatRequest = mutation({
  args: {
    senderId: v.id("users"),
    receiverId: v.id("users"),
  },
  handler: async (ctx, { senderId, receiverId }) => {
    // Check if request already exists
    const existing = await ctx.db
      .query("chatRequests")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", senderId).eq("receiverId", receiverId)
      )
      .first();

    if (existing && existing.status === "pending") {
      throw new Error("Request already sent");
    }

    // Check reverse direction too
    const reverse = await ctx.db
      .query("chatRequests")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", receiverId).eq("receiverId", senderId)
      )
      .first();

    if (reverse && reverse.status === "pending") {
      throw new Error("This user already sent you a request");
    }

    if (existing && existing.status === "accepted") {
      throw new Error("Already connected");
    }

    const requestId = await ctx.db.insert("chatRequests", {
      senderId,
      receiverId,
      status: "pending",
      expiresAt: Date.now() + TWENTY_FOUR_HOURS,
    });

    // Send email notification via internal action
    const sender = await ctx.db.get(senderId);
    const receiver = await ctx.db.get(receiverId);

    return requestId;
  },
});

// Accept a chat request
export const acceptChatRequest = mutation({
  args: {
    requestId: v.id("chatRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, { requestId, userId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");
    if (request.receiverId !== userId) throw new Error("Not authorized");
    if (request.status !== "pending") throw new Error("Request no longer pending");
    if (Date.now() > request.expiresAt) {
      await ctx.db.patch(requestId, { status: "expired" });
      throw new Error("Request has expired");
    }

    await ctx.db.patch(requestId, { status: "accepted" });

    // Create the conversation
    const conversationId = await ctx.db.insert("conversations", {
      type: "direct",
      memberIds: [request.senderId, request.receiverId],
      lastMessageTime: Date.now(),
    });

    return conversationId;
  },
});

// Reject a chat request
export const rejectChatRequest = mutation({
  args: {
    requestId: v.id("chatRequests"),
    userId: v.id("users"),
  },
  handler: async (ctx, { requestId, userId }) => {
    const request = await ctx.db.get(requestId);
    if (!request) throw new Error("Request not found");
    if (request.receiverId !== userId) throw new Error("Not authorized");

    await ctx.db.patch(requestId, { status: "rejected" });
  },
});

// Get pending requests for a user (received)
export const getPendingRequests = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const now = Date.now();
    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .collect();

    const pending = requests.filter(
      (r) => r.status === "pending" && r.expiresAt > now
    );

    // Enrich with sender info
    const enriched = await Promise.all(
      pending.map(async (r) => {
        const sender = await ctx.db.get(r.senderId);
        return { ...r, sender };
      })
    );

    return enriched;
  },
});

// Get sent requests by a user
export const getSentRequests = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const requests = await ctx.db
      .query("chatRequests")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();

    const enriched = await Promise.all(
      requests.map(async (r) => {
        const receiver = await ctx.db.get(r.receiverId);
        return { ...r, receiver };
      })
    );

    return enriched;
  },
});

// Check request status between two users
export const getRequestStatus = query({
  args: {
    currentUserId: v.id("users"),
    otherUserId: v.id("users"),
  },
  handler: async (ctx, { currentUserId, otherUserId }) => {
    // Check if already in a conversation together
    const allConversations = await ctx.db.query("conversations").collect();
    const hasConvo = allConversations.find(
      (c) =>
        c.type === "direct" &&
        c.memberIds.includes(currentUserId) &&
        c.memberIds.includes(otherUserId)
    );
    if (hasConvo) return { status: "connected", conversationId: hasConvo._id };

    // Check sent
    const sent = await ctx.db
      .query("chatRequests")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", currentUserId).eq("receiverId", otherUserId)
      )
      .first();
    if (sent) return { status: sent.status, requestId: sent._id, direction: "sent" };

    // Check received
    const received = await ctx.db
      .query("chatRequests")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", otherUserId).eq("receiverId", currentUserId)
      )
      .first();
    if (received) return { status: received.status, requestId: received._id, direction: "received" };

    return { status: "none" };
  },
});
