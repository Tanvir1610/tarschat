"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import {
  ArrowUp,
  Check,
  FileText,
  Image as ImageIcon,
  Mic,
  Paperclip,
  Pencil,
  Reply,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { Spinner, errorMessage, useDismiss, useToast } from "./ui";
import { cn, formatBytes, formatDuration, previewMessage } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_CHARS = 4000;

interface MessageInputProps {
  conversationId: Id<"conversations">;
  currentUser: Doc<"users">;
  replyingTo: ChatMessage | null;
  editing: ChatMessage | null;
  onCancelReply: () => void;
  onCancelEdit: () => void;
  onSent: () => void;
}

type AttachmentKind = "image" | "file" | "audio";
interface PendingFile {
  file: Blob;
  name: string;
  mimeType: string;
  kind: AttachmentKind;
  previewUrl?: string;
  durationMs?: number;
}

export function MessageInput({
  conversationId,
  currentUser,
  replyingTo,
  editing,
  onCancelReply,
  onCancelEdit,
  onSent,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const attachRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTypingPing = useRef(0);
  const toast = useToast();

  const sendMessage = useMutation(api.messages.sendMessage);
  const editMessage = useMutation(api.messages.editMessage);
  const generateUploadUrl = useMutation(api.messages.generateUploadUrl);
  const setTyping = useMutation(api.typing.setTyping);

  const voice = useVoiceRecorder((blob, durationMs, mimeType) => {
    setPending({
      file: blob,
      name: `Voice message.${mimeType.includes("mp4") ? "m4a" : "webm"}`,
      mimeType,
      kind: "audio",
      durationMs,
    });
  });

  useDismiss(attachRef, () => setShowAttach(false), showAttach);

  // Auto-size textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [content]);

  // Entering edit mode loads the message; replying focuses the box
  useEffect(() => {
    if (editing) {
      setContent(editing.content);
      setPending(null);
      textareaRef.current?.focus();
    }
  }, [editing]);
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  // Release object URLs + stop typing flag on unmount
  useEffect(
    () => () => {
      if (pending?.previewUrl) URL.revokeObjectURL(pending.previewUrl);
    },
    [pending]
  );
  useEffect(
    () => () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      setTyping({ userId: currentUser._id, conversationId, isTyping: false }).catch(() => {});
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [conversationId, currentUser._id]
  );

  const handleTyping = useCallback(() => {
    const now = Date.now();
    // Throttle: one mutation per second instead of one per keystroke
    if (now - lastTypingPing.current > 1000) {
      lastTypingPing.current = now;
      setTyping({ userId: currentUser._id, conversationId, isTyping: true }).catch(() => {});
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      lastTypingPing.current = 0;
      setTyping({ userId: currentUser._id, conversationId, isTyping: false }).catch(() => {});
    }, 2000);
  }, [currentUser._id, conversationId, setTyping]);

  const stopTyping = () => {
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    lastTypingPing.current = 0;
    setTyping({ userId: currentUser._id, conversationId, isTyping: false }).catch(() => {});
  };

  const pickFile = (file: File | undefined, kind: AttachmentKind) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toast(`That file is ${formatBytes(file.size)} — the limit is 10 MB.`, "error");
      return;
    }
    const isImage = file.type.startsWith("image/");
    setPending({
      file,
      name: file.name,
      mimeType: file.type || "application/octet-stream",
      kind: kind === "image" && isImage ? "image" : "file",
      previewUrl: isImage ? URL.createObjectURL(file) : undefined,
    });
    setShowAttach(false);
    textareaRef.current?.focus();
  };

  const upload = async (p: PendingFile) => {
    const url = await generateUploadUrl();
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": p.mimeType },
      body: p.file,
    });
    if (!res.ok) throw new Error("Upload failed");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return {
      storageId,
      name: p.name,
      mimeType: p.mimeType,
      size: p.file.size,
      kind: p.kind,
      ...(p.durationMs ? { durationMs: p.durationMs } : {}),
    };
  };

  const handleSend = async () => {
    const trimmed = content.trim();
    if ((!trimmed && !pending && !editing) || isSending) return;
    if (trimmed.length > MAX_CHARS) {
      setSendError(`Messages are limited to ${MAX_CHARS} characters.`);
      return;
    }

    setSendError(null);
    setIsSending(true);
    stopTyping();

    try {
      if (editing) {
        if (!trimmed && !editing.attachment) return;
        await editMessage({ messageId: editing._id, userId: currentUser._id, content: trimmed });
        onCancelEdit();
        setContent("");
      } else {
        const attachment = pending ? await upload(pending) : undefined;
        await sendMessage({
          conversationId,
          senderId: currentUser._id,
          content: trimmed,
          ...(replyingTo ? { replyToId: replyingTo._id } : {}),
          ...(attachment ? { attachment } : {}),
        });
        setContent("");
        setPending(null);
        onCancelReply();
        onSent();
      }
    } catch (e) {
      setSendError(errorMessage(e, "Failed to send message."));
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      if (editing) {
        onCancelEdit();
        setContent("");
      } else if (replyingTo) onCancelReply();
      return;
    }
    // On touch keyboards Enter should insert a newline; the send button sends
    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    if (e.key === "Enter" && !e.shiftKey && !isTouch) {
      e.preventDefault();
      handleSend();
    }
  };

  const insertEmoji = (emoji: string) => {
    const el = textareaRef.current;
    if (!el) return setContent((c) => c + emoji);
    const start = el.selectionStart ?? content.length;
    const end = el.selectionEnd ?? content.length;
    const next = content.slice(0, start) + emoji + content.slice(end);
    setContent(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  const canSend = (content.trim().length > 0 || !!pending) && !isSending;
  const showMic = !canSend && !editing && voice.supported && !isSending;

  /* ───────── Recording UI replaces the composer while active ───────── */
  if (voice.state === "recording") {
    return (
      <div className="border-t border-line bg-surface/90 px-3 pt-3 pb-safe backdrop-blur sm:px-4">
        <div className="flex items-center gap-3 rounded-2xl border border-line bg-subtle px-3 py-2">
          <button onClick={voice.cancel} className="icon-btn text-danger hover:text-danger" aria-label="Discard recording">
            <Trash2 className="h-5 w-5" />
          </button>
          <span className="h-2.5 w-2.5 animate-rec-pulse rounded-full bg-danger" aria-hidden />
          <span className="flex-1 text-sm font-medium tabular-nums text-fg" aria-live="off">
            Recording… {formatDuration(voice.elapsedMs)}
          </span>
          <button
            onClick={voice.stop}
            className="bg-brand flex h-10 w-10 items-center justify-center rounded-full text-white shadow-glow transition active:scale-90"
            aria-label="Finish recording"
          >
            <Check className="h-5 w-5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative border-t border-line bg-surface/90 px-3 pt-2.5 pb-safe backdrop-blur sm:px-4">
      {/* Reply / edit context bar */}
      {(replyingTo || editing) && (
        <div className="mb-2 flex animate-pop-in items-center gap-3 rounded-xl border border-line bg-subtle px-3 py-2">
          {editing ? (
            <Pencil className="h-4 w-4 shrink-0 text-accent" />
          ) : (
            <Reply className="h-4 w-4 shrink-0 text-accent" />
          )}
          <div className="min-w-0 flex-1 border-l-2 border-accent pl-2.5">
            <p className="text-xs font-semibold text-accent">
              {editing ? "Editing message" : `Replying to ${replyingTo?.sender?.name ?? "message"}`}
            </p>
            <p className="truncate text-xs text-muted">
              {previewMessage(editing ?? replyingTo!)}
            </p>
          </div>
          <button
            onClick={() => {
              if (editing) {
                onCancelEdit();
                setContent("");
              } else onCancelReply();
            }}
            className="icon-btn h-7 w-7"
            aria-label={editing ? "Cancel edit" : "Cancel reply"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Pending attachment chip */}
      {pending && (
        <div className="mb-2 flex animate-pop-in items-center gap-3 rounded-xl border border-line bg-subtle p-2">
          {pending.previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pending.previewUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface text-accent">
              {pending.kind === "audio" ? <Mic className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-fg">{pending.name}</p>
            <p className="text-xs text-muted">
              {pending.kind === "audio" && pending.durationMs
                ? `${formatDuration(pending.durationMs)} · `
                : ""}
              {formatBytes(pending.file.size)}
            </p>
          </div>
          <button onClick={() => setPending(null)} className="icon-btn h-8 w-8" aria-label="Remove attachment">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {(sendError || voice.error) && (
        <div role="alert" className="mb-2 flex items-center justify-between rounded-xl bg-danger/10 px-3 py-2">
          <p className="text-xs font-medium text-danger">{sendError ?? voice.error}</p>
          {sendError && (
            <button onClick={handleSend} className="text-xs font-semibold text-danger underline-offset-2 hover:underline">
              Retry
            </button>
          )}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        {/* Attachment menu */}
        {!editing && (
          <div className="relative" ref={attachRef}>
            <button
              onClick={() => {
                setShowAttach((s) => !s);
                setShowEmoji(false);
              }}
              className={cn("icon-btn h-11 w-11", showAttach && "bg-subtle text-fg")}
              aria-label="Attach a file"
              aria-haspopup="menu"
              aria-expanded={showAttach}
            >
              <Paperclip className="h-5 w-5" />
            </button>
            {showAttach && (
              <div
                role="menu"
                className="absolute bottom-full left-0 z-30 mb-2 w-48 animate-pop-in rounded-2xl border border-line bg-elevated p-1.5 shadow-pop"
              >
                <button
                  role="menuitem"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-subtle"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <ImageIcon className="h-4 w-4" />
                  </span>
                  Photo
                </button>
                <button
                  role="menuitem"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-subtle"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet/15 text-violet">
                    <FileText className="h-4 w-4" />
                  </span>
                  Document
                </button>
              </div>
            )}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                pickFile(e.target.files?.[0], "image");
                e.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              hidden
              onChange={(e) => {
                pickFile(e.target.files?.[0], "file");
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Text field with inline emoji button */}
        <div className="relative min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              if (!editing) handleTyping();
            }}
            onKeyDown={handleKeyDown}
            placeholder={editing ? "Edit your message…" : pending ? "Add a caption…" : "Write a message…"}
            aria-label="Message"
            rows={1}
            maxLength={MAX_CHARS + 200}
            className="max-h-36 min-h-[44px] w-full resize-none rounded-2xl border border-line bg-subtle py-[11px] pl-4 pr-11 text-[15px] leading-snug text-fg placeholder:text-muted transition-colors scrollbar-hide focus:border-accent/60 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            onClick={() => {
              setShowEmoji((s) => !s);
              setShowAttach(false);
            }}
            className={cn(
              "absolute bottom-1 right-1 flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:text-fg",
              showEmoji && "text-accent"
            )}
            aria-label="Emoji picker"
            aria-expanded={showEmoji}
          >
            <Smile className="h-5 w-5" />
          </button>
          {showEmoji && (
            <EmojiPicker
              onPick={insertEmoji}
              onClose={() => setShowEmoji(false)}
              className="absolute bottom-full right-0 z-30 mb-2"
            />
          )}
        </div>

        {/* Mic ⇄ Send */}
        <div className="relative h-11 w-11 shrink-0">
          <button
            onClick={handleSend}
            disabled={!canSend && !editing}
            aria-label={editing ? "Save edit" : "Send message"}
            className={cn(
              "bg-brand absolute inset-0 flex items-center justify-center rounded-full text-white shadow-glow transition-all duration-200 active:scale-90",
              canSend || editing
                ? "scale-100 opacity-100"
                : "pointer-events-none scale-75 opacity-0"
            )}
          >
            {isSending ? <Spinner className="h-5 w-5" /> : editing ? <Check className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" strokeWidth={2.5} />}
          </button>
          <button
            onClick={voice.start}
            aria-label="Record a voice message"
            tabIndex={showMic ? 0 : -1}
            className={cn(
              "absolute inset-0 flex items-center justify-center rounded-full bg-subtle text-fg transition-all duration-200 hover:bg-line active:scale-90",
              showMic ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"
            )}
          >
            <Mic className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p className="mt-1.5 hidden px-1 text-[11px] text-muted [@media(pointer:fine)]:block">
        <kbd className="font-sans font-medium">Enter</kbd> to send ·{" "}
        <kbd className="font-sans font-medium">Shift + Enter</kbd> for a new line
      </p>
    </div>
  );
}

/* ───────── Voice recording (MediaRecorder, no dependencies) ───────── */
function useVoiceRecorder(onFinished: (blob: Blob, durationMs: number, mimeType: string) => void) {
  const [state, setState] = useState<"idle" | "recording">("idle");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const discardRef = useRef(false);
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof MediaRecorder !== "undefined"
    );
  }, []);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setState("idle");
    setElapsedMs(0);
  }, []);

  useEffect(() => {
    return () => {
      discardRef.current = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      cleanup();
    };
  }, [cleanup]);

  const start = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType =
        ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((t) =>
          MediaRecorder.isTypeSupported(t)
        ) ?? "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      discardRef.current = false;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const duration = Date.now() - startedAtRef.current;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const keep = !discardRef.current && blob.size > 0 && duration > 500;
        cleanup();
        if (keep) onFinishedRef.current(blob, duration, type.split(";")[0]);
      };

      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      recorder.start();
      setState("recording");
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startedAtRef.current;
        setElapsedMs(elapsed);
        if (elapsed >= 5 * 60_000) recorder.stop(); // hard cap keeps files under the 10 MB limit
      }, 200);
    } catch (e) {
      cleanup();
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow it in your browser settings to send voice messages."
          : "Couldn't start recording on this device."
      );
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    discardRef.current = false;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const cancel = useCallback(() => {
    discardRef.current = true;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else cleanup();
  }, [cleanup]);

  return { state, elapsedMs, error, supported, start, stop, cancel };
}
