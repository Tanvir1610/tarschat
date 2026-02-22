"use client";

import { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";

interface UserListItemProps {
  user: Doc<"users">;
  onClick: () => void;
}

export function UserListItem({ user, onClick }: UserListItemProps) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
    >
      <Avatar user={user} size="md" showOnlineStatus />
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
        <p className="text-xs text-gray-400 truncate">{user.email}</p>
      </div>
      <span
        className={`text-xs font-medium px-2 py-0.5 rounded-full ${
          user.isOnline
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {user.isOnline ? "Online" : "Offline"}
      </span>
    </button>
  );
}
