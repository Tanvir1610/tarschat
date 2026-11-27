"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import type { Doc } from "@/convex/_generated/dataModel";
import { Avatar } from "./Avatar";
import { ProfileModal } from "./ProfileModal";
import { SettingsMenu } from "./SettingsMenu";
import type { useNotificationPrefs } from "@/hooks/useDesktopNotifications";
import { cn } from "@/lib/utils";

/** Profile card + settings menu — shared by the Chats and Communities sidebars */
export function ProfileFooter({
  currentUser,
  notifications,
}: {
  currentUser: Doc<"users">;
  notifications: ReturnType<typeof useNotificationPrefs>;
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  return (
    <div className="relative border-t border-line p-3 pb-safe">
      {showSettings && (
        <SettingsMenu
          onClose={() => setShowSettings(false)}
          onEditProfile={() => setShowProfile(true)}
          notifications={notifications}
        />
      )}
      <div className="flex items-center gap-1">
        <button
          onClick={() => setShowProfile(true)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-subtle"
          aria-label="Open your profile"
        >
          <Avatar user={currentUser} size="md" showOnlineStatus />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight text-fg">{currentUser.name}</p>
            <p className="truncate text-xs text-muted">
              <span className="font-medium text-success">Online</span>
              {currentUser.bio ? ` · ${currentUser.bio}` : ""}
            </p>
          </div>
        </button>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={cn("icon-btn h-10 w-10", showSettings && "bg-subtle text-fg")}
          aria-label="Settings"
          aria-haspopup="menu"
          aria-expanded={showSettings}
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
      {showProfile && <ProfileModal user={currentUser} currentUser={currentUser} onClose={() => setShowProfile(false)} />}
    </div>
  );
}
