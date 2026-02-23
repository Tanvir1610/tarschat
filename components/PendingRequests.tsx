"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Bell, Check, X, Clock } from "lucide-react";
import { Avatar } from "./Avatar";
import { useState } from "react";

interface PendingRequestsProps {
  currentUser: Doc<"users">;
  onConversationCreated: (id: Id<"conversations">) => void;
}

export function PendingRequests({ currentUser, onConversationCreated }: PendingRequestsProps) {
  const [expanded, setExpanded] = useState(false);
  const pendingRequests = useQuery(api.chatRequests.getPendingRequests, {
    userId: currentUser._id,
  });
  const acceptRequest = useMutation(api.chatRequests.acceptChatRequest);
  const rejectRequest = useMutation(api.chatRequests.rejectChatRequest);

  if (!pendingRequests || pendingRequests.length === 0) return null;

  const handleAccept = async (requestId: Id<"chatRequests">) => {
    const convoId = await acceptRequest({ requestId, userId: currentUser._id });
    onConversationCreated(convoId);
  };

  const handleReject = async (requestId: Id<"chatRequests">) => {
    await rejectRequest({ requestId, userId: currentUser._id });
  };

  // Time remaining
  const timeLeft = (expiresAt: number) => {
    const diff = expiresAt - Date.now();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h left`;
    return `${minutes}m left`;
  };

  return (
    <div className="border-b border-orange-100 bg-orange-50">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-orange-100 transition-colors"
      >
        <div className="relative">
          <Bell className="w-5 h-5 text-orange-500" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
            {pendingRequests.length}
          </span>
        </div>
        <span className="flex-1 text-sm font-medium text-orange-700 text-left">
          {pendingRequests.length} pending chat request{pendingRequests.length > 1 ? "s" : ""}
        </span>
        <span className="text-orange-400 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-3">
          {pendingRequests.map((request) => (
            <div
              key={request._id}
              className="bg-white rounded-xl p-3 shadow-sm border border-orange-100"
            >
              <div className="flex items-center gap-3 mb-3">
                <Avatar user={request.sender as Doc<"users">} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {request.sender?.name}
                  </p>
                  <p className="text-xs text-orange-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {timeLeft(request.expiresAt)}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleAccept(request._id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white text-xs py-2 rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  <Check className="w-3.5 h-3.5" />
                  Accept
                </button>
                <button
                  onClick={() => handleReject(request._id)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-red-100 text-red-600 text-xs py-2 rounded-lg hover:bg-red-200 transition-colors font-medium"
                >
                  <X className="w-3.5 h-3.5" />
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
