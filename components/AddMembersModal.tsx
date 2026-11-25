"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Check, CheckCircle2, UserPlus } from "lucide-react";
import { Avatar } from "./Avatar";
import { Modal, Skeleton, Spinner, errorMessage } from "./ui";
import { cn } from "@/lib/utils";

interface AddMembersModalProps {
  conversation: Doc<"conversations"> & { members: (Doc<"users"> | null)[] };
  currentUser: Doc<"users">;
  onClose: () => void;
}

export function AddMembersModal({ conversation, currentUser, onClose }: AddMembersModalProps) {
  const [selectedIds, setSelectedIds] = useState<Set<Id<"users">>>(new Set());
  const [isAdding, setIsAdding] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allUsers = useQuery(api.users.getAllUsers, { currentClerkId: currentUser.clerkId });
  const addMembers = useMutation(api.conversations.addMembersToGroup);

  // Filter out users already in the group
  const existingMemberIds = new Set(conversation.memberIds.map((id) => id.toString()));
  const availableUsers = allUsers?.filter((u) => !existingMemberIds.has(u._id.toString()));

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
    setError(null);
    try {
      await addMembers({
        conversationId: conversation._id,
        requesterId: currentUser._id,
        newMemberIds: Array.from(selectedIds),
      });
      setSuccess(true);
      setTimeout(onClose, 900);
    } catch (e) {
      setError(errorMessage(e, "Couldn't add members."));
    } finally {
      setIsAdding(false);
    }
  };

  return (
    <Modal
      title="Add members"
      icon={<UserPlus className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <div className="space-y-2">
          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button
            onClick={handleAdd}
            disabled={selectedIds.size === 0 || isAdding || success}
            className={cn("btn-primary w-full py-3", success && "!bg-none !bg-success")}
          >
            {success ? (
              <>
                <CheckCircle2 className="h-4 w-4" /> Members added
              </>
            ) : isAdding ? (
              <>
                <Spinner /> Adding…
              </>
            ) : selectedIds.size > 0 ? (
              `Add ${selectedIds.size} member${selectedIds.size > 1 ? "s" : ""}`
            ) : (
              "Select people to add"
            )}
          </button>
        </div>
      }
    >
      <div className="border-b border-line bg-subtle/60 px-5 py-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">
          Current members ({conversation.memberIds.length})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {conversation.members.filter(Boolean).map((member) => (
            <span
              key={member!._id}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-0.5 pl-0.5 pr-2.5 text-xs text-fg"
            >
              <Avatar user={member} size="xs" />
              {member!.name.split(" ")[0]}
              {member!._id === conversation.adminId && (
                <span className="font-semibold text-accent" title="Admin">★</span>
              )}
            </span>
          ))}
        </div>
      </div>

      {!availableUsers ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : availableUsers.length === 0 ? (
        <p className="p-8 text-center text-sm font-medium text-muted">Everyone is already in this group.</p>
      ) : (
        <ul className="p-2">
          {availableUsers.map((user) => {
            const isSel = selectedIds.has(user._id);
            return (
              <li key={user._id}>
                <button
                  onClick={() => toggleUser(user._id)}
                  aria-pressed={isSel}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-subtle"
                >
                  <Avatar user={user} size="sm" showOnlineStatus />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-fg">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                  </div>
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full border-2 transition",
                      isSel ? "bg-brand border-transparent" : "border-line"
                    )}
                  >
                    {isSel && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
