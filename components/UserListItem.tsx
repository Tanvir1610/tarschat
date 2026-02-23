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
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
      <Avatar user={user} size="md" showOnlineStatus />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
      <ChatRequestButton
        currentUser={currentUser}
        otherUser={user}
        onConversationCreated={onConversationCreated}
      />
    </div>
  );
}
