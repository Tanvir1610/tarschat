"use client";

import { Doc, Id } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";
import { ChatRequestButton } from "./ChatRequestButton";

interface UserListItemProps {
  user: Doc<"users">;
  currentUser: Doc<"users">;
  onConversationCreated: (id: Id<"conversations">) => void;
}

export function UserListItem({ user, currentUser, onConversationCreated }: UserListItemProps) {
  return (
    <div className="mx-2 flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-subtle">
      <Avatar user={user} size="md" showOnlineStatus />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg">{user.name}</p>
        <p className="truncate text-xs text-muted">{user.bio || user.email}</p>
      </div>
      <ChatRequestButton currentUser={currentUser} otherUser={user} onConversationCreated={onConversationCreated} />
    </div>
  );
}
