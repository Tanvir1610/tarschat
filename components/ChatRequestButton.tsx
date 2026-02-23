"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { UserPlus, Clock, Check, X, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatRequestButtonProps {
  currentUser: Doc<"users">;
  otherUser: Doc<"users">;
  onConversationCreated: (id: Id<"conversations">) => void;
}

export function ChatRequestButton({
  currentUser,
  otherUser,
  onConversationCreated,
}: ChatRequestButtonProps) {
  const [loading, setLoading] = useState(false);

  const requestStatus = useQuery(api.chatRequests.getRequestStatus, {
    currentUserId: currentUser._id,
    otherUserId: otherUser._id,
  });

  const sendRequest = useMutation(api.chatRequests.sendChatRequest);
  const acceptRequest = useMutation(api.chatRequests.acceptChatRequest);
  const rejectRequest = useMutation(api.chatRequests.rejectChatRequest);

  const handleSendRequest = async () => {
    setLoading(true);
    try {
      await sendRequest({ senderId: currentUser._id, receiverId: otherUser._id });
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!requestStatus?.requestId) return;
    setLoading(true);
    try {
      const convoId = await acceptRequest({
        requestId: requestStatus.requestId,
        userId: currentUser._id,
      });
      onConversationCreated(convoId);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!requestStatus?.requestId) return;
    setLoading(true);
    try {
      await rejectRequest({
        requestId: requestStatus.requestId,
        userId: currentUser._id,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!requestStatus) return null;

  // Already connected — open chat
  if (requestStatus.status === "connected") {
    return (
      <button
        onClick={() => onConversationCreated(requestStatus.conversationId!)}
        className="flex items-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-600 transition-colors font-medium"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Chat
      </button>
    );
  }

  // Sent and pending
  if (requestStatus.status === "pending" && requestStatus.direction === "sent") {
    return (
      <span className="flex items-center gap-1.5 bg-yellow-100 text-yellow-700 text-xs px-3 py-1.5 rounded-full font-medium">
        <Clock className="w-3.5 h-3.5" />
        Pending
      </span>
    );
  }

  // Received — accept or reject
  if (requestStatus.status === "pending" && requestStatus.direction === "received") {
    return (
      <div className="flex gap-1.5">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="flex items-center gap-1 bg-green-500 text-white text-xs px-3 py-1.5 rounded-full hover:bg-green-600 transition-colors font-medium"
        >
          <Check className="w-3.5 h-3.5" />
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1 bg-red-100 text-red-600 text-xs px-3 py-1.5 rounded-full hover:bg-red-200 transition-colors font-medium"
        >
          <X className="w-3.5 h-3.5" />
          Decline
        </button>
      </div>
    );
  }

  // No request yet
  if (requestStatus.status === "none") {
    return (
      <button
        onClick={handleSendRequest}
        disabled={loading}
        className="flex items-center gap-1.5 bg-blue-500 text-white text-xs px-3 py-1.5 rounded-full hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {loading ? "Sending..." : "Connect"}
      </button>
    );
  }

  // Rejected or expired
  return (
    <button
      onClick={handleSendRequest}
      disabled={loading}
      className="flex items-center gap-1.5 bg-gray-100 text-gray-600 text-xs px-3 py-1.5 rounded-full hover:bg-gray-200 transition-colors font-medium"
    >
      <UserPlus className="w-3.5 h-3.5" />
      Request Again
    </button>
  );
}
