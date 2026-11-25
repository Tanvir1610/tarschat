"use client";

import { memo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc } from "@/convex/_generated/dataModel";
import {
  Ban,
  Copy,
  CornerUpRight,
  Download,
  FileText,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Reply,
  SmilePlus,
  Trash2,
} from "lucide-react";
import { Avatar } from "./Avatar";
import { errorMessage, useDismiss, useToast } from "./ui";
import { cn, formatBytes, formatClock, formatDuration, previewMessage } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface MessageBubbleProps {
  message: ChatMessage;
  currentUser: Doc<"users">;
  isGroup: boolean;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  onReply: (m: ChatMessage) => void;
  onEdit: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
  onJumpTo: (id: string) => void;
  onMediaLoad: () => void;
}

function MessageBubbleImpl({
  message,
  currentUser,
  isGroup,
  isFirstInGroup,
  isLastInGroup,
  onReply,
  onEdit,
  onForward,
  onJumpTo,
  onMediaLoad,
}: MessageBubbleProps) {
  const [popover, setPopover] = useState<"react" | "more" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  const isOwn = message.senderId === currentUser._id;
  const deleteMessage = useMutation(api.messages.deleteMessage);
  const toggleReaction = useMutation(api.messages.toggleReaction);

  useDismiss(
    toolbarRef,
    () => {
      setPopover(null);
      setConfirmDelete(false);
    },
    popover !== null
  );

  const close = () => {
    setPopover(null);
    setConfirmDelete(false);
    setSheetOpen(false);
  };

  const handleDelete = async () => {
    try {
      await deleteMessage({ messageId: message._id, userId: currentUser._id });
      close();
    } catch (e) {
      toast(errorMessage(e, "Couldn't delete the message."), "error");
    }
  };

  const handleReaction = async (emoji: string) => {
    close();
    try {
      await toggleReaction({ messageId: message._id, userId: currentUser._id, emoji });
    } catch (e) {
      toast(errorMessage(e, "Couldn't add reaction."), "error");
    }
  };

  const handleCopy = async () => {
    close();
    try {
      await navigator.clipboard.writeText(message.content);
      toast("Copied to clipboard");
    } catch {
      toast("Couldn't copy — your browser blocked clipboard access.", "error");
    }
  };

  const hasText = message.content.trim().length > 0;
  const canEdit = isOwn && message.attachment?.kind !== "audio";
  const fresh = Date.now() - message._creationTime < 3000;

  /* One action list powers the desktop menu and the mobile sheet */
  const actions = message.isDeleted
    ? []
    : [
        { key: "reply", label: "Reply", icon: Reply, run: () => { close(); onReply(message); } },
        { key: "forward", label: "Forward", icon: CornerUpRight, run: () => { close(); onForward(message); } },
        ...(hasText ? [{ key: "copy", label: "Copy text", icon: Copy, run: handleCopy }] : []),
        ...(canEdit ? [{ key: "edit", label: "Edit", icon: Pencil, run: () => { close(); onEdit(message); } }] : []),
      ];

  const radius = isOwn
    ? cn("rounded-2xl", !isFirstInGroup && "rounded-tr-md", !isLastInGroup && "rounded-br-md", isLastInGroup && "rounded-br-md")
    : cn("rounded-2xl", !isFirstInGroup && "rounded-tl-md", !isLastInGroup && "rounded-bl-md", isLastInGroup && "rounded-bl-md");

  const onBubbleClick = () => {
    // Touch devices have no hover — tapping opens the action sheet
    if (!message.isDeleted && window.matchMedia("(hover: none)").matches) setSheetOpen(true);
  };

  return (
    <div
      id={`msg-${message._id}`}
      data-own={isOwn}
      className={cn(
        "group flex items-end gap-2 rounded-2xl",
        popover && "relative z-30", // lift the row so its menu isn't covered by later messages
        isOwn ? "flex-row-reverse" : "flex-row",
        isFirstInGroup ? "mt-3" : "mt-0.5",
        fresh && "animate-msg-in"
      )}
    >
      {/* Avatar column (other people, bottom of each run) */}
      {!isOwn && (
        <div className="w-8 shrink-0">
          {isLastInGroup && <Avatar user={message.sender} size="sm" />}
        </div>
      )}

      <div className={cn("flex min-w-0 max-w-[82%] flex-col sm:max-w-[70%] lg:max-w-[34rem]", isOwn && "items-end")}>
        {isGroup && !isOwn && isFirstInGroup && (
          <span className="mb-1 ml-3 text-xs font-semibold text-accent">{message.sender?.name}</span>
        )}

        <div className="relative flex items-center gap-1" ref={toolbarRef}>
          {/* Hover toolbar — desktop. Sits before the bubble for own messages, after for others */}
          {!message.isDeleted && (
            <div
              className={cn(
                "relative z-10 hidden items-center gap-0.5 rounded-xl border border-line bg-elevated p-0.5 opacity-0 shadow-soft transition-opacity",
                "pointer-events-none [@media(hover:hover)]:flex group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100",
                popover && "!pointer-events-auto !opacity-100",
                isOwn ? "order-first" : "order-last"
              )}
            >
              <button
                onClick={() => setPopover(popover === "react" ? null : "react")}
                className="icon-btn h-7 w-7"
                aria-label="Add reaction"
                aria-expanded={popover === "react"}
              >
                <SmilePlus className="h-4 w-4" />
              </button>
              <button onClick={() => onReply(message)} className="icon-btn h-7 w-7" aria-label="Reply">
                <Reply className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPopover(popover === "more" ? null : "more")}
                className="icon-btn h-7 w-7"
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={popover === "more"}
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>

              {popover === "react" && (
                <div
                  className={cn(
                    "absolute top-full z-20 mt-1 flex animate-pop-in gap-0.5 rounded-2xl border border-line bg-elevated p-1.5 shadow-pop",
                    isOwn ? "right-0" : "left-0"
                  )}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => handleReaction(emoji)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl text-xl transition hover:scale-125 hover:bg-subtle"
                      aria-label={`React with ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {popover === "more" && (
                <div
                  role="menu"
                  className={cn(
                    "absolute top-full z-20 mt-1 w-44 animate-pop-in rounded-2xl border border-line bg-elevated p-1.5 shadow-pop",
                    isOwn ? "right-0" : "left-0"
                  )}
                >
                  {actions.map(({ key, label, icon: Icon, run }) => (
                    <button
                      key={key}
                      role="menuitem"
                      onClick={run}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg transition-colors hover:bg-subtle"
                    >
                      <Icon className="h-4 w-4 text-muted" />
                      {label}
                    </button>
                  ))}
                  {isOwn &&
                    (confirmDelete ? (
                      <div className="mt-1 rounded-xl bg-danger/10 p-2.5">
                        <p className="mb-2 text-xs font-medium text-danger">Delete for everyone?</p>
                        <div className="flex gap-1.5">
                          <button onClick={handleDelete} className="flex-1 rounded-lg bg-danger py-1.5 text-xs font-semibold text-white active:scale-95">
                            Delete
                          </button>
                          <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded-lg bg-subtle py-1.5 text-xs font-medium text-fg active:scale-95">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        role="menuitem"
                        onClick={() => setConfirmDelete(true)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* Bubble */}
          <div
            onClick={onBubbleClick}
            className={cn(
              "relative min-w-0 px-3.5 py-2 text-[15px] leading-snug",
              radius,
              message.isDeleted
                ? "border border-dashed border-line bg-transparent text-muted"
                : isOwn
                ? "bg-brand text-white shadow-soft"
                : "border border-line bg-elevated text-fg shadow-soft"
            )}
          >
            {message.isDeleted ? (
              <p className="flex items-center gap-1.5 text-sm italic">
                <Ban className="h-3.5 w-3.5" /> This message was deleted
              </p>
            ) : (
              <>
                {message.forwarded && (
                  <p className={cn("mb-1 flex items-center gap-1 text-xs font-medium", isOwn ? "text-white/80" : "text-muted")}>
                    <CornerUpRight className="h-3 w-3" /> Forwarded
                  </p>
                )}

                {message.replyTo && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onJumpTo(message.replyTo!._id);
                    }}
                    className={cn(
                      "mb-1.5 block w-full rounded-lg border-l-[3px] px-2.5 py-1.5 text-left transition-colors",
                      isOwn
                        ? "border-white/70 bg-white/15 hover:bg-white/20"
                        : "border-accent bg-subtle hover:bg-line/60"
                    )}
                  >
                    <span className={cn("block text-xs font-semibold", isOwn ? "text-white" : "text-accent")}>
                      {message.replyTo.senderName}
                    </span>
                    <span className={cn("line-clamp-2 text-xs", isOwn ? "text-white/85" : "text-muted")}>
                      {previewMessage({
                        content: message.replyTo.content,
                        isDeleted: message.replyTo.isDeleted,
                        attachment: message.replyTo.attachmentKind
                          ? { kind: message.replyTo.attachmentKind }
                          : null,
                      })}
                    </span>
                  </button>
                )}

                {message.attachment && (
                  <Attachment message={message} isOwn={isOwn} onLoad={onMediaLoad} />
                )}

                {hasText && (
                  <p className={cn("whitespace-pre-wrap break-words [overflow-wrap:anywhere]", message.attachment && "mt-1.5")}>
                    <Linkified text={message.content} isOwn={isOwn} />
                  </p>
                )}
              </>
            )}

            {/* Meta row */}
            <span
              className={cn(
                "mt-0.5 flex select-none items-center justify-end gap-1 text-[11px] tabular-nums",
                isOwn && !message.isDeleted ? "text-white/75" : "text-muted"
              )}
            >
              {message.editedAt && !message.isDeleted && <span>edited</span>}
              <time dateTime={new Date(message._creationTime).toISOString()}>
                {formatClock(message._creationTime)}
              </time>
            </span>
          </div>
        </div>

        {/* Reactions */}
        {!message.isDeleted && message.reactions && message.reactions.length > 0 && (
          <div className={cn("mt-1 flex flex-wrap gap-1", isOwn ? "justify-end" : "justify-start")}>
            {message.reactions.map((reaction) => {
              const mine = reaction.userIds.includes(currentUser._id);
              return (
                <button
                  key={reaction.emoji}
                  onClick={() => handleReaction(reaction.emoji)}
                  aria-pressed={mine}
                  aria-label={`${reaction.emoji} ${reaction.userIds.length}${mine ? ", you reacted" : ""}`}
                  className={cn(
                    "flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition active:scale-95",
                    mine
                      ? "border-accent/50 bg-accent/15 text-accent"
                      : "border-line bg-elevated text-muted hover:border-accent/40"
                  )}
                >
                  <span className="text-sm leading-none">{reaction.emoji}</span>
                  <span className="tabular-nums">{reaction.userIds.length}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Mobile action sheet */}
      {sheetOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end bg-black/50 backdrop-blur-[2px] animate-fade-in"
          onClick={close}
        >
          <div
            role="dialog"
            aria-label="Message actions"
            className="w-full animate-sheet-up rounded-t-3xl border-t border-line bg-elevated p-3 pb-safe shadow-pop"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" aria-hidden />
            <div className="mb-2 flex justify-between rounded-2xl bg-subtle p-1.5">
              {REACTION_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl active:scale-90 active:bg-line"
                  aria-label={`React with ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {actions.map(({ key, label, icon: Icon, run }) => (
              <button
                key={key}
                onClick={run}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-fg active:bg-subtle"
              >
                <Icon className="h-5 w-5 text-muted" />
                {label}
              </button>
            ))}
            {isOwn && (
              <button
                onClick={handleDelete}
                className="flex min-h-[48px] w-full items-center gap-3 rounded-xl px-3 text-[15px] text-danger active:bg-danger/10"
              >
                <Trash2 className="h-5 w-5" />
                Delete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Messages re-render a lot while typing indicators and reactions change
export const MessageBubble = memo(MessageBubbleImpl);

/* ───────── Pieces ───────── */

function Attachment({
  message,
  isOwn,
  onLoad,
}: {
  message: ChatMessage;
  isOwn: boolean;
  onLoad: () => void;
}) {
  const att = message.attachment!;
  const url = message.attachmentUrl;

  if (!url) {
    return <p className="text-sm italic opacity-75">Attachment unavailable</p>;
  }

  if (att.kind === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={att.name}
          loading="lazy"
          onLoad={onLoad}
          className="max-h-72 min-h-[6rem] w-full min-w-[10rem] rounded-xl bg-black/10 object-cover"
        />
      </a>
    );
  }

  if (att.kind === "audio") {
    return <AudioPlayer src={url} durationMs={att.durationMs} isOwn={isOwn} />;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "flex min-w-[12rem] items-center gap-3 rounded-xl p-2.5 transition-colors",
        isOwn ? "bg-white/15 hover:bg-white/20" : "bg-subtle hover:bg-line/60"
      )}
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", isOwn ? "bg-white/20" : "bg-accent/15 text-accent")}>
        <FileText className="h-5 w-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{att.name}</span>
        <span className={cn("text-xs", isOwn ? "text-white/75" : "text-muted")}>{formatBytes(att.size)}</span>
      </span>
      <Download className="h-4 w-4 shrink-0 opacity-70" />
    </a>
  );
}

function AudioPlayer({ src, durationMs, isOwn }: { src: string; durationMs?: number; isOwn: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const total = durationMs ?? 0;

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    if (!a) return;
    if (a.paused) a.play().catch(() => setPlaying(false));
    else a.pause();
  };

  return (
    <div className="flex min-w-[13rem] items-center gap-3" onClick={(e) => e.stopPropagation()}>
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const a = e.currentTarget;
          const dur = Number.isFinite(a.duration) && a.duration > 0 ? a.duration : total / 1000;
          if (dur > 0) setProgress(a.currentTime / dur);
        }}
      />
      <button
        onClick={toggle}
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-90",
          isOwn ? "bg-white text-[rgb(var(--brand-from))]" : "bg-brand text-white"
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className={cn("h-1.5 overflow-hidden rounded-full", isOwn ? "bg-white/30" : "bg-line")}>
          <div
            className={cn("h-full rounded-full transition-[width] duration-150", isOwn ? "bg-white" : "bg-accent")}
            style={{ width: `${Math.min(100, progress * 100)}%` }}
          />
        </div>
        <span className={cn("mt-1 block text-[11px] tabular-nums", isOwn ? "text-white/75" : "text-muted")}>
          {total ? formatDuration(total) : "Voice message"}
        </span>
      </div>
    </div>
  );
}

const URL_RE = /(https?:\/\/[^\s<]+[^\s<.,;:!?)"'\]])/g;

function Linkified({ text, isOwn }: { text: string; isOwn: boolean }) {
  const parts = text.split(URL_RE);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onClick={(e) => e.stopPropagation()}
            className={cn("underline decoration-1 underline-offset-2", isOwn ? "text-white" : "text-accent")}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
