"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { useClerk, useUser } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import { ExternalLink, Mail, UserRound } from "lucide-react";
import { Avatar } from "./Avatar";
import { Modal, Spinner, errorMessage, useToast } from "./ui";
import { cn, formatLastSeen } from "@/lib/utils";

const BIO_MAX = 160;

interface ProfileModalProps {
  /** The profile being shown */
  user: Doc<"users">;
  /** The signed-in user — editing is only offered when this is the same person */
  currentUser: Doc<"users">;
  onClose: () => void;
}

export function ProfileModal({ user, currentUser, onClose }: ProfileModalProps) {
  const isSelf = user._id === currentUser._id;
  return isSelf ? (
    <EditableProfile user={currentUser} onClose={onClose} />
  ) : (
    <ReadOnlyProfile user={user} onClose={onClose} />
  );
}

function PresenceBadge({ user }: { user: Doc<"users"> }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        user.isOnline ? "bg-success/15 text-success" : "bg-subtle text-muted"
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", user.isOnline ? "bg-success" : "bg-muted/60")} />
      {user.isOnline ? "Online" : formatLastSeen(user.lastSeen)}
    </span>
  );
}

function ReadOnlyProfile({ user, onClose }: { user: Doc<"users">; onClose: () => void }) {
  return (
    <Modal title="Profile" icon={<UserRound className="h-5 w-5" />} onClose={onClose}>
      <div className="relative">
        <div className="bg-brand h-24" aria-hidden />
        <div className="-mt-12 flex flex-col items-center px-6 pb-6 text-center">
          <div className="rounded-full bg-elevated p-1 shadow-soft">
            <Avatar user={user} size="xl" showOnlineStatus />
          </div>
          <h3 className="mt-3 text-xl font-semibold text-fg">{user.name}</h3>
          <div className="mt-2">
            <PresenceBadge user={user} />
          </div>
          <p className={cn("mt-4 max-w-xs text-sm leading-relaxed", user.bio ? "text-fg" : "italic text-muted")}>
            {user.bio || "No bio yet."}
          </p>
          <div className="mt-5 flex w-full items-center gap-3 rounded-xl bg-subtle px-4 py-3 text-left">
            <Mail className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 truncate text-sm text-fg">{user.email}</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function EditableProfile({ user, onClose }: { user: Doc<"users">; onClose: () => void }) {
  const { user: clerkUser } = useUser();
  const { openUserProfile } = useClerk();
  const updateProfile = useMutation(api.users.updateProfile);
  const toast = useToast();

  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty =
    name.trim() !== user.name ||
    bio.trim() !== (user.bio ?? "") ||
    (clerkUser?.imageUrl && clerkUser.imageUrl !== user.imageUrl);
  const nameValid = name.trim().length >= 1 && name.trim().length <= 50;

  const handleSave = async () => {
    if (!nameValid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateProfile({
        userId: user._id,
        name: name.trim(),
        bio: bio.trim(),
        // Pull in a photo changed through Clerk's account manager
        ...(clerkUser?.imageUrl && clerkUser.imageUrl !== user.imageUrl
          ? { imageUrl: clerkUser.imageUrl }
          : {}),
      });
      toast("Profile updated");
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const previewUser = { ...user, name: name.trim() || user.name, imageUrl: clerkUser?.imageUrl ?? user.imageUrl };

  return (
    <Modal
      title="Your profile"
      icon={<UserRound className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1 border border-line">
            Cancel
          </button>
          <button onClick={handleSave} disabled={!dirty || !nameValid || saving} className="btn-primary flex-1">
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      }
    >
      <div className="flex flex-col items-center px-6 pt-6">
        <Avatar user={previewUser} size="xl" showOnlineStatus />
        <div className="mt-3">
          <PresenceBadge user={user} />
        </div>
        <button
          onClick={() => openUserProfile()}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:underline"
        >
          Change photo or manage account <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-4 p-6">
        <div>
          <label htmlFor="profile-name" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted">
            Display name
          </label>
          <input
            id="profile-name"
            data-autofocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            className="field"
            aria-invalid={!nameValid}
          />
          {!nameValid && <p className="mt-1 text-xs text-danger">Name is required.</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="profile-bio" className="text-xs font-semibold uppercase tracking-wider text-muted">
              Bio
            </label>
            <span className={cn("text-xs tabular-nums", bio.length > BIO_MAX - 20 ? "text-warn" : "text-muted")}>
              {bio.length}/{BIO_MAX}
            </span>
          </div>
          <textarea
            id="profile-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            rows={3}
            placeholder="Tell people a little about yourself"
            className="field resize-none"
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted">Email</p>
          <div className="flex items-center gap-3 rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-muted">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{user.email}</span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Your online status updates automatically — you show as online while TarsChat is open.
        </p>

        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
