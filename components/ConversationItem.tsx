"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Star } from "lucide-react";
import { Avatar, GroupAvatar } from "./Avatar";
import { cn, formatConversationTime, previewMessage } from "@/lib/utils";
import { getConversationTitle, getOtherMember } from "@/lib/conversation";
import type { ConversationListItem } from "@/lib/types";

interface ConversationItemProps {
  conversation: ConversationListItem;
  currentUser: Doc<"users">;
  isSelected: boolean;
  unreadCount: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}

export function ConversationItem({
  conversation,
  currentUser,
  isSelected,
  unreadCount,
  isFavorite,
  onToggleFavorite,
  onClick,
}: ConversationItemProps) {
  const otherMember = getOtherMember(conversation, currentUser._id);
  const displayName = getConversationTitle(conversation, currentUser._id);
  const last = conversation.lastMessage;
  const isUnread = unreadCount > 0;

  const senderPrefix =
    last && !last.isDeleted && last.senderId === currentUser._id
      ? "You: "
      : last && conversation.type === "group" && !last.isDeleted
      ? `${conversation.members.find((m) => m && m._id === last.senderId)?.name.split(" ")[0] ?? ""}: `
      : "";

  return (
    <div className="group relative mx-2">
      <button
        onClick={onClick}
        aria-current={isSelected ? "true" : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
          isSelected ? "bg-accent/12 ring-1 ring-inset ring-accent/25" : "hover:bg-subtle active:bg-subtle"
        )}
      >
        {conversation.type === "group" ? (
          <GroupAvatar name={displayName} size="md" />
        ) : (
          <Avatar user={otherMember ?? undefined} size="md" showOnlineStatus />
        )}

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", isUnread || isSelected ? "font-semibold text-fg" : "font-medium text-fg")}>
              {displayName}
            </span>
            <span className={cn("shrink-0 text-[11px] tabular-nums", isUnread ? "font-semibold text-accent" : "text-muted")}>
              {formatConversationTime(conversation.lastMessageTime)}
            </span>
          </div>

          <div className="mt-0.5 flex items-center justify-between gap-2 pr-7">
            <p
              className={cn(
                "min-w-0 flex-1 truncate pr-1 text-[13px]",
                last?.isDeleted && "italic",
                isUnread ? "text-fg/80" : "text-muted"
              )}
            >
              {last ? (
                <>
                  {senderPrefix}
                  {previewMessage(last)}
                </>
              ) : (
                "No messages yet"
              )}
            </p>
            {isUnread && (
              <span
                className="bg-brand flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold text-white"
                aria-label={`${unreadCount} unread message${unreadCount > 1 ? "s" : ""}`}
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Sibling (not child) of the row button so the markup stays valid */}
      <button
        onClick={onToggleFavorite}
        aria-pressed={isFavorite}
        aria-label={isFavorite ? `Remove ${displayName} from favorites` : `Add ${displayName} to favorites`}
        className={cn(
          "absolute bottom-2 right-4 flex h-6 w-6 items-center justify-center rounded-lg transition",
          isFavorite
            ? "text-warn"
            : "text-muted opacity-0 hover:text-warn focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-60",
        )}
      >
        <Star className={cn("h-4 w-4", isFavorite && "fill-current")} />
      </button>
    </div>
  );
}
