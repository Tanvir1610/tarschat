"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { X, Check, UserPlus } from "lucide-react";
import { Avatar } from "./Avatar";
import { cn } from "@/lib/utils";

interface AddMembersModalProps {
  conversation: Doc<"conversations"> & { members: (Doc<"users"> | null)[] };
  currentUser: Doc<"users">;
  onClose: () => void;
}

export function AddMembersModal({
  conversation,
  currentUser,
  onClose,
}: AddMembersModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"users">>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [success, setSuccess] = useState(false);

  const allUsers = useQuery(api.users.getAllUsers, {
    currentClerkId: currentUser.clerkId,
  });

  const addMembers = useMutation(api.conversations.addMembersToGroup);

  // Filter out users already in the group
  const existingMemberIds = new Set(conversation.memberIds.map((id) => id.toString()));
  const availableUsers = allUsers?.filter(
    (u) => !existingMemberIds.has(u._id.toString())
  );

  const toggleUser = (userId: Id<"users">) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleAdd = async () => {
    if (selectedIds.size === 0) return;
    setIsAdding(true);
    try {
      await addMembers({
        conversationId: conversation._id,
        requesterId: currentUser._id,
        newMemberIds: Array.from(selectedIds),
      });
      setSuccess(true);
      setTimeout(onClose, 1000);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-blue-500" />
            <h2 className="font-semibold text-gray-900">Add Members</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Current members */}
        <div className="px-5 py-3 bg-gray-50 border-b">
          <p className="text-xs text-gray-500 mb-2 font-medium">CURRENT MEMBERS ({conversation.memberIds.length})</p>
          <div className="flex flex-wrap gap-2">
            {conversation.members.filter(Boolean).map((member) => (
              <span
                key={member!._id}
                className="flex items-center gap-1.5 bg-white border border-gray-200 text-xs text-gray-600 px-2.5 py-1 rounded-full"
              >
                <Avatar user={member} size="sm" />
                <span>{member!.name.split(" ")[0]}</span>
                {member!._id === conversation.adminId && (
                  <span className="text-blue-500 font-medium">★</span>
                )}
              </span>
            ))}
          </div>
        </div>

        {/* Available users to add */}
        <div className="flex-1 overflow-y-auto">
          {!availableUsers ? (
            <div className="p-4 text-center text-gray-400 text-sm">Loading...</div>
          ) : availableUsers.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 font-medium">All users are already in this group!</p>
            </div>
          ) : (
            <>
              <p className="px-5 py-3 text-xs text-gray-500 font-medium border-b">ADD NEW MEMBERS</p>
              {availableUsers.map((user) => (
                <button
                  key={user._id}
                  onClick={() => toggleUser(user._id)}
                  className="w-full flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors"
                >
                  <Avatar user={user} size="sm" showOnlineStatus />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-sm text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                  </div>
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                      selectedIds.has(user._id)
                        ? "bg-blue-500 border-blue-500"
                        : "border-gray-300"
                    )}
                  >
                    {selectedIds.has(user._id) && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t">
          <button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isAdding}
            className={cn(
              "w-full py-3 rounded-xl font-medium text-sm transition-colors",
              success
                ? "bg-green-500 text-white"
                : "bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
          >
            {success
              ? "✓ Members Added!"
              : isAdding
              ? "Adding..."
              : `Add ${selectedIds.size > 0 ? selectedIds.size : ""} Member${selectedIds.size !== 1 ? "s" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
