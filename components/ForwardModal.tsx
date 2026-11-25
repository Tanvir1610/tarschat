"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Doc, Id } from "@/convex/_generated/dataModel";
import { Check, CornerUpRight, MessageSquare, Search } from "lucide-react";
import { Avatar, GroupAvatar } from "./Avatar";
import { EmptyState, Modal, Skeleton, Spinner, errorMessage, useToast } from "./ui";
import { getConversationTitle, getOtherMember } from "@/lib/conversation";
import { cn, previewMessage } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

interface ForwardModalProps {
  message: ChatMessage;
  currentUser: Doc<"users">;
  onClose: () => void;
}

export function ForwardModal({ message, currentUser, onClose }: ForwardModalProps) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<Id<"conversations">>>(new Set());
  const [sending, setSending] = useState(false);
  const toast = useToast();

  const conversations = useQuery(api.conversations.getUserConversations, { userId: currentUser._id });
  const sendMessage = useMutation(api.messages.sendMessage);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (conversations ?? []).filter(
      (c) => !q || getConversationTitle(c, currentUser._id).toLowerCase().includes(q)
    );
  }, [conversations, query, currentUser._id]);

  const toggle = (id: Id<"conversations">) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleForward = async () => {
    if (selected.size === 0) return;
    setSending(true);
    // Each target is independent — report partial failures instead of failing everything
    const results = await Promise.allSettled(
      Array.from(selected).map((conversationId) =>
        sendMessage({
          conversationId,
          senderId: currentUser._id,
          content: message.content,
          forwarded: true,
          ...(message.attachment ? { attachment: message.attachment } : {}),
        })
      )
    );
    setSending(false);

    const failed = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    const ok = results.length - failed.length;
    if (failed.length === 0) {
      toast(`Forwarded to ${ok} conversation${ok > 1 ? "s" : ""}`);
      onClose();
    } else {
      toast(
        ok > 0
          ? `Forwarded to ${ok}, but ${failed.length} failed: ${errorMessage(failed[0].reason)}`
          : errorMessage(failed[0].reason, "Couldn't forward the message."),
        "error"
      );
    }
  };

  return (
    <Modal
      title="Forward message"
      icon={<CornerUpRight className="h-5 w-5" />}
      onClose={onClose}
      footer={
        <button onClick={handleForward} disabled={selected.size === 0 || sending} className="btn-primary w-full py-3">
          {sending ? <Spinner /> : <CornerUpRight className="h-4 w-4" />}
          {sending ? "Forwarding…" : selected.size > 0 ? `Forward to ${selected.size}` : "Select a conversation"}
        </button>
      }
    >
      <div className="border-b border-line p-4">
        <div className="mb-3 rounded-xl border-l-[3px] border-accent bg-subtle px-3 py-2">
          <p className="line-clamp-2 text-sm text-muted">{previewMessage(message)}</p>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            data-autofocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="field pl-9"
          />
        </div>
      </div>

      {!conversations ? (
        <div className="space-y-3 p-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-40" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title={query ? "No matches" : "No conversations yet"}
          description={query ? "Try a different name." : "Connect with someone first, then you can forward messages."}
        />
      ) : (
        <ul className="p-2" role="listbox" aria-multiselectable="true" aria-label="Conversations">
          {filtered.map((c) => {
            const isSel = selected.has(c._id);
            const other = getOtherMember(c, currentUser._id);
            const title = getConversationTitle(c, currentUser._id);
            return (
              <li key={c._id} role="option" aria-selected={isSel}>
                <button
                  onClick={() => toggle(c._id)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-subtle"
                >
                  {c.type === "group" ? <GroupAvatar name={title} /> : <Avatar user={other} />}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{title}</span>
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
