"use client";

import { useRef } from "react";
import { useClerk } from "@clerk/nextjs";
import { Bell, BellOff, LogOut, Monitor, Moon, Sun, UserRound } from "lucide-react";
import { useTheme, type ThemePreference } from "./ThemeProvider";
import { useDismiss, useToast } from "./ui";
import { useNotificationPrefs } from "@/hooks/useDesktopNotifications";
import { cn } from "@/lib/utils";

const THEMES: { id: ThemePreference; label: string; icon: typeof Sun }[] = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
];

interface SettingsMenuProps {
  onClose: () => void;
  onEditProfile: () => void;
  notifications: ReturnType<typeof useNotificationPrefs>;
}

export function SettingsMenu({ onClose, onEditProfile, notifications }: SettingsMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { preference, setPreference } = useTheme();
  const { signOut } = useClerk();
  const toast = useToast();
  useDismiss(ref, onClose);

  const { supported, permission, enabled, setEnabled } = notifications;

  const toggleNotifications = async () => {
    const ok = await setEnabled(!enabled);
    if (!ok && !enabled) {
      toast(
        permission === "denied"
          ? "Notifications are blocked. Allow them in your browser's site settings."
          : "Notification permission wasn't granted.",
        "error"
      );
    }
  };

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Settings"
      className="absolute bottom-full left-0 right-0 z-30 mb-2 animate-pop-in rounded-2xl border border-line bg-elevated p-2 shadow-pop"
    >
      <button
        role="menuitem"
        onClick={() => {
          onClose();
          onEditProfile();
        }}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-subtle"
      >
        <UserRound className="h-4 w-4 text-muted" />
        Edit profile
      </button>

      <div className="my-1.5 h-px bg-line" />

      <div className="px-3 pb-1 pt-1.5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted">Appearance</p>
        <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-1 rounded-xl bg-subtle p-1">
          {THEMES.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="radio"
              aria-checked={preference === id}
              onClick={() => setPreference(id)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg py-2 text-[11px] font-medium transition",
                preference === id ? "bg-elevated text-fg shadow-soft" : "text-muted hover:text-fg"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="my-1.5 h-px bg-line" />

      {supported ? (
        <button
          role="menuitemcheckbox"
          aria-checked={enabled}
          onClick={toggleNotifications}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-subtle"
        >
          {enabled ? <Bell className="h-4 w-4 text-accent" /> : <BellOff className="h-4 w-4 text-muted" />}
          <span className="flex-1 text-left">Desktop notifications</span>
          <span
            aria-hidden
            className={cn("relative h-5 w-9 rounded-full transition-colors", enabled ? "bg-brand" : "bg-line")}
          >
            <span
              className={cn(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
                enabled ? "left-[1.125rem]" : "left-0.5"
              )}
            />
          </span>
        </button>
      ) : (
        <p className="px-3 py-2 text-xs text-muted">Notifications aren&apos;t supported in this browser.</p>
      )}

      <div className="my-1.5 h-px bg-line" />

      <button
        role="menuitem"
        onClick={() => signOut({ redirectUrl: "/sign-in" })}
        className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-danger transition-colors hover:bg-danger/10"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
