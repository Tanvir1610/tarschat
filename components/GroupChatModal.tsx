"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Check, Users } from "lucide-react";
import { Avatar } from "./Avatar";
import { EmptyState, Modal, Skeleton, Spinner, errorMessage } from "./ui";
import { cn } from "@/lib/utils";

interface GroupChatModalProps {
  currentUser: Doc<"users">;
  onClose: () => void;
  onCreated: (id: Id<"conversations">) => void;
}

export function GroupChatModal({ currentUser, onClose, onCreated }: GroupChatModalProps) {
  const [groupName, setGroupName] = useState("");
  const [selectedUserIds, setSelectedUserIds] = useState<Set<Id<"users">>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const users = useQuery(api.users.getAllUsers, { currentClerkId: currentUser.clerkId });
  const createGroup = useMutation(api.conversations.createGroupConversation);

  const toggleUser = (userId: Id<"users">) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const canCreate = groupName.trim().length > 0 && selectedUserIds.size >= 1 && !isCreating;

  const handleCreate = async () => {
    if (!canCreate) return;
    setIsCreating(true);
    setError(null);
    try {
      const memberIds = [currentUser._id, ...Array.from(selectedUserIds)];
      const id = await createGroup({
        name: groupName.trim(),
        memberIds,
        adminId: currentUser._id,
      });
      onCreated(id);
    } catch (e) {
      setError(errorMessage(e, "Couldn't create the group."));
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Modal
      title="New group"
      icon={<Users className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <div className="space-y-3">
          {error && (
            <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
              {error}
            </p>
          )}
          <button onClick={handleCreate} disabled={!canCreate} className="btn-primary w-full py-3">
            {isCreating && <Spinner />}
            {isCreating
              ? "Creating…"
              : selectedUserIds.size > 0
              ? `Create group · ${selectedUserIds.size} member${selectedUserIds.size > 1 ? "s" : ""}`
              : "Create group"}
          </button>
        </div>
      }
    >
      <div className="border-b border-line p-4">
        <label htmlFor="group-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
          Group name
        </label>
        <input
          id="group-name"
          data-autofocus
          type="text"
          placeholder="e.g. Design team"
          value={groupName}
          maxLength={60}
          onChange={(e) => setGroupName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          className="field"
        />
      </div>

      {!users ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No one to add yet"
          description="Other people will appear here once they sign up for TarsChat."
        />
      ) : (
        <ul className="p-2" aria-label="People to add">
          {users.map((user) => {
            const isSel = selectedUserIds.has(user._id);
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
