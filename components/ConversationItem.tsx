"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";
import { cn, formatConversationTime } from "@/lib/utils";

interface ConversationItemProps {
  conversation: Doc<"conversations"> & {
    members: (Doc<"users"> | null)[];
    lastMessage: Doc<"messages"> | null;
  };
  currentUser: Doc<"users">;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  currentUser,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const otherMember =
    conversation.type === "direct"
      ? conversation.members?.find((m) => m && m._id !== currentUser._id)
      : null;

  const displayName =
    conversation.type === "group"
      ? conversation.name
      : otherMember?.name ?? "Unknown";

  const lastMessageText = conversation.lastMessage
    ? conversation.lastMessage.isDeleted
      ? "This message was deleted"
      : conversation.lastMessage.content
    : "No messages yet";

  const unreadCount = useQuery(api.messages.getUnreadCount, {
    conversationId: conversation._id,
    userId: currentUser._id,
  });

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left",
        isSelected && "bg-blue-50 hover:bg-blue-50"
      )}
    >
      <div className="relative flex-shrink-0">
        {conversation.type === "group" ? (
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
            {displayName?.charAt(0) ?? "G"}
          </div>
        ) : (
          <Avatar
            user={otherMember ?? undefined}
            size="md"
            showOnlineStatus
          />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span
            className={cn(
              "font-medium text-sm truncate",
              isSelected ? "text-blue-700" : "text-gray-900"
            )}
          >
            {displayName}
          </span>
          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
            {formatConversationTime(conversation.lastMessageTime)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <p
            className={cn(
              "text-xs truncate flex-1",
              conversation.lastMessage?.isDeleted
                ? "italic text-gray-400"
                : "text-gray-500"
            )}
          >
            {lastMessageText}
          </p>
          {unreadCount != null && unreadCount > 0 && (
            <span className="ml-2 bg-blue-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0 font-medium">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </div>

        {conversation.type === "group" && (
          <p className="text-xs text-gray-400">
            {conversation.memberIds.length} members
          </p>
        )}
      </div>
    </button>
  );
}
