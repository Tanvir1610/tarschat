"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, ChevronDown, MessageCircleOff, Info, UserPlus, Users } from "lucide-react";
import { Avatar, GroupAvatar } from "./Avatar";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
import { AddMembersModal } from "./AddMembersModal";
import { ForwardModal } from "./ForwardModal";
import { ProfileModal } from "./ProfileModal";
import { EmptyState, Skeleton, errorMessage, useToast } from "./ui";
import { cn, formatDayLabel, formatLastSeen, isSameDay } from "@/lib/utils";
import { getOtherMember } from "@/lib/conversation";
import type { ChatMessage } from "@/lib/types";

interface ChatAreaProps {
  conversationId: Id<"conversations">;
  currentUser: Doc<"users">;
  onBack: () => void;
}

const GROUP_GAP_MS = 5 * 60 * 1000;

export function ChatArea({ conversationId, currentUser, onBack }: ChatAreaProps) {
  const messages = useQuery(api.messages.getMessages, { conversationId });
  const conversation = useQuery(api.conversations.getConversation, { conversationId });
  const typingUsers = useQuery(api.typing.getTypingUsers, {
    conversationId,
    currentUserId: currentUser._id,
  });
  const markAsRead = useMutation(api.messages.markAsRead);
  const sendMessage = useMutation(api.messages.sendMessage);
  const toast = useToast();

  const [showAddMembers, setShowAddMembers] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editing, setEditing] = useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const didInitialScroll = useRef(false);
  const lastSeenMessageId = useRef<string | null>(null);
  const [showNewMessages, setShowNewMessages] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
    isAtBottomRef.current = true;
    setShowNewMessages(false);
  }, []);

  const markRead = useCallback(() => {
    if (document.visibilityState === "visible") {
      markAsRead({ conversationId, userId: currentUser._id }).catch(() => {});
    }
  }, [markAsRead, conversationId, currentUser._id]);

  // Mark read when opening, and when the tab comes back into view
  useEffect(() => {
    markRead();
    document.addEventListener("visibilitychange", markRead);
    return () => document.removeEventListener("visibilitychange", markRead);
  }, [markRead]);

  // Follow new messages: jump on first load, then smooth-scroll if the reader is at the bottom
  useEffect(() => {
    if (!messages || messages.length === 0) return;
    const last = messages[messages.length - 1];

    if (!didInitialScroll.current) {
      didInitialScroll.current = true;
      lastSeenMessageId.current = last._id;
      scrollToBottom("auto");
      return;
    }
    if (lastSeenMessageId.current === last._id) return; // edit/reaction, not a new message
    lastSeenMessageId.current = last._id;

    if (isAtBottomRef.current || last.senderId === currentUser._id) {
      scrollToBottom("smooth");
      markRead();
    } else {
      setShowNewMessages(true);
    }
  }, [messages, currentUser._id, scrollToBottom, markRead]);

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setShowNewMessages(false);
      markRead();
    }
  }, [markRead]);

  const handleJumpTo = useCallback((id: string) => {
    const el = document.getElementById(`msg-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-flash");
    setTimeout(() => el.classList.remove("animate-flash"), 1300);
  }, []);

  const handleMediaLoad = useCallback(() => {
    if (isAtBottomRef.current) scrollToBottom("auto");
  }, [scrollToBottom]);

  const handleReply = useCallback((m: ChatMessage) => {
    setEditing(null);
    setReplyingTo(m);
  }, []);
  const handleEdit = useCallback((m: ChatMessage) => {
    setReplyingTo(null);
    setEditing(m);
  }, []);
  const handleForward = useCallback((m: ChatMessage) => setForwarding(m), []);

  const otherMember = conversation ? getOtherMember({ ...conversation, members: conversation.members }, currentUser._id) : null;
  const isGroup = conversation?.type === "group";
  const displayName = isGroup ? conversation?.name : otherMember?.name;
  const isGroupAdmin = isGroup && conversation?.adminId === currentUser._id;
  const typingNames = (typingUsers ?? []) as Doc<"users">[];

  // Group consecutive messages and insert date separators
  const rows = useMemo(() => {
    if (!messages) return [];
    return messages.map((msg, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const newDay = !prev || !isSameDay(prev._creationTime, msg._creationTime);
      const breaksFromPrev =
        newDay || prev.senderId !== msg.senderId || msg._creationTime - prev._creationTime > GROUP_GAP_MS;
      const breaksToNext =
        !next ||
        !isSameDay(next._creationTime, msg._creationTime) ||
        next.senderId !== msg.senderId ||
        next._creationTime - msg._creationTime > GROUP_GAP_MS;
      return { msg, newDay, isFirst: breaksFromPrev, isLast: breaksToNext };
    });
  }, [messages]);

  /* ───────── Unavailable conversation ───────── */
  const unavailable =
    conversation === null || (conversation && !conversation.memberIds.includes(currentUser._id));
  if (unavailable) {
    return (
      <div className="flex h-full flex-col bg-bg">
        <div className="pt-safe border-b border-line bg-surface px-2 py-3 md:hidden">
          <button onClick={onBack} className="icon-btn" aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <EmptyState
          className="flex-1"
          icon={<MessageCircleOff className="h-6 w-6" />}
          title="This conversation isn't available"
          description="It may have been removed, or you no longer have access to it."
          action={
            <button onClick={onBack} className="btn-primary">
              Back to conversations
            </button>
          }
        />
      </div>
    );
  }

  const subtitle = typingNames.length > 0
    ? { text: "typing…", tone: "accent" as const }
    : isGroup
    ? { text: `${conversation?.memberIds.length ?? 0} members`, tone: "muted" as const }
    : otherMember
    ? otherMember.isOnline
      ? { text: "Online", tone: "success" as const }
      : { text: formatLastSeen(otherMember.lastSeen), tone: "muted" as const }
    : null;

  return (
    <div className="chat-wash relative flex h-full flex-col bg-bg">
      {/* Header */}
      <header className="pt-safe z-10 border-b border-line bg-surface/85 backdrop-blur-xl">
        <div className="flex items-center gap-1.5 px-2 py-2.5 sm:gap-3 sm:px-4">
          <button onClick={onBack} className="icon-btn md:hidden" aria-label="Back to conversations">
            <ArrowLeft className="h-5 w-5" />
          </button>

          <button
            onClick={() => !isGroup && otherMember && setShowProfile(true)}
            disabled={isGroup || !otherMember}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-0.5 text-left transition-colors enabled:hover:bg-subtle"
            aria-label={isGroup ? displayName ?? "Group" : `View ${displayName ?? "user"}'s profile`}
          >
            {!conversation ? (
              <Skeleton className="h-11 w-11 rounded-full" />
            ) : isGroup ? (
              <GroupAvatar name={displayName ?? ""} />
            ) : (
              <Avatar user={otherMember ?? undefined} size="md" showOnlineStatus />
            )}
            <div className="min-w-0">
              {conversation ? (
                <>
                  <p className="truncate text-[15px] font-semibold leading-tight text-fg">{displayName}</p>
                  {subtitle && (
                    <p
                      className={cn(
                        "mt-0.5 truncate text-xs",
                        subtitle.tone === "success" && "font-medium text-success",
                        subtitle.tone === "accent" && "font-medium text-accent",
                        subtitle.tone === "muted" && "text-muted"
                      )}
                      aria-live="polite"
                    >
                      {isGroup && typingNames.length > 0
                        ? `${typingNames.map((u) => u.name.split(" ")[0]).join(", ")} typing…`
                        : subtitle.text}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Skeleton className="mb-1.5 h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </>
              )}
            </div>
          </button>

          {isGroupAdmin && (
            <button
              onClick={() => setShowAddMembers(true)}
              className="btn-ghost h-9 gap-1.5 px-2.5 text-accent hover:text-accent sm:px-3"
              aria-label="Add members"
            >
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Add</span>
            </button>
          )}
          {!isGroup && otherMember && (
            <button onClick={() => setShowProfile(true)} className="icon-btn" aria-label="Contact info">
              <Info className="h-5 w-5" />
            </button>
          )}
        </div>
      </header>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="log"
        aria-label="Messages"
        aria-live="polite"
        className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-thin sm:px-6"
      >
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {!messages ? (
            <div className="space-y-4" aria-busy="true" aria-label="Loading messages">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                  <Skeleton className={cn("h-11 rounded-2xl", i % 2 === 0 ? "w-52" : "w-40", i === 2 && "w-64")} />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <EmptyState
              className="my-auto"
              icon={isGroup ? <Users className="h-6 w-6" /> : <span className="text-2xl">👋</span>}
              title={isGroup ? `Welcome to ${displayName}` : `Say hello to ${displayName?.split(" ")[0] ?? "them"}`}
              description={
                isGroup
                  ? "This is the start of the group. Send the first message to get things going."
                  : "This is the start of your conversation. Messages are delivered in real time."
              }
              action={
                <button
                  className="btn-primary"
                  onClick={() =>
                    sendMessage({ conversationId, senderId: currentUser._id, content: "👋" }).catch((e) =>
                      toast(errorMessage(e, "Couldn't send message."), "error")
                    )
                  }
                >
                  Wave 👋
                </button>
              }
            />
          ) : (
            rows.map(({ msg, newDay, isFirst, isLast }) => (
              <div key={msg._id}>
                {newDay && (
                  <div className="my-4 flex justify-center">
                    <span className="rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">
                      {formatDayLabel(msg._creationTime)}
                    </span>
                  </div>
                )}
                <MessageBubble
                  message={msg}
                  currentUser={currentUser}
                  isGroup={!!isGroup}
                  isFirstInGroup={isFirst}
                  isLastInGroup={isLast}
                  onReply={handleReply}
                  onEdit={handleEdit}
                  onForward={handleForward}
                  onJumpTo={handleJumpTo}
                  onMediaLoad={handleMediaLoad}
                />
              </div>
            ))
          )}

          {typingNames.length > 0 && <TypingIndicator users={typingNames} />}
          <div ref={messagesEndRef} className="h-px scroll-mb-4" />
        </div>
      </div>

      {/* New messages pill */}
      {showNewMessages && (
        <div className="pointer-events-none absolute inset-x-0 bottom-28 z-10 flex justify-center">
          <button
            onClick={() => scrollToBottom("smooth")}
            className="bg-brand pointer-events-auto flex animate-pop-in items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-glow active:scale-95"
          >
            <ChevronDown className="h-4 w-4" />
            New messages
          </button>
        </div>
      )}

      <MessageInput
        conversationId={conversationId}
        currentUser={currentUser}
        replyingTo={replyingTo}
        editing={editing}
        onCancelReply={() => setReplyingTo(null)}
        onCancelEdit={() => setEditing(null)}
        onSent={() => scrollToBottom("smooth")}
      />

      {showAddMembers && conversation && (
        <AddMembersModal
          conversation={{ ...conversation, members: conversation.members }}
          currentUser={currentUser}
          onClose={() => setShowAddMembers(false)}
        />
      )}
      {showProfile && otherMember && (
        <ProfileModal user={otherMember} currentUser={currentUser} onClose={() => setShowProfile(false)} />
      )}
      {forwarding && (
        <ForwardModal message={forwarding} currentUser={currentUser} onClose={() => setForwarding(null)} />
      )}
    </div>
  );
}
