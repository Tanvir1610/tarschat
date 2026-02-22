"use client";

import { useState, useRef, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id, Doc } from "@/convex/_generated/dataModel";
import { Send } from "lucide-react";

interface MessageInputProps {
  conversationId: Id<"conversations">;
  currentUser: Doc<"users">;
}

export function MessageInput({ conversationId, currentUser }: MessageInputProps) {
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const sendMessage = useMutation(api.messages.sendMessage);
  const setTyping = useMutation(api.typing.setTyping);

  const handleTyping = useCallback(() => {
    setTyping({
      userId: currentUser._id,
      conversationId,
      isTyping: true,
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setTyping({
        userId: currentUser._id,
        conversationId,
        isTyping: false,
      });
    }, 2000);
  }, [currentUser._id, conversationId, setTyping]);

  const handleSend = async () => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setSendError(false);
    setIsSending(true);

    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setTyping({ userId: currentUser._id, conversationId, isTyping: false });

    try {
      await sendMessage({
        conversationId,
        senderId: currentUser._id,
        content: trimmed,
      });
      setContent("");
    } catch {
      setSendError(true);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="px-4 py-3 bg-white border-t border-gray-200">
      {sendError && (
        <div className="flex items-center justify-between mb-2 px-3 py-2 bg-red-50 rounded-lg">
          <p className="text-xs text-red-600">Failed to send message.</p>
          <button
            onClick={() => {
              setSendError(false);
              handleSend();
            }}
            className="text-xs text-red-600 font-semibold hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      <div className="flex items-end gap-3">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            handleTyping();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          className="flex-1 resize-none bg-gray-100 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all max-h-32 overflow-y-auto scrollbar-hide"
          style={{ minHeight: "44px" }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = "auto";
            target.style.height = `${Math.min(target.scrollHeight, 128)}px`;
          }}
        />
        <button
          onClick={handleSend}
          disabled={!content.trim() || isSending}
          className="w-11 h-11 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0 shadow-md"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-1.5 ml-1">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
