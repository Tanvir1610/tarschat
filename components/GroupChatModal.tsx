"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { X, Check, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

interface GroupChatModalProps {
  currentUser: Doc<"users">;
  onClose: () => void;
  onCreated: (id: Id<"conversations">) => void;
}

export function GroupChatModal({
  currentUser,
  onClose,
  onCreated,
}: GroupChatModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<Id<"users">>>(
    new Set()
  );
  const [isCreating, setIsCreating] = useState(false);

  const users = useQuery(api.users.getAllUsers, {
    currentClerkId: currentUser.clerkId,
  });
  const createGroup = useMutation(api.conversations.createGroupConversation);

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUserIds.size < 1) return;
    setIsCreating(true);
    try {
      const memberIds = [currentUser._id, ...Array.from(selectedUserIds)];
      const id = await createGroup({ name: groupName.trim(), memberIds });
      onCreated(id);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-900">New Group Chat</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Group name input */}
        <div className="p-4 border-b">
          <input
            type="text"
            placeholder="Group name..."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            autoFocus
          />
        </div>

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {!users ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              Loading users...
            </div>
          ) : users.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">
              No other users to add
            </div>
          ) : (
            users.map((user) => (
              <button
                key={user._id}
                onClick={() => toggleUser(user._id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <Avatar user={user} size="sm" />
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-sm text-gray-900 truncate">
                    {user.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">{user.email}</p>
                </div>
                <div
                  className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                    selectedUserIds.has(user._id)
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300"
                  )}
                >
                  {selectedUserIds.has(user._id) && (
                    <Check className="w-3 h-3 text-white" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <p className="text-xs text-gray-400 mb-3">
            {selectedUserIds.size} member{selectedUserIds.size !== 1 ? "s" : ""} selected
          </p>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUserIds.size < 1 || isCreating}
            className="w-full bg-blue-500 text-white py-3 rounded-xl font-medium text-sm hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? "Creating..." : "Create Group"}
          </button>
        </div>
      </div>
    </div>
  );
}
