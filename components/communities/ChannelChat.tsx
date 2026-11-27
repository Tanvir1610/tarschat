"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useMutation, usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";
import { ArrowUp, Ban, ChevronDown, Crown, EyeOff, Flag, Hash, Lock, Megaphone, MessagesSquare, MoreHorizontal, Shield, Smile, Trash2, UserX } from "lucide-react";
import { Avatar } from "../Avatar";
import { EmojiPicker } from "../EmojiPicker";
import { EmptyState, Skeleton, Spinner, errorMessage, useDismiss, useToast } from "../ui";
import { ReportModal } from "./ReportModal";
import { LIMITS, isStaff, type ChannelInfo, type CommunityMessage, type Role } from "@/lib/communities";
import { cn, formatClock, formatDayLabel, isSameDay } from "@/lib/utils";

const GROUP_GAP_MS = 5 * 60 * 1000;

interface Props {
  channel: ChannelInfo;
  communityName: string;
  myRole: Role;
  me: Doc<"users">;
}

export function ChannelChat({ channel, communityName, myRole, me }: Props) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.communityMessages.list,
    { channelId: channel._id },
    { initialNumItems: 30 }
  );
  const send = useMutation(api.communityMessages.send);
  const toast = useToast();

  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const anchor = useRef<{ height: number; top: number } | null>(null);
  const lastNewest = useRef<string | null>(null);
  const initialised = useRef(false);

  const ordered = useMemo(() => [...results].reverse(), [results]);
  const canPost = !channel.postingRestricted || isStaff(myRole);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    endRef.current?.scrollIntoView({ behavior, block: "end" });
    atBottom.current = true;
    setShowNew(false);
  }, []);

  // Keep the viewport steady when older messages are prepended; follow new ones when at the bottom
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || results.length === 0) return;
    if (anchor.current) {
      el.scrollTop = el.scrollHeight - anchor.current.height + anchor.current.top;
      anchor.current = null;
      return;
    }
    const newest = results[0]._id;
    if (!initialised.current) {
      initialised.current = true;
      lastNewest.current = newest;
      scrollToBottom("auto");
      return;
    }
    if (lastNewest.current === newest) return;
    lastNewest.current = newest;
    if (atBottom.current || results[0].senderId === me._id) scrollToBottom("smooth");
    else setShowNew(true);
  }, [results, me._id, scrollToBottom]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
    if (atBottom.current) setShowNew(false);
  };

  const handleLoadOlder = () => {
    const el = scrollRef.current;
    if (el) anchor.current = { height: el.scrollHeight, top: el.scrollTop };
    loadMore(30);
  };

  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [text]);

  const handleSend = async () => {
    const body = text.trim();
    if (!body || sending || !canPost) return;
    setSending(true);
    setSendError(null);
    try {
      await send({ channelId: channel._id, content: body });
      setText("");
      requestAnimationFrame(() => scrollToBottom("smooth"));
    } catch (e) {
      setSendError(errorMessage(e, "Couldn't send your message."));
    } finally {
      setSending(false);
      taRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const touch = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !touch) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = taRef.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + emoji + text.slice(end));
    requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(start + emoji.length, start + emoji.length); });
  };

  const rows = useMemo(
    () =>
      ordered.map((m, i) => {
        const prev = ordered[i - 1];
        const next = ordered[i + 1];
        const newDay = !prev || !isSameDay(prev._creationTime, m._creationTime);
        const first = newDay || prev.senderId !== m.senderId || m._creationTime - prev._creationTime > GROUP_GAP_MS;
        const last = !next || !isSameDay(next._creationTime, m._creationTime) || next.senderId !== m.senderId || next._creationTime - m._creationTime > GROUP_GAP_MS;
        return { m, newDay, first, last };
      }),
    [ordered]
  );

  const ChannelIcon = channel.kind === "announcements" ? Megaphone : Hash;

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} role="log" aria-label={`#${channel.name} messages`} aria-live="polite" className="flex-1 overflow-y-auto overscroll-contain px-3 py-4 scrollbar-thin sm:px-6">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col">
          {status === "LoadingFirstPage" ? (
            <div className="space-y-5" aria-busy="true" aria-label="Loading messages">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3"><Skeleton className="h-8 w-8 shrink-0 rounded-full" /><div className="space-y-2"><Skeleton className="h-3 w-24" /><Skeleton className={cn("h-4", i % 2 ? "w-64" : "w-44")} /></div></div>
              ))}
            </div>
          ) : (
            <>
              {status === "CanLoadMore" && (
                <button onClick={handleLoadOlder} className="mx-auto mb-3 rounded-full border border-line bg-elevated px-4 py-1.5 text-xs font-semibold text-muted transition hover:text-fg">Load older messages</button>
              )}
              {status === "LoadingMore" && <div className="mx-auto mb-3"><Spinner /></div>}
              {status === "Exhausted" && (
                <div className="mb-4 mt-auto pt-6 text-center">
                  <div className="bg-brand mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl text-white shadow-glow"><ChannelIcon className="h-6 w-6" /></div>
                  <p className="text-lg font-bold text-fg">Welcome to #{channel.name}</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm text-muted">{channel.description ?? `This is the start of #${channel.name} in ${communityName}.`}</p>
                </div>
              )}
              {ordered.length === 0 && status === "Exhausted" ? (
                <EmptyState className="pt-2" icon={<MessagesSquare className="h-6 w-6" />} title="No messages yet" description={canPost ? "Say something to get the conversation started." : "Only moderators can post here."} />
              ) : (
                rows.map(({ m, newDay, first, last }) => (
                  <div key={m._id}>
                    {newDay && (
                      <div className="my-4 flex justify-center">
                        <span className="rounded-full border border-line bg-surface/80 px-3 py-1 text-xs font-medium text-muted backdrop-blur">{formatDayLabel(m._creationTime)}</span>
                      </div>
                    )}
                    <Row message={m} mine={m.senderId === me._id} first={first} last={last} toast={toast} />
                  </div>
                ))
              )}
            </>
          )}
          <div ref={endRef} className="h-px scroll-mb-4" />
        </div>
      </div>

      {showNew && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center">
          <button onClick={() => scrollToBottom("smooth")} className="bg-brand pointer-events-auto flex animate-pop-in items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-glow active:scale-95">
            <ChevronDown className="h-4 w-4" /> New messages
          </button>
        </div>
      )}

      {/* Composer */}
      <div className="relative border-t border-line bg-surface/90 px-3 pt-2.5 pb-safe backdrop-blur sm:px-4">
        {!canPost ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl bg-subtle px-4 py-3 text-sm text-muted">
            <Lock className="h-4 w-4" /> Only moderators can post in #{channel.name}
          </div>
        ) : (
          <>
            {sendError && (
              <div role="alert" className="mb-2 rounded-xl bg-danger/10 px-3 py-2 text-xs font-medium text-danger">{sendError}</div>
            )}
            <div className="flex items-end gap-1.5">
              <div className="relative min-w-0 flex-1">
                <textarea
                  ref={taRef}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  maxLength={LIMITS.messageMax + 100}
                  aria-label={`Message #${channel.name}`}
                  placeholder={`Message #${channel.name}`}
                  className="max-h-36 min-h-[44px] w-full resize-none rounded-2xl border border-line bg-subtle py-[11px] pl-4 pr-11 text-[15px] leading-snug text-fg placeholder:text-muted transition-colors scrollbar-hide focus:border-accent/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
                />
                <button onClick={() => setShowEmoji((s) => !s)} className={cn("absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:text-fg", showEmoji && "text-accent")} aria-label="Emoji picker" aria-expanded={showEmoji}>
                  <Smile className="h-5 w-5" />
                </button>
                {showEmoji && <EmojiPicker onPick={insertEmoji} onClose={() => setShowEmoji(false)} className="absolute bottom-full right-0 z-30 mb-2" />}
              </div>
              <button onClick={handleSend} disabled={!text.trim() || sending} aria-label="Send message" className="bg-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white shadow-glow transition active:scale-90 disabled:opacity-40 disabled:shadow-none">
                {sending ? <Spinner className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
              </button>
            </div>
            {text.length > LIMITS.messageMax - 200 && (
              <p className={cn("mt-1 px-1 text-right text-[11px] tabular-nums", text.length > LIMITS.messageMax ? "text-danger" : "text-muted")}>{text.length}/{LIMITS.messageMax}</p>
            )}
          </>
        )}
      </div>
    </div>
  );

}

/* ───────── single message ───────── */
type RowProps = { message: CommunityMessage; mine: boolean; first: boolean; last: boolean; toast: (m: string, k?: "success" | "error") => void };

const Row = memo(function Row({ message: m, mine, first, last, toast }: RowProps) {
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, () => setMenu(false), menu);

  const remove = useMutation(api.communityMessages.remove);
  const block = useMutation(api.moderation.blockUser);
  const reportMessage = useMutation(api.moderation.reportMessage);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMenu(false);
    try { await fn(); toast(ok); } catch (e) { toast(errorMessage(e), "error"); }
  };

  const hasMenu = !m.isDeleted;
  const senderName = m.sender?.name ?? "Former member";

  return (
    <div
      id={`cmsg-${m._id}`}
      onClick={() => {
        // Touch devices have no hover — tapping a message opens its actions
        if (hasMenu && window.matchMedia("(hover: none)").matches && !window.getSelection()?.toString()) setMenu((v) => !v);
      }}
      className={cn("group relative flex gap-3 rounded-xl px-2 py-0.5 hover:bg-subtle/60", menu && "bg-subtle/60", first ? "mt-3" : "mt-0")}
    >
      <div className="w-9 shrink-0 pt-0.5">
        {first && m.sender && <Avatar user={{ ...(m.sender as unknown as Doc<"users">) }} size="sm" />}
      </div>
      <div className="min-w-0 flex-1">
        {first && (
          <p className="flex items-center gap-2 text-sm">
            <span className="truncate font-semibold text-fg">{senderName}</span>
            {m.senderRole === "owner" && <span className="inline-flex items-center gap-1 rounded-full bg-warn/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn"><Crown className="h-2.5 w-2.5" />Owner</span>}
            {m.senderRole === "moderator" && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent"><Shield className="h-2.5 w-2.5" />Mod</span>}
            <time className="text-[11px] text-muted" dateTime={new Date(m._creationTime).toISOString()}>{formatClock(m._creationTime)}</time>
          </p>
        )}
        {m.isDeleted ? (
          <p className="flex items-center gap-1.5 text-sm italic text-muted"><Ban className="h-3.5 w-3.5" /> {m.deletedByModerator ? "Removed by a moderator" : "This message was deleted"}</p>
        ) : m.blocked && !revealed ? (
          <p className="flex items-center gap-1.5 text-sm italic text-muted"><EyeOff className="h-3.5 w-3.5" /> Message from a blocked user</p>
        ) : (
          <p className="whitespace-pre-wrap break-words text-[15px] leading-snug text-fg [overflow-wrap:anywhere]">{m.content}</p>
        )}
        {!first && last && <span className="sr-only">{formatClock(m._creationTime)}</span>}
      </div>

      {hasMenu && (
        <div ref={ref} className={cn("absolute right-2 top-0 -translate-y-1/2", !menu && "[@media(hover:none)]:hidden")}>
          <button
            onClick={() => setMenu((v) => !v)}
            aria-label="Message actions"
            aria-haspopup="menu"
            aria-expanded={menu}
            className={cn("flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-elevated text-muted shadow-soft transition hover:text-fg",
              "opacity-0 focus-visible:opacity-100 group-hover:opacity-100", menu && "!opacity-100")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menu && (
            <div role="menu" className="absolute right-0 top-full z-20 mt-1 w-48 animate-pop-in rounded-2xl border border-line bg-elevated p-1.5 shadow-pop">
              {!mine && (
                <>
                  <button role="menuitem" onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle"><Flag className="h-4 w-4 text-muted" /> Report message</button>
                  <button role="menuitem" onClick={() => run(() => block({ userId: m.senderId }), `Blocked ${senderName}`)} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle"><UserX className="h-4 w-4 text-muted" /> Block {senderName.split(" ")[0]}</button>
                </>
              )}
              {m.blocked && <button role="menuitem" onClick={() => { setRevealed((v) => !v); setMenu(false); }} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-fg hover:bg-subtle"><EyeOff className="h-4 w-4 text-muted" /> {revealed ? "Hide" : "Show"} message</button>}
              {m.canRemove && (
                <button role="menuitem" onClick={() => run(() => remove({ messageId: m._id }), "Message removed")} className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-danger hover:bg-danger/10"><Trash2 className="h-4 w-4" /> {mine ? "Delete" : "Remove as moderator"}</button>
              )}
            </div>
          )}
        </div>
      )}

      {reporting && (
        <ReportModal
          title="Report message"
          subject={m.content}
          onClose={() => setReporting(false)}
          onSubmit={(reason, details) => reportMessage({ messageId: m._id, reason, details: details || undefined })}
        />
      )}
    </div>
  );
});
