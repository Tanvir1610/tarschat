"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { UserPlus, Clock, Check, X, MessageSquare } from "lucide-react";
import { errorMessage, useToast } from "./ui";

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
  const toast = useToast();

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
    } catch (e) {
      toast(errorMessage(e), "error");
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
    } catch (e) {
      toast(errorMessage(e), "error");
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
        className="bg-brand flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow transition active:scale-95"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        Chat
      </button>
    );
  }

  // Sent and pending
  if (requestStatus.status === "pending" && requestStatus.direction === "sent") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-warn/15 px-3 py-1.5 text-xs font-semibold text-warn">
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
          className="flex items-center gap-1 rounded-full bg-success px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50 dark:text-bg"
        >
          <Check className="w-3.5 h-3.5" />
          Accept
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1 rounded-full bg-danger/15 px-3 py-1.5 text-xs font-semibold text-danger transition active:scale-95 disabled:opacity-50"
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
        className="bg-brand flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-glow transition active:scale-95 disabled:opacity-50"
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
      className="flex items-center gap-1.5 rounded-full bg-subtle px-3 py-1.5 text-xs font-semibold text-muted transition hover:text-fg active:scale-95"
    >
      <UserPlus className="w-3.5 h-3.5" />
      Request Again
    </button>
  );
}
