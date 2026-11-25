"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import type { ConversationListItem } from "@/lib/types";
import { getConversationTitle } from "@/lib/conversation";
import { previewMessage } from "@/lib/utils";

const KEY = "tars-notifications";

/** User preference for browser notifications (stored locally, needs browser permission) */
export function useNotificationPrefs() {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [enabled, setEnabledState] = useState(false);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    setSupported(true);
    setPermission(Notification.permission);
    try {
      setEnabledState(localStorage.getItem(KEY) === "on" && Notification.permission === "granted");
    } catch {}
  }, []);

  const setEnabled = useCallback(async (next: boolean) => {
    if (typeof Notification === "undefined") return false;
    if (next) {
      const result = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      setPermission(result);
      if (result !== "granted") {
        setEnabledState(false);
        return false;
      }
    }
    setEnabledState(next);
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {}
    return true;
  }, []);

  return { supported, permission, enabled, setEnabled };
}

/** Fires a browser notification when a new message arrives in a chat you're not looking at */
export function useNewMessageNotifier({
  currentUser,
  conversations,
  selectedId,
  enabled,
  onOpen,
}: {
  currentUser: Doc<"users">;
  conversations: ConversationListItem[] | undefined;
  selectedId: Id<"conversations"> | null;
  enabled: boolean;
  onOpen: (id: Id<"conversations">) => void;
}) {
  const seen = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!conversations) return;

    // First load only records what already exists — no notification flood on page open
    if (seen.current === null) {
      seen.current = new Map(
        conversations.filter((c) => c.lastMessageId).map((c) => [c._id, c.lastMessageId as string])
      );
      return;
    }

    for (const c of conversations) {
      const last = c.lastMessage;
      if (!last || seen.current.get(c._id) === last._id) continue;
      seen.current.set(c._id, last._id);

      const fromOther = last.senderId !== currentUser._id;
      const looking = document.visibilityState === "visible" && selectedId === c._id;
      if (!enabled || !fromOther || looking || Notification.permission !== "granted") continue;

      const sender = c.members.find((m) => m && m._id === last.senderId);
      const title = c.type === "group" ? `${sender?.name ?? "Someone"} · ${getConversationTitle(c, currentUser._id)}` : getConversationTitle(c, currentUser._id);
      try {
        const n = new Notification(title, { body: previewMessage(last).slice(0, 140), tag: c._id });
        n.onclick = () => {
          window.focus();
          onOpen(c._id);
          n.close();
        };
      } catch {
        /* some mobile browsers only allow notifications via service workers */
      }
    }
  }, [conversations, currentUser, selectedId, enabled, onOpen]);
}
